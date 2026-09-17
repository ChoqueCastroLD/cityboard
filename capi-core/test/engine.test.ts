import { describe, expect, it } from 'vitest';
import city from '../boards/capi-city.json';
import harbor from '../boards/mini-harbor.json';
import {
  apply,
  type BoardDefinition,
  type Command,
  type CommandInput,
  computeRingLayout,
  computeRent,
  createGame,
  Ctx,
  GameError,
  type GameRules,
  type GameState,
  getAvailableActions,
  type OwnableTile,
  validateBoard,
} from '../src';

const board = city as unknown as BoardDefinition;
let clock = 1_000_000;
const at = () => (clock += 1000);

function run(state: GameState, cmd: CommandInput) {
  return apply(board, state, { at: at(), ...cmd } as Command);
}

function lobby(mode: 'classic' | 'async' = 'classic', seed = 7, rules?: Partial<GameRules>) {
  let s = createGame(board, { id: 'g1', mode, seed, now: at() });
  s = run(s, { type: 'JOIN', playerId: 'a', name: 'Ana' }).state;
  s = run(s, { type: 'JOIN', playerId: 'b', name: 'Beto' }).state;
  if (rules) s = run(s, { type: 'SET_RULES', playerId: 'a', rules }).state;
  return s;
}

function started(mode: 'classic' | 'async' = 'classic', seed = 7, rules?: Partial<GameRules>) {
  return run(lobby(mode, seed, rules), { type: 'START', playerId: 'a' }).state;
}

const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

function startedCompetitive(seed = 7, rules?: Partial<GameRules>) {
  let s = lobby('classic', seed, { ...rules, competitive: true });
  for (const id of ['c', 'd']) s = run(s, { type: 'JOIN', playerId: id, name: id }).state;
  return run(s, { type: 'START', playerId: 'a' }).state;
}

function rollExactly(s: GameState, id: string, total: number, from: number) {
  for (let seed = 1; seed < 500; seed++) {
    const g = { ...s, rng: seed, players: s.players.map((p) => (p.id === id ? { ...p, position: from } : p)) };
    const r = run(g, { type: 'ROLL', playerId: id });
    const dice = (r.events.find((e) => e.type === 'ROLLED') as { dice: [number, number] }).dice;
    if (dice[0] + dice[1] === total) return r;
  }
  throw new Error(`no seed rolled ${total}`);
}

describe('boards', () => {
  it('sample boards are valid', () => {
    expect(validateBoard(board)).toEqual([]);
    expect(validateBoard(harbor as unknown as BoardDefinition)).toEqual([]);
  });

  it('computes a ring layout for any even size', () => {
    const l40 = computeRingLayout(40);
    expect(l40.columns).toBe(11);
    expect(l40.rows).toBe(11);
    expect(l40.cells).toHaveLength(40);
    const l24 = computeRingLayout(24);
    expect(l24.columns).toBe(7);
    expect(l24.rows).toBe(7);
    expect(computeRingLayout(10).cells).toHaveLength(10);
    expect(() => computeRingLayout(9)).toThrow();
  });
});

