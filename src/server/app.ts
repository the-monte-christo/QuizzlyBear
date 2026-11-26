// HTTP-Teil: Login, Quiz-Verwaltung, Spiele starten, statische Dateien.
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import type { Quiz } from '../shared/quiz';
import {
  endSession,
  hashPassword,
  loginBlocked,
  loginFailed,
  loginSucceeded,
  requireAdmin,
  requireUser,
  startSession,
  userFromCookie,
  verifyPassword,
  type AuthedRequest,
} from './auth';
import { config } from './config';
import type { Db, QuizRow } from './db';
import type { GameManager } from './game/manager';

export interface AppDeps {
  db: Db;
  games: GameManager;
  /** Verzeichnis mit dem gebauten Frontend (dist/web), falls vorhanden. */
  webDir?: string;
  /** Verzeichnis mit quiz.schema.json und der Format-Beschreibung. */
  schemaDir: string;
}

export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";

export function createApp({ db, games, webDir, schemaDir }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  if (config.securityHeaders) {
    app.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', CSP);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });
  }

  // Schreibende Anfragen nur von der eigenen Seite (zusätzlich zum SameSite-Cookie)
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0].trim() ?? req.headers.host;
    if (origin && new URL(origin).host !== host) {
      return void res.status(403).json({ error: 'Fremde Herkunft.' });
    }
    next();
  });

  const json = express.json({ limit: '64kb' });
  const auth = requireUser(db);
  const user = (req: Request) => (req as AuthedRequest).user;

  // ------------------------------------------------------------------ Health

  app.get('/api/health', (_req, res) => {
    try {
      res.json({ ok: db.ping(), activeGames: games.activeCount });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  /** Adresse, unter der Handys das Spiel erreichen (für QR-Code und Anzeige auf dem Host). */
  app.get('/api/info', (_req, res) => {
    const lan: string[] = [];
    if (!config.prod) {
      for (const list of Object.values(networkInterfaces())) {
        for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) lan.push(a.address);
      }
    }
    res.json({ publicUrl: config.publicUrl ?? null, lan });
  });

  // ------------------------------------------------------------------- Login

  app.get('/api/auth/me', (req, res) => {
    const u = userFromCookie(db, req.headers.cookie);
    res.json(u ? { user: { id: u.id, name: u.name, admin: !!u.admin } } : { user: null });
  });

  app.post('/api/auth/login', json, (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (loginBlocked(ip)) return void res.status(429).json({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten.' });
    const { name, password } = req.body ?? {};
    const u = typeof name === 'string' ? db.userByName(name.trim()) : undefined;
    if (!u || typeof password !== 'string' || !verifyPassword(password, u.pass)) {
      loginFailed(ip);
      return void res.status(401).json({ error: 'Name oder Passwort stimmt nicht.' });
    }
    loginSucceeded(ip);
    startSession(db, res, u.id);
    res.json({ user: { id: u.id, name: u.name, admin: !!u.admin } });
  });

  app.post('/api/auth/logout', (req, res) => {
    endSession(db, req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/password', auth, json, (req, res) => {
    const { current, next } = req.body ?? {};
    if (typeof current !== 'string' || !verifyPassword(current, user(req).pass)) {
      return void res.status(400).json({ error: 'Das aktuelle Passwort stimmt nicht.' });
    }
    if (typeof next !== 'string' || next.length < 8) {
      return void res.status(400).json({ error: 'Das neue Passwort braucht mindestens 8 Zeichen.' });
    }
    db.setPassword(user(req).id, hashPassword(next));
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- Benutzer

  app.get('/api/users', auth, requireAdmin, (_req, res) => {
    res.json({ users: db.users().map((u) => ({ id: u.id, name: u.name, admin: !!u.admin })) });
  });

  app.post('/api/users', auth, requireAdmin, json, (req, res) => {
    const { name, password, admin } = req.body ?? {};
    if (typeof name !== 'string' || !/^[\p{L}\p{N}._-]{2,32}$/u.test(name.trim())) {
      return void res.status(400).json({ error: 'Name: 2–32 Zeichen, Buchstaben, Ziffern, Punkt, Binde- oder Unterstrich.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return void res.status(400).json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' });
    }
    if (db.userByName(name.trim())) return void res.status(409).json({ error: 'Diesen Namen gibt es schon.' });
    const id = db.addUser(name.trim(), hashPassword(password), !!admin);
    res.status(201).json({ id });
  });

  app.delete('/api/users/:id', auth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (id === user(req).id) return void res.status(400).json({ error: 'Du kannst dich nicht selbst löschen.' });
    db.deleteUser(id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------ Quizze

  const canSee = (req: Request, row: QuizRow) => row.owner_id === user(req).id || !!user(req).admin;
  const summary = (row: QuizRow) => {
    const quiz = JSON.parse(row.json) as Quiz;
    return {
      id: row.id,
      title: row.title,
      description: quiz.description,
      owner: row.owner_name,
      questions: quiz.questions.length,
      types: [...new Set(quiz.questions.map((q) => q.type))],
      updatedAt: row.updated_at,
    };
  };

  app.get('/api/quizzes', auth, (req, res) => {
    res.json({
      quizzes: db
        .quizzes()
        .filter((row) => canSee(req, row))
        .map(summary),
    });
  });

  app.get('/api/quizzes/:id', auth, (req, res) => {
    const row = db.quiz(Number(req.params.id));
    if (!row || !canSee(req, row)) return void res.status(404).json({ error: 'Quiz nicht gefunden.' });
    res.json({ ...summary(row), quiz: JSON.parse(row.json) });
  });

  // ------------------------------------------------------------------ Spiele

  const gameInfo = (g: ReturnType<GameManager['byOwner']>[number]) => ({
    pin: g.pin,
    hostKey: g.hostKey,
    title: g.quiz.title,
    phase: g.phase,
    players: g.playerCount,
    createdAt: g.createdAt,
  });

  app.get('/api/games', auth, (req, res) => {
    res.json({ games: games.byOwner(user(req).id).map(gameInfo) });
  });

  app.post('/api/games', auth, json, (req, res) => {
    const row = db.quiz(Number(req.body?.quizId));
    if (!row || !canSee(req, row)) return void res.status(404).json({ error: 'Quiz nicht gefunden.' });
    const game = games.create(JSON.parse(row.json) as Quiz, row.id, user(req).id);
    res.status(201).json(gameInfo(game));
  });

  app.delete('/api/games/:pin', auth, (req, res) => {
    const game = games.get(String(req.params.pin));
    if (!game || game.ownerId !== user(req).id) return void res.status(404).json({ error: 'Spiel nicht gefunden.' });
    games.remove(game.pin);
    res.json({ ok: true });
  });

  // ------------------------------------------------------- Statische Dateien

  app.use('/img', express.static(join(config.dataDir, 'img'), { immutable: true, maxAge: '365d', index: false }));
  app.use('/schema', express.static(schemaDir, { maxAge: '5m', index: false }));

  if (webDir && existsSync(webDir)) {
    app.use(
      express.static(webDir, {
        setHeaders(res, path) {
          if (path.includes(`${join('assets', '')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
          else res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      }),
    );
  }

  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Nicht gefunden.' }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') return void res.status(413).json({ error: 'Die Datei ist zu groß.' });
    if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: 'Ungültiges JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });

  return app;
}
