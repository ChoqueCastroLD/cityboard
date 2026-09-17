import type { BoardDefinition, CommandBody, GameEvent, GameState } from 'capi-core';

export type GameListener = (state: GameState, events: GameEvent[]) => void;

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export type ChatListener = (messages: ChatMessage[], fresh: ChatMessage | null) => void;

export interface RtcSignal {
  from: string;
  payload: Record<string, unknown>;
}

export type RtcListener = (signal: RtcSignal) => void;

export interface GameClient {
  readonly board: BoardDefinition;
  readonly myPlayerId: string | null;
  getState(): GameState;
  getPresence(): ReadonlySet<string> | null;
  getDisconnectDeadlines(): ReadonlyMap<string, number>;
  getHistory(): GameEvent[];
  subscribe(listener: GameListener): () => void;
  dispatch(command: CommandBody): Promise<void>;
  getChat(): ChatMessage[];
  subscribeChat(listener: ChatListener): () => void;
  sendChat(text: string): Promise<void>;
  sendRtc(to: string, payload: Record<string, unknown>): void;
  subscribeRtc(listener: RtcListener): () => void;
  dispose(): void;
}

export class Observable {
  private readonly listeners = new Set<GameListener>();

  subscribe(listener: GameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected notify(state: GameState, events: GameEvent[]): void {
    for (const listener of this.listeners) listener(state, events);
  }
}
