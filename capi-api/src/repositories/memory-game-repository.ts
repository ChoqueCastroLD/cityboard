import type { GameEvent, GameState } from 'capi-core';
import type { ChatMessage, GameRepository, GameResultRecord, PlayerSession, StoredGame } from './game-repository';

export class MemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, StoredGame>();
  private readonly sessions = new Map<string, PlayerSession>();
  private readonly chats = new Map<string, ChatMessage[]>();
  private readonly disconnects = new Map<string, Record<string, number>>();
  readonly results: GameResultRecord[] = [];

  async insert(state: GameState): Promise<void> {
    this.games.set(state.id, { state: structuredClone(state), history: [], settledAt: null });
  }

  async find(id: string): Promise<StoredGame | null> {
    const stored = this.games.get(id);
    return stored ? structuredClone(stored) : null;
  }

  async save(state: GameState, history: GameEvent[]): Promise<void> {
    const settledAt = this.games.get(state.id)?.settledAt ?? null;
    this.games.set(state.id, { state: structuredClone(state), history: structuredClone(history), settledAt });
  }

  async loadDisconnects(gameId: string): Promise<Record<string, number>> {
    return { ...(this.disconnects.get(gameId) ?? {}) };
  }

  async saveDisconnects(gameId: string, deadlines: Record<string, number>): Promise<void> {
    this.disconnects.set(gameId, { ...deadlines });
  }

  async loadChat(gameId: string): Promise<ChatMessage[]> {
    return structuredClone(this.chats.get(gameId) ?? []);
  }

  async saveChat(gameId: string, messages: ChatMessage[]): Promise<void> {
    this.chats.set(gameId, structuredClone(messages));
  }

  async findPlaying(): Promise<GameState[]> {
    return [...this.games.values()].filter((g) => g.state.phase === 'playing').map((g) => structuredClone(g.state));
  }

  async findPublic(): Promise<GameState[]> {
    return [...this.games.values()]
      .filter((g) => g.state.rules.isPublic && g.state.phase !== 'finished')
      .map((g) => structuredClone(g.state));
  }

  async settle(gameId: string, results: GameResultRecord[]): Promise<void> {
    const stored = this.games.get(gameId);
    if (!stored || stored.settledAt !== null) return;
    stored.settledAt = Date.now();
    this.results.push(...results.map((r) => ({ ...r })));
  }

  async insertSession(session: PlayerSession): Promise<void> {
    this.sessions.set(session.secret, { ...session });
  }

  async findSession(secret: string): Promise<PlayerSession | null> {
    const session = this.sessions.get(secret);
    return session ? { ...session } : null;
  }

  async findSessionByPlayer(gameId: string, playerId: string): Promise<PlayerSession | null> {
    const session = [...this.sessions.values()].find((s) => s.gameId === gameId && s.playerId === playerId);
    return session ? { ...session } : null;
  }

  async findSessionsByGame(gameId: string): Promise<PlayerSession[]> {
    return [...this.sessions.values()].filter((s) => s.gameId === gameId).map((s) => ({ ...s }));
  }
}
