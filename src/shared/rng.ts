/** Kleiner, deterministischer Zufallsgenerator (mulberry32) für reproduzierbares Mischen. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mischt 0..n-1. Bei n > 1 ist das Ergebnis nie die sortierte Reihenfolge. */
export function shuffledIndices(n: number, rng: () => number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (idx.some((v, i) => v !== i)) return idx;
  }
  // praktisch unerreichbar; zur Sicherheit einmal rotieren
  idx.push(idx.shift()!);
  return idx;
}
