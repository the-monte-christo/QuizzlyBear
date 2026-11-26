import { resolve } from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  prod: env.NODE_ENV === 'production',
  /** SQLite-Datei und Bilder; im Container /data. */
  dataDir: resolve(env.DATA_DIR ?? './data'),
  /** Hinter nginx: X-Forwarded-* auswerten. */
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  /** Sicherheits-Header selbst senden (lokaler CSP-Test; produktiv macht das nginx). */
  securityHeaders: env.SECURITY_HEADERS === '1',
  /** Legt beim ersten Start einen Quizmaster mit Admin-Rechten an, wenn es noch keinen gibt. */
  adminUser: env.ADMIN_USER,
  adminPassword: env.ADMIN_PASSWORD,
  /** Obergrenze für Uploads (ZIP oder JSON). */
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 60) * 1024 * 1024,
};
