import { config } from '../config';
import {
  apply,
  type BoardDefinition,
  type Command,
  type CommandBody,
  createGame,
  type GameEvent,
  type GameMode,
  type GameRules,
  type GameState,
  isPremiumToken,
  matchesPreset,
  RULE_PRESETS,
  SYSTEM_PLAYER_ID,
  toPublicState,
} from 'capi-core';
import { forbidden, notFound, unauthorized } from '../http-error';
import type { GameRepository, StoredGame } from '../repositories/game-repository';
import type { UserRepository } from '../repositories/user-repository';
import type { AuthService } from './auth-service';
import type { BoardService } from './board-service';

export interface GameUpdate {
  game: GameState;
  events: GameEvent[];
}

export type GameListener = (update: GameUpdate) => void;

export interface PublicGameSummary {
  id: string;
  boardId: string;
  boardName: string;
  mode: GameMode;
  phase: GameState['phase'];
  hostName: string | null;
  players: number;
  maxPlayers: number;
  competitive: boolean;
  preset: string | null;
  boardAccent: string | null;
  updatedAt: number;
}

export interface Actor {
  playerId: string;
  userId: string | null;
}

const HISTORY_LIMIT = 150;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

const CLIENT_COMMANDS = new Set<CommandBody['type']>([
  'LEAVE',
  'SET_RULES',
  'SET_MODE',
  'SET_BOARD',
  'FORCE_PLAY',
  'START',
  'ROLL',
  'BUY',
  'DECLINE',
  'END_TURN',
  'PAY_JAIL_FINE',
  'USE_JAIL_CARD',
  'BUILD',
  'SELL_BUILDING',
  'MORTGAGE',
  'UNMORTGAGE',
  'BID',
  'PASS_AUCTION',
  'START_AUCTION',
  'BUY_OWNED',
  'BORROW',
  'REPAY',
  'PROPOSE_TRADE',
  'ACCEPT_TRADE',
  'DECLINE_TRADE',
  'CANCEL_TRADE',
  'BANKRUPT',
  'REMOVE_PLAYER',
  'TRANSFER_HOST',
  'SPAWN_PLAYER',
  'UPDATE_PLAYER',
]);

export class GameService {
  private readonly listeners = new Map<string, Set<GameListener>>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly emptySince = new Map<string, number>();
  private readonly occupied = new Set<string>();

  constructor(
    private readonly repo: GameRepository,
    private readonly boards: BoardService,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
  ) {}

  async create(boardId: string, mode: GameMode, rules?: Partial<GameRules>): Promise<GameState> {
    const board = this.boards.get(boardId);
    let id = randomCode(6);
    while (await this.repo.find(id)) id = randomCode(6);
    const state = createGame(board, { id, mode, rules, now: Date.now() });
    await this.repo.insert(state);
    return toPublicState(state);
  }

  async listPublic(): Promise<PublicGameSummary[]> {
    const states = await this.repo.findPublic();
    return states.map((state) => {
      const board = this.boards.get(state.boardId);
      return {
        id: state.id,
        boardId: state.boardId,
        boardName: board.name,
        mode: state.mode,
        phase: state.phase,
        hostName: state.players.find((p) => p.id === state.hostId)?.name ?? null,
        players: state.players.filter((p) => !p.spectator && !p.bankrupt).length,
        maxPlayers: state.rules.maxPlayers,
        competitive: state.rules.competitive,
        preset: state.rules.competitive ? 'Oficiales' : (RULE_PRESETS.find((preset) => matchesPreset(state.rules, preset))?.name ?? null),
        boardAccent: board.theme?.accent ?? null,
        updatedAt: state.updatedAt,
      };
    });
  }

  async get(id: string): Promise<{ game: GameState; board: BoardDefinition; history: GameEvent[] }> {
    const { state, history } = await this.load(id);
    return { game: toPublicState(state), board: this.boards.get(state.boardId), history };
  }

  async join(id: string, name: string, userId: string | null, color?: string, token?: string): Promise<{ playerId: string; secret: string; game: GameState }> {
    const { state } = await this.load(id);
    if (state.rules.competitive && !userId) throw forbidden('ACCOUNT_REQUIRED', 'Las partidas competitivas requieren una cuenta.');
    if (token) await this.assertTokenAllowed(state.boardId, token, userId);
    const playerId = `p-${randomCode(8).toLowerCase()}`;
    const secret = crypto.randomUUID();
    const update = await this.run(id, { playerId, userId }, { type: 'JOIN', name, color, token });
    await this.repo.insertSession({ gameId: id, playerId, secret, userId });
    return { playerId, secret, game: update.game };
  }

  async authenticate(gameId: string, secret: string | null | undefined): Promise<Actor> {
    if (!secret) throw unauthorized();
    const session = await this.repo.findSession(secret);
    if (!session || session.gameId !== gameId) throw unauthorized();
    return { playerId: session.playerId, userId: session.userId };
  }

  async execute(gameId: string, actor: Actor, body: CommandBody): Promise<GameUpdate> {
    if (!CLIENT_COMMANDS.has(body.type)) throw forbidden('INVALID_COMMAND', `unknown command ${String(body.type)}`);
    if (body.type === 'UPDATE_PLAYER' && body.token) {
      const { state } = await this.load(gameId);
      await this.assertTokenAllowed(state.boardId, body.token, actor.userId);
    }
    if (body.type === 'SET_BOARD') return this.run(gameId, actor, body, this.boards.get(body.boardId));
    return this.run(gameId, actor, body);
  }

