import { Elysia } from 'elysia';
import type { LeaderboardService } from '../services/leaderboard-service';

export const leaderboardRoutes = (leaderboard: LeaderboardService) =>
  new Elysia({ prefix: '/api/leaderboard', name: 'leaderboard' }).get('/', () => leaderboard.top(), {
    detail: { tags: ['leaderboard'], summary: 'Top accounts by total cash (entries) and by wins (wins) in public competitive games' },
  });
