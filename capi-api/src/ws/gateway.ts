import { type CommandBody, GameError, type GameState } from 'capi-core';
import { Elysia, t } from 'elysia';
import { config } from '../config';
import { HttpError } from '../http-error';
import type { ChatService } from '../services/chat-service';
import type { Actor, GameService } from '../services/game-service';

interface Connection {
  send(payload: unknown): void;
  actor: Actor | null;
  unsubscribe: () => void;
}

class Rooms {
  private readonly rooms = new Map<string, Map<string, Connection>>();

  add(gameId: string, socketId: string, connection: Connection): void {
    const room = this.rooms.get(gameId) ?? new Map<string, Connection>();
    room.set(socketId, connection);
    this.rooms.set(gameId, room);
  }

  remove(gameId: string, socketId: string): Connection | undefined {
    const room = this.rooms.get(gameId);
    const connection = room?.get(socketId);
    room?.delete(socketId);
    if (room?.size === 0) this.rooms.delete(gameId);
    return connection;
  }

  connection(gameId: string, socketId: string): Connection | undefined {
    return this.rooms.get(gameId)?.get(socketId);
  }

  presence(gameId: string): string[] {
    const ids = new Set<string>();
    for (const c of this.rooms.get(gameId)?.values() ?? []) if (c.actor) ids.add(c.actor.playerId);
    return [...ids];
  }

  isConnected(gameId: string, playerId: string): boolean {
    return this.presence(gameId).includes(playerId);
  }

  broadcast(gameId: string, payload: unknown): void {
    for (const c of this.rooms.get(gameId)?.values() ?? []) c.send(payload);
  }

  sendToPlayer(gameId: string, playerId: string, payload: unknown): void {
    for (const c of this.rooms.get(gameId)?.values() ?? []) if (c.actor?.playerId === playerId) c.send(payload);
  }

  broadcastPresence(gameId: string, offline: Record<string, number>): void {
    const payload = { type: 'presence', playerIds: this.presence(gameId), offline };
    for (const c of this.rooms.get(gameId)?.values() ?? []) c.send(payload);
  }
}

interface Watch {
  timer: ReturnType<typeof setTimeout>;
  deadline: number;
}

const RESTORE_GRACE_MS = 60_000;

class DisconnectWatch {
  private readonly watches = new Map<string, Watch>();

  constructor(
    private readonly games: GameService,
    private readonly rooms: Rooms,
    private readonly onExpire: (gameId: string) => void,
  ) {}

  private persist(gameId: string): void {
    void this.games.saveDisconnects(gameId, this.deadlines(gameId)).catch((e) => console.error('[disconnects]', gameId, e));
  }

  async restore(): Promise<void> {
    const games = await this.games.playingGames().catch(() => []);
    for (const game of games) {
      const stored = await this.games.loadDisconnects(game.id).catch(() => ({}));
      for (const [playerId, deadline] of Object.entries(stored)) {
        const player = game.players.find((p) => p.id === playerId);
        if (!player || player.bankrupt || player.spectator) continue;
        this.arm(game.id, playerId, Math.max(deadline - Date.now(), RESTORE_GRACE_MS));
      }
      if (Object.keys(stored).length > 0) this.rooms.broadcastPresence(game.id, this.deadlines(game.id));
    }
  }

  private arm(gameId: string, playerId: string, ms: number): void {
    const key = this.key(gameId, playerId);
    const timer = setTimeout(() => {
      this.watches.delete(key);
      this.persist(gameId);
      if (this.rooms.isConnected(gameId, playerId)) return;
      void this.games
        .executeSystem(gameId, { type: 'FORFEIT', targetId: playerId, reason: 'disconnected' })
        .catch((e) => console.error('[forfeit]', gameId, e))
        .finally(() => this.onExpire(gameId));
    }, ms);
    this.watches.set(key, { timer, deadline: Date.now() + ms });
  }

  private key(gameId: string, playerId: string): string {
    return `${gameId}:${playerId}`;
  }

  deadlines(gameId: string): Record<string, number> {
    const prefix = `${gameId}:`;
    const out: Record<string, number> = {};
    for (const [key, watch] of this.watches) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = watch.deadline;
    }
    return out;
  }

  cancel(gameId: string, playerId: string): void {
    const watch = this.watches.get(this.key(gameId, playerId));
    if (!watch) return;
    clearTimeout(watch.timer);
    this.watches.delete(this.key(gameId, playerId));
    this.persist(gameId);
  }

  async start(gameId: string, playerId: string): Promise<void> {
    const key = this.key(gameId, playerId);
    if (this.watches.has(key)) return;
    const { game } = await this.games.get(gameId).catch(() => ({ game: null }));
    if (!game || game.phase !== 'playing') return;
    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.bankrupt || player.spectator) return;
    if (this.rooms.isConnected(gameId, playerId) || this.watches.has(key)) return;
    const graceMs = game.rules.competitive ? config.disconnectForfeitMs : config.disconnectGraceMs;
    this.arm(gameId, playerId, graceMs);
    this.persist(gameId);
  }
}

