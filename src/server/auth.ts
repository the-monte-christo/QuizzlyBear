// Quizmaster-Login: scrypt-Passwort-Hashes, Sitzungen in SQLite, HttpOnly-Cookie.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Db, UserRow } from './db';
import { config } from './config';

const COOKIE = 'qb_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** In der Datenbank liegt nur der Hash des Sitzungs-Tokens. */
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function userFromCookie(db: Db, cookieHeader: string | undefined): UserRow | undefined {
  const token = readCookie(cookieHeader, COOKIE);
  if (!token) return undefined;
  const id = db.sessionUser(tokenKey(token));
  return id === undefined ? undefined : db.userById(id);
}

export function startSession(db: Db, res: Response, userId: number) {
  const token = randomBytes(32).toString('base64url');
  db.addSession(tokenKey(token), userId, Date.now() + SESSION_MS);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.prod,
    maxAge: SESSION_MS,
    path: '/',
  });
}

export function endSession(db: Db, req: Request, res: Response) {
  const token = readCookie(req.headers.cookie, COOKIE);
  if (token) db.deleteSession(tokenKey(token));
  res.clearCookie(COOKIE, { path: '/' });
}

export type AuthedRequest = Request & { user: UserRow };

/** Middleware: nur für angemeldete Quizmaster. */
export function requireUser(db: Db) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = userFromCookie(db, req.headers.cookie);
    if (!user) return void res.status(401).json({ error: 'Bitte melde dich an.' });
    (req as AuthedRequest).user = user;
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as AuthedRequest).user?.admin) return void res.status(403).json({ error: 'Nur für Admins.' });
  next();
}

/** Einfache Bremse gegen Passwort-Raten: max. 8 Fehlversuche je IP in 10 Minuten. */
const fails = new Map<string, { n: number; until: number }>();
export function loginBlocked(ip: string): boolean {
  const f = fails.get(ip);
  if (f && f.until < Date.now()) fails.delete(ip);
  return (fails.get(ip)?.n ?? 0) >= 8;
}
export function loginFailed(ip: string) {
  const f = fails.get(ip) ?? { n: 0, until: Date.now() + 10 * 60 * 1000 };
  f.n++;
  fails.set(ip, f);
}
export function loginSucceeded(ip: string) {
  fails.delete(ip);
}