describe('lobby and host', () => {
  it('first player becomes host and only host can start', () => {
    const s = lobby();
    expect(s.hostId).toBe('a');
    expect(() => run(s, { type: 'START', playerId: 'b' })).toThrow(GameError);
    const started = run(s, { type: 'START', playerId: 'a' });
    expect(started.state.phase).toBe('playing');
    expect(started.state.activePlayerId).not.toBeNull();
  });

  it('rules can be changed in the lobby only', () => {
    let s = lobby();
    s = run(s, { type: 'SET_RULES', playerId: 'a', rules: { noRentInJail: true, loansEnabled: true } }).state;
    expect(s.rules.noRentInJail).toBe(true);
    expect(() => run(s, { type: 'SET_RULES', playerId: 'b', rules: { jailFine: 1 } })).toThrow(/host/);
    expect(() => run(s, { type: 'SET_RULES', playerId: 'a', rules: { jailFine: 'x' as unknown as number } })).toThrow();
    s = run(s, { type: 'START', playerId: 'a' }).state;
    expect(() => run(s, { type: 'SET_RULES', playerId: 'a', rules: { jailFine: 1 } })).toThrow(/locked/);
  });

  it('host can hand over hosting, and only to an active player', () => {
    let s = started();
    expect(() => run(s, { type: 'TRANSFER_HOST', playerId: 'b', toId: 'b' })).toThrow(/host/);
    const r = run(s, { type: 'TRANSFER_HOST', playerId: 'a', toId: 'b' });
    s = r.state;
    expect(s.hostId).toBe('b');
    expect(r.events.some((e) => e.type === 'HOST_CHANGED' && e.playerId === 'b')).toBe(true);
    expect(() => run(s, { type: 'SET_RULES', playerId: 'a', rules: {} })).toThrow(/host/);
  });

  it('host can remove a missing player, who forfeits everything', () => {
    let s = started();
    s = { ...s, properties: { condor: { ownerId: 'b', buildings: 0, mortgaged: false } } };
    expect(() => run(s, { type: 'REMOVE_PLAYER', playerId: 'b', targetId: 'a' })).toThrow(/host/);
    expect(() => run(s, { type: 'REMOVE_PLAYER', playerId: 'a', targetId: 'a' })).toThrow(/LEAVE/);
    const r = run(s, { type: 'REMOVE_PLAYER', playerId: 'a', targetId: 'b' });
    expect(player(r.state, 'b').bankrupt).toBe(true);
    expect(r.state.properties['condor']).toBeUndefined();
    expect(r.events.some((e) => e.type === 'PLAYER_REMOVED')).toBe(true);
    expect(r.state.phase).toBe('finished');
    expect(r.state.winnerId).toBe('a');
  });

  it('hosting passes to the next active player when the host leaves', () => {
    let s = lobby();
    s = run(s, { type: 'JOIN', playerId: 'c', name: 'Carla' }).state;
    s = run(s, { type: 'START', playerId: 'a' }).state;
    const r = run(s, { type: 'LEAVE', playerId: 'a' });
    expect(r.state.hostId).not.toBe('a');
    expect(player(r.state, r.state.hostId!).bankrupt).toBe(false);
    expect(r.events.some((e) => e.type === 'HOST_CHANGED')).toBe(true);
  });
});

describe('spectators and appearance', () => {
  it('joining mid-game makes a spectator the host can seat or kick', () => {
    let s = started();
    const joined = run(s, { type: 'JOIN', playerId: 'c', name: 'Carla' });
    s = joined.state;
    expect(player(s, 'c').spectator).toBe(true);
    expect(player(s, 'c').cash).toBe(0);
    expect(s.order).not.toContain('c');
    expect(getAvailableActions(board, s, 'c', at()).canRoll).toBe(false);
    expect(() => run(s, { type: 'ROLL', playerId: 'c' })).toThrow();
    expect(() => run(s, { type: 'SPAWN_PLAYER', playerId: 'b', targetId: 'c' })).toThrow(/host/);

    const kicked = run(s, { type: 'REMOVE_PLAYER', playerId: 'a', targetId: 'c' });
    expect(kicked.state.players.some((p) => p.id === 'c')).toBe(false);
    expect(kicked.state.phase).toBe('playing');

    const spawned = run(s, { type: 'SPAWN_PLAYER', playerId: 'a', targetId: 'c' }).state;
    expect(player(spawned, 'c').spectator).toBe(false);
    expect(player(spawned, 'c').cash).toBe(1500);
    expect(spawned.order).toContain('c');
  });

  it('colors and pieces are unique and can be changed', () => {
    let s = lobby();
    expect(player(s, 'a').color).not.toBe(player(s, 'b').color);
    expect(player(s, 'a').token).not.toBe(player(s, 'b').token);
    expect(() => run(s, { type: 'UPDATE_PLAYER', playerId: 'b', color: player(s, 'a').color })).toThrow(/taken/);
    expect(() => run(s, { type: 'UPDATE_PLAYER', playerId: 'b', token: player(s, 'a').token })).toThrow(/taken/);
    expect(() => run(s, { type: 'JOIN', playerId: 'c', name: 'Carla', color: player(s, 'a').color })).toThrow(/taken/);
    s = run(s, { type: 'UPDATE_PLAYER', playerId: 'b', name: 'Bea', color: '#123456', token: 'mate' }).state;
    expect(player(s, 'b')).toMatchObject({ name: 'Bea', color: '#123456', token: 'mate' });
    s = run(s, { type: 'SET_RULES', playerId: 'a', rules: { startingCash: 2000 } }).state;
    s = run(s, { type: 'START', playerId: 'a' }).state;
    expect(player(s, 'b')).toMatchObject({ name: 'Bea', color: '#123456', token: 'mate' });
    const rolled = run(s, { type: 'ROLL', playerId: s.activePlayerId! }).state;
    expect(player(rolled, 'b').color).toBe('#123456');
  });
});

