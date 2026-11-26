// Baut das vollständige JSON-Schema für quiz.json aus den Fragetyp-Modulen.
// `npm run build:schema` schreibt es nach /schema/quiz.schema.json; der Server validiert damit.
import { QUESTION_TYPES, TIEBREAKS } from '../shared/quiz';
import { TYPES } from './index';
import { TYPE_LABELS } from './labels';

export const SCHEMA_ID = 'https://quizzlybear.blanke.nrw/schema/quiz.schema.json';

export function buildQuizSchema(): Record<string, unknown> {
  const available = QUESTION_TYPES.filter((t) => TYPES[t]);
  const definitions: Record<string, unknown> = {};
  const branches: unknown[] = [];
  for (const t of available) {
    definitions[`answer_${t}`] = TYPES[t]!.answerSchema;
    branches.push({
      if: { properties: { type: { const: t } }, required: ['type'] },
      then: { properties: { answer: { $ref: `#/definitions/answer_${t}` } } },
    });
  }

  definitions.question = {
    type: 'object',
    description: 'Eine Frage. Das Feld „answer“ hängt vom Typ ab.',
    required: ['type', 'text', 'answer'],
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        pattern: '^[A-Za-z0-9_-]{1,40}$',
        description:
          'Optionale, im Quiz eindeutige Kennung. Nötig, wenn eine spätere Frage auf das Ergebnis einer Umfrage verweist.',
      },
      type: {
        enum: available,
        description: 'Fragetyp: ' + available.map((t) => `${t} = ${TYPE_LABELS[t].label}`).join(', ') + '.',
      },
      text: { type: 'string', minLength: 1, maxLength: 300, description: 'Fragetext. Ideal bis etwa 120 Zeichen.' },
      image: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description:
          'Optionales Bild: im ZIP ein Pfad relativ zur quiz.json (z. B. „img/karte.jpg“), in einer reinen quiz.json eine http(s)-URL. Pflicht bei den Typen pin und circle.',
      },
      time: {
        type: 'integer',
        minimum: 5,
        maximum: 300,
        default: 20,
        description: 'Antwortzeit in Sekunden (Standard 20).',
      },
      points: {
        type: 'integer',
        minimum: 0,
        maximum: 5000,
        default: 1000,
        description: 'Maximalpunkte der Frage (Standard 1000). Für doppelte Punkte 2000.',
      },
      explanation: {
        type: 'string',
        maxLength: 200,
        description: 'Optionaler Satz, der bei der Auflösung unter der Frage erscheint.',
      },
      answer: { type: 'object', description: 'Typspezifisches Antwort-Objekt.' },
    },
    allOf: branches,
  };

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: SCHEMA_ID,
    title: 'QuizzlyBear-Quiz',
    description:
      'Ein Quiz für QuizzlyBear. Hochladen als quiz.json (Bilder als URLs) oder als ZIP mit quiz.json und Ordner img/.',
    type: 'object',
    required: ['title', 'questions'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string', description: 'Optionaler Verweis auf dieses Schema.' },
      title: { type: 'string', minLength: 1, maxLength: 80, description: 'Titel des Quiz.' },
      description: { type: 'string', maxLength: 300, description: 'Optionale Kurzbeschreibung für die Übersicht.' },
      settings: {
        type: 'object',
        description: 'Optionale Einstellungen. Alles Weggelassene bekommt den Standardwert.',
        additionalProperties: false,
        properties: {
          phone: {
            type: 'object',
            additionalProperties: false,
            description: 'Was auf den Handys der Spieler erscheint. Der Host kann beides im Spiel umschalten.',
            properties: {
              showQuestion: {
                type: 'boolean',
                default: true,
                description: 'Fragetext und Fragebild auch auf dem Handy zeigen. false: Frage nur auf dem großen Bildschirm.',
              },
              showAnswerText: {
                type: 'boolean',
                default: true,
                description: 'Antworttexte auf dem Handy zeigen. false: nur Farbe + Symbol.',
              },
            },
          },
          streak: {
            type: 'object',
            additionalProperties: false,
            description: 'Serie = richtige Antworten in Folge. Die Serie wird immer gezählt und angezeigt.',
            properties: {
              bonus: {
                type: 'integer',
                minimum: 0,
                maximum: 1000,
                default: 0,
                description: 'Bonuspunkte je Serien-Stufe ab der zweiten richtigen Antwort in Folge. 0 = kein Bonus.',
              },
              max: { type: 'integer', minimum: 0, maximum: 5000, default: 500, description: 'Obergrenze des Bonus pro Frage.' },
            },
          },
          ranking: {
            type: 'object',
            additionalProperties: false,
            properties: {
              reveal: {
                type: 'array',
                minItems: 1,
                maxItems: 20,
                uniqueItems: true,
                items: { type: 'integer', minimum: 1, maximum: 50 },
                default: [3, 2, 1],
                description:
                  'Siegerreihenfolge: die Plätze in der Reihenfolge, in der sie bei der Siegerehrung enthüllt werden. [3, 2, 1] = klassisch, [1, 2, 3] = Sieger zuerst, [5, 4, 3, 2, 1] = Top 5.',
              },
              tiebreak: {
                type: 'array',
                uniqueItems: true,
                items: { enum: [...TIEBREAKS] },
                default: ['correct', 'time', 'streak'],
                description:
                  'Bei Punktgleichheit, in dieser Reihenfolge: correct = mehr richtige Antworten, time = kürzere Gesamtzeit, streak = längste Serie, name = alphabetisch.',
              },
              top: {
                type: 'integer',
                minimum: 3,
                maximum: 8,
                default: 5,
                description: 'Anzahl der Zeilen in der Zwischen-Rangliste nach jeder Frage.',
              },
            },
          },
        },
      },
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: { $ref: '#/definitions/question' },
        description: 'Die Fragen in Spielreihenfolge.',
      },
    },
    definitions,
  };
}
