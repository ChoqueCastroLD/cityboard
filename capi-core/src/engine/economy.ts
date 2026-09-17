import type { OwnableTile } from '../board/schema';
import type { Ctx } from './context';
import { assert } from './errors';

export function mortgageValue(tile: OwnableTile): number {
  return tile.mortgage ?? Math.floor(tile.price / 2);
}

export function pay(ctx: Ctx, fromId: string, toId: string | null, amount: number, reason: string): void {
  if (amount <= 0) return;
  const from = ctx.player(fromId);
  from.cash -= amount;
  if (toId) ctx.player(toId).cash += amount;
  ctx.emit({ type: 'PAID', fromId, toId, amount, reason });
  if (from.cash < 0) {
    from.creditorId = toId;
    ctx.emit({ type: 'IN_DEBT', playerId: fromId, amount: -from.cash, creditorId: toId });
  }
}

export function spend(ctx: Ctx, playerId: string, toId: string | null, amount: number, reason: string): void {
  const player = ctx.player(playerId);
  assert(player.cash >= amount, 'INSUFFICIENT_FUNDS', `${player.name} cannot afford ${amount}`);
  pay(ctx, playerId, toId, amount, reason);
}

export function receive(ctx: Ctx, playerId: string, amount: number, reason: string): void {
  if (amount <= 0) return;
  ctx.player(playerId).cash += amount;
  ctx.emit({ type: 'RECEIVED', playerId, amount, reason });
}

export function transferTile(ctx: Ctx, tileId: string, toId: string | null): void {
  const current = ctx.ownership(tileId);
  if (toId === null) {
    delete ctx.state.properties[tileId];
    return;
  }
  ctx.state.properties[tileId] = { ownerId: toId, buildings: 0, mortgaged: current?.mortgaged ?? false };
}

export function liquidationValue(ctx: Ctx, playerId: string): number {
  const rules = ctx.state.rules;
  let total = ctx.player(playerId).cash;
  for (const tile of ctx.playerTiles(playerId)) {
    const own = ctx.ownership(tile.id);
    if (!own) continue;
    if (tile.type === 'property' && own.buildings > 0) {
      const group = ctx.board.groups.find((g) => g.id === tile.groupId);
      total += Math.floor((group?.houseCost ?? 0) * rules.buildingSellRatio) * own.buildings;
    }
    if (!own.mortgaged && rules.mortgageEnabled) total += mortgageValue(tile);
  }
  return total;
}
