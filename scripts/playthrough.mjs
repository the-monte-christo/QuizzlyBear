// Spielt eine komplette Runde im echten Browser durch (Edge, headless) und legt Screenshots ab.
// Ende-zu-Ende-Test und Sichtkontrolle von Host-Screen und Handy-App in einem:
// Jeder Fragetyp wird wirklich bedient (tippen, sortieren, Regler ziehen, Punkt und Kreis setzen),
// ein Handy lädt mitten in einer Frage neu (Reconnect), eines ändert seine Antwort.
//
//   npm run dev            (in einem zweiten Terminal)
//   node scripts/playthrough.mjs [--base http://localhost:5173] [--quiz "Titel"] [--players 4] [--4k] [--out screenshots]
//
// Voraussetzung: `npm run seed` (Quizmaster demo / demodemo und das Demo-Quiz).
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:5173');
const QUIZ = arg('quiz', 'QuizzlyBear-Demo');
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
  await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
  return file;
};
const check = (ok, what) => {
  if (!ok) errors.push(`Prüfung fehlgeschlagen: ${what}`);
};

// ---- Quizmaster: anmelden, Spiel starten
const hostCtx = await browser.newContext({ viewport: UHD ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 } });
const host = await hostCtx.newPage();
watch(host, 'host');
await host.goto(`${BASE}/admin/`);
await host.fill('input[autocomplete="username"]', 'demo');
await host.fill('input[type="password"]', 'demodemo');
await host.click('button:has-text("Anmelden")');
await host.waitForSelector('h2:has-text("Quizze")');
await host.waitForTimeout(400);
await snap(host, 'admin');

