// Gemeinsames für die Zahlen-Typen estimate und interval: Skala, Schrittweite und der Verweis
// auf ein Umfrage-Ergebnis als Lösung.
import type { CheckCtx, PollLookup } from '../logic';

/** Lösung als Zahl – oder als Verweis: Prozentanteil einer Option einer früheren Umfrage. */
export type NumberOrPoll = number | { poll: string; option: number };

export interface ScaleAnswer {
  min: number;
  max: number;
  correct: NumberOrPoll;
  step?: number;
  unit?: string;
}

export interface ScalePublic {
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const correctSchema = {
  description:
    'Die Lösung: eine Zahl – oder ein Verweis { "poll": "<id einer früheren poll-Frage>", "option": <Index> }. Beim Verweis ist die Lösung der Prozentanteil (0–100) der Spieler, die in dieser Runde diese Option gewählt haben.',
  oneOf: [
    { type: 'number' },
    {
      type: 'object',
      required: ['poll', 'option'],
      additionalProperties: false,
      properties: {
        poll: { type: 'string', description: 'id der Umfrage-Frage (muss früher im Quiz stehen).' },
        option: { type: 'integer', minimum: 0, description: 'Index der Option, beginnend bei 0.' },
      },
    },
  ],
};

export const scaleProperties = {
  min: { type: 'number', description: 'Linkes Ende des Schiebereglers.' },
  max: { type: 'number', description: 'Rechtes Ende des Schiebereglers. Die Lösung sollte nicht in der Mitte der Skala liegen.' },
  correct: correctSchema,
  step: {
    type: 'number',
    exclusiveMinimum: 0,
    description: 'Schrittweite des Reglers. Ohne Angabe wird eine passende gewählt (rund 100–200 Schritte).',
  },
  unit: { type: 'string', maxLength: 12, description: 'Einheit hinter der Zahl, z. B. „%“, „km“, „Jahre“.' },
};

/** „Schöne“ Schrittweite (1–2–5 · 10^k), sodass die Skala rund 100–200 Schritte hat. */
export function autoStep(min: number, max: number): number {
  const raw = (max - min) / 150;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  const step = nice * pow;
  // Ganzzahlige Skalen bleiben ganzzahlig
  return Number.isInteger(min) && Number.isInteger(max) && step < 1 ? 1 : Number(step.toPrecision(6));
}

export function decimals(step: number): number {
  const s = String(step);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

/** Rundet auf die Schrittweite und begrenzt auf die Skala. */
export function snap(v: number, p: { min: number; max: number; step: number }): number {
  const clamped = Math.min(p.max, Math.max(p.min, v));
  const snapped = p.min + Math.round((clamped - p.min) / p.step) * p.step;
  return Number(Math.min(p.max, snapped).toFixed(decimals(p.step) + 2));
}

export function formatNumber(v: number, step: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals(step) });
}

export function scalePublic(a: ScaleAnswer): ScalePublic {
  return { min: a.min, max: a.max, step: a.step ?? autoStep(a.min, a.max), unit: a.unit ?? '' };
}

export function checkScale(a: ScaleAnswer, ctx: CheckCtx): string[] {
  const errors: string[] = [];
  if (a.min >= a.max) return [`answer.min (${a.min}) muss kleiner als answer.max (${a.max}) sein.`];
  const step = a.step ?? autoStep(a.min, a.max);
  const steps = (a.max - a.min) / step;
  if (steps < 2) errors.push('answer.step ist zu groß: Die Skala braucht mindestens 2 Schritte.');
  if (steps > 2000) errors.push('answer.step ist zu klein: Die Skala darf höchstens 2000 Schritte haben.');
  if (typeof a.correct === 'number') {
    if (a.correct < a.min || a.correct > a.max) {
      errors.push(`answer.correct (${a.correct}) liegt außerhalb der Skala ${a.min}–${a.max}.`);
    }
  } else {
    const options = ctx.polls.get(a.correct.poll);
    if (options === undefined) {
      errors.push(`answer.correct verweist auf die Umfrage „${a.correct.poll}“ – eine poll-Frage mit dieser id muss vorher im Quiz stehen.`);
    } else if (a.correct.option >= options) {
      errors.push(`answer.correct.option ist ${a.correct.option}, die Umfrage „${a.correct.poll}“ hat aber nur ${options} Optionen.`);
    }
    if (a.min > 0 || a.max < 100) errors.push('Bei einem Umfrage-Verweis ist die Lösung ein Prozentwert: Die Skala muss 0 bis 100 abdecken.');
  }
  return errors;
}

/** Ersetzt den Umfrage-Verweis durch den tatsächlichen Prozentwert dieser Runde. */
export function resolveScale<A extends ScaleAnswer>(a: A, poll: PollLookup): A {
  if (typeof a.correct === 'number') return a;
  const result = poll(a.correct.poll);
  const share = result && result.total > 0 ? ((result.counts[a.correct.option] ?? 0) / result.total) * 100 : 0;
  return { ...a, correct: Math.round(share) };
}
