import type { Ctx } from './context';
import { assert } from './errors';

export function transferHost(ctx: Ctx, fromId: string, toId: string): void {
  assert(ctx.state.hostId === fromId, 'NOT_ALLOWED', 'only the host can hand over hosting');
  assert(fromId !== toId, 'INVALID_COMMAND', 'you are already the host');
  const target = ctx.player(toId);
  assert(!target.bankrupt, 'NOT_ALLOWED', 'that player is out of the game');
  ctx.state.hostId = toId;
  ctx.emit({ type: 'HOST_CHANGED', playerId: toId });
}

export function reassignHostIfGone(ctx: Ctx, goneId: string): void {
  if (ctx.state.hostId !== goneId) return;
  const next = ctx.state.players.find((p) => p.id !== goneId && !p.bankrupt);
  ctx.state.hostId = next?.id ?? null;
  if (next) ctx.emit({ type: 'HOST_CHANGED', playerId: next.id });
}
