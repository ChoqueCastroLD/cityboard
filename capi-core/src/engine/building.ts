import type { PropertyTile } from '../board/schema';
import type { Ctx } from './context';
import { mortgageValue, receive, spend } from './economy';
import { assert } from './errors';
import { HOTEL_FLOOR_RENT_BONUS, HOTEL_FLOORS, type GameRules } from './rules';

function ownedProperty(ctx: Ctx, playerId: string, tileId: string): PropertyTile {
  const tile = ctx.tile(tileId);
  assert(tile.type === 'property', 'INVALID_COMMAND', 'only properties can hold buildings');
  assert(ctx.ownership(tileId)?.ownerId === playerId, 'NOT_ALLOWED', 'you do not own this property');
  return tile;
}

function houseCost(ctx: Ctx, tile: PropertyTile): number {
  const cost = ctx.board.groups.find((g) => g.id === tile.groupId)?.houseCost;
  assert(cost && cost > 0, 'NOT_ALLOWED', 'this group cannot be built on');
  return cost;
}

export function propertyRent(tile: PropertyTile, buildings: number, rules: Pick<GameRules, 'maxBuildings'>): number {
  const hotel = tile.rent[rules.maxBuildings] ?? tile.rent[tile.rent.length - 1] ?? 0;
  if (buildings <= rules.maxBuildings) return tile.rent[buildings] ?? hotel;
  return Math.round(hotel * (1 + HOTEL_FLOOR_RENT_BONUS * (buildings - rules.maxBuildings)));
}

export function hasAllHotels(ctx: Ctx, playerId: string): boolean {
  const { maxBuildings } = ctx.state.rules;
  const groups = new Set(ctx.playerTiles(playerId).map((t) => t.groupId));
  let complete = 0;
  for (const groupId of groups) {
    if (!ctx.ownsWholeGroup(groupId, playerId)) continue;
    const tiles = ctx.groupTiles(groupId).filter((t): t is PropertyTile => t.type === 'property');
    if (tiles.length === 0 || !ctx.board.groups.find((g) => g.id === groupId)?.houseCost) continue;
    complete += 1;
    if (tiles.some((t) => (ctx.ownership(t.id)?.buildings ?? 0) < maxBuildings)) return false;
  }
  return complete > 0;
}

export function maxLevel(ctx: Ctx, playerId: string): number {
  const { rules } = ctx.state;
  return rules.maxBuildings + (rules.hotelUpgrades && hasAllHotels(ctx, playerId) ? HOTEL_FLOORS : 0);
}

export function buildBlocker(ctx: Ctx, playerId: string, tileId: string): string | null {
  try {
    checkBuild(ctx, playerId, tileId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function canBuild(ctx: Ctx, playerId: string, tileId: string): boolean {
  return buildBlocker(ctx, playerId, tileId) === null;
}

function checkBuild(ctx: Ctx, playerId: string, tileId: string): { tile: PropertyTile; cost: number } {
  const tile = ownedProperty(ctx, playerId, tileId);
  const { rules } = ctx.state;
  const own = ctx.ownership(tileId)!;
  assert(ctx.ownsWholeGroup(tile.groupId, playerId), 'NOT_ALLOWED', 'you need the whole group to build');
  assert(!own.mortgaged, 'NOT_ALLOWED', 'cannot build on a mortgaged property');
  assert(own.buildings < maxLevel(ctx, playerId), 'NOT_ALLOWED', rules.hotelUpgrades && own.buildings === rules.maxBuildings ? 'hotel upgrades need hotels on all your groups' : 'this property is fully built');
  const group = ctx.groupTiles(tile.groupId);
  assert(group.every((t) => !ctx.ownership(t.id)?.mortgaged), 'NOT_ALLOWED', 'lift all mortgages in the group first');
  if (rules.evenBuild) {
    const min = Math.min(...group.map((t) => ctx.ownership(t.id)?.buildings ?? 0));
    assert(own.buildings === min, 'NOT_ALLOWED', 'build evenly across the group');
  }
  const cost = houseCost(ctx, tile);
  assert(ctx.player(playerId).cash >= cost, 'INSUFFICIENT_FUNDS', 'not enough cash to build');
  return { tile, cost };
}

export function build(ctx: Ctx, playerId: string, tileId: string): void {
  const { cost } = checkBuild(ctx, playerId, tileId);
  spend(ctx, playerId, null, cost, 'building');
  const own = ctx.ownership(tileId)!;
  own.buildings += 1;
  ctx.emit({ type: 'BUILT', playerId, tileId, buildings: own.buildings });
}

export function sellBuilding(ctx: Ctx, playerId: string, tileId: string): void {
  const tile = ownedProperty(ctx, playerId, tileId);
  const own = ctx.ownership(tileId)!;
  assert(own.buildings > 0, 'NOT_ALLOWED', 'nothing to sell');
  if (ctx.state.rules.evenBuild) {
    const max = Math.max(...ctx.groupTiles(tile.groupId).map((t) => ctx.ownership(t.id)?.buildings ?? 0));
    assert(own.buildings === max, 'NOT_ALLOWED', 'sell evenly across the group');
  }
  own.buildings -= 1;
  receive(ctx, playerId, Math.floor(houseCost(ctx, tile) * ctx.state.rules.buildingSellRatio), 'building sold');
  ctx.emit({ type: 'BUILDING_SOLD', playerId, tileId, buildings: own.buildings });
}

export function mortgage(ctx: Ctx, playerId: string, tileId: string): void {
  assert(ctx.state.rules.mortgageEnabled, 'RULE_DISABLED', 'mortgages are disabled');
  const tile = ctx.ownableTile(tileId);
  const own = ctx.ownership(tileId);
  assert(own?.ownerId === playerId, 'NOT_ALLOWED', 'you do not own this tile');
  assert(!own.mortgaged, 'NOT_ALLOWED', 'already mortgaged');
  assert(ctx.buildingsInGroup(tile.groupId) === 0, 'NOT_ALLOWED', 'sell the buildings in this group first');
  own.mortgaged = true;
  const amount = mortgageValue(tile);
  receive(ctx, playerId, amount, 'mortgage');
  ctx.emit({ type: 'MORTGAGED', playerId, tileId, amount });
}

export function unmortgage(ctx: Ctx, playerId: string, tileId: string): void {
  const tile = ctx.ownableTile(tileId);
  const own = ctx.ownership(tileId);
  assert(own?.ownerId === playerId, 'NOT_ALLOWED', 'you do not own this tile');
  assert(own.mortgaged, 'NOT_ALLOWED', 'not mortgaged');
  const base = mortgageValue(tile);
  const amount = base + Math.floor(base * ctx.state.rules.mortgageInterest);
  spend(ctx, playerId, null, amount, 'mortgage lifted');
  own.mortgaged = false;
  ctx.emit({ type: 'UNMORTGAGED', playerId, tileId, amount });
}
