// Deko-Sticker für den Hintergrund (Honig und Früchte).
//
// Weitere Bilder ergänzen: WebP nach src/web/public/art legen (oder Quellbild nach art/src
// und `npm run build:assets` laufen lassen) und hier einen Eintrag hinzufügen.
//   img   Dateiname ohne .webp
//   x, y  Position der Bildmitte in Prozent der Fläche
//   size  Breite in rem (Host: 1rem = 1/120 der Bildschirmbreite)
//   tilt  Neigung in Grad
//   dur   Dauer einer Schwebe-Bewegung in Sekunden

export interface Deco {
  img: string;
  x: number;
  y: number;
  size: number;
  tilt: number;
  dur: number;
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
  // Am Rand entlang, damit die Mitte für Inhalte frei bleibt
  host: [
    { img: ART.blueberries, x: 2.6, y: 15, size: 5.6, tilt: -10, dur: 6.5 },
    { img: ART.bee, x: 2.4, y: 33, size: 4.6, tilt: 8, dur: 4.5 },
    { img: ART.orange, x: 2.5, y: 51, size: 5.2, tilt: -16, dur: 7.5 },
    { img: ART.lemon, x: 2.6, y: 69, size: 5, tilt: 10, dur: 6.2 },
    { img: ART.honeyJar, x: 3.1, y: 88, size: 7, tilt: -8, dur: 7 },
    { img: ART.strawberry, x: 97.4, y: 16, size: 5.4, tilt: 12, dur: 6 },
    { img: ART.pear, x: 97.5, y: 34, size: 4.6, tilt: -8, dur: 7.2 },
    { img: ART.cherries, x: 97.6, y: 52, size: 5.2, tilt: 14, dur: 6.8 },
    { img: ART.raspberry, x: 97.5, y: 70, size: 4.8, tilt: -12, dur: 6.4 },
    { img: ART.honeycomb, x: 97, y: 88, size: 6.6, tilt: 9, dur: 8 },
  ],
  // Auf dem Handy bewusst wenige und kleine Sticker
  phone: [
    { img: ART.honeycomb, x: 90, y: 6, size: 4.6, tilt: 12, dur: 7 },
    { img: ART.strawberry, x: 8, y: 93, size: 3.8, tilt: -12, dur: 6 },
  ],
};