describe('afk autoplay', () => {
  it('plays for an absent player step by step once the timeout passes', () => {
    let s = started('classic', 7, { afkTimeoutMs: 30_000, auctionOnDecline: false });
    const id = s.activePlayerId!;
    expect(player(s, id).turn.deadline).not.toBeNull();

    const tooEarly = apply(board, s, { type: 'TICK', playerId: 'a', at: player(s, id).turn.deadline! - 1 });
    expect(tooEarly.events.some((e) => e.type === 'AUTO_PLAYED')).toBe(false);

    const rolled = apply(board, s, { type: 'TICK', playerId: 'a', at: player(s, id).turn.deadline! });
    expect(rolled.events.some((e) => e.type === 'AUTO_PLAYED' && e.action === 'roll')).toBe(true);
    s = rolled.state;
    const p = player(s, id);
    expect(p.turn.phase).toBe('act');
    expect(p.turn.deadline).toBe(rolled.state.updatedAt + 30_000);

    const decided = apply(board, s, { type: 'TICK', playerId: 'a', at: p.turn.deadline! });
    const actions = decided.events.filter((e) => e.type === 'AUTO_PLAYED').map((e) => (e as { action: string }).action);
    expect(actions.length).toBe(1);
    expect(['buy', 'decline', 'end-turn']).toContain(actions[0]);
  });

  it('is off when the timeout is zero', () => {
    const s = started('classic', 7, { afkTimeoutMs: 0 });
    expect(player(s, s.activePlayerId!).turn.deadline).toBeNull();
  });
});

describe('competitive mode', () => {
  it('locks the strict rule set, forbids mid-game joins and ends after the time limit', () => {
    let s = lobby('classic', 7, { competitive: true, loansEnabled: true, buyOwnedProperties: true });
    expect(s.rules.loansEnabled).toBe(false);
    expect(s.rules.buyOwnedProperties).toBe(false);
    expect(s.rules.isPublic).toBe(true);
    expect(s.rules.afkTimeoutMs).toBe(120_000);
    for (const id of ['c', 'd']) s = run(s, { type: 'JOIN', playerId: id, name: id }).state;
    s = run(s, { type: 'START', playerId: 'a' }).state;
    expect(s.endsAt).toBe(s.updatedAt + 2 * 60 * 60 * 1000);
    expect(() => run(s, { type: 'JOIN', playerId: 'e', name: 'Elena' })).toThrow(/competitive/);

    const richer = {
      ...s,
      players: s.players.map((p) => ({ ...p, cash: p.id === 'b' ? 2000 : p.cash, turn: { ...p.turn, deadline: s.endsAt! + 1 } })),
    };
    const over = apply(board, richer, { type: 'TICK', playerId: 'a', at: s.endsAt! });
    expect(over.state.phase).toBe('finished');
    expect(over.state.winnerId).toBe('b');
    const ended = over.events.find((e) => e.type === 'GAME_OVER') as { reason: string; standings: Array<{ playerId: string; cash: number }> };
    expect(ended.reason).toBe('time');
    expect(ended.standings[0]).toEqual({ playerId: 'b', cash: 2000 });
  });

  it('forfeits absent or disconnected players instead of playing for them', () => {
    let s = startedCompetitive(7);
    const id = s.activePlayerId!;
    const afk = apply(board, s, { type: 'TICK', playerId: 'a', at: player(s, id).turn.deadline! });
    expect(player(afk.state, id).bankrupt).toBe(true);
    expect(afk.events.some((e) => e.type === 'FORFEITED' && e.reason === 'afk')).toBe(true);

    s = startedCompetitive(8);
    expect(() => run(s, { type: 'FORFEIT', playerId: 'a', targetId: 'b', reason: 'disconnected' })).toThrow(/system/);
    const gone = run(s, { type: 'FORFEIT', playerId: 'system', targetId: 'b', reason: 'disconnected' });
    expect(player(gone.state, 'b').bankrupt).toBe(true);
    expect(gone.state.phase).toBe('playing');
  });

  it('settles debts immediately with a bankruptcy', () => {
    const s = startedCompetitive(7);
    const [x, y] = s.order as [string, string];
    const indebted = { ...s, players: s.players.map((p) => (p.id === x ? { ...p, cash: -50, creditorId: y } : p)) };
    const after = apply(board, indebted, { type: 'TICK', playerId: 'a', at: s.updatedAt + 1 });
    expect(player(after.state, x).bankrupt).toBe(true);
    expect(after.state.phase).toBe('playing');
  });
});

