import type { BoardDefinition, GameEvent, GameState } from 'capi-core';

export type CardDrawnEvent = Extract<GameEvent, { type: 'CARD_DRAWN' }>;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface SceneCallbacks {
  onTileClick?(tileId: string): void;
  onTokenClick?(playerId: string): void;

  onTokenHover?(playerId: string | null, at: ScreenPoint | null): void;

  onTileHover?(tileId: string | null, at: ScreenPoint | null): void;

  onDiceRoll?(playerId: string, dice: [number, number], settled: Promise<void>): void;

  onCardDrawn?(event: CardDrawnEvent, resume: () => void): void;
}

export interface SceneOptions {
  board: BoardDefinition;
  callbacks?: SceneCallbacks;
}

export type SceneBackend = 'webgpu' | 'webgl';

export type CameraMode = 'player' | 'map' | 'locked';

export interface IBoardScene {
  readonly ready: Promise<{ backend: SceneBackend }>;

  setState(state: GameState, now: number): void;

  play(events: GameEvent[]): void;

  rollDice(dice: [number, number]): Promise<void>;

  projectPlayer(playerId: string): ScreenPoint | null;

  focusTile(tileId: string | null): void;

  focusPlayer(playerId: string | null): void;

  highlightTiles(tileIds: string[]): void;

  setControlledPlayer(playerId: string | null): void;

  setCameraMode(mode: CameraMode): void;

  catchUp(): void;
  resize(): void;
  dispose(): void;
}

export type CreateBoardScene = (canvas: HTMLCanvasElement, options: SceneOptions) => IBoardScene;
