// Spielt eine komplette Runde im echten Browser durch (Edge, headless) und legt Screenshots ab.
// Dient als Ende-zu-Ende-Test und zur Sichtkontrolle von Host-Screen (4K) und Handy-App.
//
//   npm run dev            (in einem zweiten Terminal)
//   node scripts/playthrough.mjs [--base http://localhost:5173] [--quiz "Titel"] [--players 4] [--4k]
//
// Voraussetzung: `npm run seed` (Quizmaster demo / demodemo).
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:5173');
const QUIZ = arg('quiz', '');
const PLAYERS = Number(arg('players', 4));
const UHD = process.argv.includes('--4k');
const OUT = arg('out', 'screenshots');
const NAMES = ['Anna', 'Ben', 'Cleo', 'Dilara', 'Emil', 'Frieda', 'Gustav', 'Hanna', 'Ida', 'Jonas', 'Kira', 'Lukas'];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`));
};
let shot = 0;
const snap = async (page, name) => {
  const file = `${OUT}/${String(++shot).padStart(2, '0')}-${name}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  return file;
};

// ---- Quizmaster: anmelden, Spiel starten
const hostCtx = await browser.newContext({
  viewport: UHD ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 },
});
const host = await hostCtx.newPage();
watch(host, 'host');
await host.goto(`${BASE}/admin/`);
await host.fill('input[autocomplete="username"]', 'demo');
await host.fill('input[type="password"]', 'demodemo');
await host.click('button:has-text("Anmelden")');
await host.waitForSelector('text=Quizze');
await snap(host, 'admin');
const card = QUIZ ? host.locator('.item', { hasText: QUIZ }) : host.locator('.item').filter({ hasText: 'Spiel starten' }).first();
await card.locator('button:has-text("Spiel starten")').click();
await host.waitForSelector('.pin .digit');
const pin = (await host.locator('.pin').getAttribute('aria-label')).replace(/\D/g, '');
console.log('PIN', pin);

// ---- Spieler treten bei
const phones = [];
for (let i = 0; i < PLAYERS; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  watch(page, NAMES[i]);
  await page.goto(`${BASE}/?pin=${pin}`);
  if (i === 0) {
    await page.waitForTimeout(900);
    await snap(page, 'phone-join');
  }
  await page.fill('input[autocomplete="nickname"]', NAMES[i]);
  await page.click('button:has-text("Los geht")');
  await page.waitForSelector('text=Du bist dabei');
  phones.push(page);
}
await host.waitForTimeout(900);
await snap(host, 'host-lobby');
await snap(phones[0], 'phone-lobby');

// ---- Fragen durchspielen
const total = await host.evaluate(() => 0); // Platzhalter, Anzahl ergibt sich aus dem Ablauf
void total;
let q = 0;
for (;;) {
  q++;
  await host.keyboard.press('Space'); // starten bzw. nächste Frage
  await host.waitForSelector('.countdown .num');
  if (q === 1) {
    await host.waitForTimeout(700);
    await snap(host, 'host-countdown');
    await snap(phones[0], 'phone-countdown');
  }
  await host.waitForSelector('.q .head', { timeout: 8000 });
  const kind = (await host.locator('.q .kind').textContent()).trim();
  await host.waitForTimeout(900);
  await snap(host, `host-q${q}-frage`);
  await snap(phones[0], `phone-q${q}-frage`);

  // Jeder Spieler antwortet; die letzten lassen sich Zeit, einer ändert seine Antwort
  for (let i = 0; i < phones.length; i++) {
    const page = phones[i];
    const opts = page.locator('.grid .opt');
    const n = await opts.count();
    if (n > 0) {
      if (i === 1) {
        await opts.nth((q + 1) % n).click();
        await page.waitForTimeout(400);
      }
      // Spieler 0 antwortet stets wie der Fragenindex (trifft die Lösung der Demo-Fragen 1–4), der Rest gestreut
      await opts.nth(i === 0 ? (q - 1) % n : (q + i) % n).click();
    }
    if (i === 0) {
      await page.waitForTimeout(350);
      await snap(page, `phone-q${q}-gewaehlt`);
    }
    await page.waitForTimeout(250);
  }
  await host.waitForSelector('.q .stats', { timeout: 40_000 });
  await host.waitForTimeout(1600);
  await snap(host, `host-q${q}-aufloesung`);
  await snap(phones[0], `phone-q${q}-ergebnis`);
  if (phones[2]) await snap(phones[2], `phone-q${q}-ergebnis-c`);

  const label = (await host.locator('.btn.next').textContent()).trim();
  console.log(`Frage ${q} (${kind}) → ${label}`);
  await host.keyboard.press('Space');
  if (label.includes('Siegerehrung')) break;
  if (label.includes('Rangliste')) {
    await host.waitForSelector('.board');
    await host.waitForTimeout(400);
    if (q === 2) await snap(host, 'host-rangliste-vorher');
    await host.waitForTimeout(2200);
    await snap(host, `host-q${q}-rangliste`);
    if (q <= 2) await snap(phones[1], `phone-q${q}-platz`);
  }
}

// ---- Siegerehrung
await host.waitForSelector('.final');
await host.waitForTimeout(800);
await snap(host, 'host-final-0');
await snap(phones[0], 'phone-final-wartet');
for (let step = 1; step < 8; step++) {
  const next = host.locator('button.btn.next');
  if (!(await next.count())) break;
  await host.keyboard.press('Space');
  await host.waitForTimeout(1700);
  await snap(host, `host-final-${step}`);
}
await snap(phones[0], 'phone-final');
await snap(phones[phones.length - 1], 'phone-final-letzter');

await browser.close();
if (errors.length) {
  console.error('Fehler im Browser:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log('Durchlauf ohne Browser-Fehler.');
