import type { BoardDefinition, GameState, OwnableTile, Player, TradeOffer, TradeSide } from 'capi-core';
import { isOwnable } from 'capi-core';
import { ArrowRight, Check, Home, Landmark, Minus, Plus, Ticket, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { groupOf, money } from '../../lib/format';
import { useGame } from '../game/context';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const emptySide = (): TradeSide => ({ cash: 0, tileIds: [], jailCards: 0 });

const clampCash = (value: number, max: number) => Math.min(Math.max(0, max), Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));

function sanitizeSide(side: TradeSide, owner: Player, tradeable: Set<string>): TradeSide {
  return {
    cash: clampCash(side.cash, owner.cash),
    tileIds: side.tileIds.filter((id) => tradeable.has(id)),
    jailCards: Math.min(Math.max(0, Math.floor(side.jailCards)), owner.jailCards.length),
  };
}

function ownedTiles(board: BoardDefinition, state: GameState, ownerId: string): OwnableTile[] {
  return board.tiles.filter((t): t is OwnableTile => isOwnable(t) && state.properties[t.id]?.ownerId === ownerId);
}

function PlayerTag({ player, prefix }: { player: Player; prefix?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
      {prefix && <span className="font-normal text-muted">{prefix}</span>}
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.color }} />
      <span className="truncate">{player.name}</span>
    </span>
  );
}

function CashPicker({ owner, value, editable, onChange }: { owner: Player; value: number; editable: boolean; onChange: (cash: number) => void }) {
  const { board } = useGame();
  const max = Math.max(0, owner.cash);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  const commit = () => {
    onChange(clampCash(Number(draft.replace(/[^\d]/g, '')), max));
    setEditing(false);
  };
  const step = max >= 5000 ? 50 : max >= 1000 ? 10 : 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-11 items-end justify-between gap-3">
        {editing && editable ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <span className="text-3xl font-bold text-muted">{board.currency.symbol}</span>
            <input
              ref={input}
              className="field h-11 w-36 text-2xl font-bold tabular-nums"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              maxLength={9}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={commit}
              aria-label="Cantidad de dinero"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={!editable}
            className="rounded-lg text-3xl font-bold tracking-tight tabular-nums transition enabled:hover:bg-fill-2 enabled:hover:px-1.5 disabled:cursor-default"
            title={editable ? 'Clic para escribir la cantidad' : undefined}
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {money(board, value)}
          </button>
        )}
        <span className="text-xs text-muted tabular-nums">de {money(board, max)}</span>
      </div>
      <input
        type="range"
        className="w-full accent-accent disabled:opacity-50"
        min={0}
        max={max}
        step={step}
        value={Math.min(value, max)}
        disabled={!editable || max === 0}
        onChange={(e) => onChange(clampCash(Number(e.target.value), max))}
        aria-label="Dinero"
      />
    </div>
  );
}

function JailCardsPicker({ owner, value, editable, onChange }: { owner: Player; value: number; editable: boolean; onChange: (n: number) => void }) {
  const max = owner.jailCards.length;
  if (max === 0 && (!editable || value === 0)) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-fill px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <Ticket size={15} className="text-muted" /> Cartas de salida
        <span className="text-xs text-muted">tiene {max}</span>
      </span>
      {editable ? (
        <span className="flex items-center gap-1">
          <button type="button" className="btn btn-icon h-7 w-7" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos cartas">
            <Minus size={13} />
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">{value}</span>
          <button type="button" className="btn btn-icon h-7 w-7" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Más cartas">
            <Plus size={13} />
          </button>
        </span>
      ) : (
        <span className="font-semibold tabular-nums">{value}</span>
      )}
    </div>
  );
}

