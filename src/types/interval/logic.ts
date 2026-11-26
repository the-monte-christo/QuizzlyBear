// interval – Bereich wählen: Liegt die Lösung drin, gibt es umso mehr Punkte, je schmaler er ist.
import type { TypeLogic } from '../logic';
import { isNum } from '../logic';
import { checkScale, resolveScale, scaleProperties, scalePublic, snap, type ScaleAnswer, type ScalePublic } from '../_shared/scale';

export type IntervalAnswer = ScaleAnswer;
export type Range = [number, number];
export interface IntervalSummary {
  ranges: Range[];
  /** Anzahl der Bereiche, die die Lösung enthalten. */
  hits: number;
}

/** Lösung im Bereich → 1 − Breite/Skalenbreite, sonst 0. Ein Punkt-Treffer gibt volle Punkte. */
export function intervalFraction(a: { min: number; max: number }, correct: number, [lo, hi]: Range): number {
  if (correct < lo || correct > hi) return 0;
  return Math.max(0, 1 - (hi - lo) / (a.max - a.min));
}

export const interval: TypeLogic<IntervalAnswer, ScalePublic, Range, { correct: number }, IntervalSummary> = {
  type: 'interval',
  label: 'Bereich',
  hint: 'Wähle einen Bereich – je schmaler, desto mehr Punkte',
  scoring: 'proximity',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Bereichsfrage: Die Spieler wählen von–bis. Liegt die Lösung im Bereich, gibt es 1 − (Breite / Skalenbreite) der Punkte, sonst 0. Unabhängig von der Zeit.',
    required: ['min', 'max', 'correct'],
    additionalProperties: false,
    properties: scaleProperties,
  },
  check: checkScale,
  resolve: resolveScale,
  toPublic: (a) => scalePublic(a),
  parse(raw, _a, pub) {
    if (!Array.isArray(raw) || raw.length !== 2 || !isNum(raw[0]) || !isNum(raw[1])) return null;
    const lo = Math.min(raw[0], raw[1]);
    const hi = Math.max(raw[0], raw[1]);
    return lo < pub.min || hi > pub.max ? null : [snap(lo, pub), snap(hi, pub)];
  },
  score(a, v) {
    const fraction = intervalFraction(a, a.correct as number, v);
    return { fraction, correct: fraction >= 0.5 };
  },
  solution: (a) => ({ correct: a.correct as number }),
  summarize(a, _p, values) {
    const c = a.correct as number;
    return {
      ranges: values.slice(0, 400),
      hits: values.filter(([lo, hi]) => c >= lo && c <= hi).length,
    };
  },
};
