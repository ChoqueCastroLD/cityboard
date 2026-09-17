import type { UserRecord, UserRepository } from '../repositories/user-repository';

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

const CACHE_MS = 15_000;
const LIMIT = 50;

const toEntry = (u: UserRecord, i: number): LeaderboardEntry => ({ rank: i + 1, userId: u.id, name: u.name, totalCash: u.totalCash, gamesPlayed: u.gamesPlayed, wins: u.wins, losses: u.losses });

export class LeaderboardService {
  private cache: { at: number; board: Leaderboard } | null = null;

  constructor(private readonly users: UserRepository) {}

  async top(): Promise<Leaderboard> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.board;
    const [byCash, byWins] = await Promise.all([this.users.leaderboard(LIMIT), this.users.leaderboardByWins(LIMIT)]);
    const board = { entries: byCash.map(toEntry), wins: byWins.map(toEntry) };
    this.cache = { at: now, board };
    return board;
  }

  invalidate(): void {
    this.cache = null;
  }
}
