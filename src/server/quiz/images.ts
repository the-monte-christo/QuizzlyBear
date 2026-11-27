// Bildverarbeitung: alles wird auf höchstens 1280 px verkleinert und als WebP gespeichert.
// Der Dateiname ist der Hash des Ergebnisses – gleiche Bilder landen nur einmal auf der Platte.
//
// Härtung:
// - Nur Formate mit bekannter Signatur gehen an libvips (kein SVG, TIFF, HEIF …).
// - Bild-URLs werden ohne automatische Dekompression geladen: Eine fremde Antwort erreicht nie
//   den Brotli-/zlib-Decoder von Node (CVE-2026-111497 „Node2Shell“).
// - Die Verbindung geht genau zu der Adresse, die vorher geprüft wurde (kein zweites DNS).
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ImageRef } from '../../shared/quiz';

export const MAX_EDGE = 1280;
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// Im Container zählt der Speicher mehr als das letzte bisschen Tempo
sharp.cache(false);
sharp.concurrency(1);

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif';

/** Erkennt das Format an den ersten Bytes. Alles andere wird gar nicht erst dekodiert. */
export function sniffFormat(b: Uint8Array): ImageFormat | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp' && (ascii(8, 12) === 'avif' || ascii(8, 12) === 'avis')) return 'avif';
  return null;
}

export async function storeImage(input: Buffer, dataDir: string): Promise<ImageRef> {
  if (!sniffFormat(input)) throw new Error('kein unterstütztes Bildformat (JPEG, PNG, WebP, GIF, AVIF)');
  const out = await sharp(input, { failOn: 'error', limitInputPixels: 60_000_000, animated: false })
    .rotate() // EXIF-Drehung anwenden
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  const hash = createHash('sha256').update(out.data).digest('hex').slice(0, 32);
  const file = join(dataDir, 'img', `${hash}.webp`);
  if (!existsSync(file)) await writeFile(file, out.data);
  return { src: `/img/${hash}.webp`, w: out.info.width, h: out.info.height };
}

/** Bereits verarbeitetes Bild wiederverwenden (z. B. beim Re-Import eines exportierten Quiz). */
export async function existingImage(url: string, dataDir: string): Promise<ImageRef | null> {
  const m = /\/img\/([a-f0-9]{32})\.webp$/.exec(url);
  if (!m) return null;
  const file = join(dataDir, 'img', `${m[1]}.webp`);
  if (!existsSync(file)) return null;
  const meta = await sharp(await readFile(file)).metadata(); // Puffer statt Pfad: keine offenen Datei-Handles
  return { src: `/img/${m[1]}.webp`, w: meta.width ?? 0, h: meta.height ?? 0 };
}

/** Adressen, die nicht ins öffentliche Internet zeigen (intern, lokal, reserviert, Übergangs-Präfixe). */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) {
      const rest = v.slice(7);
      if (isIP(rest) === 4) return isPrivateAddress(rest);
      return true; // hexadezimal geschriebene IPv4-Abbildung: im Zweifel ablehnen
    }
    return (
      v === '::1' ||
      v === '::' ||
      /^f[cd]/.test(v) || // fc00::/7 unique local
      /^fe[89ab]/.test(v) || // fe80::/10 link-local
      v.startsWith('ff') || // multicast
      v.startsWith('64:ff9b:') || // NAT64: bildet IPv4-Adressen ab
      v.startsWith('2002:') || // 6to4
      v.startsWith('2001:db8:') // Dokumentation
    );
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // Carrier-NAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

interface Target {
  address: string;
  family: number;
}

/** Löst den Host auf und lehnt interne Ziele ab. Zurück kommt die Adresse, zu der verbunden wird. */
async function vet(u: URL, allowPrivate: boolean): Promise<Target> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('nur http(s)-Adressen sind erlaubt');
  if (u.username || u.password) throw new Error('Adressen mit Zugangsdaten sind nicht erlaubt');
  if (!allowPrivate && u.port) throw new Error('nur die Standard-Ports 80 und 443 sind erlaubt');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host.includes('\0')) throw new Error('ungültige Adresse');
  const family = isIP(host);
  const addrs: Target[] = family ? [{ address: host, family }] : await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('der Server wurde nicht gefunden');
  if (!allowPrivate && addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Adressen im internen Netz sind nicht erlaubt');
  return addrs[0];
}

type Hop = { redirect: string } | { body: Buffer };

function request(u: URL, target: Target, until: number): Promise<Hop> {
  return new Promise((resolve, reject) => {
    // Namensauflösung überschreiben: verbunden wird genau mit der geprüften Adresse (kein Rebinding)
    const pinned: LookupFunction = (_host, options, cb) => {
      if (typeof options === 'object' && options.all) (cb as any)(null, [target]);
      else cb(null, target.address, target.family);
    };
    const req = (u.protocol === 'https:' ? https : http).request(
      u,
      {
        method: 'GET',
        lookup: pinned,
        agent: false,
        // identity: Die Antwort soll unkomprimiert kommen – und wird auch nie dekomprimiert
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; image-import)', Accept: 'image/*', 'Accept-Encoding': 'identity' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.destroy();
          return resolve({ redirect: location });
        }
        if (status !== 200) {
          res.destroy();
          return reject(new Error(`der Server antwortet mit Status ${status}`));
        }
        const encoding = String(res.headers['content-encoding'] ?? 'identity').toLowerCase();
        if (encoding !== 'identity') {
          res.destroy();
          return reject(new Error('der Server liefert eine komprimierte Antwort, das wird nicht angenommen'));
        }
        if (Number(res.headers['content-length'] ?? 0) > MAX_REMOTE_BYTES) {
          res.destroy();
          return reject(new Error('das Bild ist größer als 20 MB'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_REMOTE_BYTES) {
            res.destroy();
            reject(new Error('das Bild ist größer als 20 MB'));
          } else chunks.push(chunk);
        });
        res.on('end', () => resolve({ body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    const timer = setTimeout(() => req.destroy(new Error('der Server antwortet zu langsam')), Math.max(1, until - Date.now()));
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Lädt ein Bild von einer http(s)-URL. Adressen im eigenen Netz werden abgelehnt,
 * damit der Server nicht als Sprungbrett auf interne Dienste taugt.
 */
export async function fetchImage(url: string, allowPrivate = false, timeoutMs = 15_000): Promise<Buffer> {
  const until = Date.now() + timeoutMs; // gilt für das ganze Bild, auch über Weiterleitungen hinweg
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const result = await request(current, await vet(current, allowPrivate), until);
    if ('body' in result) return result.body;
    current = new URL(result.redirect, current); // jede Weiterleitung wird erneut geprüft
  }
  throw new Error('zu viele Weiterleitungen');
}

/** Löscht Bilder, die kein Quiz mehr verwendet. */
export async function removeUnusedImages(dataDir: string, used: Set<string>): Promise<number> {
  const dir = join(dataDir, 'img');
  let removed = 0;
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.webp') || used.has(`/img/${name}`)) continue;
    await unlink(join(dir, name)).catch(() => {});
    removed++;
  }
  return removed;
}
