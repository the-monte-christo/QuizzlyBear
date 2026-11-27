// Misst, ob die Figuren-Animationen den Host-Screen ausbremsen: Bildabstände per requestAnimationFrame
// in der Lobby (dort winkt Quizzly), einmal mit laufender Animation, einmal angehalten.
// Zusätzlich landen Einzelaufnahmen der Figur in screenshots/anim, um die Bildfolge zu prüfen.
//
//   npm run dev   (zweites Terminal), dann:   node scripts/measure-anim.mjs [--base http://localhost:5173] [--4k]
//
// Hinweis: Headless-Edge rendert ohne Grafikkarte (Software). Die absoluten Zahlen sind deshalb
// schlechter als auf einem echten Gerät; aussagekräftig ist der Vergleich „mit“ gegen „ohne“.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:5173');
const UHD = process.argv.includes('--4k');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: UHD ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 } })).newPage();
await page.goto(`${BASE}/admin/`);
await page.fill('input[autocomplete="username"]', 'demo');
await page.fill('input[type="password"]', 'demodemo');
await page.click('button:has-text("Anmelden")');
await page.locator('.item:has(button:has-text("Spiel starten"))').first().locator('button:has-text("Spiel starten")').click();
await page.waitForSelector('.pin .digit');
await page.waitForSelector('.lobby .sprite img');
await page.waitForFunction(() => document.querySelector('.lobby .sprite img')?.complete);
await page.waitForTimeout(1500);

const measure = (ms) =>
  page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        const start = last;
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(tick);
          else {
            gaps.shift();
            gaps.sort((a, b) => a - b);
            const sum = gaps.reduce((a, b) => a + b, 0);
            resolve({
              frames: gaps.length,
              fps: Number((1000 / (sum / gaps.length)).toFixed(1)),
              median: Number(gaps[gaps.length >> 1].toFixed(1)),
              p95: Number(gaps[Math.floor(gaps.length * 0.95)].toFixed(1)),
              max: Number(gaps[gaps.length - 1].toFixed(1)),
              over25ms: gaps.filter((g) => g > 25).length,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

const running = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'sprite-16').length);
const withAnim = await measure(5000);

// Bildfolge festhalten: acht Aufnahmen im Abstand von rund 110 ms
await mkdir('screenshots/anim', { recursive: true });
// Ausschnitt statt Element-Screenshot: Die Figur schwebt, Playwright würde auf Stillstand warten
const box = await page.locator('.lobby .sprite').first().boundingBox();
const clip = { x: box.x - 20, y: box.y - 30, width: box.width + 40, height: box.height + 60 };
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `screenshots/anim/frame-${i}.png`, clip });
  await page.waitForTimeout(110);
}

await page.addStyleTag({ content: '.frames { animation: none !important; }' });
await page.waitForTimeout(500);
const withoutAnim = await measure(5000);

console.log(`Auflösung ${UHD ? '3840x2160' : '1920x1080'}, laufende Figuren-Animationen: ${running}`);
console.log('mit Animation :', JSON.stringify(withAnim));
console.log('ohne Animation:', JSON.stringify(withoutAnim));
await browser.close();