// Koordinaten-Helfer: Bild laden, vier Ecken klicken, das JSON muss eine gültige Fläche sein
await host.click('summary:has-text("Koordinaten-Helfer")');
await host.setInputFiles('.helper input[type="file"]', 'examples/demo/img/sticker.jpg');
await host.waitForSelector('.helper .pad img');
await host.click('.helper button:has-text("Fläche")');
await host.locator('.helper .pad').scrollIntoViewIfNeeded();
await host.waitForTimeout(300);
const padBox = await host.locator('.helper .pad').boundingBox();
for (const [x, y] of [[0.1, 0.4], [0.23, 0.4], [0.23, 0.6], [0.1, 0.6]]) {
  await host.mouse.click(padBox.x + padBox.width * x, padBox.y + padBox.height * y);
}
const helperJson = JSON.parse(`{${await host.locator('.helper pre').textContent()}}`);
const corners = helperJson.answer?.area?.[0] ?? [];
check(corners.length === 4 && Math.abs(corners[0][0] - 0.1) < 0.01 && Math.abs(corners[2][1] - 0.6) < 0.01, 'Koordinaten-Helfer liefert die geklickte Fläche');
await snap(host, 'admin-helfer');
await host.evaluate(() => scrollTo(0, 0));
// nur Quiz-Karten haben den Start-Knopf (laufende Spiele stehen in derselben Liste darüber)
await host.locator('.item:has(button:has-text("Spiel starten"))', { hasText: QUIZ }).first().locator('button:has-text("Spiel starten")').click();
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
const finish = async (message) => {
  await browser.close();
  if (errors.length) {
    console.error('Fehler:\n' + [...new Set(errors)].join('\n'));
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
};
if (arg('until', '') === 'lobby') await finish('Bis zur Lobby gelaufen, ohne Fehler.');

// ---- Antworten je Fragetyp. Spieler 0 kennt die Lösungen des Demo-Quiz, die anderen streuen.
async function sortTo(page, texts) {
  for (let target = 0; target < texts.length; target++) {
    const rows = page.locator('.sort li');
    const all = await rows.allInnerTexts();
    const from = all.findIndex((t) => t.includes(texts[target]));
    if (from < 0) continue;
    await rows.nth(from).focus();
    for (let k = from; k > target; k--) await page.keyboard.press('ArrowUp');
  }
}

let estimates = 0; // die zweite Schätzfrage des Demo-Quiz fragt das Umfrage-Ergebnis ab (50 %)
async function answer(page, who, kind) {
  const smart = who === 0;
  if (await page.locator('.pad').count()) {
    const box = await page.locator('.pad').boundingBox();
    const isCircle = kind.includes('Kreis');
    const target = isCircle ? { x: 0.624, y: 0.198 } : { x: 0.622, y: 0.815 };
    const off = smart ? 0 : 0.09 * who;
    const px = box.x + box.width * Math.min(0.95, Math.max(0.05, target.x - off));
    const py = box.y + box.height * Math.min(0.95, Math.max(0.05, target.y + (isCircle ? off : -off)));
    await page.mouse.move(px, py);
    await page.mouse.down();
    if (isCircle) await page.mouse.move(px + box.width * (smart ? 0.1 : 0.16 + 0.05 * who), py, { steps: 5 });
    await page.mouse.up();
  } else if (await page.locator('.thumb').count()) {
    // der Zeitbalken hat auch eine .track – gemeint ist die Leiste mit den Griffen
    const track = await page.locator('.track:has(.thumb)').first().boundingBox();
    const thumbs = page.locator('.thumb');
    const drag = async (index, fraction) => {
      const t = await thumbs.nth(index).boundingBox();
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
      await page.mouse.down();
      await page.mouse.move(track.x + track.width * fraction, t.y + t.height / 2, { steps: 6 });
      await page.mouse.up();
    };
    if ((await thumbs.count()) === 1) await drag(0, smart ? (estimates >= 2 ? 0.5 : 0.71) : 0.25 + who * 0.17);
    else {
      await drag(0, smart ? 0.5 : 0.08 * who);
      await drag(1, smart ? 0.6 : 0.35 + 0.2 * who);
    }
  } else if (await page.locator('.sort').count()) {
    if (smart) await sortTo(page, kind.includes('Paare') ? ['Honig', 'Milch', 'Eier', 'Wolle'] : ['Biene', 'Hering', 'Fuchs', 'Grizzlybär']);
    else if (who % 2) {
      await page.locator('.sort li').first().focus();
      await page.keyboard.press('ArrowDown');
    }
  } else {
    const opts = page.locator('.grid .opt');
    const n = await opts.count();
    if (await page.locator('.bar').count()) {
      for (const i of smart ? [0, 2, 4] : [who % n, (who + 2) % n]) await opts.nth(i).click();
    } else {
      if (who === 2) {
        // erst falsch, dann umentscheiden: Die Antwort bleibt änderbar
        await opts.nth(n - 1).click();
        await page.waitForTimeout(300);
      }
      await opts.nth(smart ? 0 : who % n).click();
    }
  }
  const send = page.locator('.bar .send');
  if (await send.count()) await send.click();
}

// ---- Fragen durchspielen
for (let q = 1; ; q++) {
  await host.keyboard.press('Space'); // starten bzw. nächste Frage
  await host.waitForSelector('.countdown .num');
  if (q === 1) {
    await host.waitForTimeout(700);
    await snap(host, 'host-countdown');
    await snap(phones[0], 'phone-countdown');
  }
  await host.waitForSelector('.q .head', { timeout: 8000 });
  const kind = (await host.locator('.q .kind').textContent()).trim();
  const slug = kind.toLowerCase().replace(/[^a-zäöü]+/g, '-');
  await host.waitForTimeout(1000);
  await snap(host, `host-q${q}-${slug}`);
  await snap(phones[0], `phone-q${q}-${slug}`);

  if (q === 1) {
    // Host schaltet um: Frage nur auf dem großen Bildschirm, Antworten nur als Farbe + Symbol
    await host.click('button[aria-label="Einstellungen"]');
    const boxes = host.locator('.menu input[type="checkbox"]');
    await boxes.nth(0).uncheck();
    await boxes.nth(1).uncheck();
    await phones[0].waitForSelector('.look');
    // Die zweite Einstellung kommt über eine echte Netzwerkstrecke einen Moment später an als die erste
    await phones[0].locator('.grid .opt .text').first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    check((await phones[0].locator('.qtext').count()) === 0, 'Fragetext auf dem Handy ausgeblendet');
    check((await phones[0].locator('.grid .opt .text').count()) === 0, 'Antworttexte auf dem Handy ausgeblendet');
    check((await phones[0].locator('.grid .opt svg.shape').count()) > 1, 'Symbole bleiben sichtbar');
    await snap(phones[0], 'phone-nur-symbole');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await phones[0].waitForSelector('.qtext');
    await host.click('button[aria-label="Einstellungen"]');
  }

  for (let i = 0; i < phones.length; i++) {
    if (i === 0 && kind === 'Schätzfrage') estimates++;
    await answer(phones[i], i, kind);
    await phones[i].waitForTimeout(300);
    if (i === 0) await snap(phones[0], `phone-q${q}-${slug}-fertig`);
    if (q === 2 && i === 1) {
      // Reconnect mitten in der Frage: Seite neu laden, die Antwort muss wieder da sein
      await phones[1].reload();
      await phones[1].waitForSelector('.grid .opt', { timeout: 8000 });
      check((await phones[1].locator('.grid .opt.on').count()) === 1, 'Antwort nach Neuladen wiederhergestellt');
      check((await phones[1].locator('.timer').count()) === 1, 'Restzeit nach Neuladen sichtbar');
      await snap(phones[1], 'phone-reconnect');
    }
  }
  await host.waitForSelector('.q .stats', { timeout: 45_000 });
  await host.waitForTimeout(2600);
  await snap(host, `host-q${q}-${slug}-aufloesung`);
  await snap(phones[0], `phone-q${q}-${slug}-ergebnis`);
  // zweites Handy streut seine Antworten: zeigt die Reaktionen auf falsch und teilweise richtig
  if (phones[1]) await snap(phones[1], `phone-q${q}-${slug}-ergebnis-b`);

  const label = (await host.locator('.btn.next').textContent()).trim();
  console.log(`Frage ${q} (${kind}) → ${label}`);
  await host.keyboard.press('Space');
  if (label.includes('Siegerehrung')) break;
  if (label.includes('Rangliste')) {
    await host.waitForSelector('.board');
    await host.waitForTimeout(2600);
    if (q === 3 || q === 6) await snap(host, `host-q${q}-rangliste`);
    await snap(phones[1], `phone-q${q}-platz`);
    if (phones[2]) await snap(phones[2], `phone-q${q}-platz-c`);
  }
}

// ---- Siegerehrung
await host.waitForSelector('.final');
await host.waitForTimeout(800);
await snap(host, 'host-final-0');
await snap(phones[0], 'phone-final-wartet');
for (let step = 1; step < 12; step++) {
  if (!(await host.locator('button.btn.next').count())) break;
  await host.keyboard.press('Space');
  await host.waitForTimeout(1700);
  await snap(host, `host-final-${step}`);
}
await snap(phones[0], 'phone-final');
await snap(phones[phones.length - 1], 'phone-final-letzter');
check((await phones[0].locator('text=Platz 1').count()) === 1, 'Spieler mit allen richtigen Antworten gewinnt');

await finish('Durchlauf ohne Fehler.');
