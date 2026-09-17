import type { GameEvent, GameState } from 'capi-core';

export interface PlayerSession {
  gameId: string;
  playerId: string;
  secret: string;
  userId: string | null;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface StoredGame {
  state: GameState;
  history: GameEvent[];
  settledAt: number | null;
}

export interface GameResultRecord {
  gameId: string;
  userId: string;
  playerId: string;
  cash: number;
  rank: number;
}

export interface GameRepository {
  insert(state: GameState): Promise<void>;
  find(id: string): Promise<StoredGame | null>;
  save(state: GameState, history: GameEvent[]): Promise<void>;
  loadChat(gameId: string): Promise<ChatMessage[]>;
  saveChat(gameId: string, messages: ChatMessage[]): Promise<void>;
  findPlaying(): Promise<GameState[]>;
  findPublic(): Promise<GameState[]>;
  settle(gameId: string, results: GameResultRecord[]): Promise<void>;
  insertSession(session: PlayerSession): Promise<void>;
  findSession(secret: string): Promise<PlayerSession | null>;
  findSessionByPlayer(gameId: string, playerId: string): Promise<PlayerSession | null>;
  findSessionsByGame(gameId: string): Promise<PlayerSession[]>;
}
