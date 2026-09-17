import type { BoardDefinition } from '../board/schema';
import { armDeadlines, autoplay, forcePlay, settleDebts } from './afk';
import { closeExpiredAuctions, dropFromAuctions, passAuction, placeBid, startAuction } from './auction';
import { declareBankruptcy, forfeit } from './bankruptcy';
import { build, mortgage, sellBuilding, unmortgage } from './building';
import { type Command, SYSTEM_PLAYER_ID } from './commands';
import { Ctx } from './context';
import { spend, transferTile } from './economy';
import { assert, GameError } from './errors';
import type { GameEvent } from './events';
import { reassignHostIfGone, transferHost } from './host';
import { borrow, repay } from './loan';
import { assertAppearanceFree, pickFreeColor, pickFreeToken } from './players';
import { shuffle } from './rng';
import { COMPETITIVE_MAX_PLAYERS, COMPETITIVE_MIN_PLAYERS, type GameMode, type GameRules, MAX_PLAYERS, MIN_PLAYERS, resolveRules } from './rules';
import { type GameState, idleTurn, type Player } from './state';
import { acceptTrade, cancelTrade, declineTrade, dropTradesOf, proposeTrade } from './trade';
import {
  advanceClassic,
  beginTurn,
  buyPending,
  checkGameOver,
  declinePending,
  endTurn,
  finishGame,
  payJailFine,
  refreshAllHourglasses,
  roll,
  useJailCard,
} from './turn';

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export function apply(board: BoardDefinition, state: GameState, command: Command): ApplyResult {
  const ctx = new Ctx(board, structuredClone(state), command.at);
  ctx.state.rules = resolveRules(ctx.state.rules);
  ctx.state.updatedAt = command.at;

  if (ctx.state.phase === 'playing') {
    closeExpiredAuctions(ctx);
    refreshAllHourglasses(ctx);
    autoplay(ctx);
  }

  dispatch(ctx, command);

  if (ctx.state.phase === 'playing') {
    settleDebts(ctx);
    armDeadlines(ctx, state);
    checkGameOver(ctx);
  }
  return { state: ctx.state, events: ctx.events };
}

export function tryApply(board: BoardDefinition, state: GameState, command: Command): ApplyResult | { error: GameError } {
  try {
    return apply(board, state, command);
  } catch (e) {
    if (e instanceof GameError) return { error: e };
    throw e;
  }
}

function dispatch(ctx: Ctx, command: Command): void {
  switch (command.type) {
    case 'TICK':
      return;
    case 'JOIN':
      return join(ctx, command.playerId, command.name, command.color, command.token);
    case 'LEAVE':
      return leave(ctx, ctx.player(command.playerId));
    case 'SET_RULES':
      return setRules(ctx, command.playerId, command.rules);
    case 'SET_MODE':
      return setMode(ctx, command.playerId, command.mode);
    case 'SET_BOARD':
      return setBoard(ctx, command.playerId, command.boardId);
    case 'START':
      return start(ctx, command.playerId);
    case 'TRANSFER_HOST':
      return transferHost(ctx, command.playerId, command.toId);
    case 'FORCE_PLAY':
      return forcePlay(ctx, command.playerId, command.targetId);
    case 'REMOVE_PLAYER':
      return removePlayer(ctx, command.playerId, command.targetId);
    case 'SPAWN_PLAYER':
      return spawnPlayer(ctx, command.playerId, command.targetId);
    case 'UPDATE_PLAYER':
      return updatePlayer(ctx, ctx.player(command.playerId), command);
    case 'FORFEIT':
      return systemForfeit(ctx, command.playerId, command.targetId, command.reason);
    case 'FINISH':
      return systemFinish(ctx, command.playerId, command.reason);
  }

  ctx.isPlaying();
  const player = ctx.player(command.playerId);
  assert(!player.bankrupt, 'NOT_ALLOWED', 'you are out of the game');

  switch (command.type) {
    case 'ROLL':
      return roll(ctx, player);
    case 'BUY':
      return buyPending(ctx, player);
    case 'DECLINE':
      return declinePending(ctx, player);
    case 'END_TURN':
      return endTurn(ctx, player);
    case 'PAY_JAIL_FINE':
      return payJailFine(ctx, player);
    case 'USE_JAIL_CARD':
      return useJailCard(ctx, player);
    case 'BUILD':
      return build(ctx, player.id, command.tileId);
    case 'SELL_BUILDING':
      return sellBuilding(ctx, player.id, command.tileId);
    case 'MORTGAGE':
      return mortgage(ctx, player.id, command.tileId);
    case 'UNMORTGAGE':
      return unmortgage(ctx, player.id, command.tileId);
    case 'BID':
      return placeBid(ctx, command.auctionId, player.id, command.amount);
    case 'PASS_AUCTION':
      return passAuction(ctx, command.auctionId, player.id);
    case 'START_AUCTION':
      return startPlayerAuction(ctx, player, command.tileId, command.minBid);
    case 'BUY_OWNED':
      return buyOwned(ctx, player, command.tileId);
    case 'BORROW':
      return borrow(ctx, player.id, command.amount);
    case 'REPAY':
      return repay(ctx, player.id, command.amount);
    case 'PROPOSE_TRADE':
      proposeTrade(ctx, player.id, command.toId, command.give, command.receive);
      return;
    case 'ACCEPT_TRADE':
      return acceptTrade(ctx, player.id, command.tradeId);
    case 'DECLINE_TRADE':
      return declineTrade(ctx, player.id, command.tradeId);
    case 'CANCEL_TRADE':
      return cancelTrade(ctx, player.id, command.tradeId);
    case 'BANKRUPT':
      return declareBankruptcy(ctx, player);
    default:
      throw new GameError('INVALID_COMMAND', `unknown command ${(command as Command).type}`);
  }
}

