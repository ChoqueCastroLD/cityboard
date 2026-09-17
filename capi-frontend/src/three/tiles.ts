import type { BoardDefinition, Side, Tile } from 'capi-core';
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, type Raycaster } from 'three';
import { type BoardLayout, TILE_HEIGHT, type TileRect } from './layout';
import { type IconNode, loadIconNode, loadImage, TileCard, type TileDrawSpec } from './tileTexture';

export interface TileOwnership {
  color: string;
  buildings: number;
  mortgaged: boolean;

  monopoly: boolean;
  rentLabel: string | null;
}

interface TileEntry {
  tile: Tile;
  rect: TileRect;
  mesh: Mesh;
  top: MeshStandardMaterial;
  card: TileCard;
  spec: TileDrawSpec;
  buildings: Group;
  signature: string;
  buildingCount: number;
  lift: number;
  highlighted: boolean;

  assets: Promise<void>;
}

const SIDE_INDEX: Record<Side, number> = { bottom: 0, right: 1, top: 2, left: 3 };

const HOUSE = new BoxGeometry(0.13, 0.11, 0.13);
const HOTEL = new BoxGeometry(0.3, 0.16, 0.16);
const FLOOR = new BoxGeometry(0.26, 0.07, 0.14);
const sideMaterial = new MeshStandardMaterial({ color: 0x14141e, roughness: 0.7 });

const signatureOf = (o: TileOwnership | null) => (o ? `${o.color}|${o.buildings}|${o.mortgaged}|${o.monopoly}|${o.rentLabel ?? ''}` : '');

export class TileLayer {
  readonly group = new Group();
  private readonly entries = new Map<string, TileEntry>();
  private readonly byMesh = new Map<Mesh, TileEntry>();

  private readonly dirty = new Map<TileEntry, number>();
  private hovered: string | null = null;
  private viewer: Side = 'bottom';
  private readonly highlightColor: Color;

  constructor(board: BoardDefinition, layout: BoardLayout, accent: string) {
    this.highlightColor = new Color(accent);
    for (const rect of layout.tiles) {
      const tile = board.tiles[rect.index]!;
      const card = new TileCard(rect.corner);
      const spec: TileDrawSpec = {
        tile,
        group: 'groupId' in tile ? board.groups.find((g) => g.id === tile.groupId) : undefined,
        currency: board.currency,
        corner: rect.corner,
        accent,
        image: null,
        groupImage: null,
        icon: null,
        ownerColor: null,
        monopoly: false,
        rentLabel: null,
        mortgaged: false,
        notes: [],
      };
      card.draw(spec);

      const top = new MeshStandardMaterial({ map: card.texture, roughness: 0.55, metalness: 0.05 });
      const geometry = new BoxGeometry(rect.width - 0.03, TILE_HEIGHT, rect.depth - 0.03);
      const mesh = new Mesh(geometry, [sideMaterial, sideMaterial, top, sideMaterial, sideMaterial, sideMaterial]);
      mesh.position.copy(rect.center).setY(TILE_HEIGHT / 2);
      mesh.rotation.y = rect.rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const buildings = new Group();
      mesh.add(buildings);
      this.group.add(mesh);

      const artwork = tile.image
        ? loadImage(tile.image).then((img) => void (spec.image = img), () => undefined)
        : tile.icon
          ? loadIconNode(tile.icon).then((icon) => void (spec.icon = icon))
          : Promise.resolve();
      const flag = spec.group?.image ? loadImage(spec.group.image).then((img) => void (spec.groupImage = img), () => undefined) : Promise.resolve();
      const assets = Promise.all([artwork, flag]).then(() => undefined);
      const entry: TileEntry = { tile, rect, mesh, top, card, spec, buildings, signature: '', buildingCount: 0, lift: 0, highlighted: false, assets };
      this.entries.set(tile.id, entry);
      this.byMesh.set(mesh, entry);
    }
  }

