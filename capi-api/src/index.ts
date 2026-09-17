import { config } from './config';
import { createRepositories } from './db';
import { sweepLimits } from './rate-limit';
import { buildServer } from './server';
import { AuthService } from './services/auth-service';
import { BillingService } from './services/billing-service';
import { BoardService } from './services/board-service';
import { ChatService } from './services/chat-service';
import { GameService } from './services/game-service';
import { LeaderboardService } from './services/leaderboard-service';
import { createMailer } from './services/mailer';

const boards = await BoardService.load(config.boardsDir);
const repos = await createRepositories();
const mailer = createMailer();
const auth = new AuthService(repos.users, mailer);
const billing = new BillingService(repos.users);
const leaderboard = new LeaderboardService(repos.users);
const games = new GameService(repos.games, boards, repos.users, auth);
const chat = new ChatService(repos.games);
const app = buildServer({ boards, games, auth, billing, leaderboard, chat }).listen(config.port);

const ticker = setInterval(() => games.tick().catch((e) => console.error('[tick]', e)), config.tickMs);
const sweeper = setInterval(sweepLimits, 60_000);
const shutdown = () => {
  clearInterval(ticker);
  clearInterval(sweeper);
  void app.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const notes = [
  mailer.configured ? 'mail: resend' : 'mail: console (RESEND_API_KEY not set)',
  billing.configured ? 'billing: stripe' : 'billing: not configured',
];
console.log(`Capi API listening on http://localhost:${config.port} (${boards.list().length} boards, ${notes.join(', ')})`);
