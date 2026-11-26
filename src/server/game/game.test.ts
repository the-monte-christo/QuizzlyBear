import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Quiz } from '../../shared/quiz';
import type { HostState, PlayerState } from '../../shared/protocol';
import { Game, type GameIO } from './game';

const quiz = (over: Partial<Quiz> = {}): Quiz => ({
  title: 'Test',
  description: '',
  settings: structuredClone(DEFAULT_SETTINGS),
  questions: [
    { id: 'a', type: 'mcsa', text: 'Eins?', time: 10, points: 1000, answer: { options: ['x', 'y'], correct: 0 } },
    { id: 'b', type: 'mcsa', text: 'Zwei?', time: 10, points: 1000, answer: { options: ['x', 'y'], correct: 1 } },
  ],
  ...over,
});

function setup(q = quiz()) {
  const hostEvents: [string, any][] = [];
  const playerStates = new Map<string, PlayerState>();
  const io: GameIO = {
    host: (e, p) => hostEvents.push([e, p]),
    player: (id, e, p) => {
      if (e === 'state') playerStates.set(id, p as PlayerState);
    },
  };
  const game = new Game('123456', q, 1, 1, io);
  const join = (name: string) => {
    const r = game.addPlayer(name);
    if (!r.ok) throw new Error(r.error);
    game.setConnected(r.id, true);
    return r.id;
  };
  const host = () => game.hostState() as HostState;
  return { game, join, host, hostEvents, playerStates };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Spielablauf', () => {
  it('läuft Lobby → Countdown → Frage → Auflösung → Rangliste → Endstand', () => {
    const { game, join, host } = setup();
    const anna = join('Anna');
    const ben = join('Ben');
    expect(host().phase).toBe('lobby');

    game.next();
    expect(host().phase).toBe('countdown');
    expect(host().question?.text).toBe('Eins?');
    expect(JSON.stringify(host().question)).not.toContain('correct');

    vi.advanceTimersByTime(3000);
    expect(host().phase).toBe('question');

    expect(game.answer(anna, { qIndex: 0, value: 0, ms: 2000, seq: 1 })).toEqual({ ok: true });
    expect(host().phase).toBe('question'); // Ben fehlt noch
    expect(game.answer(ben, { qIndex: 0, value: 1, ms: 4000, seq: 1 })).toEqual({ ok: true });
    expect(host().phase).toBe('locked'); // alle haben geantwortet
    expect(host().lockReason).toBe('all');

    vi.advanceTimersByTime(1000);
    expect(host().phase).toBe('reveal');
    expect(host().reveal?.solution).toEqual({ correct: [0] });
    expect(host().reveal?.summary).toEqual({ counts: [1, 1] });

    // 1000 · (1 − 2/10/2) = 900
    expect(game.playerState(anna)?.me.score).toBe(900);
    expect(game.playerState(anna)?.result).toMatchObject({ correct: true, points: 900 });
    expect(game.playerState(ben)?.me.score).toBe(0);
    expect(game.playerState(anna)?.me.rank).toBe(1);

    game.next();
    expect(host().phase).toBe('leaderboard');
    expect(host().leaderboard?.map((r) => r.name)).toEqual(['Anna', 'Ben']);
    expect(game.playerState(ben)?.ahead).toEqual({ name: 'Anna', gap: 900 });

    game.next();
    expect(host().phase).toBe('countdown');
    vi.advanceTimersByTime(3000 + 10_000);
    expect(host().phase).toBe('locked');
    expect(host().lockReason).toBe('time');
    vi.advanceTimersByTime(1000);
    expect(host().phase).toBe('reveal');

    game.next(); // letzte Frage: direkt zum Endstand
    expect(host().phase).toBe('final');
  });

  it('erlaubt das Ändern der Antwort: Es zählt die letzte samt ihrer Zeit', () => {
    const { game, join } = setup();
    const anna = join('Anna');
    join('Ben');
    game.next();
    vi.advanceTimersByTime(3000);
    game.answer(anna, { qIndex: 0, value: 1, ms: 1000, seq: 1 });
    game.answer(anna, { qIndex: 0, value: 0, ms: 6000, seq: 2 });
    // eine verspätet eintreffende ältere Nachricht ändert nichts
    game.answer(anna, { qIndex: 0, value: 1, ms: 1000, seq: 1 });
    expect(game.playerState(anna)?.myAnswer).toMatchObject({ value: 0, ms: 6000, seq: 2 });
    vi.advanceTimersByTime(10_000 + 1000);
    expect(game.playerState(anna)?.result?.points).toBe(700); // 1000 · (1 − 6/10/2)
  });

  it('nimmt nach Zeitablauf noch eine Sekunde lang rechtzeitig getippte Antworten an', () => {
    const { game, join } = setup();
    const anna = join('Anna');
    const ben = join('Ben');
    game.next();
    vi.advanceTimersByTime(3000 + 10_000 + 500);
    expect(game.answer(anna, { qIndex: 0, value: 0, ms: 9900, seq: 1 })).toEqual({ ok: true });
    expect(game.answer(ben, { qIndex: 0, value: 0, ms: 10_400, seq: 1 })).toEqual({ ok: false, error: 'locked' });
    vi.advanceTimersByTime(600);
    expect(game.answer(ben, { qIndex: 0, value: 0, ms: 9000, seq: 2 })).toEqual({ ok: false, error: 'locked' });
    expect(game.playerState(anna)?.result?.correct).toBe(true);
  });

  it('sperrt sofort, wenn der Host weiterklickt, und lehnt ungültige Eingaben ab', () => {
    const { game, join, host } = setup();
    const anna = join('Anna');
    join('Ben');
    game.next();
    vi.advanceTimersByTime(3000);
    expect(game.answer(anna, { qIndex: 0, value: 7, ms: 100, seq: 1 })).toEqual({ ok: false, error: 'invalid' });
    expect(game.answer(anna, { qIndex: 1, value: 0, ms: 100, seq: 1 })).toEqual({ ok: false, error: 'unknown' });
    game.next();
    expect(host().phase).toBe('locked');
    expect(game.answer(anna, { qIndex: 0, value: 0, ms: 100, seq: 2 })).toEqual({ ok: false, error: 'locked' });
  });

  it('wartet beim automatischen Sperren nicht auf getrennte Spieler', () => {
    const { game, join, host } = setup();
    const anna = join('Anna');
    const ben = join('Ben');
    game.next();
    vi.advanceTimersByTime(3000);
    game.setConnected(ben, false);
    game.answer(anna, { qIndex: 0, value: 0, ms: 100, seq: 1 });
    expect(host().phase).toBe('locked');
  });
});

