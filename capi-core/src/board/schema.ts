import type { GameRules } from '../engine/rules';

export type TileType =
  | 'start'
  | 'property'
  | 'transport'
  | 'utility'
  | 'tax'
  | 'card'
  | 'jail'
  | 'go-to-jail'
  | 'free';

export interface TileBase {
  id: string;
  type: TileType;
  name: string;

  image?: string;

  icon?: string;
  description?: string;
}

export interface PropertyTile extends TileBase {
  type: 'property';
  groupId: string;
  price: number;

  rent: number[];
  mortgage?: number;
}

export interface TransportTile extends TileBase {
  type: 'transport';
  groupId: string;
  price: number;

  rent: number[];
  mortgage?: number;
}

export interface UtilityTile extends TileBase {
  type: 'utility';
  groupId: string;
  price: number;

  multipliers: number[];
  mortgage?: number;
}

export interface TaxTile extends TileBase {
  type: 'tax';
  amount: number;
}

export interface CardTile extends TileBase {
  type: 'card';
  deckId: string;
}

export interface StartTile extends TileBase {
  type: 'start';
}
export interface JailTile extends TileBase {
  type: 'jail';
}
export interface GoToJailTile extends TileBase {
  type: 'go-to-jail';
}
export interface FreeTile extends TileBase {
  type: 'free';
}

export type Tile =
  | PropertyTile
  | TransportTile
  | UtilityTile
  | TaxTile
  | CardTile
  | StartTile
  | JailTile
  | GoToJailTile
  | FreeTile;

export type OwnableTile = PropertyTile | TransportTile | UtilityTile;

export interface TileGroup {
  id: string;
  name: string;
  color: string;
  image?: string;

  houseCost?: number;
}

export type CardAction =
  | { kind: 'move-to'; tileId: string; collectStart?: boolean }
  | { kind: 'move-by'; steps: number }
  | { kind: 'move-to-nearest'; tileType: 'transport' | 'utility'; rentMultiplier?: number }
  | { kind: 'pay'; amount: number }
  | { kind: 'receive'; amount: number }
  | { kind: 'pay-each-player'; amount: number }
  | { kind: 'receive-from-each-player'; amount: number }
  | { kind: 'go-to-jail' }
  | { kind: 'jail-free' }
  | { kind: 'repairs'; perHouse: number; perHotel: number };

export interface Card {
  id: string;
  text: string;
  image?: string;
  action: CardAction;
}

export interface Deck {
  id: string;
  name: string;
  color?: string;
  image?: string;
  cards: Card[];
}

export interface BoardTheme {
  background?: string;
  accent?: string;
  boardColor?: string;
  centerImage?: string;
}

export interface Currency {
  symbol: string;
  code?: string;
}

export interface TokenOption {
  id: string;
  label: string;
  icon?: string;
  shape?: string;
  color?: string;
  image?: string;
  premium?: boolean;
}

export interface BoardDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  currency: Currency;
  theme?: BoardTheme;
  tokens?: TokenOption[];

  defaultRules?: Partial<GameRules>;
  groups: TileGroup[];
  tiles: Tile[];
  decks: Deck[];
}

export const isOwnable = (tile: Tile): tile is OwnableTile =>
  tile.type === 'property' || tile.type === 'transport' || tile.type === 'utility';
