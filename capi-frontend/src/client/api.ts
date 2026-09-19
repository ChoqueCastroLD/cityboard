import type { BoardDefinition, BoardTheme, CommandBody, Currency, GameEvent, GameMode, GameRules, GameState } from 'capi-core';
import { accountToken } from './account';

export interface PublicGameSummary {
  id: string;
  boardId: string;
  boardName: string;
  mode: GameMode;
  phase: GameState['phase'];
  hostName: string | null;
  players: number;
  maxPlayers: number;
  competitive: boolean;
  preset: string | null;
  boardAccent: string | null;
  updatedAt: number;
}

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  premium: boolean;
  premiumUntil: string | null;
  totalCash: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalCash: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  wins: LeaderboardEntry[];
}

export interface BillingStatus {
  premium: boolean;
  premiumUntil: string | null;
  configured: boolean;
}

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export interface BoardSummary {
  id: string;
  name: string;
  description?: string;
  tileCount: number;
  thumbnail?: string;
  currency: Currency;
  theme?: BoardTheme;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit & { secret?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.secret) headers.authorization = `Bearer ${init.secret}`;
  const account = accountToken();
  if (account) headers['x-account'] = `Bearer ${account}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) throw new ApiError(body.error?.code ?? 'HTTP_ERROR', body.error?.message ?? `Error ${res.status}`, res.status);
  return body;
}

export const api = {
  boards: () => request<{ boards: BoardSummary[] }>('/api/boards'),
  board: (id: string) => request<{ board: BoardDefinition }>(`/api/boards/${id}`),
  createGame: (boardId: string, mode: GameMode, rules?: Partial<GameRules>) =>
    request<{ game: GameState }>('/api/games', { method: 'POST', body: JSON.stringify({ boardId, mode, rules }) }),
  game: (id: string) => request<{ game: GameState; board: BoardDefinition; history?: GameEvent[] }>(`/api/games/${id}`),
  publicGames: () => request<{ games: PublicGameSummary[] }>('/api/games'),
  join: (id: string, name: string, token?: string) =>
    request<{ playerId: string; secret: string; game: GameState }>(`/api/games/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ name, token }),
    }),
  command: (id: string, secret: string, command: CommandBody) =>
    request<{ game: GameState; events: GameEvent[] }>(`/api/games/${id}/commands`, {
      method: 'POST',
      secret,
      body: JSON.stringify(command),
    }),
  leaderboard: () => request<Leaderboard>('/api/leaderboard'),
  auth: {
    requestCode: (email: string, name?: string) =>
      request<{ sent: boolean; devCode?: string }>('/api/auth/request-code', { method: 'POST', body: JSON.stringify({ email, name }) }),
    verify: (email: string, code: string, name?: string) =>
      request<{ token: string; user: AccountUser }>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ email, code, name }) }),
    me: () => request<{ user: AccountUser } | AccountUser>('/api/auth/me'),
    logout: () => request<{ ok?: boolean }>('/api/auth/logout', { method: 'POST' }),
    rename: (name: string) => request<{ user: AccountUser } | AccountUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
  },
  billing: {
    status: () => request<BillingStatus>('/api/billing/status'),
    checkout: () => request<{ url: string }>('/api/billing/checkout', { method: 'POST' }),
    portal: () => request<{ url: string }>('/api/billing/portal', { method: 'POST' }),
    devActivate: () => request<BillingStatus | { ok?: boolean }>('/api/billing/dev-activate', { method: 'POST' }),
  },
};

export function wsUrl(gameId: string): string {
  const base = API_URL.replace(/^http/, 'ws');
  return `${base}/ws/games/${gameId}`;
}
