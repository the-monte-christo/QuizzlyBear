// circle – Mittelpunkt tippen, Radius ziehen. Liegt die Lösung im Kreis, gibt es umso mehr
// Punkte, je kleiner er ist. Koordinaten normiert (0–1), Radius in Bildbreiten.
import type { TypeLogic } from '../logic';
import { isNum } from '../logic';
import { coordinate, imageDistance, parsePoint, type Point } from '../pin/logic';

export interface CircleAnswer {
  x: number;
  y: number;
  /** Kleinster wählbarer Radius = volle Punkte. Standard 0.04. */
  minRadius?: number;
  /** Radius, ab dem es auch bei einem Treffer 0 Punkte gibt. Standard 0.4. */
  maxRadius?: number;
}
export interface Circle extends Point {
  r: number;
}
export interface CirclePublic {
  minRadius: number;
  maxRadius: number;
}

export const CIRCLE_MIN = 0.04;
export const CIRCLE_MAX = 0.4;

const limits = (a: CircleAnswer): CirclePublic => ({ minRadius: a.minRadius ?? CIRCLE_MIN, maxRadius: a.maxRadius ?? CIRCLE_MAX });

/** Lösung im Kreis → linear von 1 (kleinster Radius) bis 0 (größter Radius), sonst 0. */
export function circleFraction(a: CircleAnswer, guess: Circle, aspect: number): number {
  const { minRadius, maxRadius } = limits(a);
  if (imageDistance(a, guess, aspect) > guess.r) return 0;
  return Math.min(1, Math.max(0, 1 - (guess.r - minRadius) / (maxRadius - minRadius)));
}

export const circle: TypeLogic<CircleAnswer, CirclePublic, Circle, Point, { circles: Circle[] }> = {
  type: 'circle',
  label: 'Kreis ziehen',
  hint: 'Kreise die Stelle ein – je kleiner, desto mehr Punkte',
  scoring: 'proximity',
  needsImage: true,
  answerSchema: {
    type: 'object',
    description:
      'Kreis auf dem Fragebild ziehen (die Frage braucht ein „image“): Mittelpunkt tippen, Radius ziehen. Liegt die Lösung im Kreis, gibt es umso mehr Punkte, je kleiner der Kreis ist; sonst 0. Unabhängig von der Zeit.',
    required: ['x', 'y'],
    additionalProperties: false,
    properties: {
      x: coordinate('Waagerechte Position der Lösung'),
      y: coordinate('Senkrechte Position der Lösung'),
      minRadius: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 0.5,
        default: CIRCLE_MIN,
        description: 'Kleinster wählbarer Radius in Bildbreiten; ein Treffer damit gibt volle Punkte.',
      },
      maxRadius: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 1,
        default: CIRCLE_MAX,
        description: 'Größter wählbarer Radius in Bildbreiten; ein Treffer damit gibt 0 Punkte.',
      },
    },
  },
  check(a) {
    const { minRadius, maxRadius } = limits(a);
    return minRadius >= maxRadius ? [`answer.minRadius (${minRadius}) muss kleiner als answer.maxRadius (${maxRadius}) sein.`] : [];
  },
  toPublic: (a) => limits(a),
  parse(raw: any, _a, pub) {
    const p = parsePoint(raw);
    if (!p || !isNum(raw.r) || raw.r <= 0) return null;
    return { ...p, r: Number(Math.min(pub.maxRadius, Math.max(pub.minRadius, raw.r)).toFixed(4)) };
  },
  score(a, v, ctx) {
    const fraction = circleFraction(a, v, ctx.aspect);
    return { fraction, correct: fraction >= 0.5 };
  },
  solution: (a) => ({ x: a.x, y: a.y }),
  summarize: (_a, _p, values) => ({ circles: values.slice(0, 400) }),
};
