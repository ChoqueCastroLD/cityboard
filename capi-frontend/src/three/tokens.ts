import { type BoardDefinition, boardTokens, type GameState, type Player } from 'capi-core';
import {
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Raycaster,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { type BoardLayout, TILE_HEIGHT, type TileRect } from './layout';
import { buildPiece, disposePiece, pieceHeight, pieceMeshes, setPieceColor } from './pieces';
import { easeInOutCubic, easeOutCubic, type Tweens } from './tween';

const HOP_MS = 170;
const HOP_HEIGHT = 0.3;
const HOURGLASS_BUCKETS = 60;

export type Waypoint =
  | { kind: 'move'; index: number }
  | { kind: 'wait'; until: Promise<void> }
  | { kind: 'pause'; begin: (resume: () => void) => void };

interface Piece {
  player: Player;
  model: Group;
  height: number;
  color: string;
  root: Group;
  displayIndex: number;
  targetIndex: number;
  moving: boolean;
  queue: Waypoint[];
  resume: (() => void) | null;
  epoch: number;
  slot: Vector3;
  hourglass: Sprite;
  hourglassCanvas: HTMLCanvasElement;
  hourglassTexture: CanvasTexture;
  hourglassBucket: number;
  ring: Mesh<RingGeometry, MeshBasicMaterial>;
  ready: boolean;
  spin: boolean;
  heading: number;
}

export interface HopInfo {
  playerId: string;
  tile: TileRect;
  position: Vector3;
}

export class TokenLayer {
  readonly group = new Group();

  onHop: ((hop: HopInfo) => void) | null = null;
  private readonly pieces = new Map<string, Piece>();
  private readonly byMesh = new Map<Mesh, Piece>();
  private readonly marker: Mesh<ConeGeometry, MeshBasicMaterial>;
  private controlled: string | null = null;
  private lastState: GameState | null = null;

  constructor(
    private readonly board: BoardDefinition,
    private readonly layout: BoardLayout,
    private readonly tweens: Tweens,
    accent: string,
  ) {
    this.marker = new Mesh(new ConeGeometry(0.07, 0.15, 4), new MeshBasicMaterial({ color: accent }));
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    this.group.add(this.marker);
  }

  setControlled(playerId: string | null): void {
    this.controlled = playerId;
  }

  enqueue(playerId: string, waypoint: Waypoint): void {
    const piece = this.pieces.get(playerId);
    if (!piece) return;
    piece.queue.push(waypoint);
    if (!piece.moving) void this.run(piece);
  }

  pick(raycaster: Raycaster): string | null {
    const hit = raycaster.intersectObjects([...this.byMesh.keys()], false)[0];
    return hit ? (this.byMesh.get(hit.object as Mesh)?.player.id ?? null) : null;
  }

  position(playerId: string): Vector3 | null {
    const piece = this.pieces.get(playerId);
    return piece ? piece.root.position.clone() : null;
  }

  topOf(playerId: string): Vector3 | null {
    const piece = this.pieces.get(playerId);
    return piece ? piece.root.position.clone().setY(piece.root.position.y + piece.height) : null;
  }

  isMoving(playerId: string): boolean {
    const piece = this.pieces.get(playerId);
    return !!piece && (piece.moving || piece.displayIndex !== piece.targetIndex);
  }

  get busy(): boolean {
    for (const piece of this.pieces.values()) {
      if (piece.moving || piece.queue.length > 0 || piece.displayIndex !== piece.targetIndex) return true;
    }
    return false;
  }

  catchUp(): void {
    for (const piece of this.pieces.values()) {
      piece.epoch += 1;
      piece.queue.length = 0;
      piece.resume?.();
      piece.resume = null;
      piece.displayIndex = piece.targetIndex;
      piece.slot.copy(this.slotFor(piece, piece.targetIndex));
      piece.root.position.copy(piece.slot);
      piece.root.rotation.y = piece.heading;
    }
  }

  tileOf(playerId: string): TileRect | null {
    const piece = this.pieces.get(playerId);
    return piece ? (this.layout.tiles[piece.displayIndex] ?? null) : null;
  }

  sync(state: GameState, now: number): void {
    const alive = new Set<string>();
    for (const player of state.players) {
      if (player.bankrupt || player.spectator) continue;
      alive.add(player.id);
      const piece = this.pieces.get(player.id) ?? this.createPiece(player);
      const previousToken = piece.player.token;
      piece.player = player;
      if (previousToken !== player.token) this.reshape(piece);
      if (piece.color !== player.color) {
        piece.color = player.color;
        setPieceColor(piece.model, player.color);
        piece.ring.material.color.set(player.color);
      }
      if (player.position !== piece.targetIndex) {
        piece.targetIndex = player.position;
        if (!piece.moving) void this.run(piece);
      }
      piece.spin = player.inJail && !piece.moving;
      piece.ready = canAct(state, player, now);
      this.updateHourglass(piece, state, now);
    }
    for (const [id, piece] of this.pieces) {
      if (!alive.has(id)) this.removePiece(piece);
    }

    const changed = this.lastState !== state;
    this.lastState = state;
    if (changed) {
      for (const piece of this.pieces.values()) {
        if (piece.moving || piece.displayIndex !== piece.targetIndex) continue;
        const slot = this.slotFor(piece, piece.targetIndex);
        if (!slot.equals(piece.slot)) {
          const from = piece.root.position.clone();
          piece.slot.copy(slot);
          void this.tweens.run({ duration: 260, ease: easeInOutCubic, onUpdate: (t) => piece.root.position.lerpVectors(from, slot, t) });
        }
      }
    }
  }

  private shapeOf(player: Player): string {
    return boardTokens(this.board).find((t) => t.id === player.token)?.shape ?? player.token;
  }

  private attachModel(piece: Piece, model: Group): void {
    piece.model = model;
    piece.height = pieceHeight(model);
    piece.root.add(model);
    for (const mesh of pieceMeshes(model)) this.byMesh.set(mesh, piece);
  }

  private detachModel(piece: Piece): void {
    for (const mesh of pieceMeshes(piece.model)) this.byMesh.delete(mesh);
    disposePiece(piece.model);
  }

  private reshape(piece: Piece): void {
    this.detachModel(piece);
    this.attachModel(piece, buildPiece(this.shapeOf(piece.player), piece.player.color));
  }

  private createPiece(player: Player): Piece {
    const ring = new Mesh(new RingGeometry(0.2, 0.3, 48), new MeshBasicMaterial({ color: player.color, transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    ring.visible = false;

    const hourglassCanvas = document.createElement('canvas');
    hourglassCanvas.width = hourglassCanvas.height = 128;
    const hourglassTexture = new CanvasTexture(hourglassCanvas);
    hourglassTexture.colorSpace = SRGBColorSpace;
    const hourglass = new Sprite(new SpriteMaterial({ map: hourglassTexture, transparent: true, depthWrite: false }));
    hourglass.scale.setScalar(0.42);
    hourglass.position.y = 0.62;
    hourglass.visible = false;

    const root = new Group();
    root.add(ring, hourglass);
    this.group.add(root);

    const piece: Piece = {
      player,
      model: new Group(),
      height: 0,
      color: player.color,
      root,
      displayIndex: player.position,
      targetIndex: player.position,
      moving: false,
      queue: [],
      resume: null,
      epoch: 0,
      slot: new Vector3(),
      hourglass,
      hourglassCanvas,
      hourglassTexture,
      hourglassBucket: -1,
      ring,
      ready: false,
      spin: false,
      heading: 0,
    };
    this.attachModel(piece, buildPiece(this.shapeOf(player), player.color));
    this.pieces.set(player.id, piece);
    piece.slot.copy(this.slotFor(piece, player.position));
    root.position.copy(piece.slot);
    return piece;
  }

  private removePiece(piece: Piece): void {
    this.detachModel(piece);
    this.group.remove(piece.root);
    piece.ring.geometry.dispose();
    piece.ring.material.dispose();
    piece.hourglassTexture.dispose();
    piece.hourglass.material.dispose();
    this.pieces.delete(piece.player.id);
  }

  private slotFor(piece: Piece, tileIndex: number): Vector3 {
    const rect = this.layout.tiles[tileIndex]!;
    const here = [...this.pieces.values()].filter((p) => p.targetIndex === tileIndex && !p.player.bankrupt);
    const others = here.length > 0 ? here : [piece];
    const order = others.findIndex((p) => p === piece);
    const count = others.length;
    const pos = rect.center.clone().setY(TILE_HEIGHT);
    if (piece.player.inJail) {
      const tangent = new Vector3(-rect.inward.z, 0, rect.inward.x);
      pos.addScaledVector(rect.inward, rect.depth * 0.18).addScaledVector(tangent, rect.width * 0.18);
    }
    if (count > 1) {
      const radius = Math.min(0.22, 0.12 + count * 0.03);
      const angle = (Math.max(0, order) / count) * Math.PI * 2;
      pos.x += Math.cos(angle) * radius;
      pos.z += Math.sin(angle) * radius;
    }
    return pos;
  }

  private async run(piece: Piece): Promise<void> {
    piece.moving = true;
    try {
      while (this.pieces.get(piece.player.id) === piece) {
        const waypoint = piece.queue.shift();
        if (!waypoint) {
          if (piece.displayIndex === piece.targetIndex) break;
          await this.hopTo(piece, piece.targetIndex);
          continue;
        }
        if (waypoint.kind === 'move') await this.hopTo(piece, waypoint.index);
        else if (waypoint.kind === 'wait') await waypoint.until;
        else await this.pause(piece, waypoint.begin);
      }
    } finally {
      piece.moving = false;
    }
  }

  private pause(piece: Piece, begin: (resume: () => void) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      const resume = () => {
        if (piece.resume === resume) piece.resume = null;
        resolve();
      };
      piece.resume = resume;
      begin(resume);
    });
  }

  private async hopTo(piece: Piece, index: number): Promise<void> {
    const n = this.layout.tiles.length;
    const epoch = piece.epoch;
    while (piece.displayIndex !== index && piece.epoch === epoch && this.pieces.get(piece.player.id) === piece) {
      const forward = (index - piece.displayIndex + n) % n;
      const backward = (piece.displayIndex - index + n) % n;
      const step = backward <= 3 && backward < forward ? -1 : 1;
      const next = (piece.displayIndex + step + n) % n;
      const last = next === index;
      const rect = this.layout.tiles[next]!;
      const from = piece.root.position.clone();
      const to = last ? this.slotFor(piece, next) : rect.center.clone().setY(TILE_HEIGHT);
      piece.heading = Math.atan2(to.x - from.x, to.z - from.z);
      this.onHop?.({ playerId: piece.player.id, tile: rect, position: to.clone() });
      await this.tweens.run({
        duration: HOP_MS,
        ease: easeOutCubic,
        onUpdate: (t) => {
          piece.root.position.lerpVectors(from, to, t);
          piece.root.position.y = TILE_HEIGHT + Math.sin(t * Math.PI) * HOP_HEIGHT;
        },
      });
      if (piece.epoch !== epoch) return;
      piece.displayIndex = next;
      piece.slot.copy(to);
    }
  }

  private updateHourglass(piece: Piece, state: GameState, now: number): void {
    const { player } = piece;
    const waiting = state.mode === 'async' && player.turn.phase === 'idle' && player.cooldownUntil > now;
    piece.hourglass.visible = waiting;
    if (!waiting) {
      piece.hourglassBucket = -1;
      return;
    }
    const remaining = Math.max(0, Math.min(1, (player.cooldownUntil - now) / state.rules.asyncCooldownMs));
    const bucket = Math.ceil(remaining * HOURGLASS_BUCKETS);
    if (bucket === piece.hourglassBucket) return;
    piece.hourglassBucket = bucket;
    drawHourglass(piece.hourglassCanvas, remaining, player.color);
    piece.hourglassTexture.needsUpdate = true;
  }

  update(now: number): void {
    const pulse = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(now / 300));
    let controlledPiece: Piece | null = null;
    for (const piece of this.pieces.values()) {
      piece.ring.visible = piece.ready;
      piece.ring.material.opacity = pulse;
      piece.ring.scale.setScalar(1 + 0.08 * Math.sin(now / 300));
      piece.model.rotation.y = piece.spin ? now / 900 : 0;
      const turn = Math.atan2(Math.sin(piece.heading - piece.root.rotation.y), Math.cos(piece.heading - piece.root.rotation.y));
      piece.root.rotation.y += Math.abs(turn) < 0.01 ? turn : turn * 0.2;
      piece.hourglass.position.y = piece.height + 0.28;
      if (piece.player.id === this.controlled) controlledPiece = piece;
    }
    this.marker.visible = controlledPiece !== null;
    if (controlledPiece) {
      this.marker.position.copy(controlledPiece.root.position);
      this.marker.position.y += controlledPiece.height + 0.5 + 0.05 * Math.sin(now / 250);
      this.marker.rotation.y = now / 1200;
    }
  }

  dispose(): void {
    for (const piece of [...this.pieces.values()]) this.removePiece(piece);
    this.marker.geometry.dispose();
    this.marker.material.dispose();
  }
}

export function canAct(state: GameState, player: Player, now: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.mode === 'classic') return state.activePlayerId === player.id;
  return player.turn.phase !== 'idle' || now >= player.cooldownUntil;
}

function drawHourglass(canvas: HTMLCanvasElement, remaining: number, color: string): void {
  const ctx = canvas.getContext('2d')!;
  const s = canvas.width;
  const c = s / 2;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(12,12,20,0.72)';
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(c, c, c - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(c, c, c - 12, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  const w = 18;
  const h = 26;
  ctx.beginPath();
  ctx.moveTo(c - w, c - h);
  ctx.lineTo(c + w, c - h);
  ctx.lineTo(c - w, c + h);
  ctx.lineTo(c + w, c + h);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  const sand = 0.2 + 0.8 * remaining;
  ctx.beginPath();
  ctx.moveTo(c - w * sand, c - h * sand);
  ctx.lineTo(c + w * sand, c - h * sand);
  ctx.lineTo(c, c);
  ctx.closePath();
  ctx.fill();
}

export type { TileRect };
