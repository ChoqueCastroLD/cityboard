import type { AvailableActions, BoardDefinition, CommandBody, GameState, Player } from 'capi-core';
import { createContext, useContext } from 'react';
import type { GameClient } from '../../client/GameClient';
import type { LogEntry } from '../../hooks/useGameClient';
import type { VoiceApi } from '../../hooks/useVoice';
import type { CameraMode } from '../../three/types';

export type Dispatch = (command: CommandBody) => Promise<void>;

export type DialogState =
  | { kind: 'tile'; tileId: string }
  | { kind: 'trade'; withId?: string }
  | { kind: 'trade-view'; tradeId: string }
  | { kind: 'loan' }
  | { kind: 'settings'; tab: 'rules' | 'audio' }
  | { kind: 'auctions' }
  | { kind: 'log' }
  | null;

export interface GameContextValue {
  client: GameClient;
  board: BoardDefinition;
  state: GameState;
  log: LogEntry[];
  presence: ReadonlySet<string> | null;
  disconnectDeadlines: ReadonlyMap<string, number>;

  presenting: boolean;
  cardPeekSeed: number;
  catchUpId: number;
  voice: VoiceApi | null;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  now: number;

  controlledId: string | null;
  me: Player | null;
  actions: AvailableActions | null;
  isHost: boolean;
  dispatch: Dispatch;

  focusedPlayerId: string | null;
  focusPlayer: (playerId: string | null) => void;
  openDialog: (dialog: DialogState) => void;
  leave: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside a GameScreen');
  return value;
}
