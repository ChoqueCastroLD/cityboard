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
  bottom: 'right-0 bottom-0 left-0 h-[12%]',
  top: 'top-0 right-0 left-0 h-[12%]',
  left: 'top-0 bottom-0 left-0 w-[12%]',
  right: 'top-0 right-0 bottom-0 w-[12%]',
};

function ownable(tile: Tile): tile is Extract<Tile, { price: number }> {
  return tile.type === 'property' || tile.type === 'transport' || tile.type === 'utility';
}

export const Tile2D = memo(function Tile2D({ tile, rect, board, state, owner, highlighted, focused, compact, onClick, onHover }: Props) {
  const group = ownable(tile) ? board.groups.find((g) => g.id === tile.groupId) : undefined;
  const ownerPlayer = owner ? state.players.find((p) => p.id === owner.ownerId) : undefined;
  const symbol = board.currency?.symbol ?? '$';
  const landscape = rect.side === 'left' || rect.side === 'right';
  const hotel = !!owner && owner.buildings >= state.rules.maxBuildings;

  const media = tile.image ? (
    <img
      src={tile.image}
      alt=""
      className={`shrink-0 rounded-[0.15em] object-cover ${landscape ? 'h-[84%] w-[36%]' : 'h-[42%] w-full'}`}
      loading="lazy"
      draggable={false}
    />
  ) : tile.icon ? (
    <span className={`grid shrink-0 place-items-center text-accent ${landscape ? 'w-[30%]' : 'h-[36%] w-full'}`}>
      <Icon name={tile.icon} size={rect.corner ? 26 : 18} strokeWidth={1.75} />
    </span>
  ) : null;

  const label = (
    <span className={`flex min-h-0 min-w-0 flex-col justify-center gap-[0.1em] ${landscape ? 'flex-1 items-start text-left' : 'w-full items-center text-center'}`}>
      <span
        className={`w-full overflow-hidden leading-[1.05] font-semibold break-words hyphens-auto ${rect.corner ? 'text-[1.05em]' : 'text-[0.92em]'}`}
        style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: compact ? 2 : landscape ? 2 : 3 }}
      >
        {tile.name}
      </span>
      {ownable(tile) && !compact && (
        <span className={`flex w-full items-center gap-[0.25em] font-mono text-[0.8em] text-muted tabular-nums ${landscape ? '' : 'justify-center'}`}>
          {group?.image && (
            <img src={group.image} alt="" className="h-[0.8em] w-[1.2em] shrink-0 rounded-[0.1em] object-cover" loading="lazy" draggable={false} />
          )}
          <span>
            {symbol}
            {tile.price}
          </span>
        </span>
      )}
    </span>
  );

  return (
    <button
      type="button"
      className={`absolute flex items-center justify-center overflow-hidden border border-black/10 bg-[var(--tile-bg)] transition-[box-shadow] duration-200 dark:border-white/10 ${
        highlighted ? 'z-10 ring-2 ring-ok ring-inset' : ''
      } ${focused ? 'z-10 ring-2 ring-accent ring-inset' : ''}`}
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
        boxShadow: ownerPlayer ? `inset 0 0 0 0.25em ${ownerPlayer.color}` : undefined,
      }}
      onClick={() => onClick(tile.id)}
      onMouseEnter={(e) => onHover(tile.id, { x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null, null)}
      aria-label={tile.name}
      title={tile.name}
    >
      {group && <span className={`absolute ${BAND_SIDE[rect.side]}`} style={{ backgroundColor: group.color }} aria-hidden />}

      <span
        className={`flex h-full w-full min-h-0 min-w-0 items-center gap-[5%] ${
          landscape
            ? `flex-row py-[7%] ${rect.side === 'left' ? 'pr-[7%] pl-[16%]' : 'flex-row-reverse pr-[16%] pl-[7%]'}`
            : `flex-col justify-center px-[7%] ${rect.side === 'top' ? 'pt-[16%] pb-[7%]' : 'pt-[7%] pb-[16%]'}`
        }`}
      >
        {media}
        {label}
      </span>

      {owner && owner.buildings > 0 && (
        <span className="absolute inset-x-0 bottom-[0.15em] flex justify-center gap-[0.15em]" aria-hidden>
          {hotel ? (
            <span className="h-[0.35em] w-[1.1em] rounded-[0.08em] bg-warn" />
          ) : (
            Array.from({ length: owner.buildings }, (_, i) => <span key={i} className="h-[0.3em] w-[0.3em] rounded-[0.06em] bg-ok" />)
          )}
        </span>
      )}

      {owner?.mortgaged && <span className="absolute inset-0 bg-black/50" aria-hidden />}
    </button>
  );
});
