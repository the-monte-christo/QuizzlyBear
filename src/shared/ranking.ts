import type { Tiebreak } from './quiz';

export interface RankInput {
  id: string;
  name: string;
  score: number;
  /** Anzahl voll richtiger Antworten. */
  correct: number;
  maxStreak: number;
  /** Summe der Antwortzeiten in ms (nicht beantwortet = volle Fragezeit). */
  totalMs: number;
  /** Beitrittsreihenfolge, letzter Ausweg bei völligem Gleichstand. */
  joined: number;
}

/**
 * Sortiert Spieler zur Rangliste: zuerst nach Punkten, bei Gleichstand nach den
 * Kriterien aus settings.ranking.tiebreak. Es gibt keine geteilten Plätze.
 */
export function rankPlayers<T extends RankInput>(players: T[], tiebreak: Tiebreak[]): T[] {
  const by: Record<Tiebreak, (a: T, b: T) => number> = {
    correct: (a, b) => b.correct - a.correct,
    streak: (a, b) => b.maxStreak - a.maxStreak,
    time: (a, b) => a.totalMs - b.totalMs,
    name: (a, b) => a.name.localeCompare(b.name, 'de'),
  };
  return [...players].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    for (const t of tiebreak) {
      const d = by[t](a, b);
      if (d !== 0) return d;
    }
    return a.joined - b.joined;
  });
}
