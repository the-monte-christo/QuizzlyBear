// Bildverarbeitung: alles wird auf höchstens 1280 px verkleinert und als WebP gespeichert.
// Der Dateiname ist der Hash des Ergebnisses – gleiche Bilder landen nur einmal auf der Platte.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ImageRef } from '../../shared/quiz';

export const MAX_EDGE = 1280;
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;
// Im Container zählt der Speicher mehr als das letzte bisschen Tempo
sharp.cache(false);
sharp.concurrency(1);

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif']);

export async function storeImage(input: Buffer, dataDir: string): Promise<ImageRef> {
  const img = sharp(input, { failOn: 'error', limitInputPixels: 60_000_000, animated: false });
  const meta = await img.metadata();
  if (!meta.format || !ALLOWED.has(meta.format)) throw new Error('kein unterstütztes Bildformat (JPEG, PNG, WebP, GIF, AVIF)');
  const out = await img
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

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224
  );
}

/**
 * Lädt ein Bild von einer http(s)-URL. Adressen im eigenen Netz werden abgelehnt,
 * damit der Server nicht als Sprungbrett auf interne Dienste taugt.
 */
export async function fetchImage(url: string, allowPrivate = false, timeoutMs = 15_000): Promise<Buffer> {
  let current = url;
  const until = Date.now() + timeoutMs; // gilt für das ganze Bild, auch über Weiterleitungen hinweg
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('nur http(s)-Adressen sind erlaubt');
    if (!allowPrivate) {
      const host = u.hostname.replace(/^\[|\]$/g, '');
      const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
      if (addrs.some((a) => isPrivate(a.address))) throw new Error('Adressen im internen Netz sind nicht erlaubt');
    }
    const res = await fetch(u, {
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.max(1, until - Date.now())),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; image-import)', Accept: 'image/*' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, u).href;
      continue;
    }
    if (!res.ok) throw new Error(`der Server antwortet mit Status ${res.status}`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_REMOTE_BYTES) throw new Error('das Bild ist größer als 20 MB');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_REMOTE_BYTES) throw new Error('das Bild ist größer als 20 MB');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
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
