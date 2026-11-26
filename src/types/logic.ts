// Vertrag eines Fragetyp-Moduls.
//
// Jeder Typ liegt in src/types/<typ>/ und besteht aus
//   logic.ts       Schema, Prüfung, öffentliche Daten, Punktefunktion (Server + Tests)
//   Player.svelte  Eingabe auf dem Handy
//   Host.svelte    Darstellung auf dem Host-Screen inkl. Auflösung
//
// Generische Parameter: A = answer-Objekt aus quiz.json, P = öffentliche Daten ohne Lösung,
// V = Antwort eines Spielers, S = Lösung für die Auflösung, M = Zusammenfassung aller Antworten.

import type { QuestionType } from '../shared/quiz';
import type { Scoring } from '../shared/protocol';

export interface ScoreResult {
  /** Anteil der Maximalpunkte (0–1), vor einem eventuellen Zeitabzug. */
  fraction: number;
  /** Zählt die Antwort für die Serie als richtig? null = ohne Wertung (Umfrage). */
  correct: boolean | null;
}

export interface CheckCtx {
  hasImage: boolean;
  /** Frühere Umfragen dieses Quiz: id → Anzahl der Optionen. */
  polls: Map<string, number>;
}

export interface ScoreCtx {
  /** Seitenverhältnis des Fragebilds (Höhe / Breite), 1 ohne Bild. */
  aspect: number;
}

/** Ergebnis einer früheren Umfrage im laufenden Spiel. */
export type PollLookup = (questionId: string) => { counts: number[]; total: number } | undefined;

export interface TypeLogic<A = any, P = any, V = any, S = any, M = any> {
  type: QuestionType;
  /** Anzeigename, z. B. „Mehrfachauswahl“. */
  label: string;
  /** Kurze Anweisung für die Spieler. */
  hint: string;
  scoring: Scoring;
  needsImage: boolean;
  /** JSON-Schema des answer-Objekts (wird Teil von /schema/quiz.schema.json). */
  answerSchema: Record<string, unknown>;
  /** Inhaltliche Prüfung über das Schema hinaus; liefert verständliche Fehlermeldungen. */
  check(answer: A, ctx: CheckCtx): string[];
  /** Löst Verweise auf Umfrage-Ergebnisse auf, bevor die Frage startet. */
  resolve?(answer: A, poll: PollLookup): A;
  /** Öffentliche Daten ohne Lösung; mischt bei Bedarf. */
  toPublic(answer: A, rng: () => number): P;
  /** Prüft und normalisiert die Eingabe eines Spielers; null = ungültig. */
  parse(raw: unknown, answer: A, pub: P): V | null;
  score(answer: A, value: V, ctx: ScoreCtx): ScoreResult;
  solution(answer: A, pub: P): S;
  summarize(answer: A, pub: P, values: V[]): M;
}

export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
