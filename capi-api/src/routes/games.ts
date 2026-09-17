import type { CommandBody } from 'capi-core';
import { Elysia, t } from 'elysia';
import { clientIp, limits } from '../rate-limit';
import { accountTokenFrom, type AuthService } from '../services/auth-service';
import type { GameService } from '../services/game-service';

const bearer = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null);

export const gameRoutes = (games: GameService, auth: AuthService) =>
  new Elysia({ prefix: '/api/games', name: 'games' })
    .get('/', async () => ({ games: await games.listPublic() }), {
      detail: { tags: ['games'], summary: 'Public rooms that can still be joined' },
    })
    .post(
      '/',
      async ({ body, set, request, server }) => {
        limits.createGameByIp.assert(clientIp(request, server));
        set.status = 201;
        return { game: await games.create(body.boardId, body.mode, body.rules) };
      },
      {
        body: t.Object({
          boardId: t.String({ maxLength: 64 }),
          mode: t.Union([t.Literal('classic'), t.Literal('async')]),
          rules: t.Optional(t.Record(t.String(), t.Union([t.Boolean(), t.Number()]))),
        }),
        detail: { tags: ['games'], summary: 'Create a room; the returned game.id is the join code' },
      },
    )
    .get('/:id', ({ params }) => games.get(params.id.toUpperCase()), {
      params: t.Object({ id: t.String({ maxLength: 12 }) }),
      detail: { tags: ['games'], summary: 'Public game state plus its board and recent history' },
    })
    .post(
      '/:id/join',
      async ({ params, body, headers }) => {
        const user = await auth.tryAuthenticate(accountTokenFrom({ 'x-account': headers['x-account'] }));
        return games.join(params.id.toUpperCase(), body.name, user?.id ?? null, body.color, body.token);
      },
      {
        params: t.Object({ id: t.String({ maxLength: 12 }) }),
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 24 }),
          color: t.Optional(t.String({ maxLength: 7 })),
          token: t.Optional(t.String({ maxLength: 32 })),
        }),
        detail: { tags: ['games'], summary: 'Take a seat; send X-Account: Bearer <token> to link your account' },
      },
    )
    .post(
      '/:id/commands',
      async ({ params, body, headers }) => {
        const gameId = params.id.toUpperCase();
        const actor = await games.authenticate(gameId, bearer(headers.authorization));
        return games.execute(gameId, actor, body as CommandBody);
      },
      {
        params: t.Object({ id: t.String({ maxLength: 12 }) }),
        body: t.Object({ type: t.String({ maxLength: 32 }) }, { additionalProperties: true }),
        detail: { tags: ['games'], summary: 'Apply a command (ROLL, BUY, BUILD, BID, ...) as the authenticated player' },
      },
    );
