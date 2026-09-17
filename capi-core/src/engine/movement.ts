import type { OwnableTile, Tile } from '../board/schema';
import { isOwnable } from '../board/schema';
import { startAuction } from './auction';
import { propertyRent } from './building';
import { drawCard } from './cards';
import type { Ctx } from './context';
import { pay, receive } from './economy';
import type { Player } from './state';

export interface LandingOptions {
  diceTotal: number;

  rentMultiplier?: number;
}

export function passStart(ctx: Ctx, player: Player): void {
  const { rules } = ctx.state;
  receive(ctx, player.id, rules.passStartBonus, 'passed start');
  ctx.emit({ type: 'PASSED_START', playerId: player.id, amount: rules.passStartBonus });
  if (player.loan > 0 && rules.loansEnabled) {
    pay(ctx, player.id, null, Math.floor(player.loan * rules.loanInterest), 'loan interest');
  }
}

export function moveBy(ctx: Ctx, player: Player, steps: number, options: LandingOptions): void {
  const size = ctx.board.tiles.length;
  const from = player.position;
  const raw = from + steps;
  const to = ((raw % size) + size) % size;
  const passedStart = steps > 0 && raw >= size;
  player.position = to;
  ctx.emit({ type: 'MOVED', playerId: player.id, from, to, passedStart });
  if (passedStart) passStart(ctx, player);
  landOn(ctx, player, options);
}

export function moveTo(ctx: Ctx, player: Player, tileId: string, collectStart: boolean, options: LandingOptions): void {
  const from = player.position;
  const to = ctx.indexOf(tileId);
  const passedStart = collectStart && to < from;
  player.position = to;
  ctx.emit({ type: 'MOVED', playerId: player.id, from, to, passedStart });
  if (passedStart) passStart(ctx, player);
  landOn(ctx, player, options);
}

export function sendToJail(ctx: Ctx, player: Player, reason: string): void {
  const jailIndex = ctx.board.tiles.findIndex((t) => t.type === 'jail');
  if (jailIndex >= 0) player.position = jailIndex;
  player.inJail = true;
  player.jailTurns = 0;
  player.turn.doubles = 0;
  player.turn.phase = 'act';
  ctx.emit({ type: 'JAILED', playerId: player.id, reason });
}

export function landOn(ctx: Ctx, player: Player, options: LandingOptions): void {
  const tile = ctx.tileAt(player.position);
  ctx.emit({ type: 'LANDED', playerId: player.id, tileId: tile.id });
  player.turn.phase = 'act';

  switch (tile.type) {
    case 'property':
    case 'transport':
    case 'utility':
      return landOnOwnable(ctx, player, tile, options);
    case 'tax':
      return pay(ctx, player.id, null, tile.amount, tile.name);
    case 'card':
      return drawCard(ctx, player, tile.deckId, options.diceTotal);
    case 'go-to-jail':
      return sendToJail(ctx, player, tile.name);
    case 'start': {
      const { landStartBonus, passStartBonus } = ctx.state.rules;
      return receive(ctx, player.id, landStartBonus - passStartBonus, `landed on ${tile.name}`);
    }
    default:
      return;
  }
}

function landOnOwnable(ctx: Ctx, player: Player, tile: OwnableTile, options: LandingOptions): void {
  const own = ctx.ownership(tile.id);
  if (!own) return offerPurchase(ctx, player, tile);
  if (own.ownerId === player.id || own.mortgaged) return;

  const owner = ctx.player(own.ownerId);
  if (owner.bankrupt) return;
  if (ctx.state.rules.noRentInJail && owner.inJail) return;

  const rent = computeRent(ctx, tile, own.ownerId, options.diceTotal) * (options.rentMultiplier ?? 1);
  pay(ctx, player.id, owner.id, Math.floor(rent), `rent for ${tile.name}`);
}

function offerPurchase(ctx: Ctx, player: Player, tile: OwnableTile): void {
  if (ctx.state.rules.auctionOnly) {
    startAuction(ctx, tile.id, null, 1);
    return;
  }
  player.turn.pendingPurchase = tile.id;
  ctx.emit({ type: 'PURCHASE_OFFERED', playerId: player.id, tileId: tile.id });
}

export function computeRent(ctx: Ctx, tile: OwnableTile, ownerId: string, diceTotal: number): number {
  const own = ctx.ownership(tile.id);
  if (!own || own.mortgaged) return 0;
  const count = ctx.ownedInGroup(tile.groupId, ownerId);
  const monopoly = ctx.ownsWholeGroup(tile.groupId, ownerId);
  const double = ctx.state.rules.doubleRentOnMonopoly && monopoly ? 2 : 1;

  switch (tile.type) {
    case 'property':
      return own.buildings > 0 ? propertyRent(tile, own.buildings, ctx.state.rules) : (tile.rent[0] ?? 0) * double;
    case 'transport':
      return (tile.rent[count - 1] ?? tile.rent[tile.rent.length - 1] ?? 0) * double;
    case 'utility':
      return (tile.multipliers[count - 1] ?? tile.multipliers[tile.multipliers.length - 1] ?? 0) * diceTotal * double;
  }
}

export function nearestTileIndex(ctx: Ctx, from: number, predicate: (t: Tile) => boolean): number | null {
  const size = ctx.board.tiles.length;
  for (let step = 1; step <= size; step++) {
    const i = (from + step) % size;
    if (predicate(ctx.tileAt(i))) return i;
  }
  return null;
}

export const isOwnableTile = isOwnable;
