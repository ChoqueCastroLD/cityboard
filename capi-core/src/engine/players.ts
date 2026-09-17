import type { BoardDefinition } from '../board/schema';
import { boardTokens } from '../board/tokens';
import { assert } from './errors';
import type { Player } from './state';

export const PLAYER_COLORS = ['#e53935', '#2962ff', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#ff4fa3', '#29b6f6', '#aeea00', '#1de9b6', '#8d6e63', '#2b2b36', '#f5f5f5'];

const normalizeColor = (color: string) => color.trim().toLowerCase();

export function takenColors(players: readonly Player[], exceptId?: string): Set<string> {
  return new Set(players.filter((p) => p.id !== exceptId).map((p) => normalizeColor(p.color)));
}

export function takenTokens(players: readonly Player[], exceptId?: string): Set<string> {
  return new Set(players.filter((p) => p.id !== exceptId).map((p) => p.token));
}

export function pickFreeColor(players: readonly Player[]): string {
  const taken = takenColors(players);
  return PLAYER_COLORS.find((c) => !taken.has(normalizeColor(c))) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length]!;
}

export function pickFreeToken(board: BoardDefinition, players: readonly Player[]): string {
  const taken = takenTokens(players);
  const options = boardTokens(board)
    .filter((t) => !t.premium)
    .map((t) => t.id);
  return options.find((id) => !taken.has(id)) ?? String(players.length + 1);
}

export function assertAppearanceFree(board: BoardDefinition, players: readonly Player[], playerId: string, color?: string, token?: string): void {
  if (color !== undefined) {
    assert(/^#[0-9a-f]{6}$/i.test(color.trim()), 'INVALID_COMMAND', 'color must be a hex value like #ff5f6d');
    assert(!takenColors(players, playerId).has(normalizeColor(color)), 'NOT_ALLOWED', 'that color is already taken');
  }
  if (token !== undefined) {
    assert(
      boardTokens(board).some((t) => t.id === token),
      'INVALID_COMMAND',
      'unknown piece',
    );
    assert(!takenTokens(players, playerId).has(token), 'NOT_ALLOWED', 'that piece is already taken');
  }
}
