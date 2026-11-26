// match – Paare verbinden (zeitbasiert, Anteil richtiger Paare).
import { shuffledIndices } from '../../shared/rng';
import type { TypeLogic } from '../logic';
import { duplicates, parsePermutation, type Item } from '../order/logic';

export interface MatchAnswer {
  pairs: { left: string; right: string }[];
}
export interface MatchPublic {
  left: string[];
  /** rechte Seite, gemischt; id = Index des Paars */
  right: Item[];
}
export interface MatchSummary {
  /** Wie viele Spieler hatten Paar i richtig. */
  pairs: number[];
  perfect: number;
  total: number;
}

export const match: TypeLogic<MatchAnswer, MatchPublic, number[], { pairs: number[] }, MatchSummary> = {
  type: 'match',
  label: 'Paare',
  hint: 'Ordne zu, was zusammengehört',
  scoring: 'time',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Paare zuordnen. Jedes Paar gehört zusammen; die rechte Seite wird automatisch gemischt. Punkte: Anteil richtig zugeordneter Paare.',
    required: ['pairs'],
    additionalProperties: false,
    properties: {
      pairs: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        description: 'Zusammengehörende Paare (2–6).',
        items: {
          type: 'object',
          required: ['left', 'right'],
          additionalProperties: false,
          properties: {
            left: { type: 'string', minLength: 1, maxLength: 50, description: 'Linke Seite (bleibt stehen), z. B. ein Land.' },
            right: { type: 'string', minLength: 1, maxLength: 50, description: 'Rechte Seite (wird gemischt), z. B. die Hauptstadt.' },
          },
        },
      },
    },
  },
  check(a) {
    const errors: string[] = [];
    const l = duplicates(a.pairs.map((p) => p.left));
    const r = duplicates(a.pairs.map((p) => p.right));
    if (l.length) errors.push(`answer.pairs: „${l[0]}“ steht links doppelt.`);
    if (r.length) errors.push(`answer.pairs: „${r[0]}“ steht rechts doppelt – die Zuordnung wäre nicht eindeutig.`);
    return errors;
  },
  toPublic: (a, rng) => ({
    left: a.pairs.map((p) => p.left),
    right: shuffledIndices(a.pairs.length, rng).map((id) => ({ id, text: a.pairs[id].right })),
  }),
  // value[i] = id der rechten Karte, die der Spieler dem linken Eintrag i zugeordnet hat
  parse: (raw, a) => parsePermutation(raw, a.pairs.length),
  score(a, v) {
    const right = v.filter((id, i) => id === i).length;
    const fraction = right / a.pairs.length;
    return { fraction, correct: fraction === 1 };
  },
  solution: (a) => ({ pairs: a.pairs.map((_, i) => i) }),
  summarize(a, _p, values) {
    const pairs = new Array<number>(a.pairs.length).fill(0);
    let perfect = 0;
    for (const v of values) {
      let all = true;
      v.forEach((id, i) => (id === i ? pairs[i]++ : (all = false)));
      if (all) perfect++;
    }
    return { pairs, perfect, total: values.length };
  },
};
