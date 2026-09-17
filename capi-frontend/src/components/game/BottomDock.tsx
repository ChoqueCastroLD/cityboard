import type { AvailableActions, TradeSide } from 'capi-core';
import { ArrowLeftRight, ArrowRight, ChevronsRight, Coins, Dices, Gavel, Landmark, Plus, ScrollText, ShoppingBag, Skull, Ticket, Timer, X } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { formatMs, money } from '../../lib/format';
import { ChatDockButton } from '../chat/ChatPanel';
import { useGame } from './context';
import { MicButton } from './MicButton';

function Primary({ icon, label, onClick, disabled, danger }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button className={`btn h-9 px-3 text-sm ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={disabled} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function Secondary({ icon, label, onClick, badge, className }: { icon: ReactNode; label: string; onClick: () => void; badge?: number; className?: string }) {
  return (
    <button className={`btn btn-icon relative h-9 w-9 text-muted ${className ?? ''}`} onClick={onClick} title={label} aria-label={label}>
      {icon}
      {!!badge && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function statusLine(actions: AvailableActions, ctx: ReturnType<typeof useGame>): string | null {
  const { state, me } = ctx;
  if (!me) return 'Espectador';
  if (state.mode === 'async' && actions.phase === 'idle' && actions.cooldownRemainingMs > 0) return `Reloj de arena: ${formatMs(actions.cooldownRemainingMs)}`;
  if (state.mode === 'classic' && !actions.isTurn) {
    const active = state.players.find((p) => p.id === state.activePlayerId);
    const left = active?.turn.deadline ? Math.max(0, active.turn.deadline - ctx.now) : null;
    return `Esperando a ${active?.name ?? '…'}${left !== null ? ` · ${formatMs(left)}` : ''}`;
  }
  if (state.mode === 'classic' && state.auctions.length > 0) return 'Subasta en curso';
  if (me.inJail && actions.phase === 'roll' && actions.isTurn) return `En la cárcel ${me.jailTurns}/${state.rules.maxJailTurns}: dobles, fianza o carta`;
  if (actions.pendingPurchase) {
    const tile = ctx.board.tiles.find((t) => t.id === actions.pendingPurchase);
    return tile && 'price' in tile ? `${tile.name} · ${money(ctx.board, tile.price)}` : null;
  }
  return null;
}

function PrimaryActions() {
  const ctx = useGame();
  const { actions, state, dispatch, board, presenting } = ctx;
  if (!actions) return <span className="px-1 text-sm text-muted">Espectador</span>;
  if (ctx.me?.spectator) return <span data-testid="dock-primary" className="px-1 text-sm text-muted">Estás mirando como espectador. El anfitrión puede sentarte en la partida.</span>;
  if (presenting) return <span data-testid="dock-primary" className="px-1 text-sm text-muted">Leyendo la carta…</span>;
  const buttons: ReactNode[] = [];
  if (actions.phase === 'roll' && actions.isTurn) {
    buttons.push(<Primary key="roll" icon={<Dices size={17} />} label="Tirar dados" disabled={!actions.canRoll} onClick={() => dispatch({ type: 'ROLL' })} />);
  }
  if (actions.canPayJailFine) buttons.push(<Primary key="fine" icon={<Coins size={17} />} label={`Fianza ${money(board, state.rules.jailFine)}`} onClick={() => dispatch({ type: 'PAY_JAIL_FINE' })} />);
  if (actions.canUseJailCard) buttons.push(<Primary key="card" icon={<Ticket size={17} />} label="Usar carta" onClick={() => dispatch({ type: 'USE_JAIL_CARD' })} />);
  if (actions.canBuy) buttons.push(<Primary key="buy" icon={<ShoppingBag size={17} />} label="Comprar" onClick={() => dispatch({ type: 'BUY' })} />);
  if (actions.canDecline) buttons.push(<Primary key="decline" icon={<X size={17} />} label="Rechazar" onClick={() => dispatch({ type: 'DECLINE' })} danger />);
  if (actions.phase === 'act' && actions.isTurn) {
    buttons.push(<Primary key="end" icon={<ChevronsRight size={17} />} label="Terminar turno" disabled={!actions.canEndTurn} onClick={() => dispatch({ type: 'END_TURN' })} />);
  }
  if (actions.canBankrupt) buttons.push(<Primary key="bankrupt" icon={<Skull size={17} />} label="Bancarrota" danger onClick={() => dispatch({ type: 'BANKRUPT' })} />);

  const status = statusLine(actions, ctx);
  if (buttons.length === 0) return <span data-testid="dock-primary" className="px-1 text-sm text-muted tabular-nums">{status ?? 'Sin acciones disponibles'}</span>;
  const autoIn = actions.autoplayInMs;
  return (
    <div data-testid="dock-primary" className="flex flex-wrap items-center gap-1.5" title={status ?? undefined}>
      {buttons}
      {autoIn !== null && (
        <span className={`flex items-center gap-1 px-1 text-xs tabular-nums ${autoIn <= 10_000 ? 'text-danger' : 'text-muted'}`} title="Si no respondes, el sistema jugará por ti">
          <Timer size={12} /> {Math.ceil(autoIn / 1000)} s
        </span>
      )}
    </div>
  );
}

function TradeOffers() {
  const { state, me, openDialog } = useGame();
  const incoming = me ? state.trades.filter((t) => t.toId === me.id) : [];
  const first = incoming[0];
  if (!first) return null;
  return (
    <motion.button
      type="button"
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      onClick={() => openDialog({ kind: 'trade-view', tradeId: first.id })}
      className="glass flex items-center gap-2 border-accent/50 bg-accent/15 px-3 py-1.5 text-xs transition hover:bg-accent/25"
    >
      <ArrowLeftRight size={14} />
      Tienes {incoming.length} {incoming.length === 1 ? 'oferta' : 'ofertas'} de intercambio · Ver
    </motion.button>
  );
}

function describeSide(board: ReturnType<typeof useGame>['board'], side: TradeSide): string {
  const parts = [side.cash > 0 ? money(board, side.cash) : null, side.tileIds.length > 0 ? `${side.tileIds.length} ${side.tileIds.length === 1 ? 'propiedad' : 'propiedades'}` : null, side.jailCards > 0 ? `${side.jailCards} ${side.jailCards === 1 ? 'carta' : 'cartas'}` : null];
  return parts.filter(Boolean).join(' + ') || 'nada';
}

function TradesMenu() {
  const { state, me, board, openDialog } = useGame();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapper, open, () => setOpen(false));
  const canTrade = state.rules.tradingEnabled && !!me && !me.spectator && !me.bankrupt && state.phase === 'playing';
  if (!state.rules.tradingEnabled) return null;
  const trades = state.trades;
  const pick = (dialog: Parameters<typeof openDialog>[0]) => {
    setOpen(false);
    openDialog(dialog);
  };
  return (
    <div className="relative" ref={wrapper}>
      <button
        className={`btn btn-icon relative h-9 w-9 ${open ? 'text-ink' : 'text-muted'}`}
        onClick={() => setOpen(!open)}
        title="Intercambios"
        aria-label="Intercambios"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ArrowLeftRight size={16} />
        {trades.length > 0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{trades.length}</span>}
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 bottom-full z-40 mb-1.5 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-0.5 p-1.5" style={{ background: 'rgba(14, 14, 30, 0.94)' }}>
          <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-muted">
            <span>Intercambios en curso</span>
            <span className="tabular-nums">{trades.length}</span>
          </div>
          {trades.length === 0 && <span className="px-2.5 pb-1.5 text-xs text-muted">No hay propuestas abiertas.</span>}
          {trades.map((t) => {
            const from = state.players.find((p) => p.id === t.fromId);
            const to = state.players.find((p) => p.id === t.toId);
            const mine = me?.id === t.toId ? 'Para ti' : me?.id === t.fromId ? 'Tuya' : null;
            return (
              <button key={t.id} role="menuitem" className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-fill-2" onClick={() => pick({ kind: 'trade-view', tradeId: t.id })}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: from?.color }} />
                  <span className="truncate font-semibold">{from?.name ?? '?'}</span>
                  <ArrowRight size={12} className="text-muted" />
                  <span className="h-2 w-2 rounded-full" style={{ background: to?.color }} />
                  <span className="truncate font-semibold">{to?.name ?? '?'}</span>
                  {mine && <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${mine === 'Para ti' ? 'bg-accent/20 text-accent' : 'bg-fill-2 text-muted'}`}>{mine}</span>}
                </span>
                <span className="truncate text-xs text-muted">
                  Da {describeSide(board, t.give)} · pide {describeSide(board, t.receive)}
                </span>
              </button>
            );
          })}
          {canTrade && (
            <>
              <div className="my-1 h-px bg-line" />
              <button role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-fill-2" onClick={() => pick({ kind: 'trade' })}>
                <Plus size={15} /> Nuevo intercambio
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SecondaryActions() {
  const { state, me, openDialog, client } = useGame();
  return (
    <div className="flex items-center gap-1">
      {state.rules.loansEnabled && me && !me.spectator && <Secondary icon={<Landmark size={16} />} label="Préstamo" onClick={() => openDialog({ kind: 'loan' })} />}
      {state.auctions.length > 0 && <Secondary icon={<Gavel size={16} />} label="Subastas" badge={state.auctions.length} onClick={() => openDialog({ kind: 'auctions' })} />}
      <MicButton />
      <TradesMenu />
      <ChatDockButton client={client} className="md:hidden" />
      <Secondary icon={<ScrollText size={16} />} label="Registro" className="lg:hidden short:inline-flex" onClick={() => openDialog({ kind: 'log' })} />
    </div>
  );
}

function DebtBanner() {
  const { board, actions } = useGame();
  if (!actions || actions.debt <= 0) return null;
  return (
    <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass border-danger/50 bg-danger/20 px-3 py-1.5 text-xs">
      Debes <strong>{money(board, actions.debt)}</strong> · puedes reunir {money(board, actions.liquidationValue)} vendiendo e hipotecando
    </motion.div>
  );
}

export function BottomDock() {
  return (
    <div className="fixed right-[calc(0.75rem+var(--safe-right))] bottom-[calc(0.75rem+var(--safe-bottom))] left-[calc(0.75rem+var(--safe-left))] z-20 flex flex-col items-stretch gap-1.5 md:left-auto md:items-end">
      <TradeOffers />
      <DebtBanner />
      <motion.div
        layout
        className="glass flex w-full flex-wrap items-center justify-between gap-2 p-1.5 md:w-auto md:flex-nowrap md:justify-start"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="min-w-0 flex-1">
          <PrimaryActions />
        </div>
        <div className="shrink-0">
          <SecondaryActions />
        </div>
      </motion.div>
    </div>
  );
}
