import type { BoardDefinition, GameState, Ownership, Tile } from 'capi-core';
import { memo } from 'react';
import { Icon } from '../../ui/Icon';
import type { TileRect2D } from './layout2d';

interface Props {
  tile: Tile;
  rect: TileRect2D;
  board: BoardDefinition;
  state: GameState;
  owner: Ownership | undefined;
  highlighted: boolean;
  focused: boolean;
  compact: boolean;
  onClick: (tileId: string) => void;
  onHover: (tileId: string | null, at: { x: number; y: number } | null) => void;
}

const BAND_SIDE: Record<TileRect2D['side'], string> = {
  bottom: 'right-0 bottom-0 left-0 h-[14%]',
  top: 'top-0 right-0 left-0 h-[14%]',
  left: 'top-0 bottom-0 left-0 w-[14%]',
  right: 'top-0 right-0 bottom-0 w-[14%]',
};

function ownable(tile: Tile): tile is Extract<Tile, { price: number }> {
  return tile.type === 'property' || tile.type === 'transport' || tile.type === 'utility';
}

function groupColor(board: BoardDefinition, tile: Tile): string | null {
  if (!ownable(tile)) return null;
  return board.groups.find((g) => g.id === tile.groupId)?.color ?? null;
}

export const Tile2D = memo(function Tile2D({ tile, rect, board, state, owner, highlighted, focused, compact, onClick, onHover }: Props) {
  const color = groupColor(board, tile);
  const ownerPlayer = owner ? state.players.find((p) => p.id === owner.ownerId) : undefined;
  const symbol = board.currency?.symbol ?? '$';
  const vertical = rect.side === 'left' || rect.side === 'right';

  return (
    <button
      type="button"
      className={`absolute flex flex-col items-center justify-center overflow-hidden border border-black/10 bg-[var(--tile-bg)] p-[2%] text-center transition-[box-shadow,transform] duration-200 dark:border-white/10 ${
        highlighted ? 'z-10 ring-2 ring-ok ring-inset' : ''
      } ${focused ? 'z-10 ring-2 ring-accent ring-inset' : ''}`}
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
        boxShadow: ownerPlayer ? `inset 0 0 0 3px ${ownerPlayer.color}` : undefined,
      }}
      onClick={() => onClick(tile.id)}
      onMouseEnter={(e) => onHover(tile.id, { x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => onHover(tile.id, { x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null, null)}
      aria-label={tile.name}
      title={tile.name}
    >
      {color && <span className={`absolute ${BAND_SIDE[rect.side]}`} style={{ backgroundColor: color }} aria-hidden />}

      <span className={`flex h-full w-full min-h-0 min-w-0 flex-col items-center justify-center gap-[2%] overflow-hidden ${vertical ? 'px-[6%] py-[14%]' : 'px-[4%] py-[15%]'}`}>
        {!compact &&
          (tile.image ? (
            <img
              src={tile.image}
              alt=""
              className={`shrink-0 rounded-[2px] ${vertical ? 'h-[26%] w-[86%] object-cover' : 'max-h-[44%] w-auto max-w-[82%] object-contain'}`}
              loading="lazy"
              draggable={false}
            />
          ) : (
            tile.icon && <Icon name={tile.icon} size={rect.corner ? 22 : 16} className="text-muted" />
          ))}
        <span
          className={`w-full shrink-0 overflow-hidden leading-[1.05] font-medium break-words hyphens-auto ${rect.corner ? 'text-[1.1em]' : 'text-[0.95em]'}`}
          style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: compact || vertical ? 2 : 3 }}
        >
          {tile.name}
        </span>
        {ownable(tile) && !compact && (
          <span className="shrink-0 font-mono text-[0.85em] text-muted tabular-nums">
            {symbol}
            {tile.price}
          </span>
        )}
      </span>

      {owner && owner.buildings > 0 && (
        <span className="absolute inset-x-0 bottom-[1px] flex justify-center gap-[2px]" aria-hidden>
          {Array.from({ length: Math.min(owner.buildings, 5) }, (_, i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-[1px] bg-ok" />
          ))}
        </span>
      )}

      {owner?.mortgaged && <span className="absolute inset-0 bg-black/45" aria-hidden />}
    </button>
  );
});
