import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { badRequest, HttpError, unauthorized } from '../http-error';
import type { UserRecord, UserRepository } from '../repositories/user-repository';
import type { Mailer } from './mailer';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  premium: boolean;
  premiumUntil: string | null;
  totalCash: number;
  gamesPlayed: number;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isPremium = (user: Pick<UserRecord, 'premiumUntil'>, now = Date.now()) => user.premiumUntil !== null && user.premiumUntil > now;

export const toAccountUser = (user: UserRecord): AccountUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  premium: isPremium(user),
  premiumUntil: user.premiumUntil === null ? null : new Date(user.premiumUntil).toISOString(),
  totalCash: user.totalCash,
  gamesPlayed: user.gamesPlayed,
});

const hashCode = (email: string, code: string) => createHash('sha256').update(`${config.authPepper}:${email}:${code}`).digest('hex');

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const defaultName = (email: string) => email.split('@')[0]!.replace(/[._-]+/g, ' ').trim().slice(0, 24) || 'Jugador';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly mailer: Mailer,
  ) {}

  async requestCode(rawEmail: string): Promise<{ sent: boolean; devCode?: string }> {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) throw badRequest('Escribe un correo válido.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.users.createLoginCode({ id: crypto.randomUUID(), email, codeHash: hashCode(email, code), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0, consumedAt: null });
    await this.mailer.sendLoginCode(email, code);
    return this.mailer.configured || config.production ? { sent: true } : { sent: true, devCode: code };
  }

  async verify(rawEmail: string, rawCode: string, name?: string): Promise<{ token: string; user: AccountUser }> {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.replace(/\D/g, '');
    const record = await this.users.findLatestLoginCode(email);
    if (!record || record.expiresAt < Date.now()) throw new HttpError(400, 'CODE_EXPIRED', 'El código caducó. Pide uno nuevo.');
    if (record.attempts >= CODE_MAX_ATTEMPTS) throw new HttpError(400, 'CODE_LOCKED', 'Demasiados intentos. Pide un código nuevo.');
    if (!safeEqual(record.codeHash, hashCode(email, code))) {
      await this.users.bumpLoginAttempts(record.id);
      throw new HttpError(400, 'CODE_INVALID', 'Código incorrecto.');
    }
    await this.users.consumeLoginCode(record.id);
    let user = await this.users.findByEmail(email);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email,
        name: (name?.trim() || defaultName(email)).slice(0, 24),
        totalCash: 0,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        premiumUntil: null,
        stripeCustomerId: null,
        createdAt: Date.now(),
      };
      await this.users.createUser(user);
    }
    const token = randomBytes(32).toString('base64url');
    await this.users.createSession({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    return { token, user: toAccountUser(user) };
  }

  async authenticate(token: string | null | undefined): Promise<UserRecord> {
    const user = await this.tryAuthenticate(token);
    if (!user) throw unauthorized('Inicia sesión para continuar.');
    return user;
  }

  async tryAuthenticate(token: string | null | undefined): Promise<UserRecord | null> {
    if (!token) return null;
    const session = await this.users.findSession(token);
    if (!session || session.expiresAt < Date.now()) return null;
    return this.users.findById(session.userId);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (token) await this.users.deleteSession(token);
  }

  async rename(userId: string, name: string): Promise<AccountUser> {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) throw badRequest('El nombre no puede estar vacío.');
    return toAccountUser(await this.users.updateUser(userId, { name: trimmed }));
  }

  async userIsPremium(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    const user = await this.users.findById(userId);
    return user ? isPremium(user) : false;
  }
}

export const accountTokenFrom = (headers: Record<string, string | undefined>): string | null => {
  const raw = headers['x-account'] ?? headers.authorization ?? '';
  const value = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw;
  return value.trim() || null;
};