function PropertyRow({ tile, selected, editable, onToggle }: { tile: OwnableTile; selected: boolean; editable: boolean; onToggle?: () => void }) {
  const { board, state } = useGame();
  const own = state.properties[tile.id];
  const group = groupOf(board, tile.groupId);
  const blocked = (own?.buildings ?? 0) > 0;
  const content = (
    <>
      {tile.image ? (
        <img src={tile.image} alt="" className="h-9 w-12 shrink-0 rounded-md object-cover" style={{ borderBottom: `3px solid ${group?.color ?? 'transparent'}` }} loading="lazy" />
      ) : (
        <span className="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-fill-2" style={{ borderBottom: `3px solid ${group?.color ?? 'transparent'}` }}>
          <Icon name={tile.icon} size={16} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {tile.name}
          {own?.mortgaged && (
            <span className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
              <Landmark size={10} /> Hipotecada
            </span>
          )}
          {blocked && (
            <span className="inline-flex items-center gap-1 rounded-md bg-fill-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              <Home size={10} /> Con construcciones
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {group?.image ? <img src={group.image} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" /> : <span className="h-2 w-2 rounded-full" style={{ background: group?.color }} />}
          <span className="truncate">{group?.name ?? tile.type}</span>
          <span>·</span>
          <span className="tabular-nums">{money(board, tile.price)}</span>
        </span>
      </span>
      {editable && (
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${selected ? 'border-accent bg-accent text-white' : 'border-line'}`} aria-hidden>
          {selected && <Check size={13} />}
        </span>
      )}
    </>
  );
  if (!editable) return <li className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">{content}</li>;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        disabled={blocked}
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition enabled:hover:bg-fill-2 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'bg-accent/10' : ''}`}
      >
        {content}
      </button>
    </li>
  );
}

function SidePanel({ title, owner, side, editable, onChange }: { title: string; owner: Player; side: TradeSide; editable: boolean; onChange?: (side: TradeSide) => void }) {
  const { board, state } = useGame();
  const tiles = useMemo(() => ownedTiles(board, state, owner.id), [board, state, owner.id]);
  const listed = editable ? tiles : tiles.filter((t) => side.tileIds.includes(t.id));
  const toggle = (id: string) => onChange?.({ ...side, tileIds: side.tileIds.includes(id) ? side.tileIds.filter((x) => x !== id) : [...side.tileIds, id] });
  const empty = !editable && side.cash === 0 && side.tileIds.length === 0 && side.jailCards === 0;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl bg-fill p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</span>
        <PlayerTag player={owner} />
      </div>
      <CashPicker owner={owner} value={side.cash} editable={editable} onChange={(cash) => onChange?.({ ...side, cash })} />
      <JailCardsPicker owner={owner} value={side.jailCards} editable={editable} onChange={(jailCards) => onChange?.({ ...side, jailCards })} />
      <div className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs text-muted">
          <span>Propiedades</span>
          <span className="tabular-nums">
            {editable ? `${side.tileIds.length} de ${tiles.length}` : side.tileIds.length}
          </span>
        </span>
        {listed.length > 0 ? (
          <ul className="scrollbar-thin max-h-56 overflow-y-auto pr-1">
            {listed.map((tile) => (
              <PropertyRow key={tile.id} tile={tile} selected={side.tileIds.includes(tile.id)} editable={editable} onToggle={() => toggle(tile.id)} />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-xs text-muted">{editable ? 'Sin propiedades.' : empty ? 'No entrega nada.' : 'Ninguna propiedad.'}</p>
        )}
      </div>
    </section>
  );
}

function Compose({ withId, onClose }: { withId?: string; onClose: () => void }) {
  const { board, state, me, dispatch } = useGame();
  const others = state.players.filter((p) => p.id !== me?.id && !p.bankrupt && !p.spectator);
  const [toId, setToId] = useState(withId ?? '');
  const partner = others.find((p) => p.id === toId) ?? others[0];
  const [give, setGive] = useState<TradeSide>(emptySide);
  const [receive, setReceive] = useState<TradeSide>(emptySide);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReceive(emptySide());
  }, [partner?.id]);

  const safeGive = me ? sanitizeSide(give, me, new Set(ownedTiles(board, state, me.id).map((t) => t.id))) : give;
  const safeReceive = partner ? sanitizeSide(receive, partner, new Set(ownedTiles(board, state, partner.id).map((t) => t.id))) : receive;
  const nothing = safeGive.cash === 0 && safeGive.tileIds.length === 0 && safeGive.jailCards === 0 && safeReceive.cash === 0 && safeReceive.tileIds.length === 0 && safeReceive.jailCards === 0;

  if (!me || !partner) return <p className="text-sm text-muted">No hay nadie con quien negociar.</p>;

  const propose = () => {
    setBusy(true);
    void dispatch({ type: 'PROPOSE_TRADE', toId: partner.id, give: safeGive, receive: safeReceive })
      .then(onClose)
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Negociar con</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Con quién negociar">
          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === partner.id}
              onClick={() => setToId(p.id)}
              className={`pill inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition ${p.id === partner.id ? 'bg-accent text-white' : 'hover:bg-fill-2'}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SidePanel title="Ofreces" owner={me} side={safeGive} editable onChange={setGive} />
        <SidePanel title="Pides" owner={partner} side={safeReceive} editable onChange={setReceive} />
      </div>
      <button className="btn btn-primary h-11" disabled={busy || nothing} onClick={propose}>
        Proponer intercambio a {partner.name}
      </button>
    </>
  );
}

function View({ trade, onClose }: { trade: TradeOffer; onClose: () => void }) {
  const { board, state, me, dispatch } = useGame();
  const from = state.players.find((p) => p.id === trade.fromId);
  const to = state.players.find((p) => p.id === trade.toId);
  const [busy, setBusy] = useState(false);
  if (!from || !to) return <p className="text-sm text-muted">Este intercambio ya no está en curso.</p>;
  const isRecipient = me?.id === trade.toId;
  const isProposer = me?.id === trade.fromId;
  const run = (command: Parameters<typeof dispatch>[0]) => {
    setBusy(true);
    void dispatch(command)
      .then(onClose)
      .finally(() => setBusy(false));
  };
  const give = sanitizeSide(trade.give, from, new Set(ownedTiles(board, state, from.id).map((t) => t.id)));
  const receive = sanitizeSide(trade.receive, to, new Set(ownedTiles(board, state, to.id).map((t) => t.id)));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
        <PlayerTag player={from} prefix="Propone" />
        <ArrowRight size={14} className="text-muted" />
        <PlayerTag player={to} prefix="para" />
        {isRecipient && <span className="ml-auto rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">Para ti</span>}
        {isProposer && <span className="ml-auto rounded-md bg-fill-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">Tu propuesta</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SidePanel title={`${from.name} entrega`} owner={from} side={give} editable={false} />
        <SidePanel title={`${to.name} entrega`} owner={to} side={receive} editable={false} />
      </div>
      {isRecipient && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-primary h-11" disabled={busy} onClick={() => run({ type: 'ACCEPT_TRADE', tradeId: trade.id })}>
            <Check size={16} /> Aceptar intercambio
          </button>
          <button className="btn btn-danger h-11" disabled={busy} onClick={() => run({ type: 'DECLINE_TRADE', tradeId: trade.id })}>
            <X size={16} /> Rechazar
          </button>
        </div>
      )}
      {isProposer && (
        <button className="btn h-11" disabled={busy} onClick={() => run({ type: 'CANCEL_TRADE', tradeId: trade.id })}>
          <X size={16} /> Cancelar propuesta
        </button>
      )}
      {!isRecipient && !isProposer && <p className="text-center text-xs text-muted">Solo {to.name} puede aceptar o rechazar esta propuesta.</p>}
    </>
  );
}

export function TradeSheet({ open, withId, tradeId, onClose }: { open: boolean; withId?: string; tradeId?: string; onClose: () => void }) {
  const { state } = useGame();
  const trade = tradeId ? state.trades.find((t) => t.id === tradeId) : undefined;
  const title = tradeId ? 'Propuesta de intercambio' : 'Nuevo intercambio';
  return (
    <Sheet open={open} title={title} onClose={onClose} size="xl">
      {open && (tradeId ? trade ? <View trade={trade} onClose={onClose} /> : <p className="text-sm text-muted">Este intercambio ya no está en curso.</p> : <Compose withId={withId} onClose={onClose} />)}
    </Sheet>
  );
}