describe('time limits and abandonment', () => {
  it('every game ends after four hours at most, richest player wins', () => {
    const s = started();
    expect(s.rules.maxDurationMs).toBe(4 * 60 * 60 * 1000);
    expect(s.endsAt).toBe(s.updatedAt + 4 * 60 * 60 * 1000);
    const capped = lobby('classic', 7, { maxDurationMs: 99 * 60 * 60 * 1000 });
    expect(capped.rules.maxDurationMs).toBe(4 * 60 * 60 * 1000);
    const disabled = lobby('classic', 7, { maxDurationMs: 0 });
    expect(disabled.rules.maxDurationMs).toBe(4 * 60 * 60 * 1000);
  });

  it('the system can end an abandoned game', () => {
    const s = started();
    expect(() => run(s, { type: 'FINISH', playerId: 'a', reason: 'abandoned' })).toThrow(/system/);
    const over = run(s, { type: 'FINISH', playerId: 'system', reason: 'abandoned' });
    expect(over.state.phase).toBe('finished');
    expect((over.events.find((e) => e.type === 'GAME_OVER') as { reason: string }).reason).toBe('abandoned');
  });

  it('competitive needs 4 to 6 players and locks every other rule', () => {
    let s = lobby('classic', 7, { competitive: true, startingCash: 5 });
    expect(s.rules.startingCash).toBe(1500);
    expect(s.rules.maxPlayers).toBe(6);
    expect(() => run(s, { type: 'SET_RULES', playerId: 'a', rules: { jailFine: 10 } })).toThrow(/fixed/);
    expect(() => run(s, { type: 'START', playerId: 'a' })).toThrow(/at least 4/);
    for (const id of ['c', 'd']) s = run(s, { type: 'JOIN', playerId: id, name: id }).state;
    s = run(s, { type: 'START', playerId: 'a' }).state;
    expect(s.phase).toBe('playing');
  });
});

describe('lobby board and mode', () => {
  it('host can switch mode and board before starting', () => {
    let s = lobby();
    expect(() => run(s, { type: 'SET_MODE', playerId: 'b', mode: 'async' })).toThrow(/host/);
    s = run(s, { type: 'SET_MODE', playerId: 'a', mode: 'async' }).state;
    expect(s.mode).toBe('async');
    const harborBoard = harbor as unknown as BoardDefinition;
    expect(() => apply(board, s, { type: 'SET_BOARD', playerId: 'a', boardId: 'mini-harbor', at: at() })).toThrow(/does not match/);
    const switched = apply(harborBoard, s, { type: 'SET_BOARD', playerId: 'a', boardId: 'mini-harbor', at: at() });
    expect(switched.state.boardId).toBe('mini-harbor');
    expect(switched.state.rules.startingCash).toBe(1000);
    expect(switched.events.some((e) => e.type === 'BOARD_CHANGED')).toBe(true);
    const started = apply(harborBoard, switched.state, { type: 'START', playerId: 'a', at: at() }).state;
    expect(started.phase).toBe('playing');
    expect(() => apply(harborBoard, started, { type: 'SET_MODE', playerId: 'a', mode: 'classic', at: at() })).toThrow(/locked/);
  });
});

