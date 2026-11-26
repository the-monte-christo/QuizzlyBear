// order – Einträge in die richtige Reihenfolge bringen (zeitbasiert, Anteil korrekter Positionen).
import { shuffledIndices } from '../../shared/rng';
import type { TypeLogic } from '../logic';
import { isInt } from '../logic';

export interface OrderAnswer {
  /** Einträge in der RICHTIGEN Reihenfolge. */
  items: string[];
  /** Optionale Beschriftung der Enden, z. B. „älteste“ / „jüngste“. */
  first?: string;
  last?: string;
}
export interface Item {
  /** Index des Eintrags in der richtigen Reihenfolge. */
  id: number;
  text: string;
}
export interface OrderPublic {
  /** gemischt */
  items: Item[];
  first?: string;
  last?: string;
}
export interface OrderSummary {
  /** Wie viele Spieler hatten Position i richtig. */
  positions: number[];
  perfect: number;
  total: number;
}

/** Prüft, ob raw eine Permutation von 0..n-1 ist. */
export function parsePermutation(raw: unknown, n: number): number[] | null {
  if (!Array.isArray(raw) || raw.length !== n) return null;
  const seen = new Set<number>();
  for (const v of raw) {
    if (!isInt(v) || v < 0 || v >= n || seen.has(v)) return null;
    seen.add(v);
  }
  return raw as number[];
}

export function duplicates(list: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const s of list) {
    const key = s.trim().toLowerCase();
    seen.has(key) ? dup.add(s) : seen.add(key);
  }
  return [...dup];
}

export const order: TypeLogic<OrderAnswer, OrderPublic, number[], { order: number[] }, OrderSummary> = {
  type: 'order',
  label: 'Reihenfolge',
  hint: 'Bring alles in die richtige Reihenfolge',
  scoring: 'time',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Reihenfolge sortieren. „items“ steht in der RICHTIGEN Reihenfolge; gemischt wird automatisch. Punkte: Anteil der Einträge an der richtigen Position.',
    required: ['items'],
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: 2,
        maxItems: 8,
        items: { type: 'string', minLength: 1, maxLength: 80 },
        description: 'Einträge in der richtigen Reihenfolge (2–8), jeweils kurz.',
      },
      first: { type: 'string', maxLength: 24, description: 'Optionale Beschriftung des oberen Endes, z. B. „älteste“.' },
      last: { type: 'string', maxLength: 24, description: 'Optionale Beschriftung des unteren Endes, z. B. „jüngste“.' },
    },
  },
  check(a) {
    const dup = duplicates(a.items);
    return dup.length ? [`answer.items enthält „${dup[0]}“ doppelt – die Einträge müssen sich unterscheiden.`] : [];
  },
  toPublic: (a, rng) => ({
    items: shuffledIndices(a.items.length, rng).map((id) => ({ id, text: a.items[id] })),
    first: a.first,
    last: a.last,
  }),
  parse: (raw, a) => parsePermutation(raw, a.items.length),
  score(a, v) {
    const right = v.filter((id, pos) => id === pos).length;
    const fraction = right / a.items.length;
    return { fraction, correct: fraction === 1 };
  },
  solution: (a) => ({ order: a.items.map((_, i) => i) }),
  summarize(a, _p, values) {
    const positions = new Array<number>(a.items.length).fill(0);
    let perfect = 0;
    for (const v of values) {
      let all = true;
      v.forEach((id, pos) => (id === pos ? positions[pos]++ : (all = false)));
      if (all) perfect++;
    }
    return { positions, perfect, total: values.length };
  },
};
