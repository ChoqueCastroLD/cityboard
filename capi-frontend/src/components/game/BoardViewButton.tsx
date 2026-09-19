import { Box, Grid2x2 } from 'lucide-react';
import type { BoardView } from '../../lib/boardView';

const LABEL: Record<BoardView, string> = {
  '2d': 'Tablero 2D · clic para ver en 3D',
  '3d': 'Tablero 3D · clic para ver en 2D',
};

export function BoardViewButton({ view, onChange }: { view: BoardView; onChange: (view: BoardView) => void }) {
  const next: BoardView = view === '3d' ? '2d' : '3d';
  return (
    <button type="button" onClick={() => onChange(next)} title={LABEL[view]} aria-label={LABEL[view]} className="btn btn-icon h-9 w-9">
      {view === '3d' ? <Box size={16} /> : <Grid2x2 size={16} />}
    </button>
  );
}
