// Zustand des Host-Screens. Wie die Handys deckt auch der Host die Frage lokal auf,
// sobald der Countdown abgelaufen ist.

import { io, type Socket } from 'socket.io-client';
import type { HostState, PhoneSettings, SocketAuth } from '../../shared/protocol';

export const hostKeyStore = (pin: string) => `qb:host:${pin}`;

export type HostView = 'connecting' | 'gone' | 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'final';

class HostGame {
  state = $state<HostState | null>(null);
  online = $state(false);
  gone = $state(false);
  shown = $state(false);
  deadline = $state(0);
  revealAt = $state(0);
  answered = $state(0);

  readonly pin = new URLSearchParams(location.search).get('pin')?.replace(/\D/g, '') ?? '';
  private socket: Socket;
  private armed = -1;
  private revealTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const hostKey = localStorage.getItem(hostKeyStore(this.pin)) ?? '';
    this.socket = io({
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { role: 'host', pin: this.pin, hostKey } satisfies SocketAuth,
    });
    this.socket.on('connect', () => (this.online = true));
    this.socket.on('disconnect', () => (this.online = false));
    this.socket.on('gone', () => (this.gone = true));
    this.socket.on('state', (s: HostState) => this.onState(s));
    this.socket.on('answered', (m: { count: number }) => (this.answered = m.count));
    if (this.pin && hostKey) this.socket.connect();
    else this.gone = true;
  }

  get view(): HostView {
    const s = this.state;
    if (this.gone) return 'gone';
    if (!s) return 'connecting';
    if (s.phase === 'countdown' || s.phase === 'question') return this.shown ? 'question' : 'countdown';
    if (s.phase === 'locked') return 'question';
    return s.phase;
  }

  next() {
    this.socket.emit('host:next', {});
  }

  setPhone(patch: Partial<PhoneSettings>) {
    this.socket.emit('host:phone', patch);
  }

  kick(playerId: string) {
    this.socket.emit('host:kick', { playerId });
  }

  private onState(s: HostState) {
    this.state = s;
    this.answered = s.answered;
    const q = s.question;
    if (q && (s.phase === 'countdown' || s.phase === 'question')) {
      const total = q.time * 1000;
      if (this.armed !== q.index) {
        this.armed = q.index;
        clearTimeout(this.revealTimer);
        this.shown = false;
        if (q.image) new Image().src = q.image.src;
        if (s.phase === 'countdown') {
          const wait = s.countdownMs ?? 0;
          this.revealAt = performance.now() + wait;
          this.revealTimer = setTimeout(() => this.show(total), wait);
        } else {
          this.show(s.remainingMs ?? 0);
        }
      } else if (s.phase === 'question' && this.shown) {
        const serverDeadline = performance.now() + (s.remainingMs ?? 0);
        if (Math.abs(serverDeadline - this.deadline) > 1500) this.show(s.remainingMs ?? 0);
      }
      return;
    }
    clearTimeout(this.revealTimer);
    this.shown = s.phase === 'locked';
  }

  private show(remaining: number) {
    this.deadline = performance.now() + remaining;
    this.shown = true;
  }
}

export const game = new HostGame();