  async loadAssets(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map(async (entry) => {
        await entry.assets;
        this.redraw(entry);
      }),
    );
  }

  rect(tileId: string): TileRect | undefined {
    return this.entries.get(tileId)?.rect;
  }

  setOwnership(tileId: string, ownership: TileOwnership | null, maxBuildings: number): void {
    const entry = this.entries.get(tileId);
    if (!entry) return;
    const signature = signatureOf(ownership);
    if (signature === entry.signature) return;
    entry.signature = signature;
    entry.spec.ownerColor = ownership?.color ?? null;
    entry.spec.monopoly = (ownership?.monopoly ?? false) && (ownership?.buildings ?? 0) === 0;
    entry.spec.rentLabel = ownership?.rentLabel ?? null;
    entry.spec.mortgaged = ownership?.mortgaged ?? false;
    this.redraw(entry);
    this.rebuildBuildings(entry, ownership, maxBuildings);
  }

  setNotes(tileId: string, notes: string[]): void {
    const entry = this.entries.get(tileId);
    if (!entry || entry.spec.notes.join('\n') === notes.join('\n')) return;
    entry.spec.notes = notes;
    this.redraw(entry);
  }

  private turnsFor(entry: TileEntry): number {
    return (SIDE_INDEX[entry.rect.side] - SIDE_INDEX[this.viewer] + 4) % 4;
  }

  setViewerSide(side: Side): void {
    if (side === this.viewer) return;
    this.viewer = side;
    for (const entry of this.entries.values()) this.redraw(entry);
  }

  private redraw(entry: TileEntry): void {
    entry.card.draw(entry.spec, this.turnsFor(entry));
    this.dirty.set(entry, 4);
  }

  private rebuildBuildings(entry: TileEntry, ownership: TileOwnership | null, maxBuildings: number): void {
    for (const child of entry.buildings.children.slice()) {
      entry.buildings.remove(child);
      ((child as Mesh).material as MeshStandardMaterial).dispose();
    }
    const count = ownership?.buildings ?? 0;
    entry.buildingCount = count;
    if (!ownership || count === 0) return;
    const material = new MeshStandardMaterial({ color: ownership.color, roughness: 0.4, metalness: 0.1 });
    const innerZ = -entry.rect.depth / 2 + 0.16;
    if (count >= maxBuildings) {
      const hotel = new Mesh(HOTEL, material);
      hotel.position.set(0, TILE_HEIGHT / 2 + 0.08, innerZ);
      hotel.castShadow = true;
      entry.buildings.add(hotel);
      for (let floor = 1; floor <= count - maxBuildings; floor++) {
        const level = new Mesh(FLOOR, material);
        level.position.set(0, TILE_HEIGHT / 2 + 0.16 + (floor - 0.5) * 0.07, innerZ);
        level.castShadow = true;
        entry.buildings.add(level);
      }
      return;
    }
    const spacing = 0.19;
    const start = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const house = new Mesh(HOUSE, material);
      house.position.set(start + i * spacing, TILE_HEIGHT / 2 + 0.055, innerZ);
      house.castShadow = true;
      entry.buildings.add(house);
    }
  }

  setHover(tileId: string | null): void {
    this.hovered = tileId;
  }

  setHighlight(tileIds: string[]): void {
    const set = new Set(tileIds);
    for (const entry of this.entries.values()) {
      entry.highlighted = set.has(entry.tile.id);
      if (!entry.highlighted) entry.top.emissiveIntensity = 0;
    }
  }

  pick(raycaster: Raycaster): string | null {
    const hit = raycaster.intersectObjects(this.group.children, false)[0];
    return hit ? (this.byMesh.get(hit.object as Mesh)?.tile.id ?? null) : null;
  }

  update(now: number): void {
    for (const [entry, left] of this.dirty) {
      entry.card.texture.needsUpdate = true;
      if (left <= 1) this.dirty.delete(entry);
      else this.dirty.set(entry, left - 1);
    }

    const pulse = 0.22 + 0.13 * Math.sin(now / 350);
    for (const entry of this.entries.values()) {
      const target = entry.tile.id === this.hovered ? 0.05 : 0;
      entry.lift += (target - entry.lift) * 0.2;
      entry.mesh.position.y = TILE_HEIGHT / 2 + entry.lift;
      if (entry.highlighted) {
        entry.top.emissive.copy(this.highlightColor);
        entry.top.emissiveIntensity = pulse;
      } else if (entry.tile.id === this.hovered) {
        entry.top.emissive.set(0xffffff);
        entry.top.emissiveIntensity = 0.08;
      } else {
        entry.top.emissiveIntensity = 0;
      }
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.mesh.geometry.dispose();
      entry.top.dispose();
      entry.card.dispose();
      for (const child of entry.buildings.children) ((child as Mesh).material as MeshStandardMaterial).dispose();
    }
    this.entries.clear();
    this.byMesh.clear();
    this.dirty.clear();
  }
}

export type { IconNode };
