// Zustand der Handy-App: Verbindung, lokales Aufdecken, Zeitmessung, Antworten.
//
// Timing: Der Server schickt die Frage schon mit dem Countdown. Das Handy deckt sie nach
// Ablauf des Countdowns selbst auf und misst die Antwortdauer mit performance.now() vom
// Erscheinen der Antworten bis zum Tap. Diese Dauer geht an den Server.

import { io, type Socket } from 'socket.io-client';
import type { AnswerAck, JoinAck, PlayerState, SocketAuth } from '../../shared/protocol';

const STORE = 'qb:player';
const NAME = 'qb:name';

interface Saved {
  pin: string;
  playerId: string;
  token: string;
}

export interface LocalAnswer {
  value: unknown;
  ms: number;
  seq: number;
  /** Vom Server bestätigt? */
  sent: boolean;
}

export type View = 'join' | 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'final';

function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    return s && s.pin && s.playerId && s.token ? s : null;
  } catch {
    return null;
  }
}

class PlayerGame {
  state = $state<PlayerState | null>(null);
  online = $state(false);
  /** true, solange gespeicherte Zugangsdaten geprüft werden (kein Aufblitzen des Beitritts-Formulars). */
  restoring = $state(false);
  joining = $state(false);
  error = $state('');
  /** Frage lokal aufgedeckt. */
  shown = $state(false);
  /** Zeit lokal abgelaufen. */
  timeUp = $state(false);
  answer = $state<LocalAnswer | null>(null);
  /** Zeitpunkt (performance.now()), an dem die Fragezeit endet. */
  deadline = $state(0);
  /** Zeitpunkt, an dem der Countdown endet. */
  revealAt = $state(0);

  savedName = localStorage.getItem(NAME) ?? '';

