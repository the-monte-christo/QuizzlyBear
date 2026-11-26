// Anzeigenamen und Kurzanweisungen der Fragetypen (für Handy, Host und Quizmaster).
import type { QuestionType } from '../shared/quiz';

export const TYPE_LABELS: Record<QuestionType, { label: string; hint: string }> = {
  mcsa: { label: 'Eine Antwort', hint: 'Genau eine Antwort ist richtig' },
  mcma: { label: 'Mehrere Antworten', hint: 'Mehrere Antworten können richtig sein' },
  order: { label: 'Reihenfolge', hint: 'Bring alles in die richtige Reihenfolge' },
  match: { label: 'Paare', hint: 'Ordne zu, was zusammengehört' },
  estimate: { label: 'Schätzfrage', hint: 'Schätze so genau wie möglich' },
  interval: { label: 'Bereich', hint: 'Wähle einen Bereich – je schmaler, desto mehr Punkte' },
  pin: { label: 'Punkt setzen', hint: 'Tippe auf die richtige Stelle im Bild' },
  circle: { label: 'Kreis ziehen', hint: 'Kreise die Stelle ein – je kleiner, desto mehr Punkte' },
  poll: { label: 'Umfrage', hint: 'Deine Meinung zählt – ohne Punkte' },
};
