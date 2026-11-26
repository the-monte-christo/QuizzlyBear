// Gemeinsame Props der Typ-Komponenten.
import type { PublicQuestion, RevealInfo } from '../shared/protocol';

/** Props von <typ>/Player.svelte (Eingabe auf dem Handy). */
export interface PlayerProps {
  q: PublicQuestion;
  /** Zuletzt abgeschickte Antwort (undefined = noch keine). */
  value: unknown;
  locked: boolean;
  /** Antworttexte anzeigen; sonst nur Farbe + Symbol. */
  showText: boolean;
  /** Antwort abgeben oder ändern. */
  submit: (value: unknown) => void;
}

/** Props von <typ>/Host.svelte (Host-Screen). reveal ist ab der Auflösung gesetzt. */
export interface HostProps {
  q: PublicQuestion;
  reveal: RevealInfo | null;
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
