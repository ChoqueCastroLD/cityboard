const base = (process.env.SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws');

let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
}

async function json(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const inbox = new WeakMap<WebSocket, any[]>();

function open(gameId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase}/ws/games/${gameId}`);
    const received: any[] = [];
    inbox.set(socket, received);
    socket.addEventListener('message', (event) => received.push(JSON.parse(String(event.data))));
    socket.onopen = () => resolve(socket);
    socket.onerror = () => reject(new Error('websocket failed to open'));
  });
}

function waitFor(socket: WebSocket, predicate: (message: any) => boolean, timeoutMs = 5000): Promise<any> {
  const received = inbox.get(socket) ?? [];
  const seen = received.find((m) => predicate(m));
  if (seen) return Promise.resolve(seen);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for message (visto: ${received.map((m) => m.type).join(', ')})`)), timeoutMs);
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data));
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.removeEventListener('message', onMessage);
      resolve(message);
    };
    socket.addEventListener('message', onMessage);
  });
}

console.log(`smoke → ${base}`);

const health = await json('/api/health');
check('health responde', health.ok === true, health);

const boards = await json('/api/boards');
check('hay tableros', Array.isArray(boards.boards) && boards.boards.length > 0, boards);

const boardId = boards.boards[0].id;
const created = await json('/api/games', { method: 'POST', body: JSON.stringify({ boardId, mode: 'classic' }) });
const gameId = created.game.id;
check('crea sala', typeof gameId === 'string' && gameId.length > 0, created);

const host = await json(`/api/games/${gameId}/join`, { method: 'POST', body: JSON.stringify({ name: 'Humo A', color: '#ff5f6d' }) });
const guest = await json(`/api/games/${gameId}/join`, { method: 'POST', body: JSON.stringify({ name: 'Humo B', color: '#2f80ed' }) });
check('se unen dos jugadores', Boolean(host.secret && guest.secret), { host: host.playerId, guest: guest.playerId });

const listed = await json('/api/games');
check('lista pública no falla', Array.isArray(listed.games), listed);

const socket = await open(gameId);

const earlyAuth = waitFor(socket, (m) => m.type === 'ack' && m.requestId === 'auth-0');
socket.send(JSON.stringify({ type: 'auth', requestId: 'auth-0', secret: guest.secret }));
const early = await earlyAuth;
check('auth inmediato tras open (sin esperar state)', early.type === 'ack', early);

await waitFor(socket, (m) => m.type === 'state');

const spectator = await open(gameId);
const spectatorError = waitFor(spectator, (m) => m.type === 'error');
spectator.send(JSON.stringify({ type: 'chat', requestId: 'pre-auth', text: 'sin auth' }));
const rejected = await spectatorError;
check('rechaza chat sin auth', rejected.error?.code === 'UNAUTHORIZED', rejected);
spectator.close();

socket.send(JSON.stringify({ type: 'auth', requestId: 'auth-1', secret: host.secret }));
const acked = await waitFor(socket, (m) => m.type === 'ack' && m.requestId === 'auth-1');
check('auth por mensaje', acked.type === 'ack', acked);

const presence = await waitFor(socket, (m) => m.type === 'presence' && m.playerIds.includes(host.playerId));
check('presencia incluye al jugador', presence.playerIds.includes(host.playerId), presence);

socket.send(JSON.stringify({ type: 'chat', requestId: 'chat-1', text: 'hola desde el humo' }));
const chatMessage = await waitFor(socket, (m) => m.type === 'chat');
check('chat se difunde', chatMessage.message?.text === 'hola desde el humo', chatMessage);

socket.send(JSON.stringify({ type: 'command', requestId: 'start-1', command: { type: 'START' } }));
const started = await waitFor(socket, (m) => m.type === 'state' && m.game?.phase === 'playing', 8000);
check('arranca la partida', started.game.phase === 'playing', started.game?.phase);

const activeId = started.game.activePlayerId;
check('hay jugador activo', typeof activeId === 'string', activeId);

const activeSecret = activeId === host.playerId ? host.secret : guest.secret;
const activeSocket = await open(gameId);
const activeAuth = waitFor(activeSocket, (m) => m.type === 'ack' && m.requestId === 'auth-2');
activeSocket.send(JSON.stringify({ type: 'auth', requestId: 'auth-2', secret: activeSecret }));
await activeAuth;

activeSocket.send(JSON.stringify({ type: 'command', requestId: 'roll-1', command: { type: 'ROLL' } }));
const rolled = await waitFor(activeSocket, (m) => m.type === 'state' && m.events?.some((e: any) => e.type === 'ROLLED'), 8000);
check('tira los dados el jugador activo', rolled.events.some((e: any) => e.type === 'ROLLED'), rolled.events?.map((e: any) => e.type));
activeSocket.close();

const ping = new Promise((resolve) => {
  socket.addEventListener('message', function onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.type !== 'pong') return;
    socket.removeEventListener('message', onMessage);
    resolve(message);
  });
});
socket.send(JSON.stringify({ type: 'ping' }));
await ping;
check('ping/pong', true);

socket.close();

console.log(failures === 0 ? '\nsmoke OK' : `\nsmoke con ${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
