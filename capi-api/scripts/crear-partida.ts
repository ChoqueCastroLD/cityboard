const base = (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws');
const boardId = process.env.BOARD ?? 'america';

async function json(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const created = await json('/api/games', { method: 'POST', body: JSON.stringify({ boardId, mode: 'classic', rules: { afkTimeoutMs: 0 } }) });
const id: string = created.game.id;

const players: { name: string; playerId: string; secret: string }[] = [];
for (const [name, color] of [
  ['Ana', '#ff5f6d'],
  ['Beto', '#2f80ed'],
  ['Caro', '#47e5bc'],
]) {
  const joined = await json(`/api/games/${id}/join`, { method: 'POST', body: JSON.stringify({ name, color }) });
  players.push({ name: name!, playerId: joined.playerId, secret: joined.secret });
}

const socket = new WebSocket(`${wsBase}/ws/games/${id}`);
await new Promise((resolve) => (socket.onopen = resolve));
socket.send(JSON.stringify({ type: 'auth', secret: players[0]!.secret }));
await new Promise((resolve) => setTimeout(resolve, 400));
socket.send(JSON.stringify({ type: 'command', command: { type: 'START' } }));
await new Promise((resolve) => setTimeout(resolve, 900));
socket.close();

const { game } = await json(`/api/games/${id}`);
const active = players.find((p) => p.playerId === game.activePlayerId) ?? players[0]!;
console.log(JSON.stringify({ id, phase: game.phase, active: { name: active.name, playerId: active.playerId, secret: active.secret }, players }));
process.exit(0);
