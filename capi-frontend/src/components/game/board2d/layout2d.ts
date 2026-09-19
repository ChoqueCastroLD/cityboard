import { type BoardDefinition, computeRingLayout, type Side } from 'capi-core';

const CORNER = 1.5;
const EDGE = 1.0;

export interface TileRect2D {
  index: number;
  id: string;
  side: Side;
  corner: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface BoardLayout2D {
  ratio: number;
  tiles: TileRect2D[];
  byId: Map<string, TileRect2D>;
  byIndex: Map<number, TileRect2D>;
  inner: { left: number; top: number; width: number; height: number };
}

function span(i: number, count: number, total: number): [number, number] {
  const start = -total / 2;
  if (i === 0) return [start, start + CORNER];
  if (i === count - 1) return [total / 2 - CORNER, total / 2];
  return [start + CORNER + (i - 1) * EDGE, start + CORNER + i * EDGE];
}

export function buildBoardLayout2D(board: BoardDefinition): BoardLayout2D {
  const ring = computeRingLayout(board.tiles.length);
  const width = 2 * CORNER + (ring.columns - 2) * EDGE;
  const depth = 2 * CORNER + (ring.rows - 2) * EDGE;

  const tiles = ring.cells.map((cell) => {
    const tile = board.tiles[cell.index]!;
    const [x0, x1] = span(cell.col, ring.columns, width);
    const [y0, y1] = span(cell.row, ring.rows, depth);
    const left = ((x0 + width / 2) / width) * 100;
    const top = ((y0 + depth / 2) / depth) * 100;
    const tileWidth = ((x1 - x0) / width) * 100;
    const tileHeight = ((y1 - y0) / depth) * 100;
    return {
      index: cell.index,
      id: tile.id,
      side: cell.side,
      corner: cell.corner,
      left,
      top,
      width: tileWidth,
      height: tileHeight,
      centerX: left + tileWidth / 2,
      centerY: top + tileHeight / 2,
    };
  });

  const innerLeft = (CORNER / width) * 100;
  const innerTop = (CORNER / depth) * 100;

  return {
    ratio: width / depth,
    tiles,
    byId: new Map(tiles.map((t) => [t.id, t])),
    byIndex: new Map(tiles.map((t) => [t.index, t])),
    inner: { left: innerLeft, top: innerTop, width: 100 - innerLeft * 2, height: 100 - innerTop * 2 },
  };
}

export function seatOffset(seat: number, seats: number): { x: number; y: number } {
  if (seats <= 1) return { x: 0, y: 0 };
  const columns = Math.min(3, Math.ceil(Math.sqrt(seats)));
  const rows = Math.ceil(seats / columns);
  const col = seat % columns;
  const row = Math.floor(seat / columns);
  return { x: (col - (columns - 1) / 2) * 34, y: (row - (rows - 1) / 2) * 34 };
}
