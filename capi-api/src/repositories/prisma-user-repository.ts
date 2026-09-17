import type { PrismaClient } from '@prisma/client';
import type { AuthSessionRecord, LoginCodeRecord, UserRecord, UserRepository } from './user-repository';

type UserRow = {
  id: string;
  email: string;
  name: string;
  totalCash: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  premiumUntil: Date | null;
  stripeCustomerId: string | null;
  createdAt: Date;
};

const toUser = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  totalCash: row.totalCash,
  gamesPlayed: row.gamesPlayed,
  wins: row.wins,
  losses: row.losses,
  premiumUntil: row.premiumUntil?.getTime() ?? null,
  stripeCustomerId: row.stripeCustomerId,
  createdAt: row.createdAt.getTime(),
});

const toDate = (ms: number | null | undefined) => (ms === undefined ? undefined : ms === null ? null : new Date(ms));

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  async findByStripeCustomer(customerId: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
    return row ? toUser(row) : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        totalCash: user.totalCash,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        premiumUntil: toDate(user.premiumUntil) ?? null,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: new Date(user.createdAt),
      },
    });
  }

  async updateUser(id: string, patch: Partial<Pick<UserRecord, 'name' | 'premiumUntil' | 'stripeCustomerId'>>): Promise<UserRecord> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { name: patch.name, premiumUntil: toDate(patch.premiumUntil), stripeCustomerId: patch.stripeCustomerId },
    });
    return toUser(row);
  }

  async addResult(userId: string, cash: number, won: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalCash: { increment: cash }, gamesPlayed: { increment: 1 }, ...(won ? { wins: { increment: 1 } } : { losses: { increment: 1 } }) },
    });
  }

  async leaderboard(limit: number): Promise<UserRecord[]> {
    const rows = await this.prisma.user.findMany({
      where: { gamesPlayed: { gt: 0 } },
      orderBy: [{ totalCash: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return rows.map(toUser);
  }

  async leaderboardByWins(limit: number): Promise<UserRecord[]> {
    const rows = await this.prisma.user.findMany({
      where: { gamesPlayed: { gt: 0 } },
      orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return rows.map(toUser);
  }

  async createLoginCode(code: LoginCodeRecord): Promise<void> {
    await this.prisma.loginCode.create({
      data: { id: code.id, email: code.email, codeHash: code.codeHash, expiresAt: new Date(code.expiresAt), attempts: code.attempts },
    });
  }

  async findLatestLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const row = await this.prisma.loginCode.findFirst({ where: { email, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    return row
      ? { id: row.id, email: row.email, codeHash: row.codeHash, expiresAt: row.expiresAt.getTime(), attempts: row.attempts, consumedAt: row.consumedAt?.getTime() ?? null }
      : null;
  }

  async bumpLoginAttempts(id: string): Promise<void> {
    await this.prisma.loginCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async consumeLoginCode(id: string): Promise<void> {
    await this.prisma.loginCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  async createSession(session: AuthSessionRecord): Promise<void> {
    await this.prisma.authSession.create({ data: { token: session.token, userId: session.userId, expiresAt: new Date(session.expiresAt) } });
  }

  async findSession(token: string): Promise<AuthSessionRecord | null> {
    const row = await this.prisma.authSession.findUnique({ where: { token } });
    if (!row) return null;
    void this.prisma.authSession.update({ where: { token }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    return { token: row.token, userId: row.userId, expiresAt: row.expiresAt.getTime() };
  }

  async deleteSession(token: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { token } });
  }
}
