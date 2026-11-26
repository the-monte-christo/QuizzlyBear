// pin – Punkt aufs Bild setzen (nähebasiert). Koordinaten sind normiert: x und y von 0 bis 1.
import type { TypeLogic } from '../logic';
import { isNum } from '../logic';

export interface PinAnswer {
  x: number;
  y: number;
  /** Abstand (in Bildbreiten), bis zu dem es volle Punkte gibt. Standard 0.04. */
  tolerance?: number;
  /** Abstand (in Bildbreiten), ab dem es 0 Punkte gibt. Standard 0.3. */
  maxDistance?: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface PinSolution extends Point {
  tolerance: number;
  maxDistance: number;
}

export const PIN_TOLERANCE = 0.04;
export const PIN_MAX_DISTANCE = 0.3;

/**
 * Abstand zweier normierter Punkte in Bildbreiten. `aspect` = Höhe / Breite des Bilds,
 * damit ein Abstand nach oben genauso zählt wie derselbe sichtbare Abstand zur Seite.
 */
export function imageDistance(a: Point, b: Point, aspect: number): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
}

export function pinFraction(a: PinAnswer, guess: Point, aspect: number): number {
  const tol = a.tolerance ?? PIN_TOLERANCE;
  const max = a.maxDistance ?? PIN_MAX_DISTANCE;
  const d = imageDistance(a, guess, aspect);
  if (d <= tol) return 1;
  if (d >= max) return 0;
  return 1 - (d - tol) / (max - tol);
}

export const coordinate = (what: string) => ({
  type: 'number',
  minimum: 0,
  maximum: 1,
  description: `${what} als Anteil der Bildgröße: 0 = links/oben, 1 = rechts/unten. Beispiel: Bildmitte = 0.5.`,
});

export const parsePoint = (raw: any): Point | null =>
  raw && isNum(raw.x) && isNum(raw.y) && raw.x >= 0 && raw.x <= 1 && raw.y >= 0 && raw.y <= 1
    ? { x: Number(raw.x.toFixed(4)), y: Number(raw.y.toFixed(4)) }
    : null;

export const pin: TypeLogic<PinAnswer, Record<string, never>, Point, PinSolution, { points: Point[] }> = {
  type: 'pin',
  label: 'Punkt setzen',
  hint: 'Tippe auf die richtige Stelle im Bild',
  scoring: 'proximity',
  needsImage: true,
  answerSchema: {
    type: 'object',
    description:
      'Punkt auf dem Fragebild setzen (die Frage braucht ein „image“). Punkte nach Entfernung zur Lösung, unabhängig von der Zeit. Abstände zählen in Bildbreiten.',
    required: ['x', 'y'],
    additionalProperties: false,
    properties: {
      x: coordinate('Waagerechte Position der Lösung'),
      y: coordinate('Senkrechte Position der Lösung'),
      tolerance: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 1,
        default: PIN_TOLERANCE,
        description: 'Abstand in Bildbreiten, bis zu dem es volle Punkte gibt (0.04 = 4 % der Bildbreite).',
      },
      maxDistance: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 2,
        default: PIN_MAX_DISTANCE,
        description: 'Abstand in Bildbreiten, ab dem es 0 Punkte gibt. Dazwischen fallen die Punkte linear.',
      },
    },
  },
  check(a) {
    const tol = a.tolerance ?? PIN_TOLERANCE;
    const max = a.maxDistance ?? PIN_MAX_DISTANCE;
    return tol >= max ? [`answer.tolerance (${tol}) muss kleiner als answer.maxDistance (${max}) sein.`] : [];
  },
  toPublic: () => ({}),
  parse: (raw) => parsePoint(raw),
  score(a, v, ctx) {
    const fraction = pinFraction(a, v, ctx.aspect);
    return { fraction, correct: fraction >= 0.5 };
  },
  solution: (a) => ({ x: a.x, y: a.y, tolerance: a.tolerance ?? PIN_TOLERANCE, maxDistance: a.maxDistance ?? PIN_MAX_DISTANCE }),
  summarize: (_a, _p, values) => ({ points: values.slice(0, 400) }),
};
