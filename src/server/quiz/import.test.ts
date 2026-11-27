import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildQuizSchema } from '../../types/schema';
import { positive } from '../config';
import { importQuiz, ImportFailure } from './import';
import { validateQuiz } from './validate';

let dataDir: string;
let photo: Buffer;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'qb-test-'));
  mkdirSync(join(dataDir, 'img'));
  photo = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#d55e00' } })
    .jpeg()
    .toBuffer();
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const base = () => ({
  title: 'Test',
  questions: [{ type: 'mcsa', text: 'Was?', answer: { options: ['a', 'b'], correct: 1 } }] as any[],
});
const zip = (files: Record<string, Uint8Array>) => Buffer.from(zipSync(files));
const json = (o: unknown) => Buffer.from(JSON.stringify(o));
const failure = async (p: Promise<unknown>): Promise<ImportFailure> => {
  try {
    await p;
  } catch (err) {
    if (err instanceof ImportFailure) return err;
    throw err;
  }
  throw new Error('Import hätte scheitern müssen');
};

describe('validateQuiz', () => {
  it('akzeptiert ein minimales Quiz', () => {
    expect(validateQuiz(base())).toEqual([]);
  });

  it('meldet fehlende und unbekannte Felder mit Fundstelle', () => {
    const q = base();
    delete q.questions[0].text;
    q.questions[0].zeit = 10;
    const errors = validateQuiz(q);
    expect(errors).toContainEqual({ path: 'Frage 1 (mcsa)', message: 'Das Feld „text“ fehlt.' });
    expect(errors).toContainEqual({ path: 'Frage 1 (mcsa)', message: 'Das Feld „zeit“ ist hier nicht bekannt (Tippfehler?).' });
  });

  it('meldet falsche Typen und Wertebereiche im answer-Objekt', () => {
    const q = base();
    q.questions[0].answer = { options: ['nur eine'], correct: 'a' };
    q.questions[0].time = 2;
    const errors = validateQuiz(q);
    expect(errors).toContainEqual({ path: 'Frage 1 (mcsa) · answer.options', message: 'Die Liste braucht mindestens 2 Einträge.' });
    expect(errors).toContainEqual({ path: 'Frage 1 (mcsa) · answer.correct', message: 'Hier wird eine ganze Zahl erwartet.' });
    expect(errors).toContainEqual({ path: 'Frage 1 (mcsa) · time', message: 'Der Wert muss mindestens 5 sein.' });
  });

  it('prüft inhaltlich: Index der Lösung, doppelte Kennungen, unbekannter Typ', () => {
    const q = base();
    q.questions[0].answer.correct = 5;
    q.questions[0].id = 'x';
    q.questions.push({ id: 'x', type: 'mcsa', text: 'Noch eine?', answer: { options: ['a', 'b'], correct: 0 } });
    const errors = validateQuiz(q);
    expect(errors.map((e) => e.path)).toEqual(['Frage 1 (mcsa)', 'Frage 2 (mcsa) · id']);
    expect(errors[0].message).toContain('nur 2 Optionen');

    const unknown = base();
    unknown.questions[0].type = 'quizshow';
    expect(validateQuiz(unknown)[0].message).toMatch(/^Erlaubt sind nur: mcsa/);
  });

  it('prüft die Siegerreihenfolge in den Einstellungen', () => {
    const q: any = base();
    q.settings = { ranking: { reveal: [3, 3, 0] } };
    const messages = validateQuiz(q).map((e) => `${e.path}: ${e.message}`);
    expect(messages).toContain('settings.ranking.reveal: Die Liste enthält einen Eintrag doppelt.');
    expect(messages).toContain('settings.ranking.reveal[2]: Der Wert muss mindestens 1 sein.');
  });
});

describe('Konfiguration', () => {
  it('fällt bei leeren oder unsinnigen Zahlen auf den Standardwert zurück', () => {
    expect(positive(undefined, 40)).toBe(40);
    expect(positive('', 40)).toBe(40);
    expect(positive('  ', 40)).toBe(40);
    expect(positive('40MB', 40)).toBe(40);
    expect(positive('0', 40)).toBe(40);
    expect(positive('-5', 40)).toBe(40);
    expect(positive('25', 40)).toBe(25);
  });
});

