import type { BoardDefinition } from '../board/schema';
import { validateBoard } from '../board/validate';
import { GameError } from './errors';
import { type GameMode, type GameRules, resolveRules } from './rules';
import type { GameState } from './state';

export interface CreateGameOptions {
  id: string;
  mode: GameMode;
  rules?: Partial<GameRules>;
  seed?: number;
  now?: number;
}

export function normalizeGameState(state: GameState): GameState {
  return {
    ...state,
    endsAt: state.endsAt ?? null,
    rules: resolveRules(state.rules),
    players: state.players.map((p) => ({ ...p, spectator: p.spectator ?? false, finalCash: p.finalCash ?? null, turn: { ...p.turn, deadline: p.turn.deadline ?? null } })),
  };
}

export function createGame(board: BoardDefinition, options: CreateGameOptions): GameState {
  const issues = validateBoard(board);
  if (issues.length > 0) {
    throw new GameError('INVALID_COMMAND', `invalid board: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
  const now = options.now ?? Date.now();
  return {
    id: options.id,
    boardId: board.id,
    mode: options.mode,
    rules: resolveRules(board.defaultRules, options.rules),
    phase: 'lobby',
    hostId: null,
    players: [],
    order: [],
    activePlayerId: null,
    properties: {},
    decks: {},
    auctions: [],
    trades: [],
    rng: options.seed ?? (now % 2147483647),
    turnCount: 0,
    winnerId: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