const SPECTATOR_SLOTS = 4;

function join(ctx: Ctx, playerId: string, name: string, color?: string, token?: string): void {
  assert(ctx.state.phase !== 'finished', 'WRONG_PHASE', 'the game is over');
  assert(!ctx.state.players.some((p) => p.id === playerId), 'INVALID_COMMAND', 'player id already taken');
  assert(name.trim().length > 0, 'INVALID_COMMAND', 'name is required');
  assert(ctx.state.players.length < ctx.state.rules.maxPlayers + SPECTATOR_SLOTS, 'NOT_ALLOWED', 'the table is full');
  assertAppearanceFree(ctx.board, ctx.state.players, playerId, color, token);

  const spectator = ctx.state.phase === 'playing';
  assert(!(spectator && ctx.state.rules.competitive), 'NOT_ALLOWED', 'competitive games cannot be joined once started');
  const player: Player = {
    id: playerId,
    name: name.trim(),
    color: color ?? pickFreeColor(ctx.state.players),
    token: token ?? pickFreeToken(ctx.board, ctx.state.players),
    cash: spectator ? 0 : ctx.state.rules.startingCash,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: [],
    loan: 0,
    bankrupt: false,
    spectator,
    creditorId: null,
    finalCash: null,
    cooldownUntil: 0,
    turn: idleTurn(),
  };
  if (!spectator) {
    assert(ctx.state.order.length < ctx.state.rules.maxPlayers, 'NOT_ALLOWED', 'the table is full');
    ctx.state.order.push(playerId);
  }
  ctx.state.players.push(player);
  ctx.state.hostId ??= playerId;
  ctx.emit({ type: 'PLAYER_JOINED', playerId });
}

function spawnPlayer(ctx: Ctx, hostId: string, targetId: string): void {
  assert(ctx.state.hostId === hostId, 'NOT_ALLOWED', 'only the host can seat spectators');
  ctx.isPlaying();
  const target = ctx.player(targetId);
  assert(target.spectator, 'NOT_ALLOWED', 'that player is already seated');
  assert(ctx.state.order.length < ctx.state.rules.maxPlayers, 'NOT_ALLOWED', 'the table is full');
  target.spectator = false;
  target.cash = ctx.state.rules.startingCash;
  target.position = 0;
  const activeIndex = ctx.state.order.indexOf(ctx.state.activePlayerId ?? '');
  ctx.state.order.splice(activeIndex + 1, 0, targetId);
  ctx.emit({ type: 'PLAYER_SPAWNED', playerId: targetId });
  if (ctx.state.mode === 'async') beginTurn(ctx, target);
}

function updatePlayer(ctx: Ctx, player: Player, patch: { name?: string; color?: string; token?: string }): void {
  assert(ctx.state.phase !== 'finished', 'WRONG_PHASE', 'the game is over');
  assertAppearanceFree(ctx.board, ctx.state.players, player.id, patch.color, patch.token);
  if (patch.name !== undefined) {
    assert(patch.name.trim().length > 0, 'INVALID_COMMAND', 'name is required');
    player.name = patch.name.trim().slice(0, 24);
  }
  if (patch.color !== undefined) player.color = patch.color.trim().toLowerCase();
  if (patch.token !== undefined) player.token = patch.token;
  ctx.emit({ type: 'PLAYER_UPDATED', playerId: player.id });
}

