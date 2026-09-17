import type { BoardDefinition } from './schema';
import { isOwnable } from './schema';

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateBoard(board: BoardDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  if (!board.id) issue('id', 'board id is required');
  if (!board.name) issue('name', 'board name is required');
  if (!board.currency?.symbol) issue('currency.symbol', 'currency symbol is required');

  const tiles = board.tiles ?? [];
  if (tiles.length < 8) issue('tiles', 'a board needs at least 8 tiles');
  if (tiles.length % 2 !== 0) issue('tiles', 'tile count must be even to form a rectangular ring');

  const groupIds = new Set((board.groups ?? []).map((g) => g.id));
  const deckIds = new Set((board.decks ?? []).map((d) => d.id));
  const tileIds = new Set<string>();

  if (tiles[0]?.type !== 'start') issue('tiles[0]', 'the first tile must be of type "start"');
  const hasJail = tiles.some((t) => t.type === 'jail');

  tiles.forEach((tile, i) => {
    const path = `tiles[${i}]`;
    if (!tile.id) issue(path, 'tile id is required');
    if (tileIds.has(tile.id)) issue(path, `duplicate tile id "${tile.id}"`);
    tileIds.add(tile.id);
    if (!tile.name) issue(path, 'tile name is required');

    if (isOwnable(tile)) {
      if (!groupIds.has(tile.groupId)) issue(path, `unknown group "${tile.groupId}"`);
      if (!(tile.price > 0)) issue(path, 'price must be positive');
    }
    if (tile.type === 'property' && tile.rent.length !== 6) issue(path, 'property rent must have 6 entries');
    if (tile.type === 'card' && !deckIds.has(tile.deckId)) issue(path, `unknown deck "${tile.deckId}"`);
    if (tile.type === 'go-to-jail' && !hasJail) issue(path, 'go-to-jail requires a jail tile');
  });

  for (const deck of board.decks ?? []) {
    if (deck.cards.length === 0) issue(`decks.${deck.id}`, 'deck has no cards');
    for (const card of deck.cards) {
      const action = card.action;
      if (action.kind === 'move-to' && !tileIds.has(action.tileId)) {
        issue(`decks.${deck.id}.${card.id}`, `unknown tile "${action.tileId}"`);
      }
    }
  }

  return issues;
}
