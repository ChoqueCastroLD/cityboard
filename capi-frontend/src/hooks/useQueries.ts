import { useQuery } from '@tanstack/react-query';
import type { BoardDefinition } from 'capi-core';
import { api } from '../client/api';

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    queryFn: async () => {
      const { boards } = await api.boards();
      return boards;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useBoard(id: string | null) {
  return useQuery({
    queryKey: ['board', id],
    enabled: !!id,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<BoardDefinition | null> => {
      if (!id) return null;
      const { board } = await api.board(id);
      return board;
    },
  });
}

export function useRoom(code: string | null) {
  return useQuery({
    queryKey: ['room', code],
    enabled: !!code,
    retry: false,
    queryFn: () => api.game(code!),
  });
}

const PUBLIC_REFRESH_MS = 5000;

export function usePublicGames(enabled: boolean) {
  return useQuery({
    queryKey: ['public-games'],
    enabled,
    refetchInterval: PUBLIC_REFRESH_MS,
    staleTime: PUBLIC_REFRESH_MS,
    queryFn: async () => (await api.publicGames()).games,
  });
}

export function useLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ['leaderboard'],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: api.leaderboard,
  });
}

export function useBillingStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['billing-status'],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: api.billing.status,
  });
}
