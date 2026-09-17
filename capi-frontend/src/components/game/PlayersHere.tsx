import type { Player, Tile } from 'capi-core';
import { useGame } from './context';

function statusOf(player: Player, tile: Tile): string {
  if (tile.type === 'jail') return player.inJail ? 'está detenido aquí' : 'está de visita';
  if (tile.type === 'start') return 'está en la salida';
  return 'está aquí';
}

export function PlayersHere({ tileId, size = 'sm' }: { tileId: string; size?: 'sm' | 'md' }) {
  const { board, state } = useGame();
  const index = board.tiles.findIndex((t) => t.id === tileId);
  const tile = board.tiles[index];
  if (!tile) return null;
  const here = state.players.filter((p) => p.position === index && !p.spectator && !p.bankrupt);
  if (here.length === 0) return null;
  const text = size === 'md' ? 'text-sm' : 'text-[11px]';
  return (
    <ul className={`space-y-0.5 pt-1 ${text}`}>
      {here.map((p) => (
        <li key={p.id} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span>
            <span className="font-medium">{p.name}</span> <span className="text-muted">{statusOf(p, tile)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
