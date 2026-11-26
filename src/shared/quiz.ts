// Quiz-Datenmodell: so liegt ein Quiz nach dem Import in der Datenbank und im Spiel vor.
// Das Upload-Format (quiz.json) ist in /schema/quiz.schema.json beschrieben; der Import
// ergänzt Standardwerte und ersetzt Bildpfade durch verarbeitete Bilder (ImageRef).

export const QUESTION_TYPES = [
  'mcsa',
  'mcma',
  'order',
  'match',
  'estimate',
  'interval',
  'pin',
  'circle',
  'poll',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Verarbeitetes Bild: Pfad unter /img, Maße in Pixeln. */
export interface ImageRef {
  src: string;
  w: number;
  h: number;
}

/** Kriterien für Gleichstand, in dieser Reihenfolge angewendet. */
export const TIEBREAKS = ['correct', 'time', 'streak', 'name'] as const;
export type Tiebreak = (typeof TIEBREAKS)[number];

export interface QuizSettings {
  phone: {
    /** Fragetext (und Fragebild) auch auf dem Handy zeigen. */
    showQuestion: boolean;
    /** Antworttexte auf dem Handy zeigen; sonst nur Farbe + Symbol. */
    showAnswerText: boolean;
  };
  streak: {
    /** Bonuspunkte je Serien-Stufe ab der zweiten richtigen Antwort in Folge (0 = aus). */
    bonus: number;
    /** Obergrenze des Bonus pro Frage. */
    max: number;
  };
  ranking: {
    /** Gleichstand auflösen: Reihenfolge der Kriterien. */
    tiebreak: Tiebreak[];
    /** Siegerreihenfolge: Plätze in der Reihenfolge, in der sie am Ende enthüllt werden. */
    reveal: number[];
    /** Anzahl der Zeilen in der Zwischen-Rangliste. */
    top: number;
  };
}

export const DEFAULT_SETTINGS: QuizSettings = {
  phone: { showQuestion: true, showAnswerText: true },
  streak: { bonus: 0, max: 500 },
  ranking: { tiebreak: ['correct', 'time', 'streak'], reveal: [3, 2, 1], top: 5 },
};

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  image?: ImageRef;
  /** Antwortzeit in Sekunden. */
  time: number;
  /** Maximalpunkte dieser Frage (Standard 1000). */
  points: number;
  /** Optionaler Satz, der bei der Auflösung erscheint. */
  explanation?: string;
  /** Typspezifisches Antwort-Objekt, siehe src/types/<typ>/logic.ts. */
  answer: any;
}

export interface Quiz {
  title: string;
  description: string;
  settings: QuizSettings;
  questions: Question[];
}

/** Ergänzt fehlende Einstellungen um die Standardwerte. */
export function mergeSettings(raw: any): QuizSettings {
  const d = DEFAULT_SETTINGS;
  const r = raw ?? {};
  return {
    phone: {
      showQuestion: r.phone?.showQuestion ?? d.phone.showQuestion,
      showAnswerText: r.phone?.showAnswerText ?? d.phone.showAnswerText,
    },
    streak: {
      bonus: r.streak?.bonus ?? d.streak.bonus,
      max: r.streak?.max ?? d.streak.max,
    },
    ranking: {
      tiebreak: r.ranking?.tiebreak ?? [...d.ranking.tiebreak],
      reveal: r.ranking?.reveal ?? [...d.ranking.reveal],
      top: r.ranking?.top ?? d.ranking.top,
    },
  };
}
