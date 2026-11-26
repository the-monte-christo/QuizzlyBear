// mcsa – Multiple Choice, genau eine richtige Antwort (zeitbasiert).
import type { TypeLogic } from '../logic';
import { isInt } from '../logic';

export interface McsaAnswer {
  options: string[];
  correct: number;
}
export interface ChoicePublic {
  options: string[];
}
export interface McsaSolution {
  correct: number[];
}
export interface ChoiceSummary {
  /** Stimmen je Option. */
  counts: number[];
}

export const optionsSchema = {
  type: 'array',
  minItems: 2,
  maxItems: 6,
  items: { type: 'string', minLength: 1, maxLength: 120 },
  description: 'Antwortoptionen (2–6). Kurz halten: ideal bis 60 Zeichen.',
};

export function countChoices(n: number, values: (number | number[])[]): ChoiceSummary {
  const counts = new Array<number>(n).fill(0);
  for (const v of values) for (const i of Array.isArray(v) ? v : [v]) counts[i]++;
  return { counts };
}

export const mcsa: TypeLogic<McsaAnswer, ChoicePublic, number, McsaSolution, ChoiceSummary> = {
  type: 'mcsa',
  label: 'Eine Antwort',
  hint: 'Genau eine Antwort ist richtig',
  scoring: 'time',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description: 'Multiple Choice mit genau einer richtigen Antwort.',
    required: ['options', 'correct'],
    additionalProperties: false,
    properties: {
      options: optionsSchema,
      correct: { type: 'integer', minimum: 0, description: 'Index der richtigen Option, beginnend bei 0.' },
    },
  },
  check(a) {
    return a.correct >= a.options.length
      ? [`answer.correct ist ${a.correct}, es gibt aber nur ${a.options.length} Optionen (Index 0–${a.options.length - 1}).`]
      : [];
  },
  toPublic: (a) => ({ options: a.options }),
  parse: (raw, a) => (isInt(raw) && raw >= 0 && raw < a.options.length ? raw : null),
  score: (a, v) => ({ fraction: v === a.correct ? 1 : 0, correct: v === a.correct }),
  solution: (a) => ({ correct: [a.correct] }),
  summarize: (a, _p, values) => countChoices(a.options.length, values),
};