export const wsGateway = (games: GameService, chat: ChatService) => {
  const rooms = new Rooms();
  const watch = new DisconnectWatch(games, rooms, (gameId) => rooms.broadcastPresence(gameId, watch.deadlines(gameId)));
  const socketGame = new Map<string, string>();
  void watch.restore().catch((e) => console.error('[disconnects] restore', e));
  const watchAbsent = async (gameId: string, game: GameState): Promise<void> => {
    const absent = game.players.filter((p) => !p.spectator && !p.bankrupt && !rooms.isConnected(gameId, p.id));
    if (absent.length === 0) return;
    await Promise.all(absent.map((p) => watch.start(gameId, p.id)));
    rooms.broadcastPresence(gameId, watch.deadlines(gameId));
  };

  return new Elysia({ name: 'ws' }).ws('/ws/games/:id', {
    params: t.Object({ id: t.String({ maxLength: 12 }) }),
    body: t.Union([
      t.Object({ type: t.Literal('auth'), requestId: t.Optional(t.String({ maxLength: 64 })), secret: t.String({ maxLength: 64 }) }),
      t.Object({ type: t.Literal('command'), requestId: t.Optional(t.String({ maxLength: 64 })), command: t.Object({ type: t.String({ maxLength: 32 }) }, { additionalProperties: true }) }),
      t.Object({ type: t.Literal('ping') }),
      t.Object({ type: t.Literal('chat'), requestId: t.Optional(t.String({ maxLength: 64 })), text: t.String({ maxLength: 600 }) }),
      t.Object({ type: t.Literal('rtc'), to: t.String({ maxLength: 40 }), payload: t.Object({}, { additionalProperties: true }) }),
    ]),

    async open(ws) {
      const gameId = ws.data.params.id.toUpperCase();
      let unsubscribe = () => {};
      rooms.add(gameId, ws.id, { send: (payload) => ws.send(payload), actor: null, unsubscribe: () => unsubscribe() });
      socketGame.set(ws.id, gameId);
      try {
        const { game, history } = await games.get(gameId);
        unsubscribe = games.subscribe(gameId, (update) => {
          ws.send({ type: 'state', ...update });
          if (update.events.some((e) => e.type === 'GAME_STARTED')) void watchAbsent(gameId, update.game);
        });
        ws.send({ type: 'state', game, events: [], history });
        ws.send({ type: 'chat-history', messages: await chat.history(gameId) });
        rooms.broadcastPresence(gameId, watch.deadlines(gameId));
      } catch (e) {
        rooms.remove(gameId, ws.id);
        socketGame.delete(ws.id);
        ws.send({ type: 'error', error: toError(e) });
        ws.close();
      }
    },

    async message(ws, message) {
      if (message.type === 'ping') {
        ws.send({ type: 'pong' });
        return;
      }
      const gameId = socketGame.get(ws.id);
      if (message.type === 'auth') {
        const connection = gameId ? rooms.connection(gameId, ws.id) : undefined;
        if (!gameId || !connection) {
          ws.send({ type: 'error', requestId: message.requestId, error: { code: 'NOT_FOUND', message: 'connection is gone' } });
          return;
        }
        try {
          const authenticated = await games.authenticate(gameId, message.secret);
          connection.actor = authenticated;
          games.noteRoomActive(gameId);
          watch.cancel(gameId, authenticated.playerId);
          if (message.requestId) ws.send({ type: 'ack', requestId: message.requestId });
          rooms.broadcastPresence(gameId, watch.deadlines(gameId));
        } catch (e) {
          ws.send({ type: 'error', requestId: message.requestId, error: toError(e) });
        }
        return;
      }
      const actor = gameId ? rooms.connection(gameId, ws.id)?.actor : null;
      if (!gameId || !actor) {
        ws.send({ type: 'error', requestId: 'requestId' in message ? message.requestId : undefined, error: { code: 'UNAUTHORIZED', message: 'spectators cannot play' } });
        return;
      }
      if (message.type === 'rtc') {
        rooms.sendToPlayer(gameId, message.to, { type: 'rtc', from: actor.playerId, payload: message.payload });
        return;
      }
      if (message.type === 'chat') {
        try {
          const { game } = await games.get(gameId);
          const author = game.players.find((p) => p.id === actor.playerId);
          if (!author) throw new HttpError(403, 'NOT_ALLOWED', 'you are not in this game');
          const posted = await chat.post(gameId, { playerId: author.id, name: author.name, color: author.color }, message.text);
          rooms.broadcast(gameId, { type: 'chat', message: posted });
          if (message.requestId) ws.send({ type: 'ack', requestId: message.requestId });
        } catch (e) {
          ws.send({ type: 'error', requestId: message.requestId, error: toError(e) });
        }
        return;
      }
      try {
        await games.execute(gameId, actor, message.command as CommandBody);
      } catch (e) {
        ws.send({ type: 'error', requestId: message.requestId, error: toError(e) });
      }
    },

    async close(ws) {
      const gameId = socketGame.get(ws.id);
      socketGame.delete(ws.id);
      if (!gameId) return;
      const connection = rooms.remove(gameId, ws.id);
      connection?.unsubscribe();
      if (rooms.presence(gameId).length === 0) games.noteRoomEmpty(gameId);
      const playerId = connection?.actor?.playerId;
      if (playerId && !rooms.isConnected(gameId, playerId)) await watch.start(gameId, playerId);
      rooms.broadcastPresence(gameId, watch.deadlines(gameId));
    },
  });
};

function toError(e: unknown): { code: string; message: string } {
  if (e instanceof GameError || e instanceof HttpError) return { code: e.code, message: e.message };
  console.error('[ws]', e);
  return { code: 'INTERNAL', message: 'unexpected error' };
}
