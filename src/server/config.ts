import { resolve } from 'node:path';

const env = process.env;

/** Positive Zahl aus der Umgebung; leer, 0 oder Unsinn fällt auf den Standardwert zurück. */
export function positive(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: positive(env.PORT, 3000),
  prod: env.NODE_ENV === 'production',
  /** SQLite-Datei und Bilder; im Container /data. */
  dataDir: resolve(env.DATA_DIR ?? './data'),
  /** Hinter nginx: X-Forwarded-* auswerten. */
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  /** Öffentliche Adresse für QR-Code und Anzeige, z. B. https://quizzlybear.blanke.nrw */
  publicUrl: env.PUBLIC_URL?.replace(/\/$/, '') || undefined,
  /** Sicherheits-Header selbst senden (lokaler CSP-Test; produktiv macht das nginx). */
  securityHeaders: env.SECURITY_HEADERS === '1',
  /** Legt beim ersten Start einen Quizmaster mit Admin-Rechten an, wenn es noch keinen gibt. */
  adminUser: env.ADMIN_USER,
  adminPassword: env.ADMIN_PASSWORD,
  /** Bild-URLs aus dem internen Netz erlauben (nur für lokale Tests). */
  allowPrivateUrls: env.ALLOW_PRIVATE_URLS === '1',
  /** Obergrenze für Uploads (ZIP oder JSON). */
  maxUploadBytes: positive(env.MAX_UPLOAD_MB, 40) * 1024 * 1024,
};