describe('Serie und Rangliste', () => {
  it('zählt die Serie hoch, setzt sie bei Fehlern zurück und vergibt den Bonus', () => {
    const q = quiz();
    q.settings.streak = { bonus: 100, max: 500 };
    const { game, join } = setup(q);
    const anna = join('Anna');
    const ben = join('Ben');
    game.next();
    vi.advanceTimersByTime(3000);
    game.answer(anna, { qIndex: 0, value: 0, ms: 0, seq: 1 });
    game.answer(ben, { qIndex: 0, value: 0, ms: 0, seq: 1 });
    vi.advanceTimersByTime(1000);
    expect(game.playerState(anna)?.me.streak).toBe(1);
    game.next();
    game.next();
    vi.advanceTimersByTime(3000);
    game.answer(anna, { qIndex: 1, value: 1, ms: 0, seq: 1 });
    game.answer(ben, { qIndex: 1, value: 0, ms: 0, seq: 1 });
    vi.advanceTimersByTime(1000);
    expect(game.playerState(anna)?.me.streak).toBe(2);
    expect(game.playerState(anna)?.result).toMatchObject({ points: 1000, bonus: 100 });
    expect(game.playerState(anna)?.me.score).toBe(2100);
    expect(game.playerState(ben)?.me.streak).toBe(0);
  });

  it('enthüllt die Sieger in der Reihenfolge aus dem Quiz und zeigt Handys den Platz erst danach', () => {
    const q = quiz();
    q.settings.ranking.reveal = [2, 1, 7];
    const { game, join, host } = setup(q);
    const anna = join('Anna');
    const ben = join('Ben');
    const cleo = join('Cleo');
    game.next();
    vi.advanceTimersByTime(3000);
    game.answer(anna, { qIndex: 0, value: 0, ms: 100, seq: 1 });
    game.answer(ben, { qIndex: 0, value: 0, ms: 5000, seq: 1 });
    game.answer(cleo, { qIndex: 0, value: 1, ms: 100, seq: 1 });
    vi.advanceTimersByTime(1000);
    game.next(); // Rangliste
    game.next(); // Frage 2
    vi.advanceTimersByTime(3000 + 10_000 + 1000);
    game.next(); // Endstand

    expect(host().final?.reveal).toEqual([2, 1]); // Platz 7 gibt es nicht
    expect(host().final?.step).toBe(0);
    expect(game.playerState(cleo)?.final).toMatchObject({ rank: 3, revealed: true });
    expect(game.playerState(ben)?.final).toMatchObject({ rank: 2, revealed: false });
    game.next();
    expect(game.playerState(ben)?.final?.revealed).toBe(true);
    expect(game.playerState(anna)?.final?.revealed).toBe(false);
    game.next();
    expect(game.playerState(anna)?.final).toMatchObject({ rank: 1, revealed: true });
  });
});

describe('Spieler', () => {
  it('macht doppelte Namen unterscheidbar und prüft Token beim Reconnect', () => {
    const { game } = setup();
    const a = game.addPlayer('  Max  ');
    const b = game.addPlayer('max');
    if (!a.ok || !b.ok) throw new Error('join');
    expect(game.hostState().players.map((p) => p.name)).toEqual(['Max', 'max 2']);
    expect(game.authPlayer(a.id, a.token)).toBe(true);
    expect(game.authPlayer(a.id, b.token)).toBe(false);
    expect(game.addPlayer('   ').ok).toBe(false);
  });

  it('liefert beim Reconnect mitten in der Frage Restzeit und die abgegebene Antwort', () => {
    const { game, join, playerStates } = setup();
    const anna = join('Anna');
    join('Ben');
    game.next();
    vi.advanceTimersByTime(3000 + 4000);
    game.answer(anna, { qIndex: 0, value: 1, ms: 3500, seq: 1 });
    game.setConnected(anna, false);
    game.setConnected(anna, true);
    const s = playerStates.get(anna)!;
    expect(s.phase).toBe('question');
    expect(s.remainingMs).toBe(6000);
    expect(s.myAnswer).toMatchObject({ value: 1, ms: 3500 });
  });
});
