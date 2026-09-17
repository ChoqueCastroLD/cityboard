import { type BoardDefinition, type CommandBody, type GameEvent, type GameMode, type GameRules, type GameState, normalizeGameState } from 'capi-core';
import { api, ApiError, wsUrl } from './api';
import { type ChatListener, type ChatMessage, type GameClient, Observable, type RtcListener } from './GameClient';

const SESSION_KEY = 'capi:session';

interface Session {
  gameId: string;
  playerId: string;
  secret: string;
}

type ServerMessage =
  | { type: 'state'; game: GameState; events: GameEvent[]; history?: GameEvent[] }
  | { type: 'error'; requestId?: string; error: { code: string; message: string } }
  | { type: 'presence'; playerIds: string[]; offline?: Record<string, number> }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'chat-history'; messages: ChatMessage[] }
  | { type: 'rtc'; from: string; payload: Record<string, unknown> }
  | { type: 'ack'; requestId: string }
  | { type: 'pong' };

interface Pending {
  resolve: () => void;
  reject: (e: Error) => void;
}

export class RemoteGameClient extends Observable implements GameClient {
  private state: GameState;
  private currentBoard: BoardDefinition;
  private presence: ReadonlySet<string> | null = null;
  private deadlines: ReadonlyMap<string, number> = new Map();
  private chat: ChatMessage[] = [];
  private readonly chatListeners = new Set<ChatListener>();
  private readonly rtcListeners = new Set<RtcListener>();
  private socket: WebSocket | null = null;
  private closed = false;
  private retryMs = 1000;
  private readonly pending = new Map<string, Pending>();
  private readonly pingTimer: number;

  private constructor(
    board: BoardDefinition,
    state: GameState,
    readonly gameId: string,
    readonly myPlayerId: string | null,
    private readonly secret: string | null,
    private history: GameEvent[],
  ) {
    super();
    this.currentBoard = board;
    this.state = normalizeGameState(state);
    this.connect();
    this.pingTimer = window.setInterval(() => this.send({ type: 'ping' }), 25_000);
  }

  static async create(boardId: string, mode: GameMode, name: string, token?: string, rules?: Partial<GameRules>) {
    const { game } = await api.createGame(boardId, mode, rules);
    return RemoteGameClient.join(game.id, name, token);
  }

  static async join(gameId: string, name: string, token?: string): Promise<RemoteGameClient> {
    const code = gameId.trim().toUpperCase();
    const joined = await api.join(code, name, token);
    const { board, history } = await api.game(code);
    saveSession({ gameId: code, playerId: joined.playerId, secret: joined.secret });
    return new RemoteGameClient(board, joined.game, code, joined.playerId, joined.secret, history ?? []);
  }

  static savedSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  static async resume(): Promise<RemoteGameClient | null> {
    const session = RemoteGameClient.savedSession();
    if (!session) return null;
    try {
      const { game, board, history } = await api.game(session.gameId);
      if (game.phase === 'finished') {
        RemoteGameClient.forget();
        return null;
      }
      return new RemoteGameClient(board, game, session.gameId, session.playerId, session.secret, history ?? []);
    } catch {
      RemoteGameClient.forget();
      return null;
    }
  }

  static forget(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
    }
  }

  get board(): BoardDefinition {
    return this.currentBoard;
  }

  getState(): GameState {
    return this.state;
  }

  getPresence(): ReadonlySet<string> | null {
    return this.presence;
  }

  getDisconnectDeadlines(): ReadonlyMap<string, number> {
    return this.deadlines;
  }

  getHistory(): GameEvent[] {
    return this.history;
  }

  getChat(): ChatMessage[] {
    return this.chat;
  }

  subscribeChat(listener: ChatListener): () => void {
    this.chatListeners.add(listener);
    return () => void this.chatListeners.delete(listener);
  }

  sendChat(text: string): Promise<void> {
    if (!this.secret) return Promise.reject(new Error('Solo los jugadores pueden escribir en el chat.'));
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Sin conexión. Reintentando…'));
    const requestId = crypto.randomUUID();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.send({ type: 'chat', requestId, text });
    });
  }

  sendRtc(to: string, payload: Record<string, unknown>): void {
    this.send({ type: 'rtc', to, payload });
  }

  subscribeRtc(listener: RtcListener): () => void {
    this.rtcListeners.add(listener);
    return () => void this.rtcListeners.delete(listener);
  }

  async dispatch(command: CommandBody): Promise<void> {
    if (!this.secret) throw new Error('Estás viendo la partida como espectador.');
    if (this.socket?.readyState === WebSocket.OPEN) {
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      return new Promise<void>((resolve, reject) => {
        this.pending.set(requestId, { resolve, reject });
        this.send({ type: 'command', requestId, command });
      });
    }
    const { game, events } = await api.command(this.gameId, this.secret, command);
    this.apply(game, events);
  }

  dispose(): void {
    this.closed = true;
    window.clearInterval(this.pingTimer);
    this.socket?.close();
  }

  private connect(): void {
    if (this.closed) return;
    const socket = new WebSocket(wsUrl(this.gameId, this.secret));
    this.socket = socket;
    socket.onopen = () => {
      this.retryMs = 1000;
    };
    socket.onmessage = (event) => this.receive(JSON.parse(String(event.data)) as ServerMessage);
    socket.onclose = () => {
      this.socket = null;
      this.failPending(new Error('Se perdió la conexión. Reintentando…'));
      if (this.closed) return;
      window.setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 15_000);
    };
  }

  private receive(message: ServerMessage): void {
    if (message.type === 'state') {
      if (message.history) this.history = message.history;
      this.apply(message.game, message.events);

      for (const p of this.pending.values()) p.resolve();
      this.pending.clear();
    } else if (message.type === 'presence') {
      this.presence = new Set(message.playerIds);
      this.deadlines = new Map(Object.entries(message.offline ?? {}));
      this.notify(this.state, []);
    } else if (message.type === 'chat') {
      this.chat = [...this.chat, message.message].slice(-200);
      for (const listener of this.chatListeners) listener(this.chat, message.message);
    } else if (message.type === 'chat-history') {
      this.chat = message.messages;
      for (const listener of this.chatListeners) listener(this.chat, null);
    } else if (message.type === 'rtc') {
      for (const listener of this.rtcListeners) listener({ from: message.from, payload: message.payload });
    } else if (message.type === 'ack') {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        this.pending.delete(message.requestId);
        pending.resolve();
      }
    } else if (message.type === 'error') {
      const pending = message.requestId ? this.pending.get(message.requestId) : undefined;
      if (pending && message.requestId) {
        this.pending.delete(message.requestId);
        pending.reject(new ApiError(message.error.code, message.error.message, 400));
      }
    }
  }

  private apply(game: GameState, events: GameEvent[]): void {
    this.state = normalizeGameState(game);
    if (game.phase === 'finished') RemoteGameClient.forget();
    if (game.boardId !== this.currentBoard.id) {
      void this.refreshBoard(events);
      return;
    }
    this.notify(this.state, events);
  }

  private async refreshBoard(events: GameEvent[]): Promise<void> {
    try {
      const { board } = await api.game(this.gameId);
      if (board.id === this.state.boardId) this.currentBoard = board;
    } catch {
    }
    this.notify(this.state, events);
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  private failPending(error: Error): void {
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
  }
}
