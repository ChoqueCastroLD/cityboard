import type { AvailableActions, OwnableTile } from 'capi-core';
import { buildBlocker, computeRent, Ctx, HOTEL_FLOORS, isOwnable, mortgageValue, propertyRent } from 'capi-core';
import { Gavel, Hammer, HandCoins, Info, Landmark, Lock, ShoppingBag, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { translateError } from '../../lib/errors';
import { groupOf, money, playerName } from '../../lib/format';
import { CardPeek } from '../game/CardPeek';
import { PlayersHere } from '../game/PlayersHere';
import { useGame } from '../game/context';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';

type Tab = 'info' | 'actions';
const TABS = [
  { id: 'info' as const, label: 'Información', Icon: Info },
  { id: 'actions' as const, label: 'Estado y acciones', Icon: SlidersHorizontal },
];

function buildingLabel(level: number, maxBuildings: number): string {
  if (level === 0) return 'Sin construcciones';
  if (level < maxBuildings) return level === 1 ? '1 casa' : `${level} casas`;
  if (level === maxBuildings) return 'Hotel';
  const floors = level - maxBuildings;
  return `Hotel + ${floors} ${floors === 1 ? 'piso' : 'pisos'}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <strong className="tabular-nums">{value}</strong>
    </div>
  );
}

function RentTable({ tile }: { tile: OwnableTile }) {
  const { board, state } = useGame();
  const own = state.properties[tile.id];
  const rentNow = own && tile.type !== 'utility' ? computeRent(new Ctx(board, state, Date.now()), tile, own.ownerId, 0) : null;
  const levels = tile.type === 'property' ? state.rules.maxBuildings + (state.rules.hotelUpgrades ? HOTEL_FLOORS : 0) : 0;
  const rows =
    tile.type === 'property'
      ? Array.from({ length: levels + 1 }, (_, i) => ({ label: buildingLabel(i, state.rules.maxBuildings), value: money(board, propertyRent(tile, i, state.rules)), current: (own?.buildings ?? 0) === i }))
      : tile.type === 'transport'
        ? tile.rent.map((r, i) => ({ label: `${i + 1} en propiedad`, value: money(board, r), current: false }))
        : tile.multipliers.map((m, i) => ({ label: `${i + 1} en propiedad`, value: `${m} × dados`, current: false }));
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className={row.current ? 'font-semibold text-accent' : 'text-muted'}>
            <td className="py-0.5">{row.label}</td>
            <td className="py-0.5 text-right tabular-nums">{row.value}</td>
          </tr>
        ))}
        {rentNow !== null && (
          <tr className="border-t border-line font-semibold">
            <td className="pt-1">Renta actual</td>
            <td className="pt-1 text-right tabular-nums">{money(board, rentNow)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function TileSheet({ tileId, onClose }: { tileId: string | null; onClose: () => void }) {
  const { board, state, me, actions, dispatch } = useGame();
  const [minBid, setMinBid] = useState(0);
  const [tab, setTab] = useState<Tab>('info');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (tileId) setTab('info');
  }, [tileId]);
  const tile = tileId ? board.tiles.find((t) => t.id === tileId) : undefined;
  const own = tile ? state.properties[tile.id] : undefined;
  const group = tile && isOwnable(tile) ? groupOf(board, tile.groupId) : undefined;
  const mine = !!me && !!own && own.ownerId === me.id;
  const has = (list: keyof AvailableActions) => !!tile && !!actions && (actions[list] as string[]).includes(tile.id);
  const blocker = useMemo(
    () => (tile && me && mine && tile.type === 'property' ? buildBlocker(new Ctx(board, state, Date.now()), me.id, tile.id) : null),
    [board, state, me, mine, tile],
  );
  const stay = (command: Parameters<typeof dispatch>[0]) => {
    setBusy(true);
    void dispatch(command).finally(() => setBusy(false));
  };
  const leave = (command: Parameters<typeof dispatch>[0]) => {
    setBusy(true);
    void dispatch(command)
      .then(onClose)
      .finally(() => setBusy(false));
  };
  const nextLevel = own ? own.buildings + 1 : 1;
  const buildLabel = tile?.type === 'property' ? (nextLevel > state.rules.maxBuildings ? `Añadir piso (${nextLevel - state.rules.maxBuildings}/${HOTEL_FLOORS})` : nextLevel === state.rules.maxBuildings ? 'Construir hotel' : 'Construir casa') : 'Construir';

  const info = tile && (
    <div className="flex min-w-0 flex-col gap-3">
      {tile.image ? (
        <img src={tile.image} alt={tile.name} className="aspect-[16/10] w-full rounded-xl object-cover" style={{ borderBottom: `6px solid ${group?.color ?? 'transparent'}` }} />
      ) : (
        <div className="grid aspect-[16/7] w-full place-items-center rounded-xl bg-fill">
          <Icon name={tile.icon} size={44} className="text-accent" strokeWidth={1.6} />
        </div>
      )}
      {group && (
        <span className="inline-flex w-fit items-center gap-2 text-xs text-muted">
          {group.image ? <img src={group.image} alt="" className="h-4 w-6 rounded-sm border border-white/40 object-cover" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />}
          {group.name}
        </span>
      )}
      {tile.description && <p className="text-sm text-muted">{tile.description}</p>}
      {tile.type === 'tax' && <Row label="Impuesto" value={money(board, tile.amount)} />}
      {tile.type === 'card' && <CardPeek deckId={tile.deckId} size="md" />}
      {isOwnable(tile) && <RentTable tile={tile} />}
      <PlayersHere tileId={tile.id} size="md" />
    </div>
  );

  const status = tile && (
    <div className="flex min-w-0 flex-col gap-3">
      {isOwnable(tile) && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-fill p-3">
          <Row label="Precio" value={money(board, tile.price)} />
          <Row label="Hipoteca" value={money(board, mortgageValue(tile))} />
          {group?.houseCost && <Row label="Cada construcción" value={money(board, group.houseCost)} />}
          <Row label="Dueño" value={own ? playerName(state, own.ownerId) : 'Nadie'} />
          {tile.type === 'property' && own && <Row label="Construido" value={buildingLabel(own.buildings, state.rules.maxBuildings)} />}
          {own?.mortgaged && <p className="rounded-lg bg-warn/15 px-3 py-1.5 text-xs text-warn">Hipotecada: no cobra renta.</p>}
        </div>
      )}
      {!isOwnable(tile) && <p className="text-sm text-muted">Esta casilla no se puede comprar.</p>}

      {me && actions && (
        <div className="flex flex-wrap gap-2">
          {mine && tile.type === 'property' && (
            <button
              className="btn btn-primary"
              disabled={busy || blocker !== null}
              title={blocker ? translateError(blocker) : undefined}
              onClick={() => stay({ type: 'BUILD', tileId: tile.id })}
            >
              {blocker ? <Lock size={16} /> : <Hammer size={16} />} {buildLabel}
            </button>
          )}
          {has('sellable') && (
            <button className="btn" disabled={busy} onClick={() => stay({ type: 'SELL_BUILDING', tileId: tile.id })}>
              <HandCoins size={16} /> Vender construcción
            </button>
          )}
          {has('mortgageable') && (
            <button className="btn" disabled={busy} onClick={() => stay({ type: 'MORTGAGE', tileId: tile.id })}>
              <Landmark size={16} /> Hipotecar
            </button>
          )}
          {has('unmortgageable') && (
            <button className="btn" disabled={busy} onClick={() => stay({ type: 'UNMORTGAGE', tileId: tile.id })}>
              <Undo2 size={16} /> Levantar hipoteca
            </button>
          )}
          {has('purchasable') && isOwnable(tile) && (
            <button className="btn btn-primary" disabled={busy} onClick={() => leave({ type: 'BUY_OWNED', tileId: tile.id })}>
              <ShoppingBag size={16} /> Comprar por {money(board, Math.round(tile.price * state.rules.ownedPurchaseMultiplier))}
            </button>
          )}
          {has('auctionable') && (
            <div className="flex w-full items-center gap-2">
              <input className="field w-32" type="number" min={1} placeholder="Puja mínima" value={minBid || ''} onChange={(e) => setMinBid(Number(e.target.value))} />
              <button className="btn" disabled={busy || minBid < 1} onClick={() => leave({ type: 'START_AUCTION', tileId: tile.id, minBid })}>
                <Gavel size={16} /> Subastar
              </button>
            </div>
          )}
        </div>
      )}
      {mine && tile.type === 'property' && blocker && <p className="text-xs text-muted">{translateError(blocker)}</p>}
    </div>
  );

  return (
    <Sheet open={!!tile} title={tile?.name ?? ''} onClose={onClose} size="lg">
      {tile && (
        <>
          <Segmented options={TABS} value={tab} onChange={setTab} label="Sección" className="self-start md:hidden" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className={tab === 'info' ? 'contents' : 'hidden md:contents'}>{info}</div>
            <div className={tab === 'actions' ? 'contents' : 'hidden md:contents'}>{status}</div>
          </div>
        </>
      )}
    </Sheet>
  );
}
