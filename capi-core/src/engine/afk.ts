import { declareBankruptcy, forfeit } from './bankruptcy';
import { assert } from './errors';
import type { Ctx } from './context';
import { nextRandom } from './rng';
import type { GameState, Player } from './state';
import { buyPending, declinePending, endTurn, roll, useJailCard } from './turn';

const signature = (p: Player) => `${p.turn.phase}|${p.turn.pendingPurchase}|${p.turn.doubles}|${p.inJail}|${p.cash < 0}`;

function mayAct(ctx: Ctx, player: Player): boolean {
  if (player.turn.phase === 'idle') return false;
  if (ctx.state.mode === 'classic') return ctx.state.activePlayerId === player.id && ctx.state.auctions.length === 0;
  return true;
}

export function armDeadlines(ctx: Ctx, before: GameState): void {
  const timeout = ctx.state.rules.afkTimeoutMs;
  for (const player of ctx.activePlayers()) {
    if (!mayAct(ctx, player) || timeout <= 0) {
      player.turn.deadline = null;
      continue;
    }
    declineUnaffordable(ctx, player);
    const previous = before.players.find((p) => p.id === player.id);
    const changed = !previous || signature(previous) !== signature(player);
    if (changed || player.turn.deadline === null) player.turn.deadline = ctx.now + timeout;
  }
}

function declineUnaffordable(ctx: Ctx, player: Player): void {
  const tileId = player.turn.pendingPurchase;
  if (!tileId) return;
  const tile = ctx.ownableTile(tileId);
  if (player.cash >= tile.price) return;
  declinePending(ctx, player);
  ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'decline' });
}

export function forcePlay(ctx: Ctx, hostId: string, targetId: string): void {
  assert(ctx.state.hostId === hostId, 'NOT_ALLOWED', 'only the host can force a move');
  ctx.isPlaying();
  const player = ctx.player(targetId);
  assert(!player.bankrupt && !player.spectator, 'NOT_ALLOWED', 'that player is not in the game');
  assert(mayAct(ctx, player), 'NOT_ALLOWED', 'that player has nothing to play right now');
  ctx.emit({ type: 'PLAY_FORCED', playerId: targetId, byId: hostId });
  step(ctx, player);
}

export function autoplay(ctx: Ctx): void {
  if (ctx.state.rules.afkTimeoutMs <= 0) return;
  for (const player of ctx.activePlayers()) {
    const deadline = player.turn.deadline;
    if (deadline === null || ctx.now < deadline || !mayAct(ctx, player)) continue;
    step(ctx, player);
  }
}

export function settleDebts(ctx: Ctx): void {
  if (!ctx.state.rules.competitive) return;
  for (const player of ctx.activePlayers()) {
    if (player.cash < 0) declareBankruptcy(ctx, player);
  }
}

function step(ctx: Ctx, player: Player): void {
  if (ctx.state.rules.competitive) {
    forfeit(ctx, player, 'afk');
    return;
  }
  if (player.turn.phase === 'roll') {
    if (player.inJail && player.jailCards.length > 0) {
      useJailCard(ctx, player);
      ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'jail-card' });
      return;
    }
    roll(ctx, player);
    ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'roll' });
    return;
  }
  if (player.cash < 0) {
    declareBankruptcy(ctx, player);
    ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'bankrupt' });
    return;
  }
  if (player.turn.pendingPurchase) {
    const pick = nextRandom(ctx.state.rng);
    ctx.state.rng = pick.seed;
    if (pick.value < 0.5) {
      buyPending(ctx, player);
      ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'buy' });
    } else {
      declinePending(ctx, player);
      ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'decline' });
    }
    return;
  }
  endTurn(ctx, player);
  ctx.emit({ type: 'AUTO_PLAYED', playerId: player.id, action: 'end-turn' });
}
