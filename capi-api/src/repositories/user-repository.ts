export interface UserRecord {
  id: string;
  email: string;
  name: string;
  totalCash: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  premiumUntil: number | null;
  stripeCustomerId: string | null;
  createdAt: number;
}

export interface LoginCodeRecord {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  consumedAt: number | null;
}

export interface AuthSessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByStripeCustomer(customerId: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(id: string, patch: Partial<Pick<UserRecord, 'name' | 'premiumUntil' | 'stripeCustomerId'>>): Promise<UserRecord>;
  addResult(userId: string, cash: number, won: boolean): Promise<void>;
  leaderboard(limit: number): Promise<UserRecord[]>;
  leaderboardByWins(limit: number): Promise<UserRecord[]>;

  createLoginCode(code: LoginCodeRecord): Promise<void>;
  findLatestLoginCode(email: string): Promise<LoginCodeRecord | null>;
  bumpLoginAttempts(id: string): Promise<void>;
  consumeLoginCode(id: string): Promise<void>;

  createSession(session: AuthSessionRecord): Promise<void>;
  findSession(token: string): Promise<AuthSessionRecord | null>;
  deleteSession(token: string): Promise<void>;
}
