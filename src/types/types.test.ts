// Unit-Tests der Fragetyp-Module: Punktefunktion, Eingabeprüfung, öffentliche Daten.
import { describe, expect, it } from 'vitest';
import { createRng } from '../shared/rng';
import { QUESTION_TYPES } from '../shared/quiz';
import { proximityPoints, timePoints } from '../shared/scoring';
import { TYPES } from './index';
import { autoStep, snap } from './_shared/scale';
import { circle, circleFraction } from './circle/logic';
import { estimate, estimateFraction } from './estimate/logic';
import { interval, intervalFraction } from './interval/logic';
import { match } from './match/logic';
import { mcma, mcmaFraction } from './mcma/logic';
import { mcsa } from './mcsa/logic';
import { order } from './order/logic';
import { imageDistance, pin, pinFraction } from './pin/logic';
import { poll } from './poll/logic';

const rng = () => createRng(42);
const ctx = { aspect: 1 };
const noPolls = { hasImage: false, polls: new Map<string, number>() };

describe('Register', () => {
  it('kennt alle neun Typen, jeder mit Schema und Punktefunktion', () => {
    for (const t of QUESTION_TYPES) {
      const logic = TYPES[t]!;
      expect(logic.type).toBe(t);
      expect(logic.answerSchema.type).toBe('object');
      expect(typeof logic.score).toBe('function');
    }
  });
});

describe('mcsa', () => {
  const a = { options: ['a', 'b', 'c'], correct: 2 };
  it('gibt nur für die richtige Antwort Punkte, abhängig von der Zeit', () => {
    expect(mcsa.score(a, 2, ctx)).toEqual({ fraction: 1, correct: true });
    expect(mcsa.score(a, 0, ctx)).toEqual({ fraction: 0, correct: false });
    expect(timePoints(5000, 20, mcsa.score(a, 2, ctx).fraction)).toBe(875);
  });
  it('lehnt ungültige Eingaben ab und verrät die Lösung nicht', () => {
    expect(mcsa.parse(3, a, { options: a.options })).toBeNull();
    expect(mcsa.parse('2', a, { options: a.options })).toBeNull();
    expect(mcsa.parse(1.5, a, { options: a.options })).toBeNull();
    expect(mcsa.toPublic(a, rng())).toEqual({ options: ['a', 'b', 'c'] });
    expect(mcsa.summarize(a, { options: a.options }, [0, 2, 2])).toEqual({ counts: [1, 0, 2] });
  });
});

describe('mcma', () => {
  const a = { options: ['a', 'b', 'c', 'd'], correct: [0, 2] };
  it('vergibt Teilpunkte und zieht falsch Gewähltes ab', () => {
    expect(mcmaFraction([0, 2], [0, 2])).toBe(1);
    expect(mcmaFraction([0, 2], [0])).toBe(0.5);
    expect(mcmaFraction([0, 2], [0, 1])).toBe(0); // ein Treffer, ein Fehler
    expect(mcmaFraction([0, 2], [0, 1, 2])).toBe(0.5);
    expect(mcmaFraction([0, 2], [0, 1, 2, 3])).toBe(0); // alles ankreuzen bringt nichts
    expect(mcmaFraction([0, 2], [1, 3])).toBe(0); // nie negativ
  });
  it('zählt nur die vollständig richtige Auswahl für die Serie', () => {
    expect(mcma.score(a, [0, 2], ctx)).toEqual({ fraction: 1, correct: true });
    expect(mcma.score(a, [0], ctx)).toEqual({ fraction: 0.5, correct: false });
    expect(timePoints(10_000, 20, 0.5)).toBe(375);
  });
  it('normalisiert die Eingabe und lehnt Dubletten ab', () => {
    const pub = { options: a.options };
    expect(mcma.parse([2, 0], a, pub)).toEqual([0, 2]);
    expect(mcma.parse([0, 0], a, pub)).toBeNull();
    expect(mcma.parse([], a, pub)).toBeNull();
    expect(mcma.parse([4], a, pub)).toBeNull();
    expect(mcma.check({ options: ['a', 'b'], correct: [0, 5] }, noPolls)[0]).toContain('nur 2 Optionen');
  });
});

