import Stripe from 'stripe';
import { config } from '../config';
import { badRequest, forbidden, unavailable } from '../http-error';
import type { UserRecord, UserRepository } from '../repositories/user-repository';
import { isPremium } from './auth-service';

export interface BillingStatus {
  premium: boolean;
  premiumUntil: string | null;
  configured: boolean;
}

const DEV_GRANT_MS = 30 * 24 * 60 * 60 * 1000;

export class BillingService {
  private readonly stripe: Stripe | null;

  constructor(private readonly users: UserRepository) {
    this.stripe = config.stripeSecretKey && config.stripePriceId ? new Stripe(config.stripeSecretKey) : null;
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  status(user: UserRecord): BillingStatus {
    return {
      premium: isPremium(user),
      premiumUntil: user.premiumUntil === null ? null : new Date(user.premiumUntil).toISOString(),
      configured: this.configured,
    };
  }

  async checkout(user: UserRecord): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const customerId = await this.customerFor(stripe, user);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: config.stripePriceId!, quantity: 1 }],
      success_url: `${config.appUrl}/?billing=success`,
      cancel_url: `${config.appUrl}/?billing=cancel`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw unavailable('BILLING_ERROR', 'Stripe no devolvió una URL de pago.');
    return { url: session.url };
  }

  async portal(user: UserRecord): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const customerId = await this.customerFor(stripe, user);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${config.appUrl}/` });
    return { url: session.url };
  }

  async devActivate(user: UserRecord): Promise<BillingStatus> {
    if (config.production) throw forbidden('NOT_ALLOWED', 'No disponible en producción.');
    const base = Math.max(Date.now(), user.premiumUntil ?? 0);
    const updated = await this.users.updateUser(user.id, { premiumUntil: base + DEV_GRANT_MS });
    return this.status(updated);
  }

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const stripe = this.requireStripe();
    if (!config.stripeWebhookSecret || !signature) throw badRequest('Firma del webhook ausente.');
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
    } catch {
      throw badRequest('Firma del webhook inválida.');
    }
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription && session.customer) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          await this.applySubscription(String(session.customer), subscription);
        }
        return;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId && invoice.customer) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await this.applySubscription(String(invoice.customer), subscription);
        }
        return;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await this.applySubscription(String(subscription.customer), subscription);
        return;
      }
      default:
        return;
    }
  }

  private async applySubscription(customerId: string, subscription: Stripe.Subscription): Promise<void> {
    const user = await this.users.findByStripeCustomer(customerId);
    if (!user) return;
    const active = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
    const periodEnd = subscription.items.data.reduce((max, item) => Math.max(max, (item.current_period_end ?? 0) * 1000), 0);
    await this.users.updateUser(user.id, { premiumUntil: active && periodEnd > 0 ? periodEnd : null });
  }

  private async customerFor(stripe: Stripe, user: UserRecord): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
    await this.users.updateUser(user.id, { stripeCustomerId: customer.id });
    return customer.id;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw unavailable('BILLING_NOT_CONFIGURED', 'Pagos no configurados');
    return this.stripe;
  }
}