describe('Schema-Datei', () => {
  it('schema/quiz.schema.json ist aktuell (sonst: npm run build:schema)', () => {
    const onDisk = JSON.parse(readFileSync('schema/quiz.schema.json', 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildQuizSchema())));
  });

  it('das Beispiel-Quiz ist gültig', () => {
    expect(validateQuiz(JSON.parse(readFileSync('schema/beispiel-quiz.json', 'utf8')))).toEqual([]);
  });
});

describe('importQuiz', () => {
  it('importiert reines JSON und ergänzt Standardwerte', async () => {
    const { quiz } = await importQuiz(json(base()), { dataDir });
    expect(quiz.questions[0]).toMatchObject({ id: 'q1', time: 20, points: 1000 });
    expect(quiz.settings.ranking.reveal).toEqual([3, 2, 1]);
    expect(quiz.settings.phone.showQuestion).toBe(true);
  });

  it('verarbeitet Bilder aus dem ZIP: max. 1280 px, WebP, Dateiname = Hash, keine Dubletten', async () => {
    const q = base();
    q.questions[0].image = 'img/Foto.JPG';
    q.questions.push({ type: 'mcsa', text: 'Zwei?', image: './img/foto.jpg', answer: { options: ['a', 'b'], correct: 0 } });
    // Ordner gezippt statt Inhalt: quiz.json liegt eine Ebene tiefer
    const body = zip({ 'mein-quiz/quiz.json': strToU8(JSON.stringify(q)), 'mein-quiz/img/foto.jpg': photo, 'mein-quiz/img/rest.png': photo });
    const { quiz, warnings } = await importQuiz(body, { dataDir });
    const image = quiz.questions[0].image!;
    expect(image).toMatchObject({ w: 1280, h: 640 });
    expect(image.src).toMatch(/^\/img\/[a-f0-9]{32}\.webp$/);
    expect(quiz.questions[1].image).toEqual(image);
    expect(readdirSync(join(dataDir, 'img'))).toEqual([image.src.slice(5)]);
    // aus dem Speicher lesen: sharp hält Dateien unter Windows sonst geöffnet
    const meta = await sharp(readFileSync(join(dataDir, image.src))).metadata();
    expect(meta.format).toBe('webp');
    expect(warnings[0]).toContain('img/rest.png');
  });

  it('erklärt fehlende Bilder, kaputte Bilder und Pfade ohne ZIP', async () => {
    const q = base();
    q.questions[0].image = 'img/fehlt.jpg';
    const missing = await failure(importQuiz(zip({ 'quiz.json': strToU8(JSON.stringify(q)) }), { dataDir }));
    expect(missing.errors[0]).toEqual({ path: 'Frage 1 (mcsa) · image', message: 'Das Bild „img/fehlt.jpg“ fehlt im ZIP.' });

    const broken = await failure(
      importQuiz(zip({ 'quiz.json': strToU8(JSON.stringify(q)), 'img/fehlt.jpg': strToU8('kein Bild') }), { dataDir }),
    );
    expect(broken.errors[0].message).toContain('ist kein verwendbares Bild');

    const noZip = await failure(importQuiz(json(q), { dataDir }));
    expect(noZip.errors[0].message).toContain('Bildpfade funktionieren nur im ZIP');
  });

  it('lehnt Bild-URLs ins interne Netz ab', async () => {
    const q = base();
    q.questions[0].image = 'http://127.0.0.1/geheim.png';
    const err = await failure(importQuiz(json(q), { dataDir }));
    expect(err.errors[0].message).toContain('internen Netz');
  });

  it('lädt Bild-URLs mit begrenzter Parallelität und hält die Reihenfolge der Fragen', async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#0072b2' } })
      .png()
      .toBuffer();
    let active = 0;
    let most = 0;
    const server = createServer((req, res) => {
      active++;
      most = Math.max(most, active);
      setTimeout(() => {
        active--;
        if (req.url?.includes('n=3')) return void res.writeHead(404).end();
        res.writeHead(200, { 'content-type': 'image/png' }).end(png);
      }, 50);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as AddressInfo).port;
    try {
      const q = base();
      q.questions = Array.from({ length: 12 }, (_, i) => ({
        type: 'mcsa',
        text: `Frage ${i}?`,
        image: `http://127.0.0.1:${port}/bild.png?n=${i}`,
        answer: { options: ['a', 'b'], correct: 0 },
      }));
      const err = await failure(importQuiz(json(q), { dataDir, allowPrivateUrls: true }));
      // genau die eine kaputte Adresse wird gemeldet, mit der richtigen Frage
      expect(err.errors).toEqual([{ path: 'Frage 4 (mcsa) · image', message: 'Das Bild konnte nicht geladen werden: der Server antwortet mit Status 404.' }]);
      expect(most).toBeGreaterThan(1);
      expect(most).toBeLessThanOrEqual(4);

      q.questions.splice(3, 1);
      const { quiz } = await importQuiz(json(q), { dataDir, allowPrivateUrls: true });
      expect(quiz.questions.map((x) => x.text)).toEqual(q.questions.map((x: any) => x.text));
      expect(quiz.questions.every((x) => x.image?.w === 40)).toBe(true);
    } finally {
      server.close();
    }
  });

  it('lässt sich von einem ZIP mit gelogener Größenangabe nicht aufblähen', async () => {
    const q = base();
    q.questions[0].image = 'img/bombe.png';
    const zeros = new Uint8Array(8 * 1024 * 1024); // komprimiert wenige Kilobyte
    const honest = zipSync({ 'quiz.json': strToU8(JSON.stringify(q)), 'img/bombe.png': zeros }, { level: 9 });
    expect(honest.length).toBeLessThan(64 * 1024);

    // Größenfelder (Dateikopf und Verzeichnis) auf 1000 Byte fälschen
    const lying = new Uint8Array(honest);
    const view = new DataView(lying.buffer);
    let patched = 0;
    for (let i = 0; i + 4 <= lying.length; i++) {
      if (view.getUint32(i, true) === zeros.length) {
        view.setUint32(i, 1000, true);
        patched++;
      }
    }
    expect(patched).toBe(2);
    // Entpackt wird höchstens die angegebene Größe; übrig bleibt ein kaputtes „Bild“, kein Speicherfresser
    const before = process.memoryUsage().rss;
    const err = await failure(importQuiz(Buffer.from(lying), { dataDir }));
    expect(err.errors[0].message).toContain('kein verwendbares Bild');
    expect(process.memoryUsage().rss - before).toBeLessThan(6 * 1024 * 1024);
  });

  it('lehnt ZIPs ab, die entpackt über der Grenze liegen, und Dateitypen außerhalb der Liste', async () => {
    const q = base();
    q.questions[0].image = 'img/gross.png';
    const big = zipSync({ 'quiz.json': strToU8(JSON.stringify(q)), 'img/gross.png': new Uint8Array(101 * 1024 * 1024) }, { level: 1 });
    expect((await failure(importQuiz(Buffer.from(big), { dataDir }))).message).toContain('zu groß');

    q.questions[0].image = 'img/plan.svg';
    const svg = zip({ 'quiz.json': strToU8(JSON.stringify(q)), 'img/plan.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    expect((await failure(importQuiz(svg, { dataDir }))).errors[0].message).toContain('Dateityp, der nicht unterstützt wird');
  });

  it('meldet kaputtes JSON, fehlende quiz.json und Schemafehler', async () => {
    expect((await failure(importQuiz(Buffer.from('{ "title": '), { dataDir }))).message).toBe('quiz.json ist kein gültiges JSON.');
    expect((await failure(importQuiz(zip({ 'readme.txt': strToU8('hi') }), { dataDir }))).message).toBe('Im ZIP fehlt die Datei quiz.json.');
    const err = await failure(importQuiz(json({ title: 'x', questions: [] }), { dataDir }));
    expect(err.message).toBe('Das Quiz hat einen Fehler.');
    expect(err.errors[0]).toEqual({ path: 'questions', message: 'Die Liste braucht mindestens 1 Einträge.' });
  });
});