describe('order', () => {
  const a = { items: ['eins', 'zwei', 'drei', 'vier'] };
  it('wertet den Anteil korrekter Positionen', () => {
    expect(order.score(a, [0, 1, 2, 3], ctx)).toEqual({ fraction: 1, correct: true });
    expect(order.score(a, [0, 1, 3, 2], ctx)).toEqual({ fraction: 0.5, correct: false });
    expect(order.score(a, [3, 0, 1, 2], ctx).fraction).toBe(0);
  });
  it('mischt reproduzierbar, nie in die richtige Reihenfolge, und prüft Permutationen', () => {
    const pub = order.toPublic(a, rng());
    expect(pub.items.map((i) => i.id).sort()).toEqual([0, 1, 2, 3]);
    expect(pub.items.map((i) => i.id)).not.toEqual([0, 1, 2, 3]);
    expect(pub.items.every((i) => i.text === a.items[i.id])).toBe(true);
    expect(order.toPublic(a, rng())).toEqual(pub);
    expect(order.parse([0, 1, 2], a, pub)).toBeNull();
    expect(order.parse([0, 1, 2, 2], a, pub)).toBeNull();
    expect(order.parse([3, 2, 1, 0], a, pub)).toEqual([3, 2, 1, 0]);
  });
  it('fasst zusammen, welche Position wie oft stimmte', () => {
    expect(order.summarize(a, order.toPublic(a, rng()), [[0, 1, 2, 3], [0, 2, 1, 3]])).toEqual({
      positions: [2, 1, 1, 2],
      perfect: 1,
      total: 2,
    });
    expect(order.check({ items: ['A', 'a '] }, noPolls)[0]).toContain('doppelt');
  });
});

describe('match', () => {
  const a = { pairs: [{ left: 'DE', right: 'Berlin' }, { left: 'FR', right: 'Paris' }, { left: 'IT', right: 'Rom' }] };
  it('wertet den Anteil richtiger Paare', () => {
    expect(match.score(a, [0, 1, 2], ctx)).toEqual({ fraction: 1, correct: true });
    expect(match.score(a, [0, 2, 1], ctx).fraction).toBeCloseTo(1 / 3);
    expect(match.score(a, [1, 2, 0], ctx)).toEqual({ fraction: 0, correct: false });
  });
  it('mischt nur die rechte Seite und verlangt eindeutige Einträge', () => {
    const pub = match.toPublic(a, rng());
    expect(pub.left).toEqual(['DE', 'FR', 'IT']);
    expect(pub.right.map((r) => r.id)).not.toEqual([0, 1, 2]);
    expect(pub.right.every((r) => r.text === a.pairs[r.id].right)).toBe(true);
    expect(match.check({ pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'X' }] }, noPolls)[0]).toContain('rechts doppelt');
  });
});

