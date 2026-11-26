// Punkteformeln. Jeder Fragetyp liefert nur einen Anteil (0–1) und „richtig/falsch“;
// daraus entstehen hier die Punkte.

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Zeitbasiert: points = round(max · (1 − t/T/2) · Anteil).
 * Sofort-Antwort = volle Punkte, Antwort in letzter Sekunde = halbe Punkte.
 */
export function timePoints(ms: number, timeSec: number, fraction: number, max = 1000): number {
  const ratio = clamp(ms / (timeSec * 1000), 0, 1);
  return Math.round(max * (1 - ratio / 2) * clamp(fraction, 0, 1));
}

/** Nähebasiert: unabhängig von der Zeit. */
export function proximityPoints(fraction: number, max = 1000): number {
  return Math.round(max * clamp(fraction, 0, 1));
}

/** Serien-Bonus: ab der zweiten richtigen Antwort in Folge `bonus` Punkte je Stufe, gedeckelt. */
export function streakBonus(streak: number, bonus: number, max: number): number {
  if (bonus <= 0 || streak < 2) return 0;
  return Math.min(max, (streak - 1) * bonus);
}
