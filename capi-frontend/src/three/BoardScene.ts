import type { BoardDefinition, GameEvent, GameState } from 'capi-core';
import { computeRent, Ctx, isOwnable } from 'capi-core';
import {
  CanvasTexture,
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  type Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CameraRig } from './camera';
import { Dice } from './dice';
import { type BoardLayout, buildBoardLayout } from './layout';
import { type AnyRenderer, createRenderer } from './renderer';
import { makeLabelTexture } from './tileTexture';
import { TileLayer } from './tiles';
import { canAct, TokenLayer } from './tokens';
import { Tweens } from './tween';
import type { CameraMode, IBoardScene, SceneBackend, SceneOptions, ScreenPoint } from './types';

const CLICK_SLOP = 6;
const BACKGROUND_TICK_MS = 500;
const SETTLE_ROUNDS = 400;

export class BoardScene implements IBoardScene {
  readonly ready: Promise<{ backend: SceneBackend }>;

  private readonly scene = new Scene();
  private readonly tweens = new Tweens();
  private readonly layout: BoardLayout;
  private readonly tiles: TileLayer;
  private readonly tokens: TokenLayer;
  private readonly dice: Dice;
  private readonly rig: CameraRig;
  private readonly raycaster = new Raycaster();

  private readonly labelPivot = new Group();
  private readonly pointer = new Vector2();
  private readonly disposables: Array<() => void> = [];
  private renderer: AnyRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastState: GameState | null = null;
  private controlledId: string | null = null;

