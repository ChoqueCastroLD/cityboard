import { Elysia, t } from 'elysia';
import { accountTokenFrom, type AuthService } from '../services/auth-service';
import type { BillingService } from '../services/billing-service';

export const billingRoutes = (auth: AuthService, billing: BillingService) =>
  new Elysia({ prefix: '/api/billing', name: 'billing' })
    .get('/status', async ({ headers }) => billing.status(await auth.authenticate(accountTokenFrom(headers))), {
      detail: { tags: ['billing'], summary: 'Subscription status of the current account' },
    })
    .post('/checkout', async ({ headers }) => billing.checkout(await auth.authenticate(accountTokenFrom(headers))), {
      detail: { tags: ['billing'], summary: 'Stripe Checkout URL for the CEO subscription' },
    })
    .post('/portal', async ({ headers }) => billing.portal(await auth.authenticate(accountTokenFrom(headers))), {
      detail: { tags: ['billing'], summary: 'Stripe billing portal URL' },
    })
    .post('/dev-activate', async ({ headers }) => billing.devActivate(await auth.authenticate(accountTokenFrom(headers))), {
      detail: { tags: ['billing'], summary: 'Development only: grant 30 days of CEO' },
    })
    .post(
      '/webhook',
      async ({ body, headers }) => {
        await billing.handleWebhook(body, headers['stripe-signature']);
        return { received: true };
      },
      { parse: 'text', body: t.String(), detail: { tags: ['billing'], summary: 'Stripe webhook' } },
    );
