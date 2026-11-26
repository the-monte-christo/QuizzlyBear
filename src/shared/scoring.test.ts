import { describe, expect, it } from 'vitest';
import { proximityPoints, streakBonus, timePoints } from './scoring';
import { rankPlayers } from './ranking';

describe('timePoints', () => {
  it('gibt sofort volle und am Ende halbe Punkte', () => {
    expect(timePoints(0, 20, 1)).toBe(1000);
    expect(timePoints(10_000, 20, 1)).toBe(750);
    expect(timePoints(20_000, 20, 1)).toBe(500);
  });
  it('begrenzt die Zeit auf die Fragedauer und skaliert mit Teilpunkten', () => {
    expect(timePoints(99_000, 20, 1)).toBe(500);
    expect(timePoints(-50, 20, 1)).toBe(1000);
    expect(timePoints(0, 20, 0.5)).toBe(500);
    expect(timePoints(0, 20, 0)).toBe(0);
    expect(timePoints(0, 20, 1, 2000)).toBe(2000);
  });
});

describe('proximityPoints', () => {
  it('ist unabhängig von der Zeit und auf 0–1 begrenzt', () => {
    expect(proximityPoints(1)).toBe(1000);
    expect(proximityPoints(0.333)).toBe(333);
    expect(proximityPoints(-1)).toBe(0);
    expect(proximityPoints(5)).toBe(1000);
  });
});

describe('streakBonus', () => {
  it('startet bei der zweiten richtigen Antwort und ist gedeckelt', () => {
    expect(streakBonus(1, 100, 500)).toBe(0);
    expect(streakBonus(2, 100, 500)).toBe(100);
    expect(streakBonus(4, 100, 500)).toBe(300);
    expect(streakBonus(20, 100, 500)).toBe(500);
    expect(streakBonus(5, 0, 500)).toBe(0);
  });
});

describe('rankPlayers', () => {
  const p = (id: string, score: number, correct = 0, totalMs = 0, maxStreak = 0, joined = 0) => ({
    id,
    name: id,
    score,
    correct,
    totalMs,
    maxStreak,
    joined,
  });
  it('sortiert nach Punkten, dann nach den Gleichstands-Kriterien in der angegebenen Reihenfolge', () => {
    const players = [p('a', 500, 1, 9000), p('b', 800), p('c', 500, 2, 9500), p('d', 500, 2, 4000)];
    expect(rankPlayers(players, ['correct', 'time']).map((x) => x.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(rankPlayers(players, ['time', 'correct']).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('fällt bei völligem Gleichstand auf die Beitrittsreihenfolge zurück', () => {
    const players = [p('z', 100, 0, 0, 0, 2), p('y', 100, 0, 0, 0, 1)];
    expect(rankPlayers(players, []).map((x) => x.id)).toEqual(['y', 'z']);
    expect(rankPlayers(players, ['name']).map((x) => x.id)).toEqual(['y', 'z']);
  });
});