  private actingId: string | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private hoverDirty = false;
  private hoveredToken: string | null = null;
  private hoveredTile: string | null = null;
  private cameraMode: CameraMode = 'map';
  private rolls = 0;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: SceneOptions,
  ) {
    const { board } = options;
    const accent = board.theme?.accent ?? '#7c5cff';
    this.layout = buildBoardLayout(board);
    this.tiles = new TileLayer(board, this.layout, accent);
    this.tokens = new TokenLayer(board, this.layout, this.tweens, accent);
    this.tokens.onHop = ({ playerId, tile, position }) => {
      if (this.cameraMode === 'locked') return;
      if (this.cameraMode === 'player') {
        if (playerId === this.controlledId) this.rig.focusPoint(position, tile.side);
        return;
      }
      this.rig.follow(position, tile.side);
    };
    this.dice = new Dice(this.tweens);
    this.dice.setRest(this.layout.innerHalfWidth * 0.45, this.layout.innerHalfDepth * 0.45);
    this.rig = new CameraRig(canvas, this.layout);

    this.scene.add(this.tiles.group, this.tokens.group, this.dice.group);
    this.buildEnvironment(board, accent);
    this.bindPointer();

    this.ready = createRenderer(canvas).then(({ renderer, backend }) => {
      if (this.disposed) {
        renderer.dispose();
        return { backend };
      }
      this.renderer = renderer;
      this.resize();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement ?? canvas);
      const onVisibility = () => this.setBackground(document.hidden);
      document.addEventListener('visibilitychange', onVisibility);
      this.disposables.push(() => {
        document.removeEventListener('visibilitychange', onVisibility);
        this.setBackground(false);
      });
      this.setBackground(document.hidden);
      void renderer.setAnimationLoop(this.frame);

      void this.afterFrames(3).then(() => this.tiles.loadAssets());
      return { backend };
    });
  }

  setState(state: GameState, now: number): void {
    if (state !== this.lastState) {
      this.lastState = state;
      this.syncOwnership(state);
      this.syncStartNotes(state);
    }
    this.tokens.sync(state, now);
    this.followTurn(state, now);
  }

  private syncStartNotes(state: GameState): void {
    const symbol = this.options.board.currency.symbol;
    for (const tile of this.options.board.tiles) {
      if (tile.type !== 'start') continue;
      this.tiles.setNotes(tile.id, [`Caer: ${symbol}${state.rules.landStartBonus}`, `Pasar: ${symbol}${state.rules.passStartBonus}`]);
    }
  }

  private followTurn(state: GameState, now: number): void {
    const controlled = this.controlledId ? state.players.find((p) => p.id === this.controlledId) : undefined;
    const acting = controlled && canAct(state, controlled, now) ? controlled.id : this.controlledId ? null : state.activePlayerId;
    if (acting === this.actingId) return;
    this.actingId = acting;
    if (this.cameraMode !== 'map') return;
    if (!acting || this.rolls > 0 || this.tokens.isMoving(acting)) return;
    const position = this.tokens.position(acting);
    const side = this.tokens.tileOf(acting)?.side;
    if (position && side) this.rig.follow(position, side);
  }

  play(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'ROLLED': {
          const settled = this.rollDice(event.dice);
          this.options.callbacks?.onDiceRoll?.(event.playerId, event.dice, settled);
          this.tokens.enqueue(event.playerId, { kind: 'wait', until: settled });
          break;
        }
        case 'MOVED':
          this.tokens.enqueue(event.playerId, { kind: 'move', index: event.to });
          break;
        case 'CARD_DRAWN': {
          const onCardDrawn = this.options.callbacks?.onCardDrawn;
          if (onCardDrawn) this.tokens.enqueue(event.playerId, { kind: 'pause', begin: (resume) => onCardDrawn(event, resume) });
          break;
        }
      }
    }
  }

  catchUp(): void {
    this.tokens.catchUp();
    this.tweens.settle();
    this.rig.update(performance.now());
  }

  private backgroundTimer: number | null = null;

  private setBackground(hidden: boolean): void {
    if (hidden === (this.backgroundTimer !== null)) return;
    if (hidden) {
      this.backgroundTimer = window.setInterval(() => void this.settleAll(), BACKGROUND_TICK_MS);
      return;
    }
    window.clearInterval(this.backgroundTimer!);
    this.backgroundTimer = null;
    void this.settleAll();
  }

  private async settleAll(): Promise<void> {
    for (let round = 0; round < SETTLE_ROUNDS && !this.disposed; round++) {
      if (this.tweens.pending === 0 && !this.tokens.busy) return;
      this.tweens.settle();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  async rollDice(dice: [number, number]): Promise<void> {
    this.rolls += 1;
    try {
      await this.dice.roll(dice);
    } finally {
      this.rolls -= 1;
    }
  }

  projectPlayer(playerId: string): ScreenPoint | null {
    const top = this.tokens.topOf(playerId);
    return top ? this.toScreen(top) : null;
  }

  focusTile(tileId: string | null): void {
    const rect = tileId ? this.tiles.rect(tileId) : undefined;
    this.rig.focusPoint(rect?.center ?? null, rect?.side ?? null);
  }

  focusPlayer(playerId: string | null): void {
    const position = playerId ? this.tokens.position(playerId) : null;
    this.rig.focusPoint(position, playerId ? (this.tokens.tileOf(playerId)?.side ?? null) : null);
  }

  highlightTiles(tileIds: string[]): void {
    this.tiles.setHighlight(tileIds);
  }

  setControlledPlayer(playerId: string | null): void {
    this.controlledId = playerId;
    this.actingId = null;
    this.tokens.setControlled(playerId);
    if (this.cameraMode === 'player') this.focusPlayer(playerId);
    else if (this.lastState) this.followTurn(this.lastState, Date.now());
  }

  setCameraMode(mode: CameraMode): void {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    switch (mode) {
      case 'player':
        this.focusPlayer(this.controlledId);
        return;
      case 'map':
        this.rig.focusPoint(null, null);
        this.actingId = null;
        if (this.lastState) this.followTurn(this.lastState, Date.now());
        return;
      case 'locked':
        this.rig.recenter();
        return;
    }
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.canvas.clientWidth);
    const height = Math.max(1, parent?.clientHeight ?? this.canvas.clientHeight);
    this.renderer?.setSize(width, height, false);
    this.rig.fit(width / height);
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    for (const off of this.disposables) off();
    this.tweens.clear();
    this.rig.dispose();
    this.tiles.dispose();
    this.tokens.dispose();
    this.dice.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of materials) m.dispose();
      }
    });
    void this.renderer?.setAnimationLoop(null);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private frameWaiters: Array<{ left: number; resolve: () => void }> = [];

  private afterFrames(count: number): Promise<void> {
    return new Promise((resolve) => this.frameWaiters.push({ left: count, resolve }));
  }

  private readonly frame = (time: number): void => {
    if (!this.renderer) return;
    this.frameWaiters = this.frameWaiters.filter((w) => (--w.left > 0 ? true : (w.resolve(), false)));
    this.tweens.update(time);
    if (this.hoverDirty) {
      this.hoverDirty = false;
      this.updateHover();
    }
    this.tiles.setViewerSide(this.rig.viewerSide());
    this.tiles.update(time);
    this.tokens.update(time);
    this.rig.update(time);
    this.turnLabelToCamera();
    this.renderer.render(this.scene, this.rig.camera);
  };

  private turnLabelToCamera(): void {
    const quarter = Math.PI / 2;
    const target = Math.round(this.rig.azimuth() / quarter) * quarter;
    const current = this.labelPivot.rotation.y;
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    this.labelPivot.rotation.y = Math.abs(delta) < 0.002 ? target : current + delta * 0.12;
  }

  private syncOwnership(state: GameState): void {
    const { board } = this.options;
    const groupSize = new Map<string, number>();
    const ownedInGroup = new Map<string, number>();
    for (const tile of board.tiles) {
      if (!isOwnable(tile)) continue;
      groupSize.set(tile.groupId, (groupSize.get(tile.groupId) ?? 0) + 1);
      const own = state.properties[tile.id];
      if (own) {
        const key = `${tile.groupId}|${own.ownerId}`;
        ownedInGroup.set(key, (ownedInGroup.get(key) ?? 0) + 1);
      }
    }
    const ctx = new Ctx(board, state, Date.now());
    const symbol = board.currency.symbol;
    for (const tile of board.tiles) {
      if (!isOwnable(tile)) continue;
      const own = state.properties[tile.id];
      const owner = own ? state.players.find((p) => p.id === own.ownerId) : undefined;
      const monopoly = !!own && ownedInGroup.get(`${tile.groupId}|${own.ownerId}`) === groupSize.get(tile.groupId);
      const rentLabel = !own
        ? null
        : own.mortgaged
          ? 'Hipotecada'
          : tile.type === 'utility'
            ? `${tile.multipliers[Math.min(tile.multipliers.length, ownedInGroup.get(`${tile.groupId}|${own.ownerId}`) ?? 1) - 1] ?? 0}× dados`
            : `Renta ${symbol}${computeRent(ctx, tile, own.ownerId, 0)}`;
      this.tiles.setOwnership(
        tile.id,
        own && owner ? { color: owner.color, buildings: own.buildings, mortgaged: own.mortgaged, monopoly, rentLabel } : null,
        state.rules.maxBuildings,
      );
    }
  }

  private buildEnvironment(board: BoardDefinition, accent: string): void {
    const { width, depth, innerHalfWidth, innerHalfDepth } = this.layout;

    const ground = new Mesh(new CircleGeometry(Math.max(width, depth) * 1.7, 64), new MeshStandardMaterial({ map: vignetteTexture(), transparent: true, roughness: 0.95, color: 0x0a0a12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.14;
    ground.receiveShadow = true;

    const boardColor = board.theme?.boardColor;
    const base = new Mesh(
      new RoundedBoxGeometry(width + 0.5, 0.26, depth + 0.5, 4, 0.09),
      new MeshPhysicalMaterial({ color: boardColor?.startsWith('#') ? boardColor : '#1a1a2e', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    );
    base.position.y = -0.13;
    base.receiveShadow = true;

    const labelWidth = innerHalfWidth * 1.4;
    const label = new Mesh(
      new PlaneGeometry(labelWidth, labelWidth / 2),
      new MeshBasicMaterial({ map: makeLabelTexture(board.name, board.currency.code ?? board.currency.symbol), transparent: true, opacity: 0.3, depthWrite: false }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.004, -innerHalfDepth * 0.25);
    this.labelPivot.add(label);

    const hemi = new HemisphereLight(0xbfd4ff, 0x1a1020, 1.1);
    const key = new DirectionalLight(0xffe2c0, 2.4);
    key.position.set(width * 0.6, 9, depth * 0.7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -width / 2 - 1;
    key.shadow.camera.right = width / 2 + 1;
    key.shadow.camera.top = depth / 2 + 1;
    key.shadow.camera.bottom = -depth / 2 - 1;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0005;
    const rim = new DirectionalLight(accent, 0.9);
    rim.position.set(-width * 0.7, 5, -depth * 0.8);

    this.scene.add(ground, base, this.labelPivot, hemi, key, rim);
  }

  private bindPointer(): void {
    const canvas = this.canvas;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.hoverDirty = true;
    };
    const onDown = (e: PointerEvent) => {
      this.pointerDown = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      const down = this.pointerDown;
      this.pointerDown = null;
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
      onMove(e);
      this.raycaster.setFromCamera(this.pointer, this.rig.camera);
      const playerId = this.tokens.pick(this.raycaster);
      if (playerId) return this.options.callbacks?.onTokenClick?.(playerId);
      const tileId = this.tiles.pick(this.raycaster);
      if (tileId) this.options.callbacks?.onTileClick?.(tileId);
    };
    const onLeave = () => {
      this.pointer.set(2, 2);
      this.hoverDirty = true;
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    this.disposables.push(() => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('contextmenu', onContextMenu);
    });
  }

  private updateHover(): void {
    const outside = this.pointer.x > 1 || this.pointer.x < -1;
    let tokenId: string | null = null;
    let tileId: string | null = null;
    if (!outside) {
      this.raycaster.setFromCamera(this.pointer, this.rig.camera);
      tokenId = this.tokens.pick(this.raycaster);
      tileId = tokenId ? null : this.tiles.pick(this.raycaster);
    }
    this.tiles.setHover(tileId);
    this.canvas.style.cursor = tokenId || tileId ? 'pointer' : '';

    const hover = this.options.callbacks?.onTokenHover;
    if (hover) {
      if (tokenId) {
        const top = this.tokens.topOf(tokenId);
        hover(tokenId, top ? this.toScreen(top) : null);
      } else if (this.hoveredToken) {
        hover(null, null);
      }
    }
    this.hoveredToken = tokenId;

    const tileHover = this.options.callbacks?.onTileHover;
    if (tileHover) {
      if (tileId) {
        const rect = this.tiles.rect(tileId);
        tileHover(tileId, rect ? this.toScreen(rect.center.clone().setY(0.1)) : null);
      } else if (this.hoveredTile) {
        tileHover(null, null);
      }
    }
    this.hoveredTile = tileId;
  }

  private toScreen(world: Vector3): ScreenPoint {
    const ndc = world.clone().project(this.rig.camera);
    return { x: ((ndc.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - ndc.y) / 2) * this.canvas.clientHeight };
  }
}

function vignetteTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
