// Socket-Protokoll zwischen Server, Host-Screen und Handys.
// Der Server schickt bei jedem Phasenwechsel einen vollständigen Zustand („state“).
// Damit ist ein Reconnect trivial: Der neu verbundene Client bekommt denselben Zustand.

import type { ImageRef, QuestionType } from './quiz';

export type Phase = 'lobby' | 'countdown' | 'question' | 'locked' | 'reveal' | 'leaderboard' | 'final';

/** Warum eine Frage gesperrt wurde. */
export type LockReason = 'time' | 'all' | 'host';

export type Scoring = 'time' | 'proximity' | 'none';

export const COUNTDOWN_MS = 3000;
/** Kulanz nach Ablauf der Zeit, in der der Server noch Antworten annimmt. */
export const GRACE_MS = 1000;

/** Eine Frage ohne Lösung, wie sie an Host und Handys geht. */
export interface PublicQuestion {
  index: number;
  total: number;
  id: string;
  type: QuestionType;
  text: string;
  image?: ImageRef;
  /** Antwortzeit in Sekunden. */
  time: number;
  maxPoints: number;
  scoring: Scoring;
  /** Typspezifische öffentliche Daten (z. B. Antwortoptionen). */
  data: any;
}

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface LeaderRow {
  id: string;
  name: string;
  score: number;
  /** In der letzten Frage gewonnene Punkte inkl. Bonus. */
  delta: number;
  rank: number;
  prevRank: number | null;
  streak: number;
  /** Ergebnis der letzten Frage: true/false, null bei Umfragen oder ohne Wertung. */
  correct: boolean | null;
}

export interface RevealInfo {
  solution: any;
  summary: any;
  explanation?: string;
  /** Wie viele Spieler geantwortet haben. */
  answered: number;
  /** Wie viele voll richtig lagen (bei Umfragen 0). */
  correct: number;
  players: number;
}

export interface PhoneSettings {
  showQuestion: boolean;
  showAnswerText: boolean;
}

interface BaseState {
  pin: string;
  quizTitle: string;
  phase: Phase;
  qIndex: number;
  qTotal: number;
  question?: PublicQuestion;
  /** Restzeit des Countdowns in ms (nur Phase countdown). */
  countdownMs?: number;
  /** Restzeit der Frage in ms (nur Phase question). */
  remainingMs?: number;
  lockReason?: LockReason;
  phone: PhoneSettings;
}

export interface HostState extends BaseState {
  role: 'host';
  players: PlayerInfo[];
  /** Anzahl der Spieler, die schon geantwortet haben. */
  answered: number;
  reveal?: RevealInfo;
  /** Zwischen-Rangliste (Top N). */
  leaderboard?: LeaderRow[];
  final?: {
    rows: LeaderRow[];
    /** Siegerreihenfolge: Plätze in Enthüllungs-Reihenfolge. */
    reveal: number[];
    /** Wie viele Einträge aus reveal schon enthüllt sind. */
    step: number;
    awards: { longestStreak?: { name: string; streak: number } };
  };
  isLast: boolean;
}

export interface PlayerResult {
  /** Hat der Spieler überhaupt geantwortet? */
  answered: boolean;
  points: number;
  bonus: number;
  correct: boolean | null;
  /** Anteil der Maximalpunkte vor Zeitabzug (0–1). */
  fraction: number;
}

export interface PlayerState extends BaseState {
  role: 'player';
  me: { id: string; name: string; score: number; rank: number; streak: number };
  playerCount: number;
  myAnswer?: { value: any; ms: number; seq: number };
  result?: PlayerResult;
  /** Abstand zum nächstbesseren Spieler (Phase leaderboard). */
  ahead?: { name: string; gap: number };
  final?: {
    /** false, solange der eigene Platz auf dem Host noch nicht enthüllt ist. */
    revealed: boolean;
    rank: number;
    total: number;
    score: number;
    correct: number;
    maxStreak: number;
  };
}

// ---- Nachrichten Client → Server ----

export interface JoinMsg {
  pin: string;
  name: string;
}
export type JoinAck = { ok: true; playerId: string; token: string } | { ok: false; error: string };

export interface AnswerMsg {
  qIndex: number;
  value: unknown;
  /** Vom Client gemessene Antwortdauer in ms (Erscheinen der Antworten bis zum Tap). */
  ms: number;
  /** Laufende Nummer je Spieler: Die höchste zählt, Wiederholungen sind folgenlos. */
  seq: number;
}
export type AnswerAck = { ok: true } | { ok: false; error: 'locked' | 'invalid' | 'unknown' };

export type SimpleAck = { ok: true } | { ok: false; error: string };

/** Zugangsdaten im Socket-Handshake (auth). */
export type SocketAuth =
  | { role: 'player'; pin: string; playerId: string; token: string }
  | { role: 'host'; pin: string; hostKey: string }
  | Record<string, never>;
