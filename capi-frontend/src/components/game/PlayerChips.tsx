import { getAvailableActions, type Player } from 'capi-core';
import { Crown, Eye, Landmark, Lock, MicOff, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { type CashDelta, useCashDeltas } from '../../hooks/useCashDeltas';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { formatMs, money, onColor, tokenIcon } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { useGame } from './context';
import { PlayerMenuHost } from './PlayerMenuHost';

const RADIUS = 13;
const CIRC = 2 * Math.PI * RADIUS;

function Avatar({ player, progress }: { player: Player; progress: number }) {
  const { board } = useGame();
  if (player.spectator) {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-muted">
        <Eye size={14} />
      </span>
    );
  }
  return (
    <span className="relative grid h-7 w-7 place-items-center">
      <svg className="absolute inset-0" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r={RADIUS} fill={player.color} opacity={player.bankrupt ? 0.3 : 0.9} />
        {progress > 0 && (
          <circle
            cx="14"
            cy="14"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="2"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 14 14)"
          />
        )}
      </svg>
      <Icon name={tokenIcon(board, player)} size={13} className="relative" strokeWidth={2.4} style={{ color: onColor(player.color) }} />
    </span>
  );
}

function CashFloats({ deltas, board }: { deltas: CashDelta[]; board: Parameters<typeof money>[0] }) {
  return (
    <div className="pointer-events-none absolute top-0 left-full ml-2 flex flex-col items-start max-md:top-auto max-md:bottom-full max-md:left-1/2 max-md:ml-0 max-md:mb-1 max-md:-translate-x-1/2">
      <AnimatePresence>
        {deltas.map((delta, i) => (
          <motion.span
            key={delta.id}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -6 - i * 14, scale: 1 }}
            exit={{ opacity: 0, y: -22 - i * 14, scale: 0.9 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`absolute rounded-md bg-black/55 px-1.5 py-0.5 text-sm font-bold whitespace-nowrap tabular-nums backdrop-blur-sm ${delta.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {delta.amount > 0 ? '+ ' : '- '}
            {money(board, Math.abs(delta.amount))}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Chip({ player, open, onToggle, onClose, deltas }: { player: Player; open: boolean; onToggle: () => void; onClose: () => void; deltas: CashDelta[] }) {
  const ctx = useGame();
  const { board, state, now, controlledId, focusedPlayerId, focusPlayer, presence, disconnectDeadlines, isHost, dispatch, openDialog, me, voice } = ctx;
  const peerVoice = voice?.state.enabled ? (player.id === controlledId ? { speaking: voice.state.speaking && !voice.state.muted, muted: voice.state.muted } : voice.state.peers[player.id]) : undefined;
  const actions = getAvailableActions(board, state, player.id, now);
  const canAct = actions.isTurn && state.phase === 'playing';
  const progress = state.mode === 'async' && !player.spectator && state.rules.asyncCooldownMs > 0 ? actions.cooldownRemainingMs / state.rules.asyncCooldownMs : 0;
  const controlled = controlledId === player.id;
  const focused = focusedPlayerId === player.id;
  const disconnected = presence !== null && !player.bankrupt && !presence.has(player.id);
  const deadline = disconnected ? (disconnectDeadlines.get(player.id) ?? null) : null;
  const canTrade = state.rules.tradingEnabled && !!me && !me.spectator && !me.bankrupt && state.phase === 'playing';
  const wrapper = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapper, open, onClose);

  return (
    <div className="relative shrink-0" ref={wrapper}>
      <motion.button
        layout
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={player.name}
        className={`pill flex h-9 cursor-pointer items-center gap-2 pr-3 pl-1 text-xs transition-shadow ${
          canAct ? 'shadow-[0_0_0_2px_var(--accent),0_0_16px_color-mix(in_oklab,var(--accent)_60%,transparent)]' : ''
        } ${controlled || focused ? 'outline outline-1 outline-white/40' : ''} ${player.bankrupt ? 'opacity-50' : ''} ${peerVoice?.speaking ? 'ring-2 ring-ok' : ''}`}
      >
        <Avatar player={player} progress={progress} />
        <span className={`flex max-w-[9rem] items-center gap-1 font-semibold ${player.bankrupt ? 'line-through decoration-2' : ''}`}>
          <span className="truncate">{player.name}</span>
          {peerVoice?.muted && <MicOff size={10} className="shrink-0 text-danger" aria-label="Silenciado" />}
          {state.hostId === player.id && <Crown size={10} className="shrink-0 text-amber-300" />}
          {player.inJail && <Lock size={10} className="shrink-0 text-muted" />}
          {player.loan > 0 && <Landmark size={10} className="shrink-0 text-muted" />}
          {disconnected && <WifiOff size={10} className="shrink-0 text-danger" aria-label="Desconectado" />}
        </span>
        {deadline !== null && (
          <span className="tabular-nums text-danger" title="Tiempo para volver antes de la bancarrota">
            {formatMs(deadline - now)}
          </span>
        )}
        {player.spectator ? (
          <span className="text-muted">Espectador</span>
        ) : player.bankrupt ? (
          <span className="text-muted line-through tabular-nums" title="Dinero con el que quedó en bancarrota">
            {money(board, player.finalCash ?? 0)}
          </span>
        ) : (
          <span className={`tabular-nums ${player.cash < 0 ? 'text-danger' : 'text-muted'}`}>{money(board, player.cash)}</span>
        )}
      </motion.button>
      <CashFloats deltas={deltas} board={board} />
      <PlayerMenuHost
        open={open}
        player={player}
        board={board}
        state={state}
        meId={controlledId}
        isHost={isHost}
        focused={focused}
        canTrade={canTrade}
        disconnectDeadline={deadline}
        now={now}
        voice={voice}
        onFocus={focusPlayer}
        onTrade={(withId) => openDialog({ kind: 'trade', withId })}
        dispatch={dispatch}
        onClose={onClose}
      />
    </div>
  );
}

export function PlayerChips() {
  const { state, catchUpId } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const deltas = useCashDeltas(state, catchUpId);
  const seated = state.order.map((id) => state.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const spectators = state.players.filter((p) => p.spectator);
  const players = [...seated, ...spectators];
  return (
    <div className="no-scrollbar pointer-events-auto fixed top-[calc(3.5rem+var(--safe-top))] right-0 left-0 z-30 flex gap-1.5 overflow-x-auto px-3 pt-1 pb-2 md:top-[calc(3rem+var(--safe-top))] md:right-auto md:left-[calc(0.75rem+var(--safe-left))] md:z-20 md:flex-col md:overflow-visible md:px-0 md:pt-0 md:pb-0 short:top-[calc(2.75rem+var(--safe-top))]">
      {players.map((p) => (
        <Chip
          key={p.id}
          player={p}
          open={openId === p.id}
          deltas={deltas.filter((d) => d.playerId === p.id)}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          onClose={() => setOpenId(null)}
        />
      ))}
    </div>
  );
}
