import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config';
import type { GameRepository } from './repositories/game-repository';
import { MemoryGameRepository } from './repositories/memory-game-repository';
import { MemoryUserRepository } from './repositories/memory-user-repository';
import type { UserRepository } from './repositories/user-repository';

export interface Repositories {
  games: GameRepository;
  users: UserRepository;
}

function resolveSqliteUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  if (isAbsolute(path)) return url;
  return pathToFileURL(resolve(import.meta.dir, '../prisma', path)).href;
}

async function applySqlitePragmas(prisma: { $executeRawUnsafe(sql: string): Promise<unknown> }, url: string): Promise<void> {
  if (!url.startsWith('file:')) return;
  for (const pragma of ['PRAGMA journal_mode = WAL', 'PRAGMA busy_timeout = 5000', 'PRAGMA synchronous = NORMAL', 'PRAGMA foreign_keys = ON']) {
    await prisma.$executeRawUnsafe(pragma).catch((e: unknown) => console.warn(`[db] ${pragma} failed`, e));
  }
}

export function createMemoryRepositories(): Repositories {
  return { games: new MemoryGameRepository(), users: new MemoryUserRepository() };
}

export async function createRepositories(): Promise<Repositories> {
  if (!config.databaseUrl) {
    console.warn('[db] DATABASE_URL not set: using in-memory storage');
    return createMemoryRepositories();
  }
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaLibSQL } = await import('@prisma/adapter-libsql');
  const { PrismaGameRepository } = await import('./repositories/prisma-game-repository');
  const { PrismaUserRepository } = await import('./repositories/prisma-user-repository');

  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url: resolveSqliteUrl(config.databaseUrl) }) });
  await prisma.$connect();
  await applySqlitePragmas(prisma, config.databaseUrl);
  return { games: new PrismaGameRepository(prisma), users: new PrismaUserRepository(prisma) };
}
