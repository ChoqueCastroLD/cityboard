const env = process.env;
const production = env.NODE_ENV === 'production';

export const config = {
  port: Number(env.PORT ?? 3000),
  production,
  databaseUrl: env.DATABASE_URL ?? null,
  boardsDir: env.CAPI_BOARDS_DIR ?? null,
  tickMs: Number(env.TICK_MS ?? 1000),
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  appUrl: env.APP_URL ?? 'http://localhost:5173',
  authPepper: env.AUTH_PEPPER ?? 'capi-dev-pepper',
  resendApiKey: env.RESEND_API_KEY ?? null,
  resendFrom: env.RESEND_FROM ?? 'Capichan <onboarding@resend.dev>',
  stripeSecretKey: env.STRIPE_SECRET_KEY ?? null,
  stripePriceId: env.STRIPE_PRICE_ID ?? null,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
  disconnectForfeitMs: Number(env.DISCONNECT_FORFEIT_MS ?? 120_000),
  disconnectGraceMs: Number(env.DISCONNECT_GRACE_MS ?? 5 * 60_000),
  tenorApiKey: env.TENOR_API_KEY ?? null,
  stunUrls: (env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(',').map((s) => s.trim()).filter(Boolean),
  turnUrl: env.TURN_URL ?? null,
  turnUsername: env.TURN_USERNAME ?? null,
  turnCredential: env.TURN_CREDENTIAL ?? null,
  abandonMs: Number(env.ABANDON_MS ?? 30 * 60_000),
} as const;