describe('classic turn flow', () => {
  it('is deterministic for a given seed', () => {
    const a = run(started(), { type: 'ROLL', playerId: started().activePlayerId! });
    const b = run(started(), { type: 'ROLL', playerId: started().activePlayerId! });
    const timeless = (s: GameState) => s.players.map((p) => ({ ...p, turn: { ...p.turn, deadline: null } }));
    expect(timeless(a.state)).toEqual(timeless(b.state));
  });

  it('rolls, moves, offers a purchase and passes the turn', () => {
    let s = started();
    const first = s.activePlayerId!;
    const other = s.players.find((p) => p.id !== first)!.id;
    expect(() => run(s, { type: 'ROLL', playerId: other })).toThrow(/not your turn/);

    const rolled = run(s, { type: 'ROLL', playerId: first });
    s = rolled.state;
    expect(rolled.events.some((e) => e.type === 'ROLLED')).toBe(true);
    expect(player(s, first).position).toBeGreaterThan(0);
    expect(player(s, first).turn.phase).toBe('act');

    const actions = getAvailableActions(board, s, first, at());
    if (actions.canBuy) {
      const tileId = actions.pendingPurchase!;
      s = run(s, { type: 'BUY', playerId: first }).state;
      expect(s.properties[tileId]?.ownerId).toBe(first);
    }
    s = run(s, { type: 'END_TURN', playerId: first }).state;
    if (player(s, first).turn.doubles === 0) expect(s.activePlayerId).toBe(other);
  });

  it('declining sends the tile to auction and blocks the turn until settled', () => {
    let s = started();
    for (let seed = 1; seed < 200; seed++) {
      s = started('classic', seed);
      const id = s.activePlayerId!;
      s = run(s, { type: 'ROLL', playerId: id }).state;
      if (player(s, id).turn.pendingPurchase) break;
    }
    const id = s.activePlayerId!;
    const other = s.players.find((p) => p.id !== id)!.id;
    const tileId = player(s, id).turn.pendingPurchase!;
    s = run(s, { type: 'DECLINE', playerId: id }).state;
    expect(s.auctions).toHaveLength(1);
    expect(() => run(s, { type: 'END_TURN', playerId: id })).toThrow(/auction/);

    const auctionId = s.auctions[0]!.id;
    s = run(s, { type: 'BID', playerId: other, auctionId, amount: 30 }).state;
    s = run(s, { type: 'PASS_AUCTION', playerId: id, auctionId }).state;
    expect(s.auctions).toHaveLength(0);
    expect(s.properties[tileId]?.ownerId).toBe(other);
    expect(player(s, other).cash).toBe(1500 - 30);
    s = run(s, { type: 'END_TURN', playerId: id }).state;
    expect(s.activePlayerId).toBe(other);
  });
});

describe('doubles', () => {
  it('grants one bonus roll and then passes the turn when the bonus roll is not doubles', () => {
    for (let seed = 1; seed < 400; seed++) {
      let s = started('classic', seed, { afkTimeoutMs: 0, auctionOnDecline: false });
      const id = s.activePlayerId!;
      const first = run(s, { type: 'ROLL', playerId: id });
      const dice = (first.events.find((e) => e.type === 'ROLLED') as { dice: [number, number] }).dice;
      if (dice[0] !== dice[1] || player(first.state, id).inJail) continue;
      s = first.state;
      if (player(s, id).turn.pendingPurchase) s = run(s, { type: 'DECLINE', playerId: id }).state;
      for (const a of s.auctions) s = run(s, { type: 'PASS_AUCTION', playerId: s.players.find((p) => p.id !== id)!.id, auctionId: a.id }).state;
      s = run(s, { type: 'END_TURN', playerId: id }).state;
      expect(s.activePlayerId).toBe(id);
      expect(player(s, id).turn.phase).toBe('roll');
      for (let again = 1; again < 400; again++) {
        const second = run({ ...s, rng: again }, { type: 'ROLL', playerId: id });
        const d2 = (second.events.find((e) => e.type === 'ROLLED') as { dice: [number, number] }).dice;
        if (d2[0] === d2[1] || player(second.state, id).inJail) continue;
        let t = second.state;
        if (player(t, id).turn.pendingPurchase) t = run(t, { type: 'DECLINE', playerId: id }).state;
        for (const a of t.auctions) t = run(t, { type: 'PASS_AUCTION', playerId: t.players.find((p) => p.id !== id)!.id, auctionId: a.id }).state;
        if (player(t, id).cash < 0) continue;
        t = run(t, { type: 'END_TURN', playerId: id }).state;
        expect(t.activePlayerId).not.toBe(id);
        return;
      }
    }
    throw new Error('no seed produced doubles followed by a plain roll');
  });
});

