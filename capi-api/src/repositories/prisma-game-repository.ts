import type { PrismaClient } from '@prisma/client';
import type { GameEvent, GameState } from 'capi-core';
import type { ChatMessage, GameRepository, GameResultRecord, PlayerSession, StoredGame } from './game-repository';

const listing = (state: GameState) => ({
  phase: state.phase,
  isPublic: state.rules.isPublic,
  competitive: state.rules.competitive,
  players: state.players.filter((p) => !p.spectator && !p.bankrupt).length,
  maxPlayers: state.rules.maxPlayers,
});

const toSession = (row: { gameId: string; playerId: string; secret: string; userId: string | null }): PlayerSession => ({
  gameId: row.gameId,
  playerId: row.playerId,
  secret: row.secret,
  userId: row.userId,
});

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(state: GameState): Promise<void> {
    await this.prisma.game.create({
      data: { id: state.id, boardId: state.boardId, mode: state.mode, state: JSON.stringify(state), history: '[]', ...listing(state) },
    });
  }

  async find(id: string): Promise<StoredGame | null> {
    const row = await this.prisma.game.findUnique({ where: { id } });
    return row
      ? { state: JSON.parse(row.state) as GameState, history: JSON.parse(row.history) as GameEvent[], settledAt: row.settledAt?.getTime() ?? null }
      : null;
  }

  async save(state: GameState, history: GameEvent[]): Promise<void> {
    await this.prisma.game.update({
      where: { id: state.id },
      data: { state: JSON.stringify(state), history: JSON.stringify(history), ...listing(state) },
    });
  }

  async loadDisconnects(gameId: string): Promise<Record<string, number>> {
    const row = await this.prisma.game.findUnique({ where: { id: gameId }, select: { disconnects: true } });
    return row ? (JSON.parse(row.disconnects) as Record<string, number>) : {};
  }

  async saveDisconnects(gameId: string, deadlines: Record<string, number>): Promise<void> {
    await this.prisma.game.update({ where: { id: gameId }, data: { disconnects: JSON.stringify(deadlines) } }).catch(() => undefined);
  }

  async loadChat(gameId: string): Promise<ChatMessage[]> {
    const row = await this.prisma.game.findUnique({ where: { id: gameId }, select: { chat: true } });
    return row ? (JSON.parse(row.chat) as ChatMessage[]) : [];
  }

  async saveChat(gameId: string, messages: ChatMessage[]): Promise<void> {
    await this.prisma.game.update({ where: { id: gameId }, data: { chat: JSON.stringify(messages) } });
  }

  async findPlaying(): Promise<GameState[]> {
    const rows = await this.prisma.game.findMany({ where: { phase: 'playing' } });
    return rows.map((r) => JSON.parse(r.state) as GameState);
  }

  async findPublic(): Promise<GameState[]> {
    const rows = await this.prisma.game.findMany({ where: { isPublic: true, phase: { not: 'finished' } }, orderBy: { updatedAt: 'desc' }, take: 50 });
    return rows.map((r) => JSON.parse(r.state) as GameState);
  }

  async settle(gameId: string, results: GameResultRecord[]): Promise<void> {
    const updated = await this.prisma.game.updateMany({ where: { id: gameId, settledAt: null }, data: { settledAt: new Date() } });
    if (updated.count === 0) return;
    await this.prisma.gameResult.createMany({
      data: results.map((r) => ({ id: crypto.randomUUID(), gameId: r.gameId, userId: r.userId, playerId: r.playerId, cash: r.cash, rank: r.rank })),
    });
  }

  async insertSession(session: PlayerSession): Promise<void> {
    await this.prisma.playerSession.create({ data: session });
  }

  async findSession(secret: string): Promise<PlayerSession | null> {
    const row = await this.prisma.playerSession.findUnique({ where: { secret } });
    return row ? toSession(row) : null;
  }

  async findSessionByPlayer(gameId: string, playerId: string): Promise<PlayerSession | null> {
    const row = await this.prisma.playerSession.findUnique({ where: { gameId_playerId: { gameId, playerId } } });
    return row ? toSession(row) : null;
  }

  async findSessionsByGame(gameId: string): Promise<PlayerSession[]> {
    const rows = await this.prisma.playerSession.findMany({ where: { gameId } });
    return rows.map(toSession);
  }
}
