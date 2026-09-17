import type { BoardDefinition, OwnableTile, Tile } from '../board/schema';
import { isOwnable } from '../board/schema';
import { assert } from './errors';
import type { GameEvent } from './events';
import type { GameState, Ownership, Player } from './state';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type EventInput = DistributiveOmit<GameEvent, 'at'>;

export class Ctx {
  readonly events: GameEvent[] = [];
  private readonly tileIndex = new Map<string, number>();

  constructor(
    readonly board: BoardDefinition,
    readonly state: GameState,
    readonly now: number,
  ) {
    board.tiles.forEach((t, i) => this.tileIndex.set(t.id, i));
  }

  emit(event: EventInput): void {
    this.events.push({ ...event, at: this.now } as GameEvent);
  }

  player(id: string): Player {
    const p = this.state.players.find((x) => x.id === id);
    assert(p, 'NOT_FOUND', `unknown player ${id}`);
    return p;
  }

  activePlayers(): Player[] {
    return this.state.players.filter((p) => !p.bankrupt && !p.spectator);
  }

  tile(id: string): Tile {
    const i = this.tileIndex.get(id);
    assert(i !== undefined, 'NOT_FOUND', `unknown tile ${id}`);
    return this.board.tiles[i] as Tile;
  }

  ownableTile(id: string): OwnableTile {
    const t = this.tile(id);
    assert(isOwnable(t), 'INVALID_COMMAND', `${t.name} cannot be owned`);
    return t;
  }

  indexOf(tileId: string): number {
    const i = this.tileIndex.get(tileId);
    assert(i !== undefined, 'NOT_FOUND', `unknown tile ${tileId}`);
    return i;
  }

  tileAt(position: number): Tile {
    return this.board.tiles[position % this.board.tiles.length] as Tile;
  }

  ownership(tileId: string): Ownership | undefined {
    return this.state.properties[tileId];
  }

  groupTiles(groupId: string): OwnableTile[] {
    return this.board.tiles.filter((t): t is OwnableTile => isOwnable(t) && t.groupId === groupId);
  }

  ownedInGroup(groupId: string, playerId: string): number {
    return this.groupTiles(groupId).filter((t) => this.ownership(t.id)?.ownerId === playerId).length;
  }

  ownsWholeGroup(groupId: string, playerId: string): boolean {
    const tiles = this.groupTiles(groupId);
    return tiles.length > 0 && this.ownedInGroup(groupId, playerId) === tiles.length;
  }

  buildingsInGroup(groupId: string): number {
    return this.groupTiles(groupId).reduce((n, t) => n + (this.ownership(t.id)?.buildings ?? 0), 0);
  }

  playerTiles(playerId: string): OwnableTile[] {
    return this.board.tiles.filter(
      (t): t is OwnableTile => isOwnable(t) && this.ownership(t.id)?.ownerId === playerId,
    );
  }

  isPlaying(): void {
    assert(this.state.phase === 'playing', 'WRONG_PHASE', 'the game is not in progress');
  }
}
