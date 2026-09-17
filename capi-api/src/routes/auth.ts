import { Elysia, t } from 'elysia';
import { clientIp, limits } from '../rate-limit';
import { accountTokenFrom, type AuthService, normalizeEmail, toAccountUser } from '../services/auth-service';

export const authRoutes = (auth: AuthService) =>
  new Elysia({ prefix: '/api/auth', name: 'auth' })
    .post(
      '/request-code',
      async ({ body, request, server }) => {
        limits.requestCodeByIp.assert(clientIp(request, server));
        limits.requestCodeByEmail.assert(normalizeEmail(body.email));
        return auth.requestCode(body.email);
      },
      {
        body: t.Object({ email: t.String({ maxLength: 254 }), name: t.Optional(t.String({ maxLength: 24 })) }),
        detail: { tags: ['auth'], summary: 'Send a one-time login code by email' },
      },
    )
    .post(
      '/verify',
      async ({ body, request, server }) => {
        limits.verifyByIp.assert(clientIp(request, server));
        return auth.verify(body.email, body.code, body.name);
      },
      {
        body: t.Object({ email: t.String({ maxLength: 254 }), code: t.String({ minLength: 6, maxLength: 7 }), name: t.Optional(t.String({ maxLength: 24 })) }),
        detail: { tags: ['auth'], summary: 'Exchange the emailed code for an account token' },
      },
    )
    .get('/me', async ({ headers }) => ({ user: toAccountUser(await auth.authenticate(accountTokenFrom(headers))) }), {
      detail: { tags: ['auth'], summary: 'Current account' },
    })
    .patch(
      '/me',
      async ({ headers, body }) => {
        const user = await auth.authenticate(accountTokenFrom(headers));
        return { user: await auth.rename(user.id, body.name) };
      },
      { body: t.Object({ name: t.String({ minLength: 1, maxLength: 24 }) }), detail: { tags: ['auth'], summary: 'Rename the account' } },
    )
    .post(
      '/logout',
      async ({ headers }) => {
        await auth.logout(accountTokenFrom(headers));
        return { ok: true };
      },
      { detail: { tags: ['auth'], summary: 'Invalidate the account token' } },
    );
