import type { AuthSessionRecord, LoginCodeRecord, UserRecord, UserRepository } from './user-repository';

export class MemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly codes: LoginCodeRecord[] = [];
  private readonly sessions = new Map<string, AuthSessionRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((u) => u.email === email);
    return user ? { ...user } : null;
  }

  async findByStripeCustomer(customerId: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((u) => u.stripeCustomerId === customerId);
    return user ? { ...user } : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, { ...user });
  }

  async updateUser(id: string, patch: Partial<Pick<UserRecord, 'name' | 'premiumUntil' | 'stripeCustomerId'>>): Promise<UserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error(`user ${id} not found`);
    Object.assign(user, patch);
    return { ...user };
  }

  async addResult(userId: string, cash: number, won: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.totalCash += cash;
    user.gamesPlayed += 1;
    if (won) user.wins += 1;
    else user.losses += 1;
  }

  async leaderboard(limit: number): Promise<UserRecord[]> {
    return [...this.users.values()]
      .filter((u) => u.gamesPlayed > 0)
      .sort((a, b) => b.totalCash - a.totalCash || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((u) => ({ ...u }));
  }

  async leaderboardByWins(limit: number): Promise<UserRecord[]> {
    return [...this.users.values()]
      .filter((u) => u.gamesPlayed > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((u) => ({ ...u }));
  }

  async createLoginCode(code: LoginCodeRecord): Promise<void> {
    this.codes.push({ ...code });
  }

  async findLatestLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const code = [...this.codes].reverse().find((c) => c.email === email && c.consumedAt === null);
    return code ? { ...code } : null;
  }

  async bumpLoginAttempts(id: string): Promise<void> {
    const code = this.codes.find((c) => c.id === id);
    if (code) code.attempts += 1;
  }

  async consumeLoginCode(id: string): Promise<void> {
    const code = this.codes.find((c) => c.id === id);
    if (code) code.consumedAt = Date.now();
  }

  async createSession(session: AuthSessionRecord): Promise<void> {
    this.sessions.set(session.token, { ...session });
  }

  async findSession(token: string): Promise<AuthSessionRecord | null> {
    const session = this.sessions.get(token);
    return session ? { ...session } : null;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}
