// Ein laufendes Spiel als Zustandsautomat:
//
//   lobby → [ countdown (3 s) → question → locked → reveal → leaderboard ]* → final
//
// Der Host schaltet mit „weiter“. Eine Frage endet von selbst, wenn die Zeit um ist oder
// alle verbundenen Spieler geantwortet haben. Die Klasse kennt kein Socket.io – sie spricht
// nur über GameIO, damit sie sich mit Fake-Timern testen lässt.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Question, Quiz, QuizSettings } from '../../shared/quiz';
import {
  COUNTDOWN_MS,
  GRACE_MS,
  type AnswerAck,
  type AnswerMsg,
  type HostState,
  type LeaderRow,
  type LockReason,
  type Phase,
  type PhoneSettings,
  type PlayerResult,
  type PlayerState,
  type PublicQuestion,
  type RevealInfo,
} from '../../shared/protocol';
import { proximityPoints, streakBonus, timePoints } from '../../shared/scoring';
import { rankPlayers } from '../../shared/ranking';
import { createRng } from '../../shared/rng';
import { logicFor, type TypeLogic } from '../../types';

export interface GameIO {
  host(event: string, payload: unknown): void;
  player(playerId: string, event: string, payload: unknown): void;
}

/** Pause zwischen „alle haben geantwortet“ und der Auflösung. */
const LOCK_PAUSE_MS = 700;
export const MAX_PLAYERS = 250;
export const MAX_NAME = 16;

interface PlayerRec {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  joined: number;
  score: number;
  streak: number;
  maxStreak: number;
  correct: number;
  totalMs: number;
  rank: number;
  prevRank: number | null;
  last?: PlayerResult & { qIndex: number };
}

interface Current {
  index: number;
  /** Frage mit aufgelösten Verweisen (z. B. Umfrage-Ergebnis als Lösung). */
  q: Question;
  logic: TypeLogic;
  pub: PublicQuestion;
  answers: Map<string, { value: unknown; ms: number; seq: number }>;
  countdownEndsAt: number;
  endsAt: number;
  /** Bis wann der Server nach Zeitablauf noch Antworten annimmt. */
  graceUntil: number;
  lockReason?: LockReason;
  reveal?: RevealInfo;
}

export class Game {
  readonly pin: string;
  readonly hostKey = randomBytes(18).toString('base64url');
  readonly createdAt = Date.now();
  lastActivity = Date.now();
  phase: Phase = 'lobby';

  private players = new Map<string, PlayerRec>();
  private joinCounter = 0;
  private cur?: Current;
  private phone: PhoneSettings;
  private settings: QuizSettings;
  private pollResults = new Map<string, { counts: number[]; total: number }>();
  private timer?: ReturnType<typeof setTimeout>;
  private finalStep = 0;
  private rng: () => number;

  constructor(
    pin: string,
    readonly quiz: Quiz,
    readonly quizId: number,
    readonly ownerId: number,
    private io: GameIO,
  ) {
    this.pin = pin;
    this.settings = quiz.settings;
    this.phone = { ...quiz.settings.phone };
    this.rng = createRng(Number(pin) ^ (Date.now() & 0xffffff));
  }

  // ------------------------------------------------------------------ Spieler

  get playerCount() {
    return this.players.size;
  }