describe('async mode', () => {
  it('lets every player act at once and enforces the hourglass', () => {
    let s = started('async');
    expect(s.players.every((p) => p.turn.phase === 'roll')).toBe(true);
    s = run(s, { type: 'ROLL', playerId: 'a' }).state;
    s = run(s, { type: 'ROLL', playerId: 'b' }).state;

    for (const id of ['a', 'b']) {
      if (player(s, id).turn.pendingPurchase) s = run(s, { type: 'DECLINE', playerId: id }).state;
    }
    if (player(s, 'a').turn.doubles > 0) return;
    const ended = run(s, { type: 'END_TURN', playerId: 'a' });
    s = ended.state;
    expect(ended.events.some((e) => e.type === 'COOLDOWN_STARTED')).toBe(true);
    expect(player(s, 'a').turn.phase).toBe('idle');
    expect(() => run(s, { type: 'ROLL', playerId: 'a' })).toThrow(/hourglass/);

    const later = clock + s.rules.asyncCooldownMs + 1;
    const again = apply(board, s, { type: 'ROLL', playerId: 'a', at: later });
    expect(again.events.some((e) => e.type === 'TURN_STARTED' && e.playerId === 'a')).toBe(true);
  });
});

describe('start tile', () => {
  it('pays the pass bonus when passing and the land bonus in total when landing on it', () => {
    const s = started('classic', 7, { passStartBonus: 300, landStartBonus: 600 });
    const id = s.activePlayerId!;
    const r = rollExactly(s, id, 7, board.tiles.length - 7);
    expect(player(r.state, id).position).toBe(0);
    expect(player(r.state, id).cash).toBe(1500 + 600);
  });
});

