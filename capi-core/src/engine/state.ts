import type { GameMode, GameRules } from './rules';

export type GamePhase = 'lobby' | 'playing' | 'finished';

export type TurnPhase = 'idle' | 'roll' | 'act';

export interface JailCardRef {
  deckId: string;
  cardId: string;
}

export interface TurnState {
  phase: TurnPhase;

  doubles: number;
  lastRoll: [number, number] | null;

  pendingPurchase: string | null;
  deadline: number | null;
}

export const idleTurn = (): TurnState => ({ phase: 'idle', doubles: 0, lastRoll: null, pendingPurchase: null, deadline: null });

export interface Player {
  id: string;
  name: string;
  color: string;
  token: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailCards: JailCardRef[];
  loan: number;
  bankrupt: boolean;
  spectator: boolean;

  creditorId: string | null;
  finalCash: number | null;

  cooldownUntil: number;
  turn: TurnState;
}

export interface Ownership {
  ownerId: string;
  buildings: number;
  mortgaged: boolean;
}

export interface Auction {
  id: string;
  tileId: string;

  sellerId: string | null;
  minBid: number;
  highestBid: number;
  highestBidderId: string | null;
  passed: string[];

  endsAt: number | null;
}

export interface TradeSide {
  cash: number;
  tileIds: string[];
  jailCards: number;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  give: TradeSide;
  receive: TradeSide;
  createdAt: number;
}

export interface DeckState {
  draw: string[];
  discard: string[];
}

export interface GameState {
  id: string;
  boardId: string;
  mode: GameMode;
  rules: GameRules;
  phase: GamePhase;
  hostId: string | null;
  players: Player[];

  order: string[];

  activePlayerId: string | null;
  properties: Record<string, Ownership>;
  decks: Record<string, DeckState>;

  auctions: Auction[];
  trades: TradeOffer[];

  rng: number;
  turnCount: number;
  winnerId: string | null;
  endsAt: number | null;
  createdAt: number;
  updatedAt: number;
}