  addPlayer(rawName: string): { ok: true; id: string; token: string } | { ok: false; error: string } {
    const name = String(rawName ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME);
    if (!name) return { ok: false, error: 'Bitte gib einen Namen ein.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'Dieses Spiel ist voll.' };
    if (this.phase === 'final') return { ok: false, error: 'Dieses Spiel ist schon vorbei.' };

    // doppelte Namen unterscheidbar machen
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    let unique = name;
    for (let n = 2; taken.has(unique.toLowerCase()); n++) {
      const suffix = ` ${n}`;
      unique = name.slice(0, MAX_NAME - suffix.length) + suffix;
    }

    const p: PlayerRec = {
      id: randomUUID(),
      token: randomBytes(18).toString('base64url'),
      name: unique,
      connected: false,
      joined: this.joinCounter++,
      score: 0,
      streak: 0,
      maxStreak: 0,
      correct: 0,
      totalMs: 0,
      rank: this.players.size + 1,
      prevRank: null,
    };
    this.players.set(p.id, p);
    this.touch();
    return { ok: true, id: p.id, token: p.token };
  }

  /** Prüft Spieler-ID + Token (Reconnect). */
  authPlayer(id: string, token: string): boolean {
    const p = this.players.get(id);
    return !!p && p.token === token;
  }

  setConnected(id: string, connected: boolean) {
    const p = this.players.get(id);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    this.touch();
    if (this.phase === 'lobby') {
      this.broadcast(); // alle sehen, wie die Lobby sich füllt
    } else {
      this.sendHost();
      if (connected) this.sendPlayer(p);
      else this.checkAllAnswered();
    }
  }

  kick(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.cur?.answers.delete(id);
    this.io.player(id, 'kicked', {});
    this.sendHost();
    this.checkAllAnswered();
  }

  // --------------------------------------------------------------------- Host

  /** „Weiter“ des Hosts – was passiert, hängt von der Phase ab. */
  next() {
    this.touch();
    switch (this.phase) {
      case 'lobby':
        return this.startQuestion(0);
      case 'question':
        return this.lock('host');
      case 'reveal': {
        const last = this.cur!.index >= this.quiz.questions.length - 1;
        if (last) return this.enterFinal();
        // Nach einer Umfrage hat sich die Rangliste nicht geändert: direkt weiter
        if (this.cur!.logic.scoring === 'none') return this.startQuestion(this.cur!.index + 1);
        this.phase = 'leaderboard';
        return this.broadcast();
      }
      case 'leaderboard':
        return this.startQuestion(this.cur!.index + 1);
      case 'final':
        if (this.finalStep < this.finalReveal().length) {
          this.finalStep++;
          this.broadcast();
        }
        return;
      default:
        return; // countdown und locked laufen von selbst weiter
    }
  }

  setPhone(patch: Partial<PhoneSettings>) {
    if (typeof patch.showQuestion === 'boolean') this.phone.showQuestion = patch.showQuestion;
    if (typeof patch.showAnswerText === 'boolean') this.phone.showAnswerText = patch.showAnswerText;
    this.broadcast();
  }

  // ------------------------------------------------------------------ Ablauf

  private startQuestion(index: number) {
    const raw = this.quiz.questions[index];
    const logic = raw && logicFor(raw.type);
    if (!raw || !logic) return this.enterFinal();

    const answer = logic.resolve ? logic.resolve(raw.answer, (id) => this.pollResults.get(id)) : raw.answer;
    const q: Question = { ...raw, answer };
    const now = Date.now();
    const pub: PublicQuestion = {
      index,
      total: this.quiz.questions.length,
      id: q.id,
      type: q.type,
      text: q.text,
      image: q.image,
      time: q.time,
      maxPoints: logic.scoring === 'none' ? 0 : q.points,
      scoring: logic.scoring,
      data: logic.toPublic(answer, this.rng),
    };
    this.cur = {
      index,
      q,
      logic,
      pub,
      answers: new Map(),
      countdownEndsAt: now + COUNTDOWN_MS,
      endsAt: now + COUNTDOWN_MS + q.time * 1000,
      graceUntil: 0,
    };
    this.phase = 'countdown';
    this.broadcast();
    this.setTimer(COUNTDOWN_MS, () => this.activate());
  }

  private activate() {
    const cur = this.cur!;
    const now = Date.now();
    cur.endsAt = now + cur.q.time * 1000;
    this.phase = 'question';
    this.broadcast();
    this.setTimer(cur.q.time * 1000, () => this.lock('time'));
    this.checkAllAnswered();
  }

  private lock(reason: LockReason) {
    if (this.phase !== 'question') return;
    const cur = this.cur!;
    cur.lockReason = reason;
    // Nur nach Zeitablauf gibt es die Kulanzsekunde für Antworten, die noch unterwegs sind.
    cur.graceUntil = reason === 'time' ? Date.now() + GRACE_MS : 0;
    this.phase = 'locked';
    this.broadcast();
    this.setTimer(reason === 'time' ? GRACE_MS : LOCK_PAUSE_MS, () => this.reveal());
  }

  /** Antwort eines Spielers. Die Antwort ist änderbar: Es zählt die mit der höchsten seq. */
  answer(playerId: string, msg: AnswerMsg): AnswerAck {
    const p = this.players.get(playerId);
    const cur = this.cur;
    if (!p || !cur || !msg || msg.qIndex !== cur.index) return { ok: false, error: 'unknown' };

    const open =
      this.phase === 'question' ||
      // Der Client deckt lokal auf und kann minimal vor dem Server „aktiv“ sein
      (this.phase === 'countdown' && Date.now() >= cur.countdownEndsAt - 250) ||
      (this.phase === 'locked' && Date.now() <= cur.graceUntil);
    if (!open) return { ok: false, error: 'locked' };

    const value = cur.logic.parse(msg.value, cur.q.answer, cur.pub.data);
    const limit = cur.q.time * 1000;
    if (value === null || typeof msg.ms !== 'number' || !Number.isFinite(msg.ms) || !Number.isInteger(msg.seq)) {
      return { ok: false, error: 'invalid' };
    }
    // In der Kulanzzeit zählt nur, was der Spieler noch innerhalb der Fragezeit getippt hat
    if (this.phase === 'locked' && msg.ms > limit) return { ok: false, error: 'locked' };

    const prev = cur.answers.get(playerId);
    if (prev && msg.seq <= prev.seq) return { ok: true }; // Wiederholung oder überholt: folgenlos
    const ms = Math.min(limit, Math.max(0, Math.round(msg.ms)));
    cur.answers.set(playerId, { value, ms, seq: msg.seq });
    this.touch();
    this.io.host('answered', { count: cur.answers.size });
    this.checkAllAnswered();
    return { ok: true };
  }

  private checkAllAnswered() {
    if (this.phase !== 'question' || !this.cur) return;
    const online = [...this.players.values()].filter((p) => p.connected);
    if (online.length > 0 && online.every((p) => this.cur!.answers.has(p.id))) this.lock('all');
  }

  private reveal() {
    const cur = this.cur!;
    const { logic, q } = cur;
    const ctx = { aspect: q.image ? q.image.h / q.image.w : 1 };
    const values: unknown[] = [];
    let fullCorrect = 0;

    for (const p of this.players.values()) {
      const a = cur.answers.get(p.id);
      const res: PlayerResult = {
        answered: !!a,
        points: 0,
        bonus: 0,
        correct: logic.scoring === 'none' ? null : false,
        fraction: 0,
      };
      if (a) {
        values.push(a.value);
        const s = logic.score(q.answer, a.value, ctx);
        res.fraction = s.fraction;
        res.correct = s.correct;
        if (logic.scoring === 'time') res.points = timePoints(a.ms, q.time, s.fraction, q.points);
        else if (logic.scoring === 'proximity') res.points = proximityPoints(s.fraction, q.points);
      }
      if (logic.scoring !== 'none') p.totalMs += a ? a.ms : q.time * 1000;

      if (res.correct === true) {
        p.streak++;
        p.correct++;
        fullCorrect++;
        res.bonus = streakBonus(p.streak, this.settings.streak.bonus, this.settings.streak.max);
      } else if (res.correct === false) {
        p.streak = 0;
      }
      p.maxStreak = Math.max(p.maxStreak, p.streak);
      p.score += res.points + res.bonus;
      p.last = { ...res, qIndex: cur.index };
    }

    this.rerank();

    const summary = logic.summarize(q.answer, cur.pub.data, values);
    if (q.type === 'poll') {
      const counts: number[] = summary.counts;
      this.pollResults.set(q.id, { counts, total: values.length });
    }
    cur.reveal = {
      solution: logic.solution(q.answer, cur.pub.data),
      summary,
      explanation: q.explanation,
      answered: values.length,
      correct: fullCorrect,
      players: this.players.size,
    };
    this.phase = 'reveal';
    this.broadcast();
  }

  private rerank() {
    const ordered = rankPlayers([...this.players.values()], this.settings.ranking.tiebreak);
    const hadRanks = this.cur ? this.cur.index > 0 : false;
    ordered.forEach((p, i) => {
      p.prevRank = hadRanks ? p.rank : null;
      p.rank = i + 1;
    });
  }

  private enterFinal() {
    this.clearTimer();
    this.rerank();
    this.phase = 'final';
    this.finalStep = 0;
    this.broadcast();
  }

  /** Siegerreihenfolge aus dem Quiz, beschränkt auf tatsächlich vergebene Plätze. */
  private finalReveal(): number[] {
    const seen = new Set<number>();
    return this.settings.ranking.reveal.filter((place) => {
      if (place < 1 || place > this.players.size || seen.has(place)) return false;
      seen.add(place);
      return true;
    });
  }

  // ----------------------------------------------------------------- Zustände

  private ordered(): PlayerRec[] {
    return [...this.players.values()].sort((a, b) => a.rank - b.rank || a.joined - b.joined);
  }

  private row(p: PlayerRec): LeaderRow {
    const last = this.cur && p.last?.qIndex === this.cur.index ? p.last : undefined;
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      delta: last ? last.points + last.bonus : 0,
      rank: p.rank,
      prevRank: p.prevRank,
      streak: p.streak,
      correct: last ? last.correct : null,
    };
  }

