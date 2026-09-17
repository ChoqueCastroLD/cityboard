import { startAuction } from './auction';
import { returnJailCard } from './cards';
import type { Ctx } from './context';
import { pay, spend } from './economy';
import { assert } from './errors';
import type { GameOverReason } from './events';
import { moveBy, sendToJail } from './movement';
import { rollDie } from './rng';
import { idleTurn, type Player } from './state';

export function beginTurn(ctx: Ctx, player: Player): void {
  player.turn = { ...idleTurn(), phase: 'roll' };
  ctx.state.turnCount += 1;
  ctx.emit({ type: 'TURN_STARTED', playerId: player.id });
}

export function refreshHourglass(ctx: Ctx, player: Player): void {
  if (ctx.state.mode !== 'async' || player.bankrupt) return;
  if (player.turn.phase === 'idle' && ctx.now >= player.cooldownUntil) beginTurn(ctx, player);
}

export function refreshAllHourglasses(ctx: Ctx): void {
  for (const player of ctx.activePlayers()) refreshHourglass(ctx, player);
}

export function ensureActing(ctx: Ctx, player: Player): void {
  ctx.isPlaying();
  assert(!player.bankrupt, 'NOT_ALLOWED', 'you are out of the game');
  if (ctx.state.mode === 'classic') {
    assert(ctx.state.activePlayerId === player.id, 'NOT_YOUR_TURN', 'it is not your turn');
  } else {
    refreshHourglass(ctx, player);
    assert(player.turn.phase !== 'idle', 'NOT_YOUR_TURN', 'your hourglass is still running');
  }
}

export function roll(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  assert(player.turn.phase === 'roll', 'WRONG_PHASE', 'you already rolled');
  if (ctx.state.mode === 'classic') {
    assert(ctx.state.auctions.length === 0, 'WRONG_PHASE', 'finish the auction first');
  }

  const d1 = rollDie(ctx.state.rng);
  const d2 = rollDie(d1.seed);
  ctx.state.rng = d2.seed;
  const dice: [number, number] = [d1.value, d2.value];
  const total = d1.value + d2.value;
  const doubles = d1.value === d2.value;
  player.turn.lastRoll = dice;
  ctx.emit({ type: 'ROLLED', playerId: player.id, dice });

  if (player.inJail) return rollInJail(ctx, player, total, doubles);

  if (doubles) {
    player.turn.doubles += 1;
    if (player.turn.doubles >= ctx.state.rules.maxDoubles) {
      return sendToJail(ctx, player, 'too many doubles');
    }
  } else {
    player.turn.doubles = 0;
  }
  moveBy(ctx, player, total, { diceTotal: total });
}

function rollInJail(ctx: Ctx, player: Player, total: number, doubles: boolean): void {
  const { rules } = ctx.state;
  if (doubles) {
    release(ctx, player, 'doubles');
    player.turn.doubles = 0;
    return moveBy(ctx, player, total, { diceTotal: total });
  }
  player.jailTurns += 1;
  if (player.jailTurns >= rules.maxJailTurns) {
    pay(ctx, player.id, null, rules.jailFine, 'jail fine');
    release(ctx, player, 'fine');
    return moveBy(ctx, player, total, { diceTotal: total });
  }
  player.turn.phase = 'act';
}

function release(ctx: Ctx, player: Player, how: 'doubles' | 'fine' | 'card'): void {
  player.inJail = false;
  player.jailTurns = 0;
  ctx.emit({ type: 'RELEASED', playerId: player.id, how });
}

export function payJailFine(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  assert(player.inJail && player.turn.phase === 'roll', 'WRONG_PHASE', 'you can only pay before rolling');
  spend(ctx, player.id, null, ctx.state.rules.jailFine, 'jail fine');
  release(ctx, player, 'fine');
}

export function useJailCard(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  assert(player.inJail && player.turn.phase === 'roll', 'WRONG_PHASE', 'you can only use the card before rolling');
  returnJailCard(ctx, player);
  release(ctx, player, 'card');
}

export function buyPending(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  const tileId = player.turn.pendingPurchase;
  assert(tileId, 'WRONG_PHASE', 'nothing to buy');
  const tile = ctx.ownableTile(tileId);
  assert(!ctx.ownership(tileId), 'NOT_ALLOWED', 'already owned');
  spend(ctx, player.id, null, tile.price, `bought ${tile.name}`);
  ctx.state.properties[tileId] = { ownerId: player.id, buildings: 0, mortgaged: false };
  player.turn.pendingPurchase = null;
  ctx.emit({ type: 'BOUGHT', playerId: player.id, tileId, price: tile.price, fromId: null });
}

export function declinePending(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  const tileId = player.turn.pendingPurchase;
  assert(tileId, 'WRONG_PHASE', 'nothing to decline');
  player.turn.pendingPurchase = null;
  ctx.emit({ type: 'DECLINED', playerId: player.id, tileId });
  if (ctx.state.rules.auctionOnDecline && !ctx.ownership(tileId) && !ctx.state.auctions.some((a) => a.tileId === tileId)) {
    startAuction(ctx, tileId, null, 1);
  }
}

export function endTurn(ctx: Ctx, player: Player): void {
  ensureActing(ctx, player);
  assert(player.turn.phase === 'act', 'WRONG_PHASE', 'roll first');
  assert(player.cash >= 0, 'NOT_ALLOWED', 'settle your debt (or declare bankruptcy) first');
  if (player.turn.pendingPurchase) declinePending(ctx, player);
  if (ctx.state.mode === 'classic') {
    assert(ctx.state.auctions.length === 0, 'WRONG_PHASE', 'finish the auction first');
  }

  if (player.turn.doubles > 0 && !player.inJail) {
    player.turn.phase = 'roll';
    return;
  }
  finishTurn(ctx, player);
}

export function finishTurn(ctx: Ctx, player: Player): void {
  player.turn = idleTurn();
  if (ctx.state.mode === 'async') {
    player.cooldownUntil = ctx.now + ctx.state.rules.asyncCooldownMs;
    ctx.emit({ type: 'COOLDOWN_STARTED', playerId: player.id, until: player.cooldownUntil });
    return;
  }
  advanceClassic(ctx);
}

export function advanceClassic(ctx: Ctx): void {
  const order = ctx.state.order;
  const current = order.indexOf(ctx.state.activePlayerId ?? '');
  for (let step = 1; step <= order.length; step++) {
    const id = order[(current + step) % order.length];
    if (!id) continue;
    const candidate = ctx.player(id);
    if (!candidate.bankrupt) {
      ctx.state.activePlayerId = id;
      beginTurn(ctx, candidate);
      return;
    }
  }
  ctx.state.activePlayerId = null;
}

export function checkGameOver(ctx: Ctx): void {
  if (ctx.state.phase !== 'playing') return;
  const alive = ctx.activePlayers();
  const seated = ctx.state.players.filter((p) => !p.spectator).length;
  if (alive.length <= 1 && seated > 1) return finishGame(ctx, 'last-standing');
  if (ctx.state.endsAt !== null && ctx.now >= ctx.state.endsAt) return finishGame(ctx, 'time');
}

export function finishGame(ctx: Ctx, reason: GameOverReason): void {
  const standings = ctx
    .activePlayers()
    .map((p) => ({ playerId: p.id, cash: p.cash }))
    .sort((a, b) => b.cash - a.cash);
  ctx.state.phase = 'finished';
  ctx.state.winnerId = standings[0]?.playerId ?? null;
  ctx.state.activePlayerId = null;
  ctx.emit({ type: 'GAME_OVER', winnerId: ctx.state.winnerId, reason, standings });
}
