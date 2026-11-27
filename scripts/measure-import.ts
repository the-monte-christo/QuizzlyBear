// Misst den Spitzen-Speicherbedarf des Quiz-Imports mit ungünstigen ZIPs – als Grundlage für das
// Speicherlimit des Containers (deploy/docker-compose.prod.yml).
//
//   npx tsx scripts/measure-import.ts            alle Fälle bauen und nacheinander messen
//   npx tsx scripts/measure-import.ts run <zip>  einen Fall in diesem Prozess messen (intern)
//
// Jeder Fall läuft in einem frischen Prozess, damit der Aufbau des ZIPs nicht mitgezählt wird.
// Gemessen wird die Resident Set Size (RSS): Das ist die Größe, die auch das Container-Limit zählt.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import sharp from 'sharp';

const MB = 1024 * 1024;

if (process.argv[2] === 'run') {
  const { importQuiz } = await import('../src/server/quiz/import');
  const dataDir = mkdtempSync(join(tmpdir(), 'qb-mem-'));
  mkdirSync(join(dataDir, 'img'));
  const body = readFileSync(process.argv[3]); // entspricht dem Upload-Puffer im Server
  const base = process.memoryUsage().rss;
  let peak = base;
  const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 10);
  const t0 = Date.now();
  let outcome = 'ok';
  try {
    const { quiz } = await importQuiz(body, { dataDir });
    outcome = `${quiz.questions.length} Fragen`;
  } catch (err) {
    outcome = `abgelehnt: ${(err as Error).message}`;
  }
  clearInterval(timer);
  peak = Math.max(peak, process.memoryUsage().rss);
  console.log(JSON.stringify({ zipMB: +(body.length / MB).toFixed(1), baseMB: Math.round(base / MB), peakMB: Math.round(peak / MB), seconds: +((Date.now() - t0) / 1000).toFixed(1), outcome }));
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5 });
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'qb-zips-'));
const quiz = (images: string[]) =>
  strToU8(JSON.stringify({ title: 'Speichertest', questions: images.map((image, i) => ({ type: 'mcsa', text: `Frage ${i + 1}?`, image, answer: { options: ['a', 'b'], correct: 0 } })) }));
const noise = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 60 } } });

const cases: Record<string, () => Promise<Uint8Array>> = {
  // viele große Fotos: nutzt das Upload-Limit (40 MB) fast aus
  'viele 12-MP-Fotos (JPEG)': async () => {
    const photo = await noise(4000, 3000).jpeg({ quality: 88 }).toBuffer();
    const count = Math.max(1, Math.floor((38 * MB) / photo.length));
    const files: Record<string, Uint8Array> = {};
    const names = Array.from({ length: count }, (_, i) => `img/foto-${i}.jpg`);
    // jede Datei leicht verändern, damit keine Dublette erkannt wird
    names.forEach((n, i) => (files[n] = Buffer.concat([photo, Buffer.from([i])])));
    files['quiz.json'] = quiz(names);
    return zipSync(files, { level: 0 });
  },
  // ein einzelnes Riesenbild knapp unter der Pixelgrenze
  'ein 59-MP-Foto (JPEG)': async () => {
    const photo = await noise(9400, 6266).jpeg({ quality: 60 }).toBuffer();
    return zipSync({ 'quiz.json': quiz(['img/riesig.jpg']), 'img/riesig.jpg': photo }, { level: 0 });
  },
  // einfarbiges PNG: winzige Datei, aber riesige Fläche (klassische Dekompressionsfalle)
  'ein 59-MP-PNG, einfarbig': async () => {
    const png = await sharp({ create: { width: 9400, height: 6266, channels: 3, background: '#d55e00' } }).png().toBuffer();
    return zipSync({ 'quiz.json': quiz(['img/flaeche.png']), 'img/flaeche.png': png });
  },
  // kleines ZIP, das beim Entpacken bis an die Grenze (100 MB) wächst: unkomprimierte PNGs mit
  // gleichförmigem Inhalt. Das ist der ungünstigste Fall, den die Grenzen noch zulassen.
  'kleines ZIP, entpackt knapp 100 MB': async () => {
    const png = await sharp({ create: { width: 3000, height: 2200, channels: 3, background: '#0072b2' } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const count = Math.max(1, Math.floor((97 * MB) / png.length));
    const files: Record<string, Uint8Array> = {};
    const names = Array.from({ length: count }, (_, i) => `img/roh-${i}.png`);
    names.forEach((n, i) => (files[n] = Buffer.concat([png, Buffer.from([i])])));
    files['quiz.json'] = quiz(names);
    return zipSync(files, { level: 6 });
  },
  // dasselbe mit 40 MB Ballast im Upload: Upload-Grenze und Entpack-Grenze zugleich ausgereizt
  '40-MB-Upload, entpackt knapp 100 MB': async () => {
    const png = await sharp({ create: { width: 3000, height: 2200, channels: 3, background: '#0072b2' } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const photo = await noise(4000, 3000).jpeg({ quality: 88 }).toBuffer();
    const files: Record<string, Uint8Array> = {};
    const names: string[] = [];
    for (let i = 0; (i + 1) * photo.length < 38 * MB; i++) {
      names.push(`img/foto-${i}.jpg`);
      files[names[i]] = Buffer.concat([photo, Buffer.from([i])]);
    }
    const rest = 97 * MB - names.length * photo.length;
    for (let i = 0; (i + 1) * png.length < rest; i++) {
      const n = `img/roh-${i}.png`;
      names.push(n);
      files[n] = Buffer.concat([png, Buffer.from([i])]);
    }
    files['quiz.json'] = quiz(names);
    return zipSync(files, { level: 6 });
  },
};

for (const [name, make] of Object.entries(cases)) {
  const file = join(dir, 'fall.zip');
  writeFileSync(file, await make());
  const out = execFileSync(process.execPath, ['--import', 'tsx', process.argv[1], 'run', file], { encoding: 'utf8' }).trim();
  console.log(`${name.padEnd(40)} ${out.split('\n').pop()}`);
}
rmSync(dir, { recursive: true, force: true });
