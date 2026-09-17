import { dropFromAuctions } from './auction';
import type { Ctx } from './context';
import { transferTile } from './economy';
import { assert } from './errors';
import { reassignHostIfGone } from './host';
import { idleTurn, type Player } from './state';
import { dropTradesOf } from './trade';
import { advanceClassic, checkGameOver } from './turn';

export function forfeit(ctx: Ctx, player: Player, reason: 'afk' | 'disconnected' | 'debt' | null): void {
  for (const tile of ctx.playerTiles(player.id)) transferTile(ctx, tile.id, null);
  player.bankrupt = true;
  player.finalCash = player.cash;
  player.cash = 0;
  player.loan = 0;
  player.turn = idleTurn();
  if (reason) ctx.emit({ type: 'FORFEITED', playerId: player.id, reason });
  dropTradesOf(ctx, player.id);
  dropFromAuctions(ctx, player.id);
  reassignHostIfGone(ctx, player.id);
  if (ctx.state.mode === 'classic' && ctx.state.activePlayerId === player.id) advanceClassic(ctx);
  checkGameOver(ctx);
}

export function declareBankruptcy(ctx: Ctx, player: Player): void {
  ctx.isPlaying();
  assert(!player.bankrupt, 'NOT_ALLOWED', 'already bankrupt');
  assert(player.cash < 0, 'NOT_ALLOWED', 'you can only declare bankruptcy while in debt');
  const creditorId = player.creditorId;
  const creditor = creditorId ? ctx.player(creditorId) : null;

  for (const tile of ctx.playerTiles(player.id)) {
    const own = ctx.ownership(tile.id)!;
    if (tile.type === 'property' && own.buildings > 0) {
      const cost = ctx.board.groups.find((g) => g.id === tile.groupId)?.houseCost ?? 0;
      player.cash += Math.floor(cost * ctx.state.rules.buildingSellRatio) * own.buildings;
      own.buildings = 0;
    }
    transferTile(ctx, tile.id, creditor && !creditor.bankrupt ? creditor.id : null);
  }

  if (creditor && !creditor.bankrupt) {
    creditor.cash += Math.max(0, player.cash);
    creditor.jailCards.push(...player.jailCards);
  } else {
    for (const ref of player.jailCards) {
      (ctx.state.decks[ref.deckId] ??= { draw: [], discard: [] }).discard.push(ref.cardId);
    }
  }

  player.finalCash = player.cash;
  player.cash = 0;
  player.loan = 0;
  player.jailCards = [];
  player.bankrupt = true;
  player.creditorId = null;
  player.turn = idleTurn();
  ctx.emit({ type: 'BANKRUPT', playerId: player.id, creditorId: creditor?.id ?? null });

  dropTradesOf(ctx, player.id);
  dropFromAuctions(ctx, player.id);
  reassignHostIfGone(ctx, player.id);
  if (ctx.state.mode === 'classic' && ctx.state.activePlayerId === player.id) advanceClassic(ctx);
  checkGameOver(ctx);
}
