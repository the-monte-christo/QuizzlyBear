// Socket.io-Schicht: ordnet Verbindungen einem Spiel und einer Rolle zu.
// Zugangsdaten stehen im Handshake (auth). Dadurch ist die Identität bei jedem
// automatischen Reconnect sofort wieder da, und gepufferte Antworten kommen an.

import type { Server, Socket } from 'socket.io';
import type { AnswerAck, AnswerMsg, JoinAck, JoinMsg, SimpleAck, SocketAuth } from '../shared/protocol';
import type { GameIO } from './game/game';
import type { GameManager } from './game/manager';

const hostRoom = (pin: string) => `h:${pin}`;
const playerRoom = (pin: string, id: string) => `p:${pin}:${id}`;

export function makeGameIO(io: Server): (pin: string) => GameIO {
  return (pin) => ({
    host: (event, payload) => void io.to(hostRoom(pin)).emit(event, payload),
    player: (id, event, payload) => void io.to(playerRoom(pin, id)).emit(event, payload),
  });
}

interface SocketData {
  role?: 'host' | 'player';
  pin?: string;
  playerId?: string;
}

export function attachSockets(io: Server, games: GameManager) {
  const roomSize = (room: string) => io.sockets.adapter.rooms.get(room)?.size ?? 0;

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
    const auth = (socket.handshake.auth ?? {}) as SocketAuth;

    if (auth.role === 'host') {
      const game = games.get(auth.pin);
      if (game && auth.hostKey === game.hostKey) {
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
      const game = games.get(msg?.pin);
      if (!game) return ack({ ok: false, error: 'Kein Spiel mit dieser PIN gefunden.' });
      const res = game.addPlayer(msg.name);
      if (!res.ok) return ack(res);
      // Erst antworten, dann binden: So kennt der Client seine Zugangsdaten, bevor der Zustand kommt
      ack({ ok: true, playerId: res.id, token: res.token });
      bindPlayer(socket, game.pin, res.id);
    });

    socket.on('player:answer', (msg: AnswerMsg, ack?: (r: AnswerAck) => void) => {
      const game = data.role === 'player' ? games.get(data.pin) : undefined;
      const res: AnswerAck = game && data.playerId ? game.answer(data.playerId, msg) : { ok: false, error: 'unknown' };
      if (typeof ack === 'function') ack(res);
    });

    const hostGame = () => (data.role === 'host' ? games.get(data.pin) : undefined);

    socket.on('host:next', (_msg: unknown, ack?: (r: SimpleAck) => void) => {
      const game = hostGame();
      game?.next();
      if (typeof ack === 'function') ack(game ? { ok: true } : { ok: false, error: 'Kein Spiel.' });
    });

    socket.on('host:phone', (msg: { showQuestion?: boolean; showAnswerText?: boolean }) => {
      hostGame()?.setPhone(msg ?? {});
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
