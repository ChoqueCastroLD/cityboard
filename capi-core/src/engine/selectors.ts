import type { BoardDefinition, OwnableTile } from '../board/schema';
import { isOwnable } from '../board/schema';
import { canBuild } from './building';
import { Ctx } from './context';
import { liquidationValue, mortgageValue } from './economy';
import type { GameState, TurnPhase } from './state';

export interface AuctionView {
  auctionId: string;
  tileId: string;
  canBid: boolean;
  canPass: boolean;
  minNextBid: number;
  remainingMs: number | null;
}

export interface AvailableActions {
  isTurn: boolean;
  phase: TurnPhase;
  cooldownRemainingMs: number;
  autoplayInMs: number | null;
  debt: number;
  liquidationValue: number;
  pendingPurchase: string | null;
  canRoll: boolean;
  canBuy: boolean;
  canDecline: boolean;
  canEndTurn: boolean;
  canPayJailFine: boolean;
  canUseJailCard: boolean;
  canBankrupt: boolean;
  canBorrow: boolean;
  canRepay: boolean;
  canTrade: boolean;
  buildable: string[];
  sellable: string[];
  mortgageable: string[];
  unmortgageable: string[];
  auctionable: string[];

  purchasable: string[];
  auctions: AuctionView[];
}

export function getAvailableActions(board: BoardDefinition, state: GameState, playerId: string, now: number): AvailableActions {
  const ctx = new Ctx(board, state, now);
  const player = state.players.find((p) => p.id === playerId);
  const none: AvailableActions = {
    isTurn: false,
    phase: 'idle',
    cooldownRemainingMs: 0,
    autoplayInMs: null,
    debt: 0,
    liquidationValue: 0,
    pendingPurchase: null,
    canRoll: false,
    canBuy: false,
    canDecline: false,
    canEndTurn: false,
    canPayJailFine: false,
    canUseJailCard: false,
    canBankrupt: false,
    canBorrow: false,
    canRepay: false,
    canTrade: false,
    buildable: [],
    sellable: [],
    mortgageable: [],
    unmortgageable: [],
    auctionable: [],
    purchasable: [],
    auctions: [],
  };
  if (!player || player.bankrupt || player.spectator || state.phase !== 'playing') return none;

  const { rules } = state;
  const cooldownRemainingMs = state.mode === 'async' ? Math.max(0, player.cooldownUntil - now) : 0;
  let phase = player.turn.phase;
  if (state.mode === 'async' && phase === 'idle' && cooldownRemainingMs === 0) phase = 'roll';
  const isTurn = state.mode === 'classic' ? state.activePlayerId === playerId : phase !== 'idle';
  const auctionsBlock = state.mode === 'classic' && state.auctions.length > 0;

  const pending = player.turn.pendingPurchase;
  const pendingTile = pending ? (ctx.tile(pending) as OwnableTile) : null;
  const mine = ctx.playerTiles(playerId);
  const others = board.tiles.filter(
    (t): t is OwnableTile => isOwnable(t) && !!ctx.ownership(t.id) && ctx.ownership(t.id)!.ownerId !== playerId,
  );
  const inAuction = (tileId: string) => state.auctions.some((a) => a.tileId === tileId);
  const maxInGroup = (groupId: string) => Math.max(...ctx.groupTiles(groupId).map((t) => ctx.ownership(t.id)?.buildings ?? 0));

  return {
    isTurn,
    phase,
    cooldownRemainingMs,
    autoplayInMs: isTurn && player.turn.deadline !== null ? Math.max(0, player.turn.deadline - now) : null,
    debt: Math.max(0, -player.cash),
    liquidationValue: liquidationValue(ctx, playerId),
    pendingPurchase: pending,
    canRoll: isTurn && phase === 'roll' && !auctionsBlock,
    canBuy: isTurn && !!pendingTile && player.cash >= pendingTile.price,
    canDecline: isTurn && !!pendingTile,
    canEndTurn: isTurn && phase === 'act' && player.cash >= 0 && !auctionsBlock,
    canPayJailFine: isTurn && phase === 'roll' && player.inJail && player.cash >= rules.jailFine,
    canUseJailCard: isTurn && phase === 'roll' && player.inJail && player.jailCards.length > 0,
    canBankrupt: player.cash < 0,
    canBorrow: rules.loansEnabled && player.loan < rules.maxLoan,
    canRepay: player.loan > 0 && player.cash > 0,
    canTrade: rules.tradingEnabled && ctx.activePlayers().length > 1,
    buildable: mine.filter((t) => canBuild(ctx, playerId, t.id)).map((t) => t.id),
    sellable: mine
      .filter((t) => {
        const b = ctx.ownership(t.id)?.buildings ?? 0;
        return t.type === 'property' && b > 0 && (!rules.evenBuild || b === maxInGroup(t.groupId));
      })
      .map((t) => t.id),
    mortgageable: rules.mortgageEnabled
      ? mine.filter((t) => !ctx.ownership(t.id)?.mortgaged && ctx.buildingsInGroup(t.groupId) === 0 && !inAuction(t.id)).map((t) => t.id)
      : [],
    unmortgageable: mine
      .filter((t) => {
        const base = mortgageValue(t);
        return ctx.ownership(t.id)?.mortgaged && player.cash >= base + Math.floor(base * rules.mortgageInterest);
      })
      .map((t) => t.id),
    auctionable: rules.playerAuctions
      ? mine.filter((t) => (ctx.ownership(t.id)?.buildings ?? 0) === 0 && !inAuction(t.id)).map((t) => t.id)
      : [],
    purchasable: rules.buyOwnedProperties
      ? others
          .filter((t) => {
            const own = ctx.ownership(t.id)!;
            return own.buildings === 0 && !own.mortgaged && !inAuction(t.id) && player.cash >= Math.round(t.price * rules.ownedPurchaseMultiplier);
          })
          .map((t) => t.id)
      : [],
    auctions: state.auctions.map((a) => {
      const minNextBid = Math.max(a.minBid, a.highestBid + 1);
      const eligible = a.sellerId !== playerId && !a.passed.includes(playerId);
      return {
        auctionId: a.id,
        tileId: a.tileId,
        canBid: eligible && player.cash >= minNextBid,
        canPass: eligible && a.highestBidderId !== playerId,
        minNextBid,
        remainingMs: a.endsAt === null ? null : Math.max(0, a.endsAt - now),
      };
    }),
  };
}
