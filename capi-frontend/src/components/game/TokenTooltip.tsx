import { getAvailableActions, isOwnable } from 'capi-core';
import { Building2, Coins, House, MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatMs, money } from '../../lib/format';
import type { ScreenPoint } from '../../three/types';
import { useGame } from './context';

export interface TokenHover {
  playerId: string;
  at: ScreenPoint;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted" title={label}>
      {icon}
      <span className="text-ink tabular-nums">{value}</span>
    </span>
  );
}

export function TokenTooltip({ hover }: { hover: TokenHover | null }) {
  const { board, state, now } = useGame();
  const player = hover ? state.players.find((p) => p.id === hover.playerId) : undefined;

  let status = 'Esperando';
  let owned = 0;
  let houses = 0;
  let hotels = 0;
  if (player) {
    const actions = getAvailableActions(board, state, player.id, now);
    if (player.bankrupt) status = 'En bancarrota';
    else if (state.mode === 'classic' && actions.isTurn) status = 'Su turno';
    else if (state.mode === 'async' && actions.isTurn) status = 'Puede jugar';
    else if (state.mode === 'async' && actions.cooldownRemainingMs > 0) status = `Reloj: ${formatMs(actions.cooldownRemainingMs)}`;
    for (const tile of board.tiles) {
      const own = isOwnable(tile) ? state.properties[tile.id] : undefined;
      if (!own || own.ownerId !== player.id) continue;
      owned += 1;
      if (own.buildings >= state.rules.maxBuildings) hotels += 1;
      else houses += own.buildings;
    }
  }

  return (
    <AnimatePresence>
      {hover && player && (
        <motion.div
          key="token-tooltip"
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          data-testid="token-tooltip"
          className="glass pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full px-3 py-2 text-xs whitespace-nowrap"
          style={{ left: hover.at.x, top: hover.at.y - 12 }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
            {player.name}
            <span className="font-normal text-muted">· {status}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-muted" title="Dinero">
              <Coins size={12} />
              <span className={`tabular-nums ${player.cash < 0 ? 'text-danger' : 'text-ink'}`}>{money(board, player.cash)}</span>
            </span>
            <Stat icon={<MapPin size={12} />} value={owned} label="Propiedades" />
            <Stat icon={<House size={12} />} value={houses} label="Casas" />
            <Stat icon={<Building2 size={12} />} value={hotels} label="Hoteles" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
