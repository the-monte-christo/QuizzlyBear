import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Quiz } from '../shared/quiz';

export interface UserRow {
  id: number;
  name: string;
  pass: string;
  admin: number;
  created_at: number;
}

export interface QuizRow {
  id: number;
  owner_id: number;
  owner_name: string;
  title: string;
  json: string;
  created_at: number;
  updated_at: number;
}

export type Db = ReturnType<typeof openDb>;

export function openDb(dataDir: string) {
  mkdirSync(join(dataDir, 'img'), { recursive: true });
  const db = new Database(join(dataDir, 'quizzlybear.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass TEXT NOT NULL,
      admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const q = {
    userByName: db.prepare<[string], UserRow>('SELECT * FROM users WHERE name = ?'),
    userById: db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?'),
    users: db.prepare<[], UserRow>('SELECT * FROM users ORDER BY name'),
    userCount: db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users'),
    addUser: db.prepare('INSERT INTO users (name, pass, admin, created_at) VALUES (?, ?, ?, ?)'),
    setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
    delUser: db.prepare('DELETE FROM users WHERE id = ?'),

    addSession: db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare<[string, number], { user_id: number }>(
      'SELECT user_id FROM sessions WHERE token = ? AND expires > ?',
    ),
    delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    delUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires <= ?'),

    quizzes: db.prepare<[], QuizRow>(
      'SELECT q.*, u.name AS owner_name FROM quizzes q JOIN users u ON u.id = q.owner_id ORDER BY q.updated_at DESC',
    ),
    quiz: db.prepare<[number], QuizRow>(
      'SELECT q.*, u.name AS owner_name FROM quizzes q JOIN users u ON u.id = q.owner_id WHERE q.id = ?',
    ),
    addQuiz: db.prepare('INSERT INTO quizzes (owner_id, title, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'),
    setQuiz: db.prepare('UPDATE quizzes SET title = ?, json = ?, updated_at = ? WHERE id = ?'),
    delQuiz: db.prepare('DELETE FROM quizzes WHERE id = ?'),
    allQuizJson: db.prepare<[], { json: string }>('SELECT json FROM quizzes'),
  };

  return {
    raw: db,
    /** Prüft, ob die Datenbank antwortet (Health-Endpunkt). */
    ping: () => q.userCount.get() !== undefined,

    userByName: (name: string) => q.userByName.get(name),
    userById: (id: number) => q.userById.get(id),
    users: () => q.users.all(),
    userCount: () => q.userCount.get()!.n,
    addUser: (name: string, pass: string, admin: boolean) =>
      Number(q.addUser.run(name, pass, admin ? 1 : 0, Date.now()).lastInsertRowid),
    setPassword: (id: number, pass: string) => void q.setPass.run(pass, id),
    deleteUser: (id: number) => void q.delUser.run(id),

    addSession: (token: string, userId: number, expires: number) => void q.addSession.run(token, userId, expires),
    sessionUser: (token: string) => q.session.get(token, Date.now())?.user_id,
    deleteSession: (token: string) => void q.delSession.run(token),
    deleteUserSessions: (userId: number) => void q.delUserSessions.run(userId),
    purgeSessions: () => void q.purgeSessions.run(Date.now()),

    quizzes: () => q.quizzes.all(),
    quiz: (id: number) => q.quiz.get(id),
    addQuiz: (ownerId: number, quiz: Quiz) => {
      const now = Date.now();
      return Number(q.addQuiz.run(ownerId, quiz.title, JSON.stringify(quiz), now, now).lastInsertRowid);
    },
    updateQuiz: (id: number, quiz: Quiz) => void q.setQuiz.run(quiz.title, JSON.stringify(quiz), Date.now(), id),
    deleteQuiz: (id: number) => void q.delQuiz.run(id),
    /** Alle Bildpfade, die noch von einem Quiz verwendet werden. */
    usedImages: () => {
      const used = new Set<string>();
      for (const row of q.allQuizJson.all()) {
        for (const m of row.json.matchAll(/"src":"(\/img\/[a-f0-9]+\.webp)"/g)) used.add(m[1]);
      }
      return used;
    },
    close: () => db.close(),
  };
}
