import { type BoardDefinition, boardTokens, type GameState, PLAYER_COLORS, type Player, takenColors, takenTokens } from 'capi-core';
import { Crown } from 'lucide-react';
import { useAccount } from '../../hooks/useAccount';
import { Icon } from '../ui/Icon';

function Taken() {
  return <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,transparent_44%,rgba(255,255,255,0.9)_44%,rgba(255,255,255,0.9)_56%,transparent_56%)]" />;
}

export function ColorPicker({ player, state, onPick, size = 'sm' }: { player: Player; state: GameState; onPick: (color: string) => void; size?: 'sm' | 'md' }) {
  const taken = takenColors(state.players, player.id);
  const swatch = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <div className="px-1 py-1">
      <span className="text-[11px] tracking-wide text-muted uppercase">Color</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {PLAYER_COLORS.map((color) => {
          const used = taken.has(color.toLowerCase());
          const current = player.color.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              disabled={used}
              title={used ? 'Ya elegido' : color}
              aria-label={used ? 'Color ya elegido' : `Color ${color}`}
              onClick={() => onPick(color)}
              className={`relative ${swatch} rounded-full border border-line transition disabled:cursor-not-allowed disabled:opacity-40 ${current ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:scale-110'}`}
              style={{ background: color }}
            >
              {used && <Taken />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TokenPicker({
  player,
  board,
  state,
  onPick,
  onPremiumLocked,
  size = 'sm',
}: {
  player: Player;
  board: BoardDefinition;
  state: GameState;
  onPick: (token: string) => void;
  onPremiumLocked?: () => void;
  size?: 'sm' | 'md';
}) {
  const { premium } = useAccount();
  const taken = takenTokens(state.players, player.id);
  const tokens = boardTokens(board);
  if (tokens.length === 0) return null;
  const iconSize = size === 'md' ? 20 : 16;
  return (
    <div className="px-1 py-1">
      <span className="text-[11px] tracking-wide text-muted uppercase">Ficha</span>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {tokens.map((token) => {
          const used = taken.has(token.id);
          const locked = !!token.premium && !premium;
          const current = player.token === token.id;
          const title = used ? 'Ya elegida' : locked ? 'Solo CEO' : token.label;
          return (
            <button
              key={token.id}
              type="button"
              disabled={used}
              aria-disabled={used || locked}
              title={title}
              onClick={() => (locked ? onPremiumLocked?.() : onPick(token.id))}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                current ? 'bg-fill-2 ring-1 ring-accent' : 'hover:bg-fill-2'
              } ${locked ? 'opacity-55' : ''}`}
            >
              <Icon name={token.icon} size={iconSize} />
              <span className="truncate">{token.label}</span>
              {token.premium && (
                <span className={`absolute top-0.5 right-0.5 rounded-full p-0.5 ${locked ? 'bg-fill-2 text-warn' : 'bg-warn text-black'}`} aria-label="Ficha CEO">
                  <Crown size={9} />
                </span>
              )}
              {used && <span className="pointer-events-none absolute inset-1 rounded-lg bg-[linear-gradient(135deg,transparent_47%,rgba(255,255,255,0.8)_47%,rgba(255,255,255,0.8)_53%,transparent_53%)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
