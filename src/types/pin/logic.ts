// pin – Punkt aufs Bild setzen (nähebasiert). Koordinaten sind normiert: x und y von 0 bis 1.
//
// Das Ziel ist entweder ein Punkt (x, y) mit kreisförmiger Toleranz oder eine Fläche (area):
// ein oder mehrere Vielecke, etwa der Umriss eines Landes oder eines Gegenstands im Wimmelbild.
import type { TypeLogic } from '../logic';
import { isNum } from '../logic';

export interface Point {
  x: number;
  y: number;
}
/** Vieleck als Liste von Eckpunkten [x, y], normiert; wird automatisch geschlossen. */
export type Polygon = [number, number][];

export interface PinAnswer {
  /** Ziel als Punkt … */
  x?: number;
  y?: number;
  /** … oder als Fläche: ein oder mehrere Vielecke (mehrere z. B. für ein Land mit Inseln). */
  area?: Polygon[];
  /** Abstand (in Bildbreiten), bis zu dem es volle Punkte gibt. Standard: Punkt 0.04, Fläche 0. */
  tolerance?: number;
  /** Abstand (in Bildbreiten), ab dem es 0 Punkte gibt. Standard: Punkt 0.3, Fläche 0.15. */
  maxDistance?: number;
}
export interface PinSolution {
  x?: number;
  y?: number;
  area?: Polygon[];
  tolerance: number;
  maxDistance: number;
}

export const PIN_TOLERANCE = 0.04;
export const PIN_MAX_DISTANCE = 0.3;
export const AREA_TOLERANCE = 0;
export const AREA_MAX_DISTANCE = 0.15;

/** Wirksame Grenzwerte: Flächen haben engere Standardwerte als Punkte. */
export function pinLimits(a: PinAnswer): { tolerance: number; maxDistance: number } {
  return {
    tolerance: a.tolerance ?? (a.area ? AREA_TOLERANCE : PIN_TOLERANCE),
    maxDistance: a.maxDistance ?? (a.area ? AREA_MAX_DISTANCE : PIN_MAX_DISTANCE),
  };
}

/**
 * Abstand zweier normierter Punkte in Bildbreiten. `aspect` = Höhe / Breite des Bilds,
 * damit ein Abstand nach oben genauso zählt wie derselbe sichtbare Abstand zur Seite.
 */
export function imageDistance(a: Point, b: Point, aspect: number): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
}

/** Liegt der Punkt im Vieleck? (Strahl nach rechts, gerade/ungerade Zahl von Kantenschnitten) */
export function insidePolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Abstand eines Punkts zur Strecke a–b, alles schon in Bildbreiten. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Abstand zur Fläche in Bildbreiten: 0, wenn der Punkt in einem der Vielecke liegt. */
export function areaDistance(area: Polygon[], p: Point, aspect: number): number {
  let min = Infinity;
  for (const poly of area) {
    if (insidePolygon(p, poly)) return 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const d = segmentDistance(p.x, p.y * aspect, poly[i][0], poly[i][1] * aspect, poly[j][0], poly[j][1] * aspect);
      if (d < min) min = d;
    }
  }
  return min;
}

/** Fläche eines Vielecks (Gaußsche Trapezformel), in normierten Einheiten. */
export function polygonArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) sum += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(sum) / 2;
}

/** Volle Punkte im Ziel bzw. innerhalb der Toleranz, dann linear fallend bis maxDistance. */
export function pinFraction(a: PinAnswer, guess: Point, aspect: number): number {
  const { tolerance, maxDistance } = pinLimits(a);
  const d = a.area ? areaDistance(a.area, guess, aspect) : imageDistance({ x: a.x!, y: a.y! }, guess, aspect);
  // kleine Reserve gegen Rundungsfehler: Wer genau auf der Grenze liegt, ist drin
  if (d <= tolerance + 1e-9) return 1;
  if (d >= maxDistance) return 0;
  return 1 - (d - tolerance) / (maxDistance - tolerance);
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
      'Punkt auf dem Fragebild setzen (die Frage braucht ein „image“). Das Ziel ist entweder ein Punkt („x“ und „y“) oder eine Fläche („area“) – nicht beides. Punkte nach Entfernung zum Ziel, unabhängig von der Zeit. Abstände zählen in Bildbreiten.',
    additionalProperties: false,
    properties: {
      x: coordinate('Waagerechte Position des Zielpunkts'),
      y: coordinate('Senkrechte Position des Zielpunkts'),
      area: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        description:
          'Ziel als Fläche: eine Liste von Vielecken, jedes eine Liste von Eckpunkten [x, y] (normiert, 0–1). Ein Treffer in einem der Vielecke gibt volle Punkte. Mehrere Vielecke z. B. für ein Land mit Inseln. Beispiel für ein Rechteck: [[[0.2, 0.3], [0.5, 0.3], [0.5, 0.6], [0.2, 0.6]]].',
        items: {
          type: 'array',
          minItems: 3,
          maxItems: 300,
          description: 'Ein Vieleck mit mindestens drei Eckpunkten, der Reihe nach am Umriss entlang. Es wird automatisch geschlossen.',
          items: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number', minimum: 0, maximum: 1 },
            description: 'Eckpunkt [x, y].',
          },
        },
      },
      tolerance: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description:
          'Abstand in Bildbreiten, bis zu dem es volle Punkte gibt. Standard beim Punkt 0.04 (4 % der Bildbreite), bei einer Fläche 0 (nur Treffer in der Fläche).',
      },
      maxDistance: {
        type: 'number',
        exclusiveMinimum: 0,
        maximum: 2,
        description:
          'Abstand in Bildbreiten, ab dem es 0 Punkte gibt; dazwischen fallen die Punkte linear. Standard beim Punkt 0.3, bei einer Fläche 0.15 (gemessen ab dem Rand der Fläche).',
      },
    },
  },
  check(a) {
    const errors: string[] = [];
    const hasPoint = a.x !== undefined || a.y !== undefined;
    if (a.area && hasPoint) {
      errors.push('answer enthält „area“ und zugleich „x“/„y“. Bitte nur eines angeben: Fläche oder Punkt.');
    } else if (!a.area && (a.x === undefined || a.y === undefined)) {
      errors.push('answer braucht ein Ziel: entweder „x“ und „y“ (Punkt) oder „area“ (Fläche).');
    }
    a.area?.forEach((poly, i) => {
      if (polygonArea(poly) < 1e-5) errors.push(`answer.area[${i}] hat keinen Flächeninhalt – die Eckpunkte liegen auf einer Linie oder aufeinander.`);
    });
    const { tolerance, maxDistance } = pinLimits(a);
    if (tolerance >= maxDistance) errors.push(`answer.tolerance (${tolerance}) muss kleiner als answer.maxDistance (${maxDistance}) sein.`);
    return errors;
  },
  toPublic: () => ({}),
  parse: (raw) => parsePoint(raw),
  score(a, v, ctx) {
    const fraction = pinFraction(a, v, ctx.aspect);
    return { fraction, correct: fraction >= 0.5 };
  },
  solution: (a) => ({ x: a.x, y: a.y, area: a.area, ...pinLimits(a) }),
  summarize: (_a, _p, values) => ({ points: values.slice(0, 400) }),
};