function dropSpectator(ctx: Ctx, player: Player): void {
  ctx.state.players = ctx.state.players.filter((p) => p.id !== player.id);
  reassignHostIfGone(ctx, player.id);
}

function leave(ctx: Ctx, player: Player): void {
  if (ctx.state.phase === 'lobby') {
    ctx.state.players = ctx.state.players.filter((p) => p.id !== player.id);
    ctx.state.order = ctx.state.order.filter((id) => id !== player.id);
    if (ctx.state.hostId === player.id) ctx.state.hostId = ctx.state.players[0]?.id ?? null;
    ctx.emit({ type: 'PLAYER_LEFT', playerId: player.id });
    return;
  }
  if (player.bankrupt) return;
  ctx.emit({ type: 'PLAYER_LEFT', playerId: player.id });
  if (player.spectator) return dropSpectator(ctx, player);
  forfeit(ctx, player, null);
}

function removePlayer(ctx: Ctx, hostId: string, targetId: string): void {
  assert(ctx.state.hostId === hostId, 'NOT_ALLOWED', 'only the host can remove players');
  assert(hostId !== targetId, 'INVALID_COMMAND', 'use LEAVE to remove yourself');
  ctx.isPlaying();
  const target = ctx.player(targetId);
  assert(!target.bankrupt, 'NOT_ALLOWED', 'that player is already out');
  ctx.emit({ type: 'PLAYER_REMOVED', playerId: targetId, byId: hostId });
  if (target.spectator) return dropSpectator(ctx, target);
  forfeit(ctx, target, null);
}

function systemFinish(ctx: Ctx, callerId: string, reason: 'abandoned'): void {
  assert(callerId === SYSTEM_PLAYER_ID, 'NOT_ALLOWED', 'only the system can end a game');
  ctx.isPlaying();
  finishGame(ctx, reason);
}

function systemForfeit(ctx: Ctx, callerId: string, targetId: string, reason: 'disconnected' | 'afk'): void {
  assert(callerId === SYSTEM_PLAYER_ID, 'NOT_ALLOWED', 'only the system can force a forfeit');
  ctx.isPlaying();
  const target = ctx.player(targetId);
  assert(!target.bankrupt && !target.spectator, 'NOT_ALLOWED', 'that player is not seated');
  forfeit(ctx, target, reason);
}

function ensureHostInLobby(ctx: Ctx, playerId: string, what: string): void {
  assert(ctx.state.hostId === playerId, 'NOT_ALLOWED', `only the host can change the ${what}`);
  assert(ctx.state.phase === 'lobby', 'WRONG_PHASE', `the ${what} is locked once the game starts`);
}

function setMode(ctx: Ctx, playerId: string, mode: GameMode): void {
  ensureHostInLobby(ctx, playerId, 'mode');
  assert(mode === 'classic' || mode === 'async', 'INVALID_COMMAND', 'unknown mode');
  ctx.state.mode = mode;
  ctx.emit({ type: 'MODE_CHANGED', mode });
}

function setBoard(ctx: Ctx, playerId: string, boardId: string): void {
  ensureHostInLobby(ctx, playerId, 'board');
  assert(ctx.board.id === boardId, 'INVALID_COMMAND', 'the board definition does not match');
  ctx.state.boardId = boardId;
  ctx.state.properties = {};
  ctx.state.decks = {};
  for (const player of ctx.state.players) player.position = 0;
  ctx.state.rules = resolveRules(ctx.state.rules, ctx.board.defaultRules);
  ctx.emit({ type: 'BOARD_CHANGED', boardId });
}