describe('economy', () => {
  it('hotel upgrades add up to four floors once every group has hotels', () => {
    const off = started('classic', 7);
    const id = off.order[0]!;
    const hotels = { 'callejon-faro': { ownerId: id, buildings: 5, mortgaged: false }, 'plaza-molino': { ownerId: id, buildings: 5, mortgaged: false } };
    const locked = { ...off, properties: hotels, players: off.players.map((p) => (p.id === id ? { ...p, cash: 5000 } : p)) };
    expect(() => run(locked, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' })).toThrow(/fully built/);

    let s = started('classic', 7, { hotelUpgrades: true });
    s = { ...s, properties: hotels, players: s.players.map((p) => (p.id === id ? { ...p, cash: 5000 } : p)) };
    const beforeRent = computeRent(new Ctx(board, s, at()), board.tiles.find((t) => t.id === 'callejon-faro') as OwnableTile, id, 0);
    for (let floor = 1; floor <= 4; floor++) {
      s = run(s, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' }).state;
      s = run(s, { type: 'BUILD', playerId: id, tileId: 'plaza-molino' }).state;
      expect(s.properties['callejon-faro']?.buildings).toBe(5 + floor);
    }
    expect(() => run(s, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' })).toThrow(/fully built/);
    const afterRent = computeRent(new Ctx(board, s, at()), board.tiles.find((t) => t.id === 'callejon-faro') as OwnableTile, id, 0);
    expect(afterRent).toBe(Math.round(beforeRent * 2.4));

    const partial = { ...s, properties: { ...hotels, jacaranda: { ownerId: id, buildings: 0, mortgaged: false }, ceibo: { ownerId: id, buildings: 0, mortgaged: false }, lapacho: { ownerId: id, buildings: 0, mortgaged: false } } };
    expect(() => run(partial, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' })).toThrow(/hotels on all/);
  });

  it('loans, mortgages and building follow the rules', () => {
    let s = started('classic', 7, { loansEnabled: true, maxLoan: 300 });
    const id = s.order[0]!;
    s = run(s, { type: 'BORROW', playerId: id, amount: 200 }).state;
    expect(player(s, id).cash).toBe(1700);
    expect(() => run(s, { type: 'BORROW', playerId: id, amount: 200 })).toThrow(/at most/);
    s = run(s, { type: 'REPAY', playerId: id, amount: 200 }).state;

    s = {
      ...s,
      properties: {
        'callejon-faro': { ownerId: id, buildings: 0, mortgaged: false },
        'plaza-molino': { ownerId: id, buildings: 0, mortgaged: false },
      },
    };
    s = run(s, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' }).state;
    expect(() => run(s, { type: 'BUILD', playerId: id, tileId: 'callejon-faro' })).toThrow(/evenly/);
    s = run(s, { type: 'BUILD', playerId: id, tileId: 'plaza-molino' }).state;
    expect(() => run(s, { type: 'MORTGAGE', playerId: id, tileId: 'plaza-molino' })).toThrow(/buildings/);
    s = run(s, { type: 'SELL_BUILDING', playerId: id, tileId: 'plaza-molino' }).state;
    s = run(s, { type: 'SELL_BUILDING', playerId: id, tileId: 'callejon-faro' }).state;
    s = run(s, { type: 'MORTGAGE', playerId: id, tileId: 'plaza-molino' }).state;
    expect(s.properties['plaza-molino']?.mortgaged).toBe(true);

    const noMortgage = started('classic', 7, { mortgageEnabled: false });
    const owner = noMortgage.order[0]!;
    const g = { ...noMortgage, properties: { 'callejon-faro': { ownerId: owner, buildings: 0, mortgaged: false } } };
    expect(() => run(g, { type: 'MORTGAGE', playerId: owner, tileId: 'callejon-faro' })).toThrow(/disabled/);
  });

  it('buy owned properties pays the owner a premium', () => {
    const locked = started();
    const [x, y] = locked.order as [string, string];
    const g = { ...locked, properties: { condor: { ownerId: y, buildings: 0, mortgaged: false } } };
    expect(() => run(g, { type: 'BUY_OWNED', playerId: x, tileId: 'condor' })).toThrow(/disabled/);

    let s = started('classic', 7, { buyOwnedProperties: true });
    const [p, q] = s.order as [string, string];
    s = { ...s, properties: { condor: { ownerId: q, buildings: 0, mortgaged: false } } };
    s = run(s, { type: 'BUY_OWNED', playerId: p, tileId: 'condor' }).state;
    expect(s.properties['condor']?.ownerId).toBe(p);
    expect(player(s, q).cash).toBe(1500 + 800);
  });

  it('trades swap cash and tiles once accepted', () => {
    let s = started();
    const [x, y] = s.order as [string, string];
    s = { ...s, properties: { condor: { ownerId: y, buildings: 0, mortgaged: false } } };
    const proposed = run(s, {
      type: 'PROPOSE_TRADE',
      playerId: x,
      toId: y,
      give: { cash: 100, tileIds: [], jailCards: 0 },
      receive: { cash: 0, tileIds: ['condor'], jailCards: 0 },
    });
    s = proposed.state;
    const tradeId = s.trades[0]!.id;
    expect(() => run(s, { type: 'ACCEPT_TRADE', playerId: x, tradeId })).toThrow(/recipient/);
    s = run(s, { type: 'ACCEPT_TRADE', playerId: y, tradeId }).state;
    expect(s.properties['condor']?.ownerId).toBe(x);
    expect(player(s, x).cash).toBe(1400);
    expect(s.trades).toHaveLength(0);
  });

  it('landing on the jail tile is only a visit; go-to-jail detains', () => {
    const s = started();
    const id = s.activePlayerId!;
    const jail = board.tiles.findIndex((t) => t.type === 'jail');
    const visit = rollExactly(s, id, 7, jail - 7);
    expect(player(visit.state, id).inJail).toBe(false);
    const goto = board.tiles.findIndex((t) => t.type === 'go-to-jail');
    const sent = rollExactly(s, id, 7, goto - 7);
    expect(player(sent.state, id).inJail).toBe(true);
    expect(player(sent.state, id).position).toBe(jail);
  });
});