  executeSystem(gameId: string, body: CommandBody): Promise<GameUpdate> {
    return this.run(gameId, { playerId: SYSTEM_PLAYER_ID, userId: null }, body);
  }

  subscribe(gameId: string, listener: GameListener): () => void {
    const set = this.listeners.get(gameId) ?? new Set<GameListener>();
    set.add(listener);
    this.listeners.set(gameId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(gameId);
    };
  }

  loadDisconnects(gameId: string): Promise<Record<string, number>> {
    return this.repo.loadDisconnects(gameId);
  }

  saveDisconnects(gameId: string, deadlines: Record<string, number>): Promise<void> {
    return this.repo.saveDisconnects(gameId, deadlines);
  }

  playingGames(): Promise<GameState[]> {
    return this.repo.findPlaying();
  }

  noteRoomActive(gameId: string): void {
    this.emptySince.delete(gameId);
    this.occupied.add(gameId);
  }

  noteRoomEmpty(gameId: string): void {
    this.occupied.delete(gameId);
    this.emptySince.set(gameId, Date.now());
  }

  async tick(): Promise<void> {
    const now = Date.now();
    for (const state of await this.repo.findPlaying()) {
      if (this.abandoned(state.id, now)) {
        await this.executeSystem(state.id, { type: 'FINISH', reason: 'abandoned' }).catch((e) => console.error('[abandon]', state.id, e));
        this.emptySince.delete(state.id);
        continue;
      }
      if (!needsTick(state, now)) continue;
      await this.executeSystem(state.id, { type: 'TICK' }).catch((e) => console.error('[tick]', state.id, e));
    }
  }

  private abandoned(gameId: string, now: number): boolean {
    if (this.occupied.has(gameId)) return false;
    const since = this.emptySince.get(gameId);
    if (since === undefined) {
      this.emptySince.set(gameId, now);
      return false;
    }
    return now - since >= config.abandonMs;
  }

  private run(gameId: string, actor: Actor, body: CommandBody, boardOverride?: BoardDefinition): Promise<GameUpdate> {
    return this.enqueue(gameId, async () => {
      const stored = await this.load(gameId);
      const board = boardOverride ?? this.boards.get(stored.state.boardId);
      const command = { ...body, playerId: actor.playerId, at: Date.now() } as Command;
      const result = apply(board, stored.state, command);
      await this.repo.save(result.state, [...stored.history, ...result.events].slice(-HISTORY_LIMIT));
      await this.settleIfFinished(stored, result.state, result.events);
      const update = { game: toPublicState(result.state), events: result.events };
      this.notify(gameId, update);
      return update;
    });
  }

  private async settleIfFinished(stored: StoredGame, state: GameState, events: GameEvent[]): Promise<void> {
    const over = events.find((e) => e.type === 'GAME_OVER');
    if (!over || over.type !== 'GAME_OVER' || stored.settledAt !== null) return;
    if (!state.rules.competitive || !state.rules.isPublic) return;
    const sessions = await this.repo.findSessionsByGame(state.id);
    const userOf = new Map(sessions.map((s) => [s.playerId, s.userId] as const));
    const results = over.standings
      .map((standing, index) => ({ gameId: state.id, userId: userOf.get(standing.playerId) ?? null, playerId: standing.playerId, cash: Math.max(0, standing.cash), rank: index + 1 }))
      .filter((r): r is typeof r & { userId: string } => r.userId !== null);
    await this.repo.settle(state.id, results);
    for (const result of results) await this.users.addResult(result.userId, result.cash, result.rank === 1);
  }

  private async assertTokenAllowed(boardId: string, token: string, userId: string | null): Promise<void> {
    if (!isPremiumToken(this.boards.get(boardId), token)) return;
    if (!(await this.auth.userIsPremium(userId))) throw forbidden('PREMIUM_REQUIRED', 'Esa ficha es exclusiva de la suscripción CEO.');
  }

  private async load(id: string): Promise<StoredGame> {
    const stored = await this.repo.find(id);
    if (!stored) throw notFound(`game ${id}`);
    return stored;
  }

  private notify(gameId: string, update: GameUpdate): void {
    for (const listener of this.listeners.get(gameId) ?? []) listener(update);
  }

  private enqueue<T>(gameId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(gameId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.queues.set(gameId, next);
    const cleanup = () => {
      if (this.queues.get(gameId) === next) this.queues.delete(gameId);
    };
    next.then(cleanup, cleanup);
    return next;
  }
}

function needsTick(state: GameState, now: number): boolean {
  if (state.endsAt !== null && now >= state.endsAt) return true;
  if (state.auctions.some((a) => a.endsAt !== null && now >= a.endsAt)) return true;
  const acting = state.players.filter((p) => !p.bankrupt && !p.spectator);
  if (acting.some((p) => p.turn.phase !== 'idle' && p.turn.deadline !== null && now >= p.turn.deadline)) return true;
  if (state.mode !== 'async') return false;
  return acting.some((p) => p.turn.phase === 'idle' && now >= p.cooldownUntil);
}
