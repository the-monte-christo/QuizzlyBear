// Socket.io-Schicht: ordnet Verbindungen einem Spiel und einer Rolle zu.
// Zugangsdaten stehen im Handshake (auth). Dadurch ist die Identität bei jedem
// automatischen Reconnect sofort wieder da, und gepufferte Antworten kommen an.
//
// Härtung: Jede Verbindung hat ein Kontingent je Nachrichtenart; Beitrittsversuche mit falscher
// PIN sind je Herkunftsadresse begrenzt; die Gesamtzahl der Verbindungen ist gedeckelt.

import type { Server, Socket } from 'socket.io';
import type { AnswerAck, AnswerMsg, JoinAck, JoinMsg, SimpleAck, SocketAuth } from '../shared/protocol';
import { config } from './config';
import type { GameIO } from './game/game';
import type { GameManager } from './game/manager';

const hostRoom = (pin: string) => `h:${pin}`;
const playerRoom = (pin: string, id: string) => `p:${pin}:${id}`;

/** Mehr gleichzeitige Verbindungen nimmt der Server nicht an (ein Prozess, 384 MB). */
export const MAX_CONNECTIONS = 3000;

export function makeGameIO(io: Server): (pin: string) => GameIO {
  return (pin) => ({
    host: (event, payload) => void io.to(hostRoom(pin)).emit(event, payload),
    player: (id, event, payload) => void io.to(playerRoom(pin, id)).emit(event, payload),
  });
}

/** Kontingent, das sich mit `perSecond` wieder auffüllt (Token Bucket). */
export function bucket(perSecond: number, burst: number, now: () => number = Date.now) {
  let tokens = burst;
  let last = now();
  return (): boolean => {
    const t = now();
    tokens = Math.min(burst, tokens + ((t - last) / 1000) * perSecond);
    last = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

interface SocketData {
  role?: 'host' | 'player';
  pin?: string;
  playerId?: string;
}

export function attachSockets(io: Server, games: GameManager) {
  const roomSize = (room: string) => io.sockets.adapter.rooms.get(room)?.size ?? 0;

  // Falsche PINs je Herkunftsadresse: bremst das Durchprobieren, ohne ein ganzes Büro
  // (viele Handys hinter einer Adresse) beim normalen Beitreten zu stören.
  const pinGuesses = new Map<string, { allow: () => boolean; seen: number }>();
  const sweep = setInterval(() => {
    const old = Date.now() - 10 * 60 * 1000;
    for (const [ip, g] of pinGuesses) if (g.seen < old) pinGuesses.delete(ip);
  }, 60_000);
  sweep.unref();
  const mayGuess = (ip: string): boolean => {
    let g = pinGuesses.get(ip);
    if (!g) {
      if (pinGuesses.size > 20_000) pinGuesses.clear();
      g = { allow: bucket(0.5, 30), seen: 0 };
      pinGuesses.set(ip, g);
    }
    g.seen = Date.now();
    return g.allow();
  };
  const addressOf = (socket: Socket): string => {
    const forwarded = config.trustProxy ? socket.handshake.headers['x-forwarded-for'] : undefined;
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim();
    return first || socket.handshake.address;
  };

  io.use((_socket, next) => {
    if (io.engine.clientsCount > MAX_CONNECTIONS) return next(new Error('Der Server ist gerade voll.'));
    next();
  });

  const bindPlayer = (socket: Socket, pin: string, playerId: string) => {
    const game = games.get(pin);
    if (!game) return;
    const data = socket.data as SocketData;
    data.role = 'player';
    data.pin = pin;
    data.playerId = playerId;
    socket.join(playerRoom(pin, playerId));
    game.setConnected(playerId, true);
    // setConnected sendet nur beim Wechsel offline → online; ein zweiter Tab braucht den Zustand auch
    socket.emit('state', game.playerState(playerId));
  };

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;
    const raw = socket.handshake.auth;
    const auth = (raw && typeof raw === 'object' ? raw : {}) as SocketAuth;
    const ip = addressOf(socket);

    // Kontingente dieser Verbindung
    const mayJoin = bucket(0.2, 5);
    const mayAnswer = bucket(10, 30);
    const mayHost = bucket(5, 20);

    if (auth.role === 'host') {
      const game = games.get(auth.pin);
      if (game && game.authHost(auth.hostKey)) {
        data.role = 'host';
        data.pin = game.pin;
        socket.join(hostRoom(game.pin));
        socket.emit('state', game.hostState());
      } else {
        socket.emit('gone', {});
      }
    } else if (auth.role === 'player') {
      const game = games.get(auth.pin);
      if (game && game.authPlayer(auth.playerId, auth.token)) bindPlayer(socket, game.pin, auth.playerId);
      else socket.emit('gone', {});
    }

    socket.on('player:join', (msg: JoinMsg, ack?: (r: JoinAck) => void) => {
      if (typeof ack !== 'function') return;
      if (!mayJoin()) return ack({ ok: false, error: 'Zu viele Versuche. Bitte warte einen Moment.' });
      if (data.role) return ack({ ok: false, error: 'Diese Verbindung ist schon in einem Spiel.' });
      const game = games.get(msg?.pin);
      if (!game) {
        if (!mayGuess(ip)) return ack({ ok: false, error: 'Zu viele falsche PINs. Bitte warte eine Minute.' });
        return ack({ ok: false, error: 'Kein Spiel mit dieser PIN gefunden.' });
      }
      const res = game.addPlayer(msg.name);
      if (!res.ok) return ack(res);
      // Erst antworten, dann binden: So kennt der Client seine Zugangsdaten, bevor der Zustand kommt
      ack({ ok: true, playerId: res.id, token: res.token });
      bindPlayer(socket, game.pin, res.id);
    });

    socket.on('player:answer', (msg: AnswerMsg, ack?: (r: AnswerAck) => void) => {
      const game = data.role === 'player' && mayAnswer() ? games.get(data.pin) : undefined;
      const res: AnswerAck = game && data.playerId ? game.answer(data.playerId, msg) : { ok: false, error: 'unknown' };
      if (typeof ack === 'function') ack(res);
    });

    const hostGame = () => (data.role === 'host' && mayHost() ? games.get(data.pin) : undefined);

    socket.on('host:next', (_msg: unknown, ack?: (r: SimpleAck) => void) => {
      const game = hostGame();
      game?.next();
      if (typeof ack === 'function') ack(game ? { ok: true } : { ok: false, error: 'Kein Spiel.' });
    });

    socket.on('host:phone', (msg: { showQuestion?: boolean; showAnswerText?: boolean }) => {
      hostGame()?.setPhone(msg && typeof msg === 'object' ? msg : {});
    });

    socket.on('host:kick', (msg: { playerId?: string }) => {
      const game = hostGame();
      if (!game || typeof msg?.playerId !== 'string') return;
      const room = playerRoom(game.pin, msg.playerId);
      game.kick(msg.playerId);
      for (const s of io.sockets.adapter.rooms.get(room) ?? []) {
        const other = io.sockets.sockets.get(s);
        if (other) other.data = {};
      }
      io.in(room).socketsLeave(room);
    });

    socket.on('disconnect', () => {
      if (data.role !== 'player' || !data.pin || !data.playerId) return;
      // Der Socket hat seine Räume schon verlassen: Ist kein weiterer Tab mehr da, gilt der Spieler als offline
      if (roomSize(playerRoom(data.pin, data.playerId)) === 0) {
        games.get(data.pin)?.setConnected(data.playerId, false);
      }
    });
  });
}
