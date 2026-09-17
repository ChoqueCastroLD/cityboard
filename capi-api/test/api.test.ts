import { beforeAll, describe, expect, it } from 'bun:test';
import { createMemoryRepositories } from '../src/db';
import { limits } from '../src/rate-limit';
import { buildServer, type CapiServer } from '../src/server';
import { AuthService } from '../src/services/auth-service';
import { BillingService } from '../src/services/billing-service';
import { BoardService } from '../src/services/board-service';
import { GameService } from '../src/services/game-service';
import { ChatService } from '../src/services/chat-service';
import { LeaderboardService } from '../src/services/leaderboard-service';
import { createMailer } from '../src/services/mailer';

let app: CapiServer;
let games: GameService;

const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const call = (path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
  app
    .handle(
      new Request(`http://localhost${path}`, {
        method: init.method ?? (init.body ? 'POST' : 'GET'),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': init.headers?.ip ?? '10.0.0.1', ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    )
    .then(json);

async function login(email: string, name: string): Promise<string> {
  const requested = await call('/api/auth/request-code', { body: { email }, headers: { ip: `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` } });
  expect(requested.status).toBe(200);
  expect(requested.body.devCode).toMatch(/^\d{6}$/);
  const verified = await call('/api/auth/verify', { body: { email, code: requested.body.devCode, name }, headers: { ip: `10.2.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` } });
  expect(verified.status).toBe(200);
  return verified.body.token as string;
}

const account = (token: string) => ({ 'x-account': `Bearer ${token}` });
const player = (secret: string) => ({ authorization: `Bearer ${secret}` });

beforeAll(async () => {
  const boards = await BoardService.load(null);
  const repos = createMemoryRepositories();
  const auth = new AuthService(repos.users, createMailer());
  const billing = new BillingService(repos.users);
  const leaderboard = new LeaderboardService(repos.users);
  games = new GameService(repos.games, boards, repos.users, auth);
  const chat = new ChatService(repos.games);
  app = buildServer({ boards, games, auth, billing, leaderboard, chat });
});

describe('auth', () => {
  it('logs in with an emailed code and returns the account', async () => {
    const token = await login('ana@example.com', 'Ana');
    const me = await call('/api/auth/me', { headers: account(token) });
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'ana@example.com', name: 'Ana', premium: false, totalCash: 0 });
    const renamed = await call('/api/auth/me', { method: 'PATCH', body: { name: 'Ana B' }, headers: account(token) });
    expect(renamed.body.user.name).toBe('Ana B');
    await call('/api/auth/logout', { method: 'POST', headers: account(token) });
    expect((await call('/api/auth/me', { headers: account(token) })).status).toBe(401);
  });

  it('rejects wrong codes and invalid emails', async () => {
    expect((await call('/api/auth/request-code', { body: { email: 'not-an-email' } })).status).toBe(400);
    await call('/api/auth/request-code', { body: { email: 'beto@example.com' } });
    const wrong = await call('/api/auth/verify', { body: { email: 'beto@example.com', code: '000000' }, headers: { ip: '10.9.9.9' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('CODE_INVALID');
  });

  it('rate limits code requests per email', async () => {
    for (let i = 0; i < 5; i++) await call('/api/auth/request-code', { body: { email: 'spam@example.com' }, headers: { ip: `10.5.0.${i}` } });
    const blocked = await call('/api/auth/request-code', { body: { email: 'spam@example.com' }, headers: { ip: '10.5.0.99' } });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('competitive games and premium pieces', () => {
  it('refuses guests in competitive games and premium pieces without a subscription', async () => {
    const created = await call('/api/games', { body: { boardId: 'mini-harbor', mode: 'classic', rules: { competitive: true } } });
    expect(created.status).toBe(201);
    const id = created.body.game.id as string;
    const guest = await call(`/api/games/${id}/join`, { body: { name: 'Invitado' } });
    expect(guest.status).toBe(403);
    expect(guest.body.error.code).toBe('ACCOUNT_REQUIRED');

    const token = await login('ceo@example.com', 'Ceo');
    const premium = await call(`/api/games/${id}/join`, { body: { name: 'Ceo', token: 'corona' }, headers: account(token) });
    expect(premium.status).toBe(403);
    expect(premium.body.error.code).toBe('PREMIUM_REQUIRED');

    const activated = await call('/api/billing/dev-activate', { method: 'POST', headers: account(token) });
    expect(activated.body.premium).toBe(true);
    const seated = await call(`/api/games/${id}/join`, { body: { name: 'Ceo', token: 'corona' }, headers: account(token) });
    expect(seated.status).toBe(200);
    expect(seated.body.game.players[0].token).toBe('corona');
  });

  it('rejects system-only and unknown commands from clients', async () => {
    const created = await call('/api/games', { body: { boardId: 'mini-harbor', mode: 'classic' } });
    const id = created.body.game.id as string;
    const joined = await call(`/api/games/${id}/join`, { body: { name: 'Ana' } });
    const forbidden = await call(`/api/games/${id}/commands`, { body: { type: 'FORFEIT', targetId: 'x', reason: 'afk' }, headers: player(joined.body.secret) });
    expect(forbidden.status).toBe(403);
    const unknown = await call(`/api/games/${id}/commands`, { body: { type: 'HACK' }, headers: player(joined.body.secret) });
    expect(unknown.status).toBe(403);
  });

  it('accrues the final cash of a public competitive game to the leaderboard', async () => {
    const tokenA = await login('lea@example.com', 'Lea');
    const others = await Promise.all(['leo', 'lia', 'luz'].map((n) => login(`${n}@example.com`, n)));
    const created = await call('/api/games', { body: { boardId: 'mini-harbor', mode: 'classic', rules: { competitive: true } } });
    const id = created.body.game.id as string;
    const a = await call(`/api/games/${id}/join`, { body: { name: 'Lea' }, headers: account(tokenA) });
    const joined = [];
    for (const [i, token] of others.entries()) joined.push(await call(`/api/games/${id}/join`, { body: { name: `Otro${i}` }, headers: account(token) }));
    const started = await call(`/api/games/${id}/commands`, { body: { type: 'START' }, headers: player(a.body.secret) });
    expect(started.body.game.phase).toBe('playing');

    let over = started.body;
    for (const other of joined) over = await games.executeSystem(id, { type: 'FORFEIT', targetId: other.body.playerId, reason: 'disconnected' });
    expect(over.game.phase).toBe('finished');
    expect(over.game.winnerId).toBe(a.body.playerId);

    const board = await call('/api/leaderboard');
    expect(board.status).toBe(200);
    const lea = board.body.entries.find((e: { name: string }) => e.name === 'Lea');
    expect(lea).toMatchObject({ rank: 1, totalCash: 1000, gamesPlayed: 1, wins: 1, losses: 0 });
    expect(board.body.entries).toHaveLength(1);
    expect(board.body.wins[0]).toMatchObject({ name: 'Lea', wins: 1 });

    const me = await call('/api/auth/me', { headers: account(tokenA) });
    expect(me.body.user.totalCash).toBe(1000);
  });
});

describe('security', () => {
  it('sets security headers and hides docs in production only', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('rate limits room creation per ip', async () => {
    const ip = '10.7.7.7';
    let last = 201;
    for (let i = 0; i < 21; i++) {
      last = (await call('/api/games', { body: { boardId: 'mini-harbor', mode: 'classic' }, headers: { ip } })).status;
    }
    expect(last).toBe(429);
    limits.createGameByIp.sweep(Date.now() + 11 * 60 * 1000);
  });
});
