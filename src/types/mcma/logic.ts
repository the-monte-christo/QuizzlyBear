// mcma – Multiple Choice mit mehreren richtigen Antworten (zeitbasiert, Teilpunkte).
import type { TypeLogic } from '../logic';
import { isInt } from '../logic';
import { countChoices, optionsSchema, type ChoicePublic, type ChoiceSummary } from '../mcsa/logic';

export interface McmaAnswer {
  options: string[];
  correct: number[];
}

/**
 * Teilpunkte: (richtig gewählte − falsch gewählte) / Anzahl richtiger Optionen, mindestens 0.
 * Wer einfach alles ankreuzt, bekommt deshalb nichts geschenkt.
 */
export function mcmaFraction(correct: number[], chosen: number[]): number {
  const right = new Set(correct);
  let hits = 0;
  let wrong = 0;
  for (const c of chosen) right.has(c) ? hits++ : wrong++;
  return Math.max(0, (hits - wrong) / right.size);
}

export const mcma: TypeLogic<McmaAnswer, ChoicePublic, number[], { correct: number[] }, ChoiceSummary> = {
  type: 'mcma',
  label: 'Mehrere Antworten',
  hint: 'Mehrere Antworten können richtig sein',
  scoring: 'time',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Multiple Choice mit einer oder mehreren richtigen Antworten. Teilpunkte: (richtig gewählte − falsch gewählte) / Anzahl richtiger, mindestens 0.',
    required: ['options', 'correct'],
    additionalProperties: false,
    properties: {
      options: optionsSchema,
      correct: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: { type: 'integer', minimum: 0 },
        description: 'Indizes aller richtigen Optionen, beginnend bei 0.',
      },
    },
  },
  check(a) {
    const bad = a.correct.filter((c) => c >= a.options.length);
    return bad.length
      ? [`answer.correct enthält ${bad.join(', ')}, es gibt aber nur ${a.options.length} Optionen (Index 0–${a.options.length - 1}).`]
      : [];
  },
  toPublic: (a) => ({ options: a.options }),
  parse(raw, a) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > a.options.length) return null;
    if (!raw.every((v) => isInt(v) && v >= 0 && v < a.options.length)) return null;
    const unique = [...new Set(raw as number[])].sort((x, y) => x - y);
    return unique.length === raw.length ? unique : null;
  },
  score(a, v) {
    const fraction = mcmaFraction(a.correct, v);
    return { fraction, correct: fraction === 1 };
  },
  solution: (a) => ({ correct: [...a.correct].sort((x, y) => x - y) }),
  summarize: (a, _p, values) => countChoices(a.options.length, values),
};