  private base() {
    const cur = this.cur;
    const now = Date.now();
    const showQ = cur && this.phase !== 'lobby' && this.phase !== 'final';
    return {
      pin: this.pin,
      quizTitle: this.quiz.title,
      phase: this.phase,
      qIndex: cur ? cur.index : -1,
      qTotal: this.quiz.questions.length,
      question: showQ ? cur.pub : undefined,
      countdownMs: cur && this.phase === 'countdown' ? Math.max(0, cur.countdownEndsAt - now) : undefined,
      remainingMs: cur && this.phase === 'question' ? Math.max(0, cur.endsAt - now) : undefined,
      lockReason: cur && this.phase === 'locked' ? cur.lockReason : undefined,
      phone: { ...this.phone },
    };
  }

  hostState(): HostState {
    const cur = this.cur;
    const afterReveal = this.phase === 'reveal' || this.phase === 'leaderboard';
    const state: HostState = {
      ...this.base(),
      role: 'host',
      players: [...this.players.values()]
        .sort((a, b) => a.joined - b.joined)
        .map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
      answered: cur ? cur.answers.size : 0,
      reveal: afterReveal ? cur?.reveal : undefined,
      leaderboard: afterReveal
        ? this.ordered()
            .slice(0, this.settings.ranking.top)
            .map((p) => this.row(p))
        : undefined,
      isLast: cur ? cur.index >= this.quiz.questions.length - 1 : false,
    };
    if (this.phase === 'final') {
      const rows = this.ordered();
      const best = [...rows].sort((a, b) => b.maxStreak - a.maxStreak)[0];
      state.final = {
        rows: rows.slice(0, 50).map((p) => this.row(p)),
        reveal: this.finalReveal(),
        step: this.finalStep,
        awards: {
          longestStreak: best && best.maxStreak >= 2 ? { name: best.name, streak: best.maxStreak } : undefined,
        },
      };
    }
    return state;
  }