function setRules(ctx: Ctx, playerId: string, patch: Partial<GameRules>): void {
  assert(ctx.state.hostId === playerId, 'NOT_ALLOWED', 'only the host can change rules');
  assert(ctx.state.phase === 'lobby', 'WRONG_PHASE', 'rules are locked once the game starts');
  const keys = Object.keys(patch) as Array<keyof GameRules>;
  for (const key of keys) {
    assert(key in ctx.state.rules, 'INVALID_COMMAND', `unknown rule ${key}`);
    assert(typeof patch[key] === typeof ctx.state.rules[key], 'INVALID_COMMAND', `invalid value for ${key}`);
  }
  if (patch.competitive === true) {
    assert(ctx.state.order.length <= COMPETITIVE_MAX_PLAYERS, 'NOT_ALLOWED', `competitive games allow at most ${COMPETITIVE_MAX_PLAYERS} players`);
    ctx.state.rules = resolveRules({ competitive: true });
    ctx.emit({ type: 'RULES_CHANGED', keys });
    return;
  }
  if (ctx.state.rules.competitive) {
    assert(
      keys.every((key) => key === 'competitive'),
      'NOT_ALLOWED',
      'competitive rules are fixed; turn competitive off to change them',
    );
    if (patch.competitive === false) ctx.state.rules = resolveRules({ ...ctx.state.rules, competitive: false, isPublic: false });
    ctx.emit({ type: 'RULES_CHANGED', keys });
    return;
  }
  if (patch.maxPlayers !== undefined) {
    const seated = ctx.state.order.length;
    assert(
      Number.isInteger(patch.maxPlayers) && patch.maxPlayers >= Math.max(MIN_PLAYERS, seated) && patch.maxPlayers <= MAX_PLAYERS,
      'INVALID_COMMAND',
      `maxPlayers must be between ${Math.max(MIN_PLAYERS, seated)} and ${MAX_PLAYERS}`,
    );
  }
  ctx.state.rules = resolveRules({ ...ctx.state.rules, ...patch });
  ctx.emit({ type: 'RULES_CHANGED', keys });
}

function start(ctx: Ctx, playerId: string): void {
  assert(ctx.state.phase === 'lobby', 'WRONG_PHASE', 'the game already started');
  assert(ctx.state.hostId === playerId, 'NOT_ALLOWED', 'only the host can start');
  const minimum = ctx.state.rules.competitive ? COMPETITIVE_MIN_PLAYERS : MIN_PLAYERS;
  assert(ctx.state.order.length >= minimum, 'NOT_ALLOWED', `at least ${minimum} players are needed`);

  const shuffled = shuffle(ctx.state.order, ctx.state.rng);
  ctx.state.rng = shuffled.seed;
  ctx.state.order = shuffled.items;
  ctx.state.phase = 'playing';
  ctx.state.endsAt = ctx.state.rules.maxDurationMs > 0 ? ctx.now + ctx.state.rules.maxDurationMs : null;
  ctx.emit({ type: 'GAME_STARTED' });

  if (ctx.state.mode === 'classic') {
    ctx.state.activePlayerId = ctx.state.order[0]!;
    beginTurn(ctx, ctx.player(ctx.state.activePlayerId));
  } else {
    for (const player of ctx.state.players) beginTurn(ctx, player);
  }
}

function startPlayerAuction(ctx: Ctx, player: Player, tileId: string, minBid: number): void {
  assert(ctx.state.rules.playerAuctions, 'RULE_DISABLED', 'player auctions are disabled');
  const own = ctx.ownership(tileId);
  assert(own?.ownerId === player.id, 'NOT_ALLOWED', 'you do not own this tile');
  assert(own.buildings === 0, 'NOT_ALLOWED', 'sell the buildings first');
  startAuction(ctx, tileId, player.id, minBid);
}

function buyOwned(ctx: Ctx, buyer: Player, tileId: string): void {
  const { rules } = ctx.state;
  assert(rules.buyOwnedProperties, 'RULE_DISABLED', 'buying owned properties is disabled');
  const tile = ctx.ownableTile(tileId);
  const own = ctx.ownership(tileId);
  assert(own && own.ownerId !== buyer.id, 'NOT_ALLOWED', 'this tile is not owned by another player');
  assert(own.buildings === 0 && !own.mortgaged, 'NOT_ALLOWED', 'only unimproved, unmortgaged tiles can be bought');
  assert(!ctx.state.auctions.some((a) => a.tileId === tileId), 'NOT_ALLOWED', 'tile is being auctioned');
  const price = Math.round(tile.price * rules.ownedPurchaseMultiplier);
  spend(ctx, buyer.id, own.ownerId, price, `bought ${tile.name} from its owner`);
  const sellerId = own.ownerId;
  transferTile(ctx, tileId, buyer.id);
  ctx.emit({ type: 'BOUGHT', playerId: buyer.id, tileId, price, fromId: sellerId });
}
