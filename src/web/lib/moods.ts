// Reaktionen von Quizzly und Herry auf Ergebnisse – als Pools, damit es abwechslungsreich bleibt.
//
// Tonfall: Die beiden freuen sich mit, staunen, leiden mit oder sind frech – aber sie lachen
// niemanden aus, der falsch liegt oder hinten steht. Herry darf fies grinsen, wo es keinen trifft.

import type { Art } from './art';

export interface Mood {
  art: Art;
  line: string;
}

/** Stabile Zahl aus einer Kennung (z. B. Spieler-ID): Jeder Spieler startet an anderer Stelle im Pool. */
export function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Wählt reihum aus dem Pool: Mit fortlaufendem `turn` wiederholt sich nichts direkt. */
export function pick<T>(pool: readonly T[], seed: number, turn = 0): T {
  return pool[(seed + turn) % pool.length];
}

/** Behält die Schlüssel als Typ, die Einträge bleiben schlichte Mood-Listen. */
const pools = <K extends string>(p: Record<K, readonly Mood[]>) => p;

// ---------------------------------------------------------------- Handy: Ergebnis einer Frage

export const RESULT = pools({
  correct: [
    { art: 'bear-cheer', line: 'Quizzly feiert mit dir.' },
    { art: 'bear-thumbs', line: 'Sauber gelöst.' },
    { art: 'herry-wow', line: 'Sogar Herry ist beeindruckt.' },
    { art: 'bear-clap', line: 'Applaus vom Chef persönlich.' },
    { art: 'bear-relaxed', line: 'Genau so.' },
    { art: 'bear-cool', line: 'Lässig. Sehr lässig.' },
  ],
  /** richtig und schon eine Serie von mindestens drei */
  streak: [
    { art: 'bear-cool', line: 'Läuft bei dir.' },
    { art: 'herry-shock', line: 'Herry kommt aus dem Staunen nicht raus.' },
    { art: 'herry-wow', line: 'Herry will wissen, wie du das machst.' },
    { art: 'bear-cheer', line: 'Nicht zu stoppen!' },
  ],
  partial: [
    { art: 'bear-think', line: 'Da geht noch was.' },
    { art: 'herry-relaxed', line: 'Herry meint: gar nicht übel.' },
    { art: 'bear-relaxed', line: 'Halb gewonnen.' },
  ],
  wrong: [
    { art: 'bear-ohno', line: 'Oh no …' },
    { art: 'bear-comfort', line: 'Kopf hoch, die nächste sitzt.' },
    { art: 'herry-ohno', line: 'Herry kann gar nicht hinsehen.' },
    { art: 'bear-shock', line: 'Damit hat Quizzly nicht gerechnet.' },
    { art: 'herry-pout', line: 'Herry schmollt solidarisch mit.' },
    { art: 'bear-oops', line: 'Passiert den Besten.' },
  ],
  none: [
    { art: 'bear-clock', line: 'Beim nächsten Mal schneller!' },
    { art: 'bear-nervous', line: 'Quizzly hat mitgezittert.' },
    { art: 'herry-pout', line: 'Herry wartet immer noch auf deine Antwort.' },
  ],
  poll: [
    { art: 'bear-wave', line: 'Danke fürs Mitmachen.' },
    { art: 'herry-relaxed', line: 'Herry hätte dasselbe gesagt.' },
    { art: 'bear-relaxed', line: 'Jede Meinung zählt.' },
  ],
  // Schätzen, Bereich, Punkt, Kreis
  bullseye: [
    { art: 'bear-cheer', line: 'Besser geht es nicht.' },
    { art: 'bear-cool', line: 'Punktlandung.' },
    { art: 'herry-shock', line: 'Herry glaubt an Hellseherei.' },
  ],
  close: [
    { art: 'bear-thumbs', line: 'Richtig gut geschätzt.' },
    { art: 'herry-wow', line: 'Herry nickt anerkennend.' },
    { art: 'bear-clap', line: 'Das war nah dran.' },
  ],
  near: [
    { art: 'bear-think', line: 'Ein paar Punkte gibt es trotzdem.' },
    { art: 'herry-relaxed', line: 'Herry sagt: Die Richtung stimmte.' },
    { art: 'bear-comfort', line: 'Fast – beim nächsten Mal.' },
  ],
});