  playerState(id: string): PlayerState | null {
    const p = this.players.get(id);
    if (!p) return null;
    const cur = this.cur;
    const afterReveal = this.phase === 'reveal' || this.phase === 'leaderboard';
    const mine = cur?.answers.get(p.id);
    const state: PlayerState = {
      ...this.base(),
      role: 'player',
      me: { id: p.id, name: p.name, score: p.score, rank: p.rank, streak: p.streak },
      playerCount: this.players.size,
      myAnswer: cur && mine && this.phase !== 'lobby' && this.phase !== 'final' ? mine : undefined,
      result: afterReveal && cur && p.last?.qIndex === cur.index ? p.last : undefined,
    };
    if (this.phase === 'leaderboard' && p.rank > 1) {
      const ahead = this.ordered()[p.rank - 2];
      if (ahead) state.ahead = { name: ahead.name, gap: ahead.score - p.score };
    }
    if (this.phase === 'final') {
      const order = this.finalReveal();
      const at = order.indexOf(p.rank);
      state.final = {
        revealed: at === -1 ? true : at < this.finalStep,
        rank: p.rank,
        total: this.players.size,
        score: p.score,
        correct: p.correct,
        maxStreak: p.maxStreak,
      };
    }
    return state;
  }

  private sendHost() {
    this.io.host('state', this.hostState());
  }

  private sendPlayer(p: PlayerRec) {
    this.io.player(p.id, 'state', this.playerState(p.id));
  }

  broadcast() {
    this.sendHost();
    for (const p of this.players.values()) if (p.connected) this.sendPlayer(p);
  }

  // ------------------------------------------------------------------- Intern

  private touch() {
    this.lastActivity = Date.now();
  }

  private setTimer(ms: number, fn: () => void) {
    this.clearTimer();
    this.timer = setTimeout(fn, ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  destroy() {
    this.clearTimer();
  }
}
