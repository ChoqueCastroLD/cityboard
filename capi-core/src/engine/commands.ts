import type { GameMode, GameRules } from './rules';
import type { TradeSide } from './state';

interface Base {
  playerId: string;

  at: number;
}

export type Command = Base &
  (
    | { type: 'JOIN'; name: string; color?: string; token?: string }
    | { type: 'LEAVE' }
    | { type: 'SET_RULES'; rules: Partial<GameRules> }
    | { type: 'SET_MODE'; mode: GameMode }
    | { type: 'SET_BOARD'; boardId: string }
    | { type: 'REMOVE_PLAYER'; targetId: string }
    | { type: 'TRANSFER_HOST'; toId: string }
    | { type: 'SPAWN_PLAYER'; targetId: string }
    | { type: 'FORCE_PLAY'; targetId: string }
    | { type: 'FORFEIT'; targetId: string; reason: 'disconnected' | 'afk' }
    | { type: 'FINISH'; reason: 'abandoned' }
    | { type: 'UPDATE_PLAYER'; name?: string; color?: string; token?: string }
    | { type: 'START' }
    | { type: 'ROLL' }
    | { type: 'BUY' }
    | { type: 'DECLINE' }
    | { type: 'END_TURN' }
    | { type: 'PAY_JAIL_FINE' }
    | { type: 'USE_JAIL_CARD' }
    | { type: 'BUILD'; tileId: string }
    | { type: 'SELL_BUILDING'; tileId: string }
    | { type: 'MORTGAGE'; tileId: string }
    | { type: 'UNMORTGAGE'; tileId: string }
    | { type: 'BID'; auctionId: string; amount: number }
    | { type: 'PASS_AUCTION'; auctionId: string }
    | { type: 'START_AUCTION'; tileId: string; minBid: number }
    | { type: 'BUY_OWNED'; tileId: string }
    | { type: 'BORROW'; amount: number }
    | { type: 'REPAY'; amount: number }
    | { type: 'PROPOSE_TRADE'; toId: string; give: TradeSide; receive: TradeSide }
    | { type: 'ACCEPT_TRADE'; tradeId: string }
    | { type: 'DECLINE_TRADE'; tradeId: string }
    | { type: 'CANCEL_TRADE'; tradeId: string }
    | { type: 'BANKRUPT' }

    | { type: 'TICK' }
  );

export type CommandType = Command['type'];

export const SYSTEM_PLAYER_ID = 'system';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type CommandInput = DistributiveOmit<Command, 'at'>;

export type CommandBody = DistributiveOmit<Command, 'at' | 'playerId'>;
