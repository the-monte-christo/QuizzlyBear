import { randomInt } from 'node:crypto';
import type { Quiz } from '../../shared/quiz';
import { Game, type GameIO } from './game';

const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000; // Spiele ohne Aktivität
const FINAL_LIMIT_MS = 60 * 60 * 1000; // beendete Spiele bleiben noch eine Stunde sichtbar

/** Hält alle laufenden Spiele im Speicher (ein Node-Prozess, kein Cluster). */
export class GameManager {
  private games = new Map<string, Game>();
  private sweep: ReturnType<typeof setInterval>;

  constructor(private makeIO: (pin: string) => GameIO) {
    this.sweep = setInterval(() => this.cleanup(), 60_000);
    this.sweep.unref();
  }

  create(quiz: Quiz, quizId: number, ownerId: number): Game {
    let pin: string;
    do pin = String(randomInt(100000, 1000000));
    while (this.games.has(pin));
    const game = new Game(pin, quiz, quizId, ownerId, this.makeIO(pin));
    this.games.set(pin, game);
    return game;
  }

  get(pin: unknown): Game | undefined {
    return typeof pin === 'string' ? this.games.get(pin.replace(/\D/g, '')) : undefined;
  }

  byOwner(ownerId: number): Game[] {
    return [...this.games.values()].filter((g) => g.ownerId === ownerId);
  }

  remove(pin: string) {
    this.games.get(pin)?.destroy();
    this.games.delete(pin);
  }

  /** Spiele, in denen gerade gespielt wird (für den Health-Endpunkt und sichere Deployments). */
  get activeCount(): number {
    return [...this.games.values()].filter((g) => g.phase !== 'final' && g.playerCount > 0).length;
  }

  private cleanup() {
    const now = Date.now();
    for (const [pin, g] of this.games) {
      const limit = g.phase === 'final' ? FINAL_LIMIT_MS : IDLE_LIMIT_MS;
      if (now - g.lastActivity > limit) this.remove(pin);
    }
  }
}
