// Deko-Sticker (Honig und Früchte) in drei Tiefenebenen vor dem gemalten Hintergrund.
//
//   far   klein, blass, unscharf, bewegt sich langsam          (Datei <img>-far.webp)
//   mid   scharf, normale Größe                                (Datei <img>.webp)
//   near  sehr groß, leicht unscharf, vom Bildrand angeschnitten, etwas schneller (<img>-near.webp)
//
// Unschärfe und Schlagschatten sind in die WebP-Dateien eingerechnet (scripts/build-assets.mjs),
// im Browser läuft dafür kein Filter. Bewegt wird nur per transform.
//
// Weitere Bilder ergänzen: Quellbild nach art/src legen, `npm run build:assets` ausführen und hier
// einen Eintrag hinzufügen. Das Hintergrundmotiv selbst ist art/src/bg-*.jpg.
//   x, y   Position der Bildmitte in Prozent der Fläche (near darf über den Rand hinausragen)
//   size   Breite in rem (Host: 1 rem = 1/120 der Bildschirmbreite)
//   tilt   Neigung in Grad
//   dur    Dauer einer Schwebe-Bewegung in Sekunden
//   calm   bleibt auch während Frage und Auflösung sichtbar (dort höchstens 2–3 Elemente)

export type Layer = 'far' | 'mid' | 'near';

export interface Deco {
  img: string;
  layer: Layer;
  x: number;
  y: number;
  size: number;
  tilt: number;
  dur: number;
  calm?: boolean;
}

export const ART = {
  honeyJar: 'deco-01',
  honeycomb: 'deco-02',
  bee: 'deco-03',
  drop: 'deco-04',
  strawberry: 'deco-05',
  blueberries: 'deco-06',
  orange: 'deco-07',
  cherries: 'deco-08',
  apple: 'deco-09',
  pear: 'deco-10',
  raspberry: 'deco-11',
  lemon: 'deco-12',
} as const;

export const DECO: Record<'host' | 'phone', Deco[]> = {
  // Sechs Sticker, bewusst unregelmäßig verteilt – kein Rahmen
  host: [
    { img: ART.bee, layer: 'far', x: 3.1, y: 21, size: 3.4, tilt: 8, dur: 13, calm: true },
    { img: ART.raspberry, layer: 'far', x: 69, y: 9.5, size: 3, tilt: -10, dur: 15 },
    { img: ART.orange, layer: 'mid', x: 3.4, y: 52, size: 5.4, tilt: -16, dur: 8 },
    { img: ART.pear, layer: 'mid', x: 96.9, y: 63, size: 5, tilt: 9, dur: 7, calm: true },
    { img: ART.strawberry, layer: 'near', x: 0.5, y: 95, size: 21, tilt: -14, dur: 5.4, calm: true },
    { img: ART.cherries, layer: 'near', x: 99, y: 2.5, size: 17, tilt: 12, dur: 4.8 },
  ],
  // Auf dem Handy nur zwei, und nur außerhalb der Fragen
  phone: [
    { img: ART.cherries, layer: 'near', x: 97, y: 1.5, size: 9, tilt: 14, dur: 5.2 },
    { img: ART.bee, layer: 'far', x: 10, y: 13, size: 2.3, tilt: -8, dur: 12 },
  ],
};

const SUFFIX: Record<Layer, string> = { far: '-far', mid: '', near: '-near' };
export const decoSrc = (d: Deco) => `/art/${d.img}${SUFFIX[d.layer]}.webp`;
