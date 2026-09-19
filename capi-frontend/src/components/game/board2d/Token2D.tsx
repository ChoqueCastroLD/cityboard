import { boardTokens, type BoardDefinition, type Player } from 'capi-core';
import { memo } from 'react';
import { Icon } from '../../ui/Icon';

interface Props {
  player: Player;
  board: BoardDefinition;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
  controlled: boolean;
  stepMs: number;
  hopKey: number;
  size: number;
  onClick: (playerId: string) => void;
  onHover: (playerId: string | null, at: { x: number; y: number } | null) => void;
  innerRef: (el: HTMLButtonElement | null) => void;
}

function contrast(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#ffffff';
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#111111' : '#ffffff';
}

export const Token2D = memo(function Token2D({ player, board, x, y, offsetX, offsetY, active, controlled, stepMs, hopKey, size, onClick, onHover, innerRef }: Props) {
  const option = boardTokens(board).find((t) => t.id === player.token);
  const ink = contrast(player.color);

  return (
    <button
      type="button"
      ref={innerRef}
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-md"
      style={{
        height: `${size}px`,
        width: `${size}px`,
        left: `${x}%`,
        top: `${y}%`,
        marginLeft: `${offsetX}%`,
        marginTop: `${offsetY}%`,
        backgroundColor: player.color,
        borderColor: controlled ? ink : 'rgba(0,0,0,0.25)',
        color: ink,
        opacity: player.bankrupt ? 0.35 : 1,
        transition: `left ${stepMs}ms linear, top ${stepMs}ms linear, margin-left 200ms ease, margin-top 200ms ease, box-shadow 200ms ease`,
        boxShadow: active ? `0 0 0 3px ${player.color}66, 0 2px 6px rgba(0,0,0,0.35)` : undefined,
      }}
      onClick={() => onClick(player.id)}
      onMouseEnter={(e) => onHover(player.id, { x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null, null)}
      aria-label={player.name}
      title={player.name}
    >
      <span key={hopKey} className="capi-hop grid place-items-center">
        <Icon name={option?.icon} size={Math.round(size * 0.55)} strokeWidth={2.5} />
      </span>
      {player.inJail && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger" aria-hidden />}
    </button>
  );
});
