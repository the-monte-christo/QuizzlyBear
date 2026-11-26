// poll – Meinungsfrage ohne Punkte. Das Ergebnis kann Lösung einer späteren Schätz- oder
// Bereichsfrage sein („Wie viel Prozent von uns …?“), siehe estimate und interval.
import type { TypeLogic } from '../logic';
import { isInt } from '../logic';
import { countChoices, optionsSchema, type ChoicePublic, type ChoiceSummary } from '../mcsa/logic';

export interface PollAnswer {
  options: string[];
}

export const poll: TypeLogic<PollAnswer, ChoicePublic, number, Record<string, never>, ChoiceSummary> = {
  type: 'poll',
  label: 'Umfrage',
  hint: 'Deine Meinung zählt – ohne Punkte',
  scoring: 'none',
  needsImage: false,
  answerSchema: {
    type: 'object',
    description:
      'Meinungsfrage ohne richtige Antwort und ohne Punkte. Mit einer „id“ an der Frage kann eine spätere estimate- oder interval-Frage das Ergebnis als Lösung verwenden.',
    required: ['options'],
    additionalProperties: false,
    properties: { options: optionsSchema },
  },
  check: () => [],
  toPublic: (a) => ({ options: a.options }),
  parse: (raw, a) => (isInt(raw) && raw >= 0 && raw < a.options.length ? raw : null),
  score: () => ({ fraction: 0, correct: null }),
  solution: () => ({}),
  summarize: (a, _p, values) => countChoices(a.options.length, values),
};
