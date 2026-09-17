export type Side = 'bottom' | 'left' | 'top' | 'right';

export interface Cell {
  index: number;
  col: number;
  row: number;
  side: Side;
  corner: boolean;
}

export interface RingLayout {
  columns: number;
  rows: number;
  cells: Cell[];
}

export function computeRingLayout(tileCount: number): RingLayout {
  if (tileCount < 8 || tileCount % 2 !== 0) {
    throw new Error('tileCount must be an even number >= 8');
  }
  const inner = (tileCount - 4) / 2;
  const horizontal = Math.ceil(inner / 2);
  const vertical = inner - horizontal;
  const columns = horizontal + 2;
  const rows = vertical + 2;
  const maxCol = columns - 1;
  const maxRow = rows - 1;

  const cells: Cell[] = [];
  let index = 0;
  const push = (col: number, row: number, side: Side, corner: boolean) =>
    cells.push({ index: index++, col, row, side, corner });

  push(maxCol, maxRow, 'bottom', true);
  for (let c = maxCol - 1; c >= 1; c--) push(c, maxRow, 'bottom', false);
  push(0, maxRow, 'left', true);
  for (let r = maxRow - 1; r >= 1; r--) push(0, r, 'left', false);
  push(0, 0, 'top', true);
  for (let c = 1; c <= maxCol - 1; c++) push(c, 0, 'top', false);
  push(maxCol, 0, 'right', true);
  for (let r = 1; r <= maxRow - 1; r++) push(maxCol, r, 'right', false);

  return { columns, rows, cells };
}