describe('estimate', () => {
  const a = { min: 0, max: 200, correct: 100 };
  it('vergibt Punkte nach relativer Abweichung, unabhängig von der Zeit', () => {
    expect(estimateFraction(a, 100, 100)).toBe(1);
    expect(estimateFraction(a, 100, 125)).toBe(0.5); // 12,5 % der Skala daneben, Toleranz 25 %
    expect(estimateFraction(a, 100, 75)).toBe(0.5);
    expect(estimateFraction(a, 100, 150)).toBe(0);
    expect(estimateFraction(a, 100, 0)).toBe(0);
    expect(estimateFraction({ ...a, tolerance: 0.1 }, 100, 110)).toBe(0.5);
    expect(proximityPoints(estimate.score(a, 110, ctx).fraction)).toBe(800);
    expect(estimate.score(a, 125, ctx).correct).toBe(true);
    expect(estimate.score(a, 130, ctx).correct).toBe(false);
  });
  it('wählt eine passende Schrittweite und rastet darauf ein', () => {
    expect(autoStep(0, 100)).toBe(1);
    expect(autoStep(0, 5)).toBe(1); // ganzzahlige Skala bleibt ganzzahlig
    expect(autoStep(0, 1.5)).toBe(0.01);
    expect(autoStep(1900, 2030)).toBe(1);
    expect(autoStep(0, 10_000)).toBe(50);
    expect(snap(0.1 + 0.2, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snap(999, { min: 0, max: 100, step: 5 })).toBe(100);
    const pub = estimate.toPublic({ min: 0, max: 100, correct: 40, unit: '%' }, rng());
    expect(pub).toEqual({ min: 0, max: 100, step: 1, unit: '%' });
    expect(estimate.parse(40.4, a, pub)).toBe(40);
    expect(estimate.parse(101, a, pub)).toBeNull();
    expect(estimate.parse('40', a, pub)).toBeNull();
  });
  it('löst den Verweis auf ein Umfrage-Ergebnis auf', () => {
    const ref = { min: 0, max: 100, correct: { poll: 'kaffee', option: 1 } };
    const resolved = estimate.resolve!(ref, (id) => (id === 'kaffee' ? { counts: [2, 5, 1], total: 8 } : undefined));
    expect(resolved.correct).toBe(63); // 5 von 8 = 62,5 %
    expect(estimate.resolve!(ref, () => undefined).correct).toBe(0);
    expect(estimate.check(ref, noPolls)[0]).toContain('muss vorher im Quiz stehen');
    expect(estimate.check(ref, { hasImage: false, polls: new Map([['kaffee', 3]]) })).toEqual([]);
    expect(estimate.check({ ...ref, correct: { poll: 'kaffee', option: 3 } }, { hasImage: false, polls: new Map([['kaffee', 3]]) })[0]).toContain(
      'nur 3 Optionen',
    );
    expect(estimate.check({ min: 10, max: 5, correct: 7 }, noPolls)[0]).toContain('kleiner als');
    expect(estimate.check({ min: 0, max: 10, correct: 70 }, noPolls)[0]).toContain('außerhalb der Skala');
  });
  it('liefert sortierte Schätzungen und den Median', () => {
    expect(estimate.summarize(a, estimate.toPublic(a, rng()), [90, 10, 50])).toEqual({ values: [10, 50, 90], median: 50 });
    expect(estimate.summarize(a, estimate.toPublic(a, rng()), []).median).toBeNull();
  });
});

describe('interval', () => {
  const a = { min: 0, max: 100, correct: 40 };
  it('belohnt schmale Bereiche, wenn die Lösung drin liegt', () => {
    expect(intervalFraction(a, 40, [40, 40])).toBe(1);
    expect(intervalFraction(a, 40, [30, 50])).toBe(0.8);
    expect(intervalFraction(a, 40, [0, 100])).toBe(0);
    expect(intervalFraction(a, 40, [40, 90])).toBe(0.5); // Rand zählt als drin
  });
  it('gibt 0 Punkte, wenn die Lösung außerhalb liegt', () => {
    expect(intervalFraction(a, 40, [41, 45])).toBe(0);
    expect(intervalFraction(a, 40, [0, 39])).toBe(0);
    expect(interval.score(a, [30, 50], ctx)).toEqual({ fraction: 0.8, correct: true });
    expect(interval.score(a, [0, 90], ctx).correct).toBe(false); // Treffer, aber zu breit für die Serie
  });
  it('sortiert die Grenzen und prüft den Wertebereich', () => {
    const pub = interval.toPublic(a, rng());
    expect(interval.parse([50, 30], a, pub)).toEqual([30, 50]);
    expect(interval.parse([-1, 30], a, pub)).toBeNull();
    expect(interval.parse([30], a, pub)).toBeNull();
    expect(interval.summarize(a, pub, [[30, 50], [60, 70]])).toEqual({ ranges: [[30, 50], [60, 70]], hits: 1 });
  });
});

describe('pin', () => {
  const a = { x: 0.5, y: 0.5 };
  it('misst den Abstand in Bildbreiten und berücksichtigt das Seitenverhältnis', () => {
    expect(imageDistance({ x: 0, y: 0 }, { x: 0.3, y: 0.4 }, 1)).toBeCloseTo(0.5);
    // Bild doppelt so breit wie hoch: derselbe y-Unterschied ist nur halb so weit
    expect(imageDistance({ x: 0, y: 0 }, { x: 0, y: 0.4 }, 0.5)).toBeCloseTo(0.2);
  });
  it('gibt in der Toleranz volle Punkte und fällt dann linear auf 0', () => {
    expect(pinFraction(a, { x: 0.5, y: 0.5 }, 1)).toBe(1);
    expect(pinFraction(a, { x: 0.53, y: 0.5 }, 1)).toBe(1); // innerhalb 0.04
    expect(pinFraction(a, { x: 0.67, y: 0.5 }, 1)).toBeCloseTo(0.5); // Mitte zwischen 0.04 und 0.3
    expect(pinFraction(a, { x: 0.8, y: 0.5 }, 1)).toBe(0);
    expect(pinFraction(a, { x: 0.0, y: 0.0 }, 1)).toBe(0);
    expect(pinFraction({ ...a, tolerance: 0.1, maxDistance: 0.2 }, { x: 0.65, y: 0.5 }, 1)).toBeCloseTo(0.5);
    expect(pin.score(a, { x: 0.6, y: 0.5 }, ctx).correct).toBe(true);
    expect(pin.score(a, { x: 0.75, y: 0.5 }, ctx).correct).toBe(false);
  });
  it('nimmt nur normierte Koordinaten an', () => {
    expect(pin.parse({ x: 0.123456, y: 1 }, a, {})).toEqual({ x: 0.1235, y: 1 });
    expect(pin.parse({ x: 1.2, y: 0.5 }, a, {})).toBeNull();
    expect(pin.parse({ x: 0.5 }, a, {})).toBeNull();
    expect(pin.parse(null, a, {})).toBeNull();
    expect(pin.needsImage).toBe(true);
    expect(pin.check({ x: 0.5, y: 0.5, tolerance: 0.5, maxDistance: 0.2 }, noPolls)[0]).toContain('kleiner als');
  });
});

describe('circle', () => {
  const a = { x: 0.5, y: 0.5 };
  it('gibt für kleine Kreise mit der Lösung darin mehr Punkte', () => {
    expect(circleFraction(a, { x: 0.5, y: 0.5, r: 0.04 }, 1)).toBe(1);
    expect(circleFraction(a, { x: 0.5, y: 0.5, r: 0.22 }, 1)).toBeCloseTo(0.5);
    expect(circleFraction(a, { x: 0.5, y: 0.5, r: 0.4 }, 1)).toBe(0);
    expect(circleFraction(a, { x: 0.6, y: 0.5, r: 0.13 }, 1)).toBeCloseTo(0.75);
  });
  it('gibt 0 Punkte, wenn die Lösung außerhalb des Kreises liegt', () => {
    expect(circleFraction(a, { x: 0.6, y: 0.5, r: 0.09 }, 1)).toBe(0);
    expect(circleFraction(a, { x: 0.5, y: 0.7, r: 0.15 }, 1)).toBe(0);
    // flaches Bild: 0.2 nach unten sind nur 0.1 Bildbreiten – der Kreis reicht
    expect(circleFraction(a, { x: 0.5, y: 0.7, r: 0.15 }, 0.5)).toBeGreaterThan(0);
    expect(circle.score(a, { x: 0.5, y: 0.5, r: 0.1 }, ctx).correct).toBe(true);
    expect(circle.score(a, { x: 0.5, y: 0.5, r: 0.35 }, ctx).correct).toBe(false);
  });
  it('begrenzt den Radius auf den erlaubten Bereich', () => {
    const pub = circle.toPublic(a, rng());
    expect(pub).toEqual({ minRadius: 0.04, maxRadius: 0.4 });
    expect(circle.parse({ x: 0.5, y: 0.5, r: 0.001 }, a, pub)).toEqual({ x: 0.5, y: 0.5, r: 0.04 });
    expect(circle.parse({ x: 0.5, y: 0.5, r: 3 }, a, pub)).toEqual({ x: 0.5, y: 0.5, r: 0.4 });
    expect(circle.parse({ x: 0.5, y: 0.5 }, a, pub)).toBeNull();
  });
});

describe('poll', () => {
  const a = { options: ['Ja', 'Nein'] };
  it('gibt keine Punkte und beeinflusst die Serie nicht', () => {
    expect(poll.scoring).toBe('none');
    expect(poll.score(a, 0, ctx)).toEqual({ fraction: 0, correct: null });
    expect(poll.summarize(a, { options: a.options }, [0, 0, 1])).toEqual({ counts: [2, 1] });
    expect(poll.parse(2, a, { options: a.options })).toBeNull();
  });
});
