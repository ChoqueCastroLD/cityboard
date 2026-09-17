import type { BoardDefinition, CommandBody, GameState, Player } from 'capi-core';
import { ArrowLeftRight, Check, Crown, FastForward, LocateFixed, Map, Pencil, UserPlus, UserX, Volume1, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import type { VoiceApi } from '../../hooks/useVoice';
import { formatMs } from '../../lib/format';
import { PREMIUM_REQUIRED_EVENT } from '../../lib/toast';
import { ColorPicker, TokenPicker } from './AppearancePickers';

export interface PlayerMenuProps {
  player: Player;
  board: BoardDefinition;
  state: GameState;
  meId: string | null;
  isHost: boolean;
  focused?: boolean;
  canTrade?: boolean;
  onFocus?: (playerId: string | null) => void;
  onTrade?: (playerId: string) => void;
  disconnectDeadline?: number | null;
  now?: number;
  voice?: VoiceApi | null;
  dispatch: (command: CommandBody) => Promise<void>;
  onClose: () => void;
  variant?: 'popover' | 'sheet';
}

function Item({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-fill-2 ${danger ? 'text-danger' : ''}`}
    >
      {icon}
      {label}
    </button>
  );
}

function NameEditor({ player, onSave }: { player: Player; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  if (!editing) return <Item icon={<Pencil size={15} />} label="Cambiar nombre" onClick={() => setEditing(true)} />;
  const save = () => {
    if (name.trim() && name.trim() !== player.name) onSave(name.trim());
    setEditing(false);
  };
  return (
    <form
      className="flex items-center gap-1.5 px-1 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input className="field h-8 flex-1 text-sm" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn-icon h-8 w-8" aria-label="Guardar nombre">
        <Check size={14} />
      </button>
    </form>
  );
}

export function PlayerMenu(props: PlayerMenuProps) {
  const { player, board, state, meId, isHost, focused, canTrade, onFocus, onTrade, disconnectDeadline = null, now = Date.now(), voice = null, dispatch, onClose, variant = 'popover' } = props;
  const peer = voice?.state.enabled && meId !== player.id ? (voice.state.peers[player.id] ?? null) : null;
  const [confirmKick, setConfirmKick] = useState(false);

  const isMe = meId === player.id;
  const seated = !player.spectator && !player.bankrupt;
  const playing = state.phase === 'playing';
  const run = (command: CommandBody) => void dispatch(command).finally(onClose);

  const items: ReactNode[] = [];
  if (onFocus && playing && seated) {
    items.push(
      focused ? (
        <Item key="overview" icon={<Map size={15} />} label="Vista general" onClick={() => (onFocus(null), onClose())} />
      ) : (
        <Item key="focus" icon={<LocateFixed size={15} />} label="Ver al jugador" onClick={() => (onFocus(player.id), onClose())} />
      ),
    );
  }
  if (onTrade && canTrade && seated && !isMe) {
    items.push(<Item key="trade" icon={<ArrowLeftRight size={15} />} label="Negociar" onClick={() => (onTrade(player.id), onClose())} />);
  }
  if (isHost && !isMe && seated && state.hostId !== player.id) {
    items.push(<Item key="host" icon={<Crown size={15} />} label="Hacer anfitrión" onClick={() => run({ type: 'TRANSFER_HOST', toId: player.id })} />);
  }
  const pending = playing && seated && player.turn.phase !== 'idle' && (state.mode === 'async' || state.activePlayerId === player.id);
  if (isHost && !isMe && pending) {
    items.push(<Item key="force" icon={<FastForward size={15} />} label="Forzar jugada" onClick={() => run({ type: 'FORCE_PLAY', targetId: player.id })} />);
  }
  if (isHost && player.spectator && playing) {
    items.push(<Item key="spawn" icon={<UserPlus size={15} />} label="Sentar en la partida" onClick={() => run({ type: 'SPAWN_PLAYER', targetId: player.id })} />);
  }
  if (isHost && !isMe && !player.bankrupt && state.hostId !== player.id) {
    items.push(
      <Item
        key="kick"
        icon={<UserX size={15} />}
        label={confirmKick ? '¿Confirmar expulsión?' : 'Expulsar'}
        danger
        onClick={() => (confirmKick ? run({ type: 'REMOVE_PLAYER', targetId: player.id }) : setConfirmKick(true))}
      />,
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        role="menu"
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.14 }}
        className={variant === 'sheet' ? 'flex w-full flex-col gap-0.5' : 'glass absolute top-full left-0 z-40 mt-1.5 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col gap-0.5 p-1.5'}
      >
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
          <span className="truncate font-semibold text-ink">{player.name}</span>
          {player.spectator && <span>· espectador</span>}
          {isMe && <span>· tú</span>}
        </div>
        {disconnectDeadline !== null && (
          <div className="mx-1 mb-1 flex items-center gap-2 rounded-lg bg-danger/15 px-2.5 py-2 text-xs text-danger">
            <WifiOff size={14} className="shrink-0" />
            <span>
              Desconectado. Bancarrota en <span className="font-semibold tabular-nums">{formatMs(disconnectDeadline - now)}</span> si no vuelve.
            </span>
          </div>
        )}
        {voice?.state.enabled && !isMe && !player.spectator && (
          <div className="mx-1 mb-1 flex flex-col gap-1.5 rounded-lg bg-fill px-2.5 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {peer?.speaking ? <Volume2 size={14} className="text-ok" /> : <Volume1 size={14} className="text-muted" />}
                {peer ? (peer.connected ? (peer.muted ? 'Silenciado' : peer.speaking ? 'Hablando' : 'Conectado por voz') : 'Conectando voz…') : 'Sin chat de voz'}
              </span>
              {peer && (
                <button type="button" className={`btn h-7 px-2.5 text-[11px] ${peer.muted ? 'btn-danger' : ''}`} onClick={() => voice.setPeerMuted(player.id, !peer.muted)} aria-pressed={peer.muted}>
                  {peer.muted ? <VolumeX size={12} /> : <Volume2 size={12} />} {peer.muted ? 'Activar' : 'Silenciar'}
                </button>
              )}
            </div>
            {peer && (
              <label className="flex items-center gap-2">
                <input type="range" className="w-full accent-accent" min={0} max={200} value={Math.round(peer.volume * 100)} disabled={peer.muted} onChange={(e) => voice.setPeerVolume(player.id, Number(e.target.value) / 100)} aria-label={`Volumen de ${player.name}`} />
                <span className="w-10 text-right tabular-nums">{Math.round(peer.volume * 100)} %</span>
              </label>
            )}
          </div>
        )}
        {items}
        {isMe && (
          <>
            {items.length > 0 && <div className="my-1 h-px bg-line" />}
            <NameEditor player={player} onSave={(name) => run({ type: 'UPDATE_PLAYER', name })} />
            <ColorPicker player={player} state={state} onPick={(color) => void dispatch({ type: 'UPDATE_PLAYER', color })} />
            <TokenPicker
              player={player}
              board={board}
              state={state}
              onPremiumLocked={() => window.dispatchEvent(new CustomEvent(PREMIUM_REQUIRED_EVENT))}
              onPick={(token) => void dispatch({ type: 'UPDATE_PLAYER', token })}
            />
          </>
        )}
        {items.length === 0 && !isMe && <span className="px-2.5 py-1.5 text-xs text-muted">Sin acciones disponibles.</span>}
      </motion.div>
    </AnimatePresence>
  );
}
