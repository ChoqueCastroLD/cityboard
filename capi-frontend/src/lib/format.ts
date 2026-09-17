import { type BoardDefinition, boardTokens, type GameState, type Player, type TokenOption } from 'capi-core';

export const money = (board: BoardDefinition, amount: number): string =>
  `${board.currency.symbol}${Math.round(amount).toLocaleString('es')}`;

export const tileName = (board: BoardDefinition, tileId: string): string =>
  board.tiles.find((t) => t.id === tileId)?.name ?? tileId;

export const playerName = (state: GameState, playerId: string | null): string =>
  playerId === null ? 'la banca' : (state.players.find((p) => p.id === playerId)?.name ?? playerId);

export const tokenOf = (board: BoardDefinition, player: Pick<Player, 'token'>): TokenOption | undefined =>
  boardTokens(board).find((t) => t.id === player.token);

const SHAPE_ICONS: Record<string, string> = {
  pawn: 'User',
  cone: 'Triangle',
  cube: 'Box',
  sphere: 'Circle',
  ring: 'CircleDashed',
  pyramid: 'Pyramid',
  cylinder: 'Cylinder',
  capsule: 'Pill',
};

export function tokenIcon(board: BoardDefinition, player: Pick<Player, 'token'>): string {
  const token = tokenOf(board, player);
  return token?.icon ?? (token?.shape ? (SHAPE_ICONS[token.shape] ?? 'Shapes') : 'Shapes');
}

export function formatMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export const groupOf = (board: BoardDefinition, groupId: string) => board.groups.find((g) => g.id === groupId);

export function translateReason(reason: string): string {
  const fixed: Record<string, string> = {
    'jail fine': 'fianza',
    'loan interest': 'interés del préstamo',
    mortgage: 'hipoteca',
    'mortgage lifted': 'hipoteca levantada',
    auction: 'subasta',
    building: 'construcción',
    'building sold': 'venta de construcción',
    'passed start': 'bono de salida',
  };
  if (fixed[reason]) return fixed[reason];
  const rent = /^rent for (.+)$/.exec(reason);
  if (rent) return `renta de ${rent[1]}`;
  const bought = /^bought (.+?)( from its owner)?$/.exec(reason);
  if (bought) return `compra de ${bought[1]}`;
  return reason;
}

export function onColor(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return '#111118';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111118' : '#ffffff';
}