// ---------------------------------------------------------------- Handy: Platz in der Rangliste

export const RANK = pools({
  first: [
    { art: 'bear-cheer', line: 'Ganz vorn – halt die Stellung!' },
    { art: 'bear-cool', line: 'Platz 1. Einfach so.' },
    { art: 'herry-wow', line: 'Herry jubelt von der Seitenlinie.' },
  ],
  /** Plätze gutgemacht: Hier darf Herry fies grinsen */
  up: [
    { art: 'herry-grin', line: 'Herry grinst: Da hast du jemanden überholt.' },
    { art: 'bear-thumbs', line: 'Es geht nach oben.' },
    { art: 'bear-cool', line: 'Still und leise vorgerückt.' },
  ],
  down: [
    { art: 'bear-comfort', line: 'Noch ist nichts verloren.' },
    { art: 'bear-nervous', line: 'Jetzt wird es spannend.' },
    { art: 'herry-ohno', line: 'Herry drückt dir die Flossen.' },
  ],
  same: [
    { art: 'bear-think', line: 'Dranbleiben.' },
    { art: 'bear-relaxed', line: 'Solide Position.' },
    { art: 'herry-relaxed', line: 'Herry meint: alles im grünen Bereich.' },
  ],
});

// ---------------------------------------------------------------- Handy: Endstand

export const FINAL = pools({
  winner: [{ art: 'bear-trophy', line: 'Gewonnen! Quizzly verneigt sich.' }],
  podium: [
    { art: 'bear-cheer', line: 'Auf dem Treppchen!' },
    { art: 'herry-wow', line: 'Herry applaudiert.' },
  ],
  rest: [
    { art: 'bear-thumbs', line: 'Danke fürs Mitspielen!' },
    { art: 'bear-clap', line: 'Schön, dass du dabei warst.' },
    { art: 'herry-relaxed', line: 'Herry sagt: Revanche jederzeit.' },
    { art: 'bear-wave', line: 'Bis zum nächsten Quiz!' },
  ],
  /** Platz steht fest, wird aber erst auf dem großen Bildschirm enthüllt */
  secret: [
    { art: 'herry-grin', line: 'Herry weiß es schon – verrät aber nichts.' },
    { art: 'bear-nervous', line: 'Quizzly hält es kaum aus.' },
  ],
});

// ---------------------------------------------------------------- Host: Kommentar zur Auflösung

export const HOST_REVEAL = pools({
  poll: [
    { art: 'bear-wave', line: 'So denkt die Runde.' },
    { art: 'herry-relaxed', line: 'Herry hat natürlich mit abgestimmt.' },
  ],
  nobody: [
    { art: 'bear-nervous', line: 'Niemand traut sich?' },
    { art: 'herry-pout', line: 'Herry hätte gern eine Antwort gesehen.' },
  ],
  all: [
    { art: 'herry-shock', line: 'Alle richtig?! Herry ist sprachlos.' },
    { art: 'bear-clap', line: 'Alle richtig – Applaus für alle!' },
  ],
  most: [
    { art: 'bear-cheer', line: 'Stark gespielt!' },
    { art: 'bear-thumbs', line: 'Das sitzt.' },
  ],
  some: [
    { art: 'bear-think', line: 'Gar nicht so einfach …' },
    { art: 'bear-relaxed', line: 'Die einen sagen so, die anderen so.' },
  ],
  few: [
    { art: 'herry-wow', line: 'Respekt an alle, die es wussten.' },
    { art: 'bear-shock', line: 'Die war knackig.' },
  ],
  // Niemand lag richtig: Herry ist der Störenfried, nicht der Schadenfrohe
  zero: [
    { art: 'herry-grin', line: 'Diese Frage hat Herry ausgesucht.' },
    { art: 'bear-ohno', line: 'Autsch. Die war fies.' },
  ],
});

/** Wer an der Rangliste auf dem Host herumlungert. */
export const HOST_BOARD: Record<'bear' | 'herry', readonly Art[]> = {
  bear: ['bear-think', 'bear-cool', 'bear-relaxed', 'bear-clap'],
  herry: ['herry-cool', 'herry-grin', 'herry-relaxed', 'herry-wow'],
};
