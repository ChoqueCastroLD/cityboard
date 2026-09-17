import type { Card } from '../board/schema';
import type { Ctx } from './context';
import { pay, receive } from './economy';
import { assert } from './errors';
import { moveBy, moveTo, nearestTileIndex, sendToJail } from './movement';
import { shuffle } from './rng';
import type { Player } from './state';

export function drawCard(ctx: Ctx, player: Player, deckId: string, diceTotal: number): void {
  const deck = ctx.board.decks.find((d) => d.id === deckId);
  assert(deck, 'NOT_FOUND', `unknown deck ${deckId}`);
  const pile = (ctx.state.decks[deckId] ??= { draw: [], discard: [] });

  if (pile.draw.length === 0) {
    const source = pile.discard.length > 0 ? pile.discard : deck.cards.map((c) => c.id);
    const shuffled = shuffle(source, ctx.state.rng);
    ctx.state.rng = shuffled.seed;
    pile.draw = shuffled.items;
    pile.discard = [];
  }

  const cardId = pile.draw.shift();
  assert(cardId, 'INVALID_COMMAND', `deck ${deckId} is empty`);
  const card = deck.cards.find((c) => c.id === cardId);
  assert(card, 'NOT_FOUND', `unknown card ${cardId}`);

  ctx.emit({ type: 'CARD_DRAWN', playerId: player.id, deckId, cardId, text: card.text });

  if (card.action.kind === 'jail-free') {
    player.jailCards.push({ deckId, cardId });
  } else {
    pile.discard.push(cardId);
  }
  applyCard(ctx, player, card, diceTotal);
}

function applyCard(ctx: Ctx, player: Player, card: Card, diceTotal: number): void {
  const action = card.action;
  switch (action.kind) {
    case 'move-to':
      return moveTo(ctx, player, action.tileId, action.collectStart ?? true, { diceTotal });
    case 'move-by':
      return moveBy(ctx, player, action.steps, { diceTotal });
    case 'move-to-nearest': {
      const index = nearestTileIndex(ctx, player.position, (t) => t.type === action.tileType);
      if (index === null) return;
      const tile = ctx.tileAt(index);
      return moveTo(ctx, player, tile.id, true, { diceTotal, rentMultiplier: action.rentMultiplier ?? 1 });
    }
    case 'pay':
      return pay(ctx, player.id, null, action.amount, card.text);
    case 'receive':
      return receive(ctx, player.id, action.amount, card.text);
    case 'pay-each-player':
      for (const other of ctx.activePlayers()) {
        if (other.id !== player.id) pay(ctx, player.id, other.id, action.amount, card.text);
      }
      return;
    case 'receive-from-each-player':
      for (const other of ctx.activePlayers()) {
        if (other.id !== player.id) pay(ctx, other.id, player.id, action.amount, card.text);
      }
      return;
    case 'go-to-jail':
      return sendToJail(ctx, player, card.text);
    case 'jail-free':
      return;
    case 'repairs': {
      let total = 0;
      for (const tile of ctx.playerTiles(player.id)) {
        const buildings = ctx.ownership(tile.id)?.buildings ?? 0;
        const hotel = buildings >= ctx.state.rules.maxBuildings;
        total += hotel ? action.perHotel : buildings * action.perHouse;
      }
      return pay(ctx, player.id, null, total, card.text);
    }
  }
}

export function returnJailCard(ctx: Ctx, player: Player): void {
  const ref = player.jailCards.shift();
  assert(ref, 'NOT_ALLOWED', 'no jail-free card');
  (ctx.state.decks[ref.deckId] ??= { draw: [], discard: [] }).discard.push(ref.cardId);
}
