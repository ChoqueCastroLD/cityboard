import type { Ctx } from './context';
import { transferTile } from './economy';
import { assert } from './errors';
import type { TradeOffer, TradeSide } from './state';

function checkSide(ctx: Ctx, playerId: string, side: TradeSide): void {
  const player = ctx.player(playerId);
  assert(!player.bankrupt, 'NOT_ALLOWED', `${player.name} is out of the game`);
  assert(Number.isInteger(side.cash) && side.cash >= 0, 'INVALID_COMMAND', 'invalid cash amount');
  assert(side.cash <= player.cash, 'INSUFFICIENT_FUNDS', `${player.name} cannot cover ${side.cash}`);
  assert(side.jailCards >= 0 && side.jailCards <= player.jailCards.length, 'INVALID_COMMAND', 'not enough jail cards');
  for (const tileId of side.tileIds) {
    const own = ctx.ownership(tileId);
    assert(own?.ownerId === playerId, 'NOT_ALLOWED', `${player.name} does not own ${tileId}`);
    assert(own.buildings === 0, 'NOT_ALLOWED', 'sell buildings before trading a property');
    assert(!ctx.state.auctions.some((a) => a.tileId === tileId), 'NOT_ALLOWED', 'tile is being auctioned');
  }
}

export function proposeTrade(ctx: Ctx, fromId: string, toId: string, give: TradeSide, receive: TradeSide): TradeOffer {
  assert(ctx.state.rules.tradingEnabled, 'RULE_DISABLED', 'trading is disabled');
  assert(fromId !== toId, 'INVALID_COMMAND', 'cannot trade with yourself');
  checkSide(ctx, fromId, give);
  checkSide(ctx, toId, receive);
  const offer: TradeOffer = {
    id: `trade-${ctx.now}-${fromId}`,
    fromId,
    toId,
    give,
    receive,
    createdAt: ctx.now,
  };
  ctx.state.trades.push(offer);
  ctx.emit({ type: 'TRADE_PROPOSED', tradeId: offer.id, fromId, toId });
  return offer;
}

function takeTrade(ctx: Ctx, tradeId: string): TradeOffer {
  const offer = ctx.state.trades.find((t) => t.id === tradeId);
  assert(offer, 'NOT_FOUND', 'trade not found');
  ctx.state.trades = ctx.state.trades.filter((t) => t.id !== tradeId);
  return offer;
}

export function acceptTrade(ctx: Ctx, playerId: string, tradeId: string): void {
  assert(ctx.state.rules.tradingEnabled, 'RULE_DISABLED', 'trading is disabled');
  const offer = takeTrade(ctx, tradeId);
  assert(offer.toId === playerId, 'NOT_ALLOWED', 'only the recipient can accept');
  checkSide(ctx, offer.fromId, offer.give);
  checkSide(ctx, offer.toId, offer.receive);
  moveSide(ctx, offer.fromId, offer.toId, offer.give);
  moveSide(ctx, offer.toId, offer.fromId, offer.receive);
  ctx.emit({ type: 'TRADE_ACCEPTED', tradeId });
}

function moveSide(ctx: Ctx, fromId: string, toId: string, side: TradeSide): void {
  const from = ctx.player(fromId);
  const to = ctx.player(toId);
  from.cash -= side.cash;
  to.cash += side.cash;
  for (const tileId of side.tileIds) transferTile(ctx, tileId, toId);
  to.jailCards.push(...from.jailCards.splice(0, side.jailCards));
}

export function declineTrade(ctx: Ctx, playerId: string, tradeId: string): void {
  const offer = takeTrade(ctx, tradeId);
  assert(offer.toId === playerId, 'NOT_ALLOWED', 'only the recipient can decline');
  ctx.emit({ type: 'TRADE_DECLINED', tradeId });
}

export function cancelTrade(ctx: Ctx, playerId: string, tradeId: string): void {
  const offer = takeTrade(ctx, tradeId);
  assert(offer.fromId === playerId, 'NOT_ALLOWED', 'only the proposer can cancel');
  ctx.emit({ type: 'TRADE_CANCELLED', tradeId });
}

export function dropTradesOf(ctx: Ctx, playerId: string): void {
  for (const offer of ctx.state.trades.filter((t) => t.fromId === playerId || t.toId === playerId)) {
    ctx.state.trades = ctx.state.trades.filter((t) => t.id !== offer.id);
    ctx.emit({ type: 'TRADE_CANCELLED', tradeId: offer.id });
  }
}
