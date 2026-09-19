import { computeRent, Ctx, isOwnable, mortgageValue, type Tile } from 'capi-core';
import { Building2, Gavel, House, Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { money } from '../../lib/format';
import type { ScreenPoint } from '../../three/types';
import { Icon } from '../ui/Icon';
import { CardPeek } from './CardPeek';
import { PlayersHere } from './PlayersHere';
import { useGame } from './context';

export interface TileHover {
  tileId: string;
  at: ScreenPoint;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'danger' | 'accent' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'accent' ? 'text-accent' : 'text-ink';
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums font-medium ${color}`}>{value}</span>
    </div>
  );
}

function specialSummary(tile: Tile): string | null {
  switch (tile.type) {
    case 'tax':
      return 'Impuesto';
    case 'card':
      return 'Roba una carta';
    case 'start':
      return 'Salida';
    case 'jail':
      return 'Cárcel';
    case 'go-to-jail':
      return 'Ve a la cárcel';
    case 'free':
      return 'Casilla libre';
    default:
      return null;
  }
}


export function TileTooltip({ hover }: { hover: TileHover | null }) {
  const { board, state, now } = useGame();
  const tile = hover ? board.tiles.find((t) => t.id === hover.tileId) : undefined;
  const ownable = tile && isOwnable(tile) ? tile : null;
  const group = ownable ? board.groups.find((g) => g.id === ownable.groupId) : undefined;
  const own = ownable ? state.properties[ownable.id] : undefined;
  const owner = own ? state.players.find((p) => p.id === own.ownerId) : undefined;
  const auction = ownable ? state.auctions.find((a) => a.tileId === ownable.id) : undefined;
  const isHotel = !!own && own.buildings >= state.rules.maxBuildings;

  let rent: number | null = null;
  if (ownable && own && owner && !own.mortgaged) {
    const ctx = new Ctx(board, state, now);
    rent = computeRent(ctx, ownable, owner.id, 7);
  }

  return (
    <AnimatePresence>
      {hover && tile && (
        <motion.div
          key="tile-tooltip"
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          data-testid="tile-tooltip"
          className="glass pointer-events-none absolute z-30 w-56 -translate-x-1/2 -translate-y-full overflow-hidden text-xs"
          style={{ left: hover.at.x, top: hover.at.y - 16 }}
        >
          {ownable?.image ? (
            <img src={ownable.image} alt="" className="h-20 w-full object-cover" />
          ) : (
            <div className="flex h-12 items-center justify-center text-accent">
              <Icon name={tile.icon} size={22} />
            </div>
          )}
          {group && <div className="h-1" style={{ background: group.color }} />}
          <div className="space-y-1 px-3 py-2">
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="truncate">{tile.name}</span>
              {group && (
                <span className="flex min-w-0 items-center gap-1 text-[10px] font-normal text-muted">
                  {group.image && <img src={group.image} alt="" className="h-3 w-[18px] rounded-sm border border-white/40 object-cover" />}
                  <span className="truncate">{group.name}</span>
                </span>
              )}
            </div>

            {ownable ? (
              <>
                <Row label="Precio" value={money(board, ownable.price)} />
                <Row
                  label="Dueño"
                  value={owner ? owner.name : 'Nadie'}
                  tone={owner ? undefined : 'muted'}
                />
                {own?.mortgaged ? (
                  <Row label="Estado" value="Hipotecada" tone="danger" />
                ) : owner ? (
                  <Row label="Renta actual" value={money(board, rent ?? 0)} tone="accent" />
                ) : (
                  <Row label="Hipoteca" value={money(board, mortgageValue(ownable))} />
                )}
                {own && ownable.type === 'property' && (
                  <div className="flex items-center gap-1 text-muted">
                    {isHotel ? <Building2 size={12} /> : <House size={12} />}
                    <span className="text-ink">{isHotel ? 'Hotel' : `${own.buildings} casa${own.buildings === 1 ? '' : 's'}`}</span>
                  </div>
                )}
                {auction && (
                  <div className="flex items-center gap-1 text-accent">
                    <Gavel size={12} />
                    <span>En subasta · puja {money(board, Math.max(auction.minBid, auction.highestBid))}</span>
                  </div>
                )}
                {own?.mortgaged && (
                  <div className="flex items-center gap-1 text-muted">
                    <Lock size={12} />
                    <span>No cobra renta</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <Row label="Tipo" value={specialSummary(tile) ?? tile.type} tone="muted" />
                {tile.type === 'tax' && <Row label="Importe" value={money(board, tile.amount)} tone="danger" />}
                {tile.type === 'card' && <CardPeek deckId={tile.deckId} />}
                {tile.type === 'start' && (
                  <>
                    <Row label="Al caer" value={money(board, state.rules.landStartBonus)} tone="accent" />
                    <Row label="Al pasar" value={money(board, state.rules.passStartBonus)} tone="accent" />
                  </>
                )}
                {tile.type === 'jail' && <Row label="Fianza" value={money(board, state.rules.jailFine)} />}
                {tile.description && <p className="pt-1 text-muted">{tile.description}</p>}
              </>
            )}
            <PlayersHere tileId={tile.id} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
