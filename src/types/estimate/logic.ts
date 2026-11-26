// estimate – Zahl per Schieberegler schätzen (nähebasiert, unabhängig von der Zeit).
import type { TypeLogic } from '../logic';
import { isNum } from '../logic';
import { checkScale, resolveScale, scaleProperties, scalePublic, snap, type ScaleAnswer, type ScalePublic } from '../_shared/scale';

export interface EstimateAnswer extends ScaleAnswer {
  /** Abweichung (als Anteil der Skala), ab der es 0 Punkte gibt. Standard 0.25. */
  tolerance?: number;
}
export interface EstimateSummary {
  /** alle Schätzungen, aufsteigend */
  values: number[];
  median: number | null;
}

export const DEFAULT_TOLERANCE = 0.25;

/**
 * Punkte nach relativer Abweichung: Abweichung im Verhältnis zur Skalenbreite.
 * Volltreffer = 1, bei `tolerance` (Standard: ein Viertel der Skala) daneben = 0, dazwischen linear.
 */
export function estimateFraction(a: { min: number; max: number; tolerance?: number }, correct: number, guess: number): number {
  const deviation = Math.abs(guess - correct) / (a.max - a.min);
  return Math.max(0, 1 - deviation / (a.tolerance ?? DEFAULT_TOLERANCE));
}

export const estimate: TypeLogic<EstimateAnswer, ScalePublic, number, { correct: number }, EstimateSummary> = {
  type: 'estimate',
  label: 'Schätzfrage',
  hint: 'Schätze so genau wie möglich',
  scoring: 'proximity',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Schätzfrage mit Schieberegler. Punkte nach relativer Abweichung, unabhängig von der Zeit: Volltreffer = volle Punkte; wer um „tolerance“ (Anteil der Skalenbreite) oder mehr danebenliegt, bekommt 0.',
    required: ['min', 'max', 'correct'],
    additionalProperties: false,
    properties: {
      ...scaleProperties,
      tolerance: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 1,
        default: DEFAULT_TOLERANCE,
        description:
          'Abweichung als Anteil der Skalenbreite, ab der es 0 Punkte gibt. 0.25 = ein Viertel der Skala. Kleiner = strenger.',
      },
    },
  },
  check: checkScale,
  resolve: resolveScale,
  toPublic: (a) => scalePublic(a),
  parse: (raw, _a, pub) => (isNum(raw) && raw >= pub.min && raw <= pub.max ? snap(raw, pub) : null),
  score(a, v) {
    const fraction = estimateFraction(a, a.correct as number, v);
    return { fraction, correct: fraction >= 0.5 };
  },
  solution: (a) => ({ correct: a.correct as number }),
  summarize(_a, _p, values) {
    const sorted = [...values].sort((x, y) => x - y);
    const mid = sorted.length >> 1;
    const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { values: sorted.slice(0, 400), median };
  },
};
