// Prüft eine hochgeladene quiz.json: zuerst gegen das JSON-Schema (ajv), dann inhaltlich
// über die Fragetyp-Module. Fehler kommen als verständliche deutsche Sätze mit Fundstelle zurück.
import { Ajv, type ErrorObject } from 'ajv';
import { logicFor } from '../../types';
import { buildQuizSchema } from '../../types/schema';

export interface ImportError {
  /** Lesbare Fundstelle, z. B. „Frage 3 (mcsa) · answer.correct“. */
  path: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: false });
const validateSchema = ajv.compile(buildQuizSchema());

const TYPE_NAMES: Record<string, string> = {
  string: 'ein Text in Anführungszeichen',
  integer: 'eine ganze Zahl',
  number: 'eine Zahl',
  boolean: 'true oder false',
  array: 'eine Liste [ … ]',
  object: 'ein Objekt { … }',
};

/** /questions/2/answer/options/1 → „Frage 3 (mcsa) · answer.options[1]“ */
function prettyPath(instancePath: string, quiz: any): string {
  const parts = instancePath.split('/').filter(Boolean);
  if (parts.length === 0) return 'quiz.json';
  let head = '';
  let rest = parts;
  if (parts[0] === 'questions' && parts.length > 1) {
    const i = Number(parts[1]);
    const type = quiz?.questions?.[i]?.type;
    head = `Frage ${i + 1}${typeof type === 'string' ? ` (${type})` : ''}`;
    rest = parts.slice(2);
  }
  const tail = rest.reduce((acc, p) => (/^\d+$/.test(p) ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), '');
  return [head, tail].filter(Boolean).join(' · ');
}

function explain(e: ErrorObject): string | null {
  const p = e.params as Record<string, any>;
  switch (e.keyword) {
    case 'if':
      return null; // Folgefehler von if/then – der eigentliche Fehler steht daneben
    case 'required':
      return `Das Feld „${p.missingProperty}“ fehlt.`;
    case 'additionalProperties':
      return `Das Feld „${p.additionalProperty}“ ist hier nicht bekannt (Tippfehler?).`;
    case 'type':
      return `Hier wird ${TYPE_NAMES[String(p.type)] ?? p.type} erwartet.`;
    case 'enum':
      return `Erlaubt sind nur: ${(p.allowedValues as unknown[]).join(', ')}.`;
    case 'const':
      return `Erwartet wird ${JSON.stringify(p.allowedValue)}.`;
    case 'minimum':
      return `Der Wert muss mindestens ${p.limit} sein.`;
    case 'maximum':
      return `Der Wert darf höchstens ${p.limit} sein.`;
    case 'exclusiveMinimum':
      return `Der Wert muss größer als ${p.limit} sein.`;
    case 'exclusiveMaximum':
      return `Der Wert muss kleiner als ${p.limit} sein.`;
    case 'minLength':
      return p.limit === 1 ? 'Der Text darf nicht leer sein.' : `Der Text braucht mindestens ${p.limit} Zeichen.`;
    case 'maxLength':
      return `Der Text ist zu lang (höchstens ${p.limit} Zeichen).`;
    case 'minItems':
      return `Die Liste braucht mindestens ${p.limit} Einträge.`;
    case 'maxItems':
      return `Die Liste darf höchstens ${p.limit} Einträge haben.`;
    case 'uniqueItems':
      return 'Die Liste enthält einen Eintrag doppelt.';
    case 'pattern':
      return 'Erlaubt sind nur Buchstaben, Ziffern, Binde- und Unterstrich (höchstens 40 Zeichen).';
    case 'oneOf':
    case 'anyOf':
      return 'Der Wert hat keine der erlaubten Formen (siehe Format-Beschreibung).';
    default:
      return e.message ?? 'Ungültiger Wert.';
  }
}

export function validateQuiz(raw: unknown): ImportError[] {
  const errors: ImportError[] = [];
  if (!validateSchema(raw)) {
    const seen = new Set<string>();
    for (const e of validateSchema.errors ?? []) {
      // Bei oneOf/anyOf meldet ajv auch jeden Zweig einzeln – das verwirrt mehr, als es hilft
      if (/\/(oneOf|anyOf)\/\d+\//.test(e.schemaPath)) continue;
      const message = explain(e);
      if (!message) continue;
      const path = prettyPath(e.instancePath, raw);
      const key = `${path}|${message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({ path, message });
    }
    return errors;
  }

  // Inhaltliche Prüfung – das Schema hat die Form schon garantiert
  const quiz = raw as { questions: any[] };
  const ids = new Set<string>();
  const polls = new Map<string, number>();
  quiz.questions.forEach((q, i) => {
    const where = `Frage ${i + 1} (${q.type})`;
    const id: string = q.id ?? `q${i + 1}`;
    if (ids.has(id)) errors.push({ path: `${where} · id`, message: `Die Kennung „${id}“ kommt mehrfach vor.` });
    ids.add(id);

    const logic = logicFor(q.type)!;
    if (logic.needsImage && !q.image) {
      errors.push({ path: `${where} · image`, message: 'Dieser Fragetyp braucht ein Bild.' });
    }
    for (const message of logic.check(q.answer, { hasImage: !!q.image, polls })) {
      errors.push({ path: where, message });
    }
    if (q.type === 'poll') polls.set(id, q.answer.options.length);
  });
  return errors;
}
