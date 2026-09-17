import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { GameError } from 'capi-core';
import { Elysia } from 'elysia';
import { config } from './config';
import { HttpError } from './http-error';
import { authRoutes } from './routes/auth';
import { billingRoutes } from './routes/billing';
import { boardRoutes } from './routes/boards';
import { gameRoutes } from './routes/games';
import { leaderboardRoutes } from './routes/leaderboard';
import type { AuthService } from './services/auth-service';
import type { BillingService } from './services/billing-service';
import type { BoardService } from './services/board-service';
import type { GameService } from './services/game-service';
import type { LeaderboardService } from './services/leaderboard-service';
import { mediaRoutes } from './routes/media';
import type { ChatService } from './services/chat-service';
import { wsGateway } from './ws/gateway';

export interface ServerDeps {
  boards: BoardService;
  games: GameService;
  auth: AuthService;
  billing: BillingService;
  leaderboard: LeaderboardService;
  chat: ChatService;
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_WS_PAYLOAD_BYTES = 16 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
};

export function buildServer({ boards, games, auth, billing, leaderboard, chat }: ServerDeps) {
  const app = new Elysia({ serve: { maxRequestBodySize: MAX_BODY_BYTES }, websocket: { maxPayloadLength: MAX_WS_PAYLOAD_BYTES } })
    .use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['content-type', 'authorization', 'x-account', 'stripe-signature'] }))
    .onAfterHandle(({ set }) => {
      Object.assign(set.headers, SECURITY_HEADERS);
    })
    .onError(({ error, set, code }) => {
      Object.assign(set.headers, SECURITY_HEADERS);
      if (error instanceof GameError) {
        set.status = 400;
        return { error: { code: error.code, message: error.message } };
      }
      if (error instanceof HttpError) {
        set.status = error.status;
        return { error: { code: error.code, message: error.message } };
      }
      if (code === 'VALIDATION') {
        set.status = 400;
        return { error: { code: 'VALIDATION', message: 'Petición inválida.' } };
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } };
      }
      console.error('[http]', error);
      set.status = 500;
      return { error: { code: 'INTERNAL', message: 'Error inesperado.' } };
    })
    .get('/api/health', () => ({ ok: true, now: Date.now() }))
    .use(boardRoutes(boards))
    .use(gameRoutes(games, auth))
    .use(authRoutes(auth))
    .use(billingRoutes(auth, billing))
    .use(leaderboardRoutes(leaderboard))
    .use(mediaRoutes())
    .use(wsGateway(games, chat));

  return config.production ? app : app.use(swagger({ path: '/docs', documentation: { info: { title: 'Capi API', version: '0.2.0' } } }));
}

export type CapiServer = ReturnType<typeof buildServer>;