  private socket: Socket;
  private shownAt = 0;
  private armed = -1;
  private seq = 0;
  private lastAcked: LocalAnswer | null = null;
  private revealTimer?: ReturnType<typeof setTimeout>;
  private lockTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.socket = io({ autoConnect: false, transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
    this.socket.on('connect', () => (this.online = true));
    this.socket.on('disconnect', () => (this.online = false));
    this.socket.on('state', (s: PlayerState) => this.onState(s));
    this.socket.on('gone', () => this.reset('Dieses Spiel gibt es nicht mehr.'));
    this.socket.on('kicked', () => this.reset('Du wurdest aus dem Spiel entfernt.'));

    const saved = load();
    if (saved) {
      this.restoring = true;
      this.socket.auth = { role: 'player', ...saved } satisfies SocketAuth;
    }
    this.socket.connect();
  }

  get view(): View {
    const s = this.state;
    if (!s) return 'join';
    // Aufgedeckt wird lokal – auch wenn der Server schon ein paar Millisekunden weiter ist
    if (s.phase === 'countdown' || s.phase === 'question') return this.shown ? 'question' : 'countdown';
    if (s.phase === 'locked') return 'question';
    return s.phase;
  }

  /** Eingaben gesperrt: Zeit um oder vom Server gesperrt. */
  get locked(): boolean {
    return this.timeUp || this.state?.phase === 'locked';
  }

  join(pin: string, name: string) {
    this.error = '';
    this.joining = true;
    localStorage.setItem(NAME, name);
    this.socket.timeout(8000).emit('player:join', { pin, name }, (err: Error | null, res?: JoinAck) => {
      this.joining = false;
      if (err || !res) return void (this.error = 'Keine Verbindung zum Server. Versuch es gleich noch einmal.');
      if (!res.ok) return void (this.error = res.error);
      const saved: Saved = { pin: pin.replace(/\D/g, ''), playerId: res.playerId, token: res.token };
      localStorage.setItem(STORE, JSON.stringify(saved));
      // Für jeden späteren Reconnect: Identität steckt im Handshake
      this.socket.auth = { role: 'player', ...saved } satisfies SocketAuth;
    });
  }

  /** Antwort abgeben oder ändern. Jede Änderung bekommt eine neue Zeit. */
  submit(value: unknown) {
    const s = this.state;
    if (!s?.question || this.locked || !this.shown) return;
    const ms = Math.max(0, Math.round(performance.now() - this.shownAt));
    const a: LocalAnswer = { value, ms, seq: ++this.seq, sent: false };
    this.answer = a;
    this.send(s.question.index, a, 0);
  }

  private send(qIndex: number, a: LocalAnswer, attempt: number) {
    this.socket
      .timeout(4000)
      .emit('player:answer', { qIndex, value: a.value, ms: a.ms, seq: a.seq }, (err: Error | null, res?: AnswerAck) => {
        if (this.armed !== qIndex || this.seq !== a.seq) return; // inzwischen überholt
        if (err || !res) {
          // Funkloch: mit derselben Nummer und derselben Zeit wiederholen
          if (attempt < 4) this.send(qIndex, a, attempt + 1);
          return;
        }
        if (res.ok) {
          this.lastAcked = { ...a, sent: true };
          this.answer = this.lastAcked;
        } else if (res.error === 'locked') {
          this.answer = this.lastAcked; // zu spät: letzte bestätigte Antwort gilt
        }
      });
  }

  leave() {
    this.reset('');
  }

  private reset(message: string) {
    localStorage.removeItem(STORE);
    this.clearTimers();
    this.socket.auth = {};
    this.state = null;
    this.restoring = false;
    this.armed = -1;
    this.answer = null;
    this.error = message;
    // Frische Verbindung ohne alte Identität
    this.socket.disconnect().connect();
  }

  /** Lädt die Figuren-Animationen der Ergebnis-Bildschirme vor, solange in der Lobby nichts los ist. */
  private warmed = false;
  private warmUp() {
    if (this.warmed) return;
    this.warmed = true;
    setTimeout(() => {
      for (const name of ['bear-cheer', 'bear-think', 'herry-grin']) new Image().src = `/art/anim-${name}-s.webp`;
    }, 1500);
  }

  private onState(s: PlayerState) {
    this.restoring = false;
    this.warmUp();
    this.error = '';
    this.state = s;
    const q = s.question;

    if (q && (s.phase === 'countdown' || s.phase === 'question')) {
      const total = q.time * 1000;
      if (this.armed !== q.index) {
        // neue Frage
        this.armed = q.index;
        this.clearTimers();
        this.shown = false;
        this.timeUp = false;
        this.seq = s.myAnswer?.seq ?? 0;
        this.lastAcked = s.myAnswer ? { ...s.myAnswer, sent: true } : null;
        this.answer = this.lastAcked;
        if (q.image) new Image().src = q.image.src; // vorladen, während der Countdown läuft

        if (s.phase === 'countdown') {
          const wait = s.countdownMs ?? 0;
          this.revealAt = performance.now() + wait;
          this.revealTimer = setTimeout(() => this.show(total, total), wait);
        } else {
          this.show(s.remainingMs ?? 0, total); // später Beitritt oder Reconnect mitten in der Frage
        }
      } else if (s.phase === 'question' && this.shown) {
        // gleiche Frage, neuer Zustand (Reconnect): nur bei deutlicher Abweichung neu ausrichten
        const serverDeadline = performance.now() + (s.remainingMs ?? 0);
        if (Math.abs(serverDeadline - this.deadline) > 1500) this.show(s.remainingMs ?? 0, total);
      }
      return;
    }

    this.clearTimers();
    if (s.phase === 'locked') {
      this.shown = true;
      if (!this.answer && s.myAnswer) this.answer = { ...s.myAnswer, sent: true };
    } else {
      this.shown = false;
      this.timeUp = false;
      if (s.phase === 'reveal') this.answer = s.myAnswer ? { ...s.myAnswer, sent: true } : null;
    }
  }

  private show(remaining: number, total: number) {
    clearTimeout(this.lockTimer);
    const now = performance.now();
    this.deadline = now + remaining;
    this.shownAt = this.deadline - total;
    this.shown = true;
    this.timeUp = remaining <= 0;
    this.lockTimer = setTimeout(() => (this.timeUp = true), remaining);
  }

  private clearTimers() {
    clearTimeout(this.revealTimer);
    clearTimeout(this.lockTimer);
  }
}

export const game = new PlayerGame();
