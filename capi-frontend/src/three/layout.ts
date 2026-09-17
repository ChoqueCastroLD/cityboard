import { type BoardDefinition, computeRingLayout, type Side } from 'capi-core';
import { Vector3 } from 'three';

export const CORNER = 1.5;
export const EDGE = 1.0;
export const TILE_HEIGHT = 0.06;

export interface TileRect {
  index: number;
  id: string;
  side: Side;
  corner: boolean;
  center: Vector3;

  rotationY: number;

  width: number;

  depth: number;

  inward: Vector3;
}

export interface BoardLayout {
  width: number;
  depth: number;
  tiles: TileRect[];
  byId: Map<string, TileRect>;

  innerHalfWidth: number;
  innerHalfDepth: number;
}

const ROTATION: Record<Side, number> = { bottom: 0, left: -Math.PI / 2, top: Math.PI, right: Math.PI / 2 };
const INWARD: Record<Side, Vector3> = {
  bottom: new Vector3(0, 0, -1),
  left: new Vector3(1, 0, 0),
  top: new Vector3(0, 0, 1),
  right: new Vector3(-1, 0, 0),
};

function span(i: number, count: number, total: number): [number, number] {
  const start = -total / 2;
  if (i === 0) return [start, start + CORNER];
  if (i === count - 1) return [total / 2 - CORNER, total / 2];
  return [start + CORNER + (i - 1) * EDGE, start + CORNER + i * EDGE];
}

export function buildBoardLayout(board: BoardDefinition): BoardLayout {
  const ring = computeRingLayout(board.tiles.length);
  const width = 2 * CORNER + (ring.columns - 2) * EDGE;
  const depth = 2 * CORNER + (ring.rows - 2) * EDGE;

  const tiles: TileRect[] = ring.cells.map((cell) => {
    const tile = board.tiles[cell.index]!;
    const [x0, x1] = span(cell.col, ring.columns, width);
    const [z0, z1] = span(cell.row, ring.rows, depth);
    const horizontal = cell.side === 'bottom' || cell.side === 'top';
    return {
      index: cell.index,
      id: tile.id,
      side: cell.side,
      corner: cell.corner,
      center: new Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2),
      rotationY: ROTATION[cell.side],
      width: cell.corner ? CORNER : horizontal ? x1 - x0 : z1 - z0,
      depth: cell.corner ? CORNER : horizontal ? z1 - z0 : x1 - x0,
      inward: INWARD[cell.side],
    };
  });

  return {
    width,
    depth,
    tiles,
    byId: new Map(tiles.map((t) => [t.id, t])),
    innerHalfWidth: width / 2 - CORNER,
    innerHalfDepth: depth / 2 - CORNER,
  };
}
