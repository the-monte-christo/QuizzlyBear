// Tests der Härtung: keine Dekompression fremder Daten, Bild-Abruf, Anmeldung, Obergrenzen.
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Quiz } from '../shared/quiz';
import { createApp } from './app';
import { hashPassword } from './auth';
import { openDb, type Db } from './db';
import { Game } from './game/game';
import { GameManager, MAX_GAMES_PER_OWNER } from './game/manager';
import { fetchImage, isPrivateAddress, sniffFormat, storeImage } from './quiz/images';
import { nodeStatus } from './runtime';
import { bucket } from './sockets';

const quiz: Quiz = {
  title: 'Test',
  description: '',
  settings: structuredClone(DEFAULT_SETTINGS),
  questions: [{ id: 'a', type: 'mcsa', text: 'Eins?', time: 10, points: 1000, answer: { options: ['x', 'y'], correct: 0 } }],
};

let dataDir: string;
let db: Db;
let games: GameManager;
let api: Server;
let base: string;

const listen = (server: Server) => new Promise<number>((done) => server.listen(0, '127.0.0.1', () => done((server.address() as AddressInfo).port)));

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'qb-hard-'));
  mkdirSync(join(dataDir, 'img'), { recursive: true });
  db = openDb(dataDir);
  db.addUser('chef', hashPassword('geheim-geheim'), true);
  games = new GameManager(() => ({ host() {}, player() {} }));
  api = createServer(createApp({ db, games, schemaDir: 'schema' }));
  base = `http://127.0.0.1:${await listen(api)}`;
});
afterAll(() => {
  api.close();
  db.close();
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const post = (path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });
const login = async (password = 'geheim-geheim') => {
  const res = await post('/api/auth/login', JSON.stringify({ name: 'chef', password }));
  return { res, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
};

describe('komprimierte Anfragen (CVE-2026-111497)', () => {
  const body = JSON.stringify({ name: 'chef', password: 'geheim-geheim' });

  it('lehnt Brotli-, gzip- und deflate-Anfragen ab, statt sie auszupacken', async () => {
    for (const [encoding, data] of [
      ['br', brotliCompressSync(body)],
      ['gzip', gzipSync(body)],
      ['deflate', gzipSync(body)],
    ] as const) {
      const res = await post('/api/auth/login', data, { 'Content-Encoding': encoding });
      expect(res.status, encoding).toBe(415);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('lehnt sie auch beim Quiz-Upload ab', async () => {
    const { cookie } = await login();
    const res = await post('/api/quizzes', brotliCompressSync('{}'), { 'Content-Encoding': 'br', Cookie: cookie });
    expect(res.status).toBe(415);
  });

  it('nimmt dieselbe Anfrage unkomprimiert an', async () => {
    expect((await login()).res.status).toBe(200);
  });
});

describe('Anmeldung und Sitzungen', () => {
  it('antwortet bei unbekanntem Namen und falschem Passwort gleich', async () => {
    const a = await post('/api/auth/login', JSON.stringify({ name: 'gibtsnicht', password: 'x' }));
    const b = await post('/api/auth/login', JSON.stringify({ name: 'chef', password: 'falsch' }));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
    for (const bad of [{ name: 5, password: [] }, { name: 'chef' }, {}, { name: 'chef', password: 'x'.repeat(5000) }]) {
      expect((await post('/api/auth/login', JSON.stringify(bad))).status).toBe(401);
    }
  });

  it('lehnt fremde und unlesbare Herkunft ab', async () => {
    const body = JSON.stringify({ name: 'chef', password: 'geheim-geheim' });
    expect((await post('/api/auth/login', body, { Origin: 'https://boese.example' })).status).toBe(403);
    expect((await post('/api/auth/login', body, { Origin: 'null' })).status).toBe(403);
    expect((await post('/api/auth/login', body, { Origin: base })).status).toBe(200);
  });

  it('beendet beim Passwortwechsel alle alten Sitzungen', async () => {
    const old = await login();
    const second = await login();
    const change = await post('/api/auth/password', JSON.stringify({ current: 'geheim-geheim', next: 'neu-und-sicher' }), { Cookie: old.cookie });
    expect(change.status).toBe(200);
    const fresh = change.headers.get('set-cookie')?.split(';')[0] ?? '';
    const me = async (cookie: string) => (await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).json()).user;
    expect(await me(old.cookie)).toBeNull();
    expect(await me(second.cookie)).toBeNull();
    expect((await me(fresh))?.name).toBe('chef');
    // zurückstellen für die übrigen Tests
    await post('/api/auth/password', JSON.stringify({ current: 'neu-und-sicher', next: 'geheim-geheim' }), { Cookie: fresh });
  });

  it('setzt nosniff und schützt die Verwaltung vor Unangemeldeten', async () => {
    const res = await fetch(base + '/api/quizzes');
    expect(res.status).toBe(401);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await post('/api/games', JSON.stringify({ quizId: 1 }))).status).toBe(401);
    expect((await post('/api/quizzes', '{}')).status).toBe(401);
  });

  it('begrenzt die Zahl gleichzeitiger Spiele je Quizmaster', async () => {
    const { cookie } = await login();
    const id = db.addQuiz(db.userByName('chef')!.id, quiz);
    const codes: number[] = [];
    for (let i = 0; i < MAX_GAMES_PER_OWNER + 1; i++) {
      codes.push((await post('/api/games', JSON.stringify({ quizId: id }), { Cookie: cookie })).status);
    }
    expect(codes.slice(0, MAX_GAMES_PER_OWNER).every((c) => c === 201)).toBe(true);
    expect(codes[MAX_GAMES_PER_OWNER]).toBe(429);
  });
});

describe('Bild-Abruf', () => {
  let origin: string;
  let server: Server;
  let png: Buffer;
  let hits: string[] = [];

  beforeAll(async () => {
    png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#008f68' } })
      .png()
      .toBuffer();
    server = createServer((req, res) => {
      hits.push(`${req.url} ${req.headers['accept-encoding']}`);
      if (req.url === '/ok.png') return void res.writeHead(200, { 'content-type': 'image/png' }).end(png);
      if (req.url === '/br.png') return void res.writeHead(200, { 'content-type': 'image/png', 'content-encoding': 'br' }).end(brotliCompressSync(png));
      if (req.url === '/gzip.png') return void res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipSync(png));
      if (req.url === '/weiter') return void res.writeHead(302, { location: '/ok.png' }).end();
      if (req.url === '/kreis') return void res.writeHead(302, { location: '/kreis' }).end();
      if (req.url === '/riesig') return void res.writeHead(200, { 'content-length': String(30 * 1024 * 1024) }).end();
      if (req.url === '/langsam') return; // antwortet nie
      res.writeHead(404).end();
    });
    origin = `http://127.0.0.1:${await listen(server)}`;
  });
  afterAll(() => server.close());

  it('lädt unkomprimiert und folgt Weiterleitungen', async () => {
    hits = [];
    expect((await fetchImage(`${origin}/ok.png`, true)).equals(png)).toBe(true);
    expect((await fetchImage(`${origin}/weiter`, true)).equals(png)).toBe(true);
    // der Server wird ausdrücklich um eine unkomprimierte Antwort gebeten
    expect(hits.every((h) => h.endsWith(' identity'))).toBe(true);
  });

  it('nimmt komprimierte Antworten nicht an, statt sie zu dekodieren', async () => {
    await expect(fetchImage(`${origin}/br.png`, true)).rejects.toThrow('komprimierte Antwort');
    await expect(fetchImage(`${origin}/gzip.png`, true)).rejects.toThrow('komprimierte Antwort');
  });

  it('bricht bei Endlos-Weiterleitung, Übergröße und Trödeln ab', async () => {
    await expect(fetchImage(`${origin}/kreis`, true)).rejects.toThrow('zu viele Weiterleitungen');
    await expect(fetchImage(`${origin}/riesig`, true)).rejects.toThrow('größer als 20 MB');
    await expect(fetchImage(`${origin}/langsam`, true, 150)).rejects.toThrow('zu langsam');
    await expect(fetchImage(`${origin}/fehlt`, true)).rejects.toThrow('Status 404');
  });

  it('lehnt interne Ziele, fremde Ports, Zugangsdaten und andere Protokolle ab', async () => {
    for (const url of ['http://127.0.0.1/x.png', 'http://localhost/x.png', 'http://[::1]/x.png', 'http://10.1.2.3/x.png', 'http://169.254.169.254/latest/meta-data', 'http://[::ffff:192.168.1.1]/x.png']) {
      await expect(fetchImage(url), url).rejects.toThrow('internen Netz');
    }
    await expect(fetchImage(`${origin}/ok.png`)).rejects.toThrow('Standard-Ports');
    await expect(fetchImage('http://nutzer:pass@example.org/x.png')).rejects.toThrow('Zugangsdaten');
    await expect(fetchImage('ftp://example.org/x.png')).rejects.toThrow('http(s)');
    await expect(fetchImage('file:///etc/passwd')).rejects.toThrow('http(s)');
  });

  it('erkennt private und reservierte Adressen', () => {
    for (const ip of ['10.0.0.1', '172.16.5.5', '172.31.255.255', '192.168.10.111', '127.0.0.1', '0.0.0.0', '100.64.0.1', '169.254.1.1', '198.18.0.1', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2002:c0a8:1::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '192.169.1.1', '100.63.255.255', '2a00:1450:4001::200e', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('Bildformate', () => {
  it('lässt nur Formate mit bekannter Signatur an die Bildbibliothek', async () => {
    const img = sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } });
    expect(sniffFormat(await img.clone().jpeg().toBuffer())).toBe('jpeg');
    expect(sniffFormat(await img.clone().png().toBuffer())).toBe('png');
    expect(sniffFormat(await img.clone().webp().toBuffer())).toBe('webp');
    expect(sniffFormat(await img.clone().gif().toBuffer())).toBe('gif');
    expect(sniffFormat(await img.clone().avif().toBuffer())).toBe('avif');
    expect(sniffFormat(await img.clone().tiff().toBuffer())).toBeNull();

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="file:///etc/passwd"/></svg>');
    expect(sniffFormat(svg)).toBeNull();
    await expect(storeImage(svg, dataDir)).rejects.toThrow('kein unterstütztes Bildformat');
    await expect(storeImage(await img.clone().tiff().toBuffer(), dataDir)).rejects.toThrow('kein unterstütztes Bildformat');
    await expect(storeImage(Buffer.from('<html>'), dataDir)).rejects.toThrow('kein unterstütztes Bildformat');
  });
});

describe('Node-Laufzeit', () => {
  it('verlangt je Linie mindestens das letzte Sicherheits-Release', () => {
    for (const v of ['24.22.3', '24.22.4', '24.23.0', '22.23.5', '22.24.0', '26.13.1', '27.0.0', '28.1.0']) {
      expect(nodeStatus(v).ok, v).toBe(true);
    }
    // 24.14.0 und 24.22.0 enthalten die Brotli-Lücke; 20, 23 und 25 bekommen keine Korrekturen mehr
    for (const v of ['24.14.0', '24.22.0', '24.22.2', '22.23.3', '22.12.0', '26.12.1', '26.0.0', '20.19.0', '23.11.0', '25.2.0', '18.20.0']) {
      expect(nodeStatus(v).ok, v).toBe(false);
    }
    expect(nodeStatus('24.14.0').message).toContain('24.22.3');
  });
});

describe('Kontingente und Spieler', () => {
  it('begrenzt Nachrichten je Verbindung und füllt sich wieder auf', () => {
    let now = 0;
    const allow = bucket(2, 3, () => now);
    expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]);
    now += 500; // eine halbe Sekunde bei 2 pro Sekunde = ein neues Kontingent
    expect([allow(), allow()]).toEqual([true, false]);
    now += 60_000;
    expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]); // nie mehr als der Vorrat
  });

  it('entfernt Steuerzeichen aus Namen und prüft Schlüssel typsicher', () => {
    const game = new Game('123456', quiz, 1, 1, { host() {}, player() {} });
    const a = game.addPlayer('‮Anna\u0000​  B\t');
    if (!a.ok) throw new Error('join');
    expect(game.hostState().players[0].name).toBe('Anna B');
    expect(game.addPlayer('​‮').ok).toBe(false);
    expect(game.addPlayer({ toString: () => 'x' } as any).ok).toBe(false);
    expect(game.addPlayer('x'.repeat(5000)).ok).toBe(true);

    expect(game.authPlayer(a.id, a.token)).toBe(true);
    expect(game.authPlayer(a.id, a.token + 'x')).toBe(false);
    expect(game.authPlayer(a.id, undefined)).toBe(false);
    expect(game.authPlayer({} as any, a.token)).toBe(false);
    expect(game.authHost(game.hostKey)).toBe(true);
    expect(game.authHost('')).toBe(false);
    expect(game.authHost(['x'] as any)).toBe(false);
  });
});
