import type { Ctx } from './context';
import { pay, transferTile } from './economy';
import { assert } from './errors';
import type { Auction } from './state';

export function startAuction(ctx: Ctx, tileId: string, sellerId: string | null, minBid: number): Auction {
  assert(
    !ctx.state.auctions.some((a) => a.tileId === tileId),
    'NOT_ALLOWED',
    'this tile is already being auctioned',
  );
  const { rules } = ctx.state;
  const auction: Auction = {
    id: `auction-${ctx.state.turnCount}-${tileId}-${ctx.now}`,
    tileId,
    sellerId,
    minBid: Math.max(1, Math.floor(minBid)),
    highestBid: 0,
    highestBidderId: null,
    passed: [],
    endsAt: rules.auctionDurationMs > 0 ? ctx.now + rules.auctionDurationMs : null,
  };
  ctx.state.auctions.push(auction);
  ctx.emit({ type: 'AUCTION_STARTED', auctionId: auction.id, tileId, sellerId, minBid: auction.minBid });
  return auction;
}

export function findAuction(ctx: Ctx, auctionId: string): Auction {
  const auction = ctx.state.auctions.find((a) => a.id === auctionId);
  assert(auction, 'NOT_FOUND', 'auction not found');
  return auction;
}

export function placeBid(ctx: Ctx, auctionId: string, playerId: string, amount: number): void {
  const auction = findAuction(ctx, auctionId);
  const bidder = ctx.player(playerId);
  assert(!bidder.bankrupt, 'NOT_ALLOWED', 'bankrupt players cannot bid');
  assert(auction.sellerId !== playerId, 'NOT_ALLOWED', 'the seller cannot bid');
  assert(!auction.passed.includes(playerId), 'NOT_ALLOWED', 'you already passed');
  assert(Number.isInteger(amount) && amount >= auction.minBid, 'INVALID_COMMAND', `minimum bid is ${auction.minBid}`);
  assert(amount > auction.highestBid, 'INVALID_COMMAND', 'bid must beat the highest bid');
  assert(amount <= bidder.cash, 'INSUFFICIENT_FUNDS', 'you cannot afford that bid');

  auction.highestBid = amount;
  auction.highestBidderId = playerId;
  ctx.emit({ type: 'BID_PLACED', auctionId, playerId, amount });
  closeIfSettled(ctx, auction);
}

export function passAuction(ctx: Ctx, auctionId: string, playerId: string): void {
  const auction = findAuction(ctx, auctionId);
  assert(auction.sellerId !== playerId, 'NOT_ALLOWED', 'the seller cannot pass');
  assert(auction.highestBidderId !== playerId, 'NOT_ALLOWED', 'the highest bidder cannot pass');
  if (!auction.passed.includes(playerId)) auction.passed.push(playerId);
  ctx.emit({ type: 'AUCTION_PASSED', auctionId, playerId });
  closeIfSettled(ctx, auction);
}

function closeIfSettled(ctx: Ctx, auction: Auction): void {
  const bidders = ctx
    .activePlayers()
    .filter((p) => p.id !== auction.sellerId && p.id !== auction.highestBidderId);
  if (bidders.every((p) => auction.passed.includes(p.id))) settleAuction(ctx, auction);
}

export function closeExpiredAuctions(ctx: Ctx): void {
  for (const auction of ctx.state.auctions.slice()) {
    if (auction.endsAt !== null && ctx.now >= auction.endsAt) settleAuction(ctx, auction);
  }
}

export function settleAuction(ctx: Ctx, auction: Auction): void {
  ctx.state.auctions = ctx.state.auctions.filter((a) => a.id !== auction.id);
  const winnerId = auction.highestBidderId;
  if (winnerId) {
    pay(ctx, winnerId, auction.sellerId, auction.highestBid, 'auction');
    transferTile(ctx, auction.tileId, winnerId);
    ctx.emit({ type: 'BOUGHT', playerId: winnerId, tileId: auction.tileId, price: auction.highestBid, fromId: auction.sellerId });
  }
  ctx.emit({ type: 'AUCTION_ENDED', auctionId: auction.id, tileId: auction.tileId, winnerId, amount: auction.highestBid });
}

export function dropFromAuctions(ctx: Ctx, playerId: string): void {
  for (const auction of ctx.state.auctions.slice()) {
    if (auction.sellerId === playerId) {
      ctx.state.auctions = ctx.state.auctions.filter((a) => a.id !== auction.id);
      ctx.emit({ type: 'AUCTION_ENDED', auctionId: auction.id, tileId: auction.tileId, winnerId: null, amount: 0 });
      continue;
    }
    if (auction.highestBidderId === playerId) {
      auction.highestBidderId = null;
      auction.highestBid = 0;
    }
    auction.passed = auction.passed.filter((id) => id !== playerId);
    closeIfSettled(ctx, auction);
  }
}
