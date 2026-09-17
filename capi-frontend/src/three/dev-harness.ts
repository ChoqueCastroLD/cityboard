import { apply, type BoardDefinition, type Command, type CommandInput, createGame, type GameState, PLAYER_COLORS, TOKEN_CATALOG, type Player } from 'capi-core';
import boardJson from 'capi-core/boards/capi-city.json';
import { createBoardScene } from './index';

const board = boardJson as unknown as BoardDefinition;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const status = document.getElementById('status')!;
document.body.style.background = board.theme?.background ?? '#0f1024';
const gallery = new URLSearchParams(location.search).has('gallery');

let state: GameState = createGame(board, { id: 'dev', mode: 'async', seed: 42, rules: { asyncCooldownMs: 6000 }, now: Date.now() });
const run = (cmd: CommandInput) => {
  const result = apply(board, state, { ...cmd, at: Date.now() } as Command);
  state = result.state;
  return result;
};
run({ type: 'JOIN', playerId: 'a', name: 'Ana', token: 'capibara' });
run({ type: 'JOIN', playerId: 'b', name: 'Beto', token: 'tucan' });
run({ type: 'JOIN', playerId: 'c', name: 'Carla', token: 'barco' });
run({ type: 'START', playerId: 'a' });

if (gallery) {
  const template = state.players[0]!;
  const players: Player[] = TOKEN_CATALOG.map((token, i) => ({
    ...structuredClone(template),
    id: `g${i}`,
    name: token.label,
    token: token.id,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
    position: (i + 1) % board.tiles.length,
    turn: { ...template.turn, phase: 'idle', deadline: null },
    cooldownUntil: 0,
  }));
  state = { ...state, phase: 'lobby', players, order: players.map((p) => p.id), activePlayerId: null };
} else {
  state = {
    ...state,
    properties: {
      jacaranda: { ownerId: 'a', buildings: 2, mortgaged: false },
      ceibo: { ownerId: 'a', buildings: 2, mortgaged: false },
      lapacho: { ownerId: 'a', buildings: 5, mortgaged: false },
      'estacion-norte': { ownerId: 'b', buildings: 0, mortgaged: false },
      sauce: { ownerId: 'c', buildings: 0, mortgaged: true },
    },
  };
}

const scene = createBoardScene(canvas, {
  board,
  callbacks: {
    onTileClick: (id) => {
      status.textContent = `tile ${id}`;
      scene.focusTile(id);
      setTimeout(() => scene.focusTile(null), 1500);
    },
    onTokenClick: (id) => (status.textContent = `token ${id}`),
    onTokenHover: (id, at) => (status.textContent = id ? `hover ${id} @ ${at?.x.toFixed(0)},${at?.y.toFixed(0)}` : status.textContent),
    onCardDrawn: (event, resume) => {
      status.textContent = `card ${event.playerId}: ${event.text}`;
      setTimeout(resume, 1500);
    },
  },
});
if (!gallery) scene.setControlledPlayer('a');
scene.setState(state, Date.now());
const { backend } = await scene.ready;
status.textContent = `backend: ${backend}${gallery ? ' · gallery' : ''}`;
Object.assign(window, { __backend: backend, __scene: scene, __state: () => state });

setInterval(() => scene.setState(state, Date.now()), 250);

async function step(): Promise<void> {
  const now = Date.now();
  for (const player of state.players) {
    const acts = player.turn.phase !== 'idle' || now >= player.cooldownUntil;
    if (!acts || player.turn.phase === 'act') continue;
    const rolled = run({ type: 'ROLL', playerId: player.id });
    scene.play(rolled.events);
    scene.setState(state, Date.now());
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const me = state.players.find((p) => p.id === player.id)!;
    if (me.turn.pendingPurchase) run({ type: me.cash > 400 ? 'BUY' : 'DECLINE', playerId: player.id });
    for (const auction of state.auctions) run({ type: 'PASS_AUCTION', playerId: player.id, auctionId: auction.id });
    if (state.players.find((p) => p.id === player.id)!.cash < 0) continue;
    try {
      run({ type: 'END_TURN', playerId: player.id });
    } catch {
    }
    scene.setState(state, Date.now());
    return;
  }
}
if (!gallery) {
  setInterval(() => void step().catch((e) => (status.textContent = String(e))), 3000);
  setTimeout(() => scene.focusPlayer('b'), 9000);
  setTimeout(() => scene.focusPlayer(null), 12000);
}
