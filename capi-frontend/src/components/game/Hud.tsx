import { Check, Copy, Hourglass, ListOrdered, LogOut, Settings2, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import type { SceneBackend } from '../../three/types';
import { Sheet } from '../ui/Sheet';
import { CameraModeButton } from './CameraModeButton';
import { useGame } from './context';

const FIVE_MINUTES = 5 * 60_000;

function LeaveConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { leave, client, me, state } = useGame();
  const [busy, setBusy] = useState(false);
  const seated = !!me && !me.spectator && !me.bankrupt && state.phase === 'playing';
  const confirm = () => {
    if (!seated) return leave();
    setBusy(true);
    void client
      .dispatch({ type: 'LEAVE' })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
        leave();
      });
  };
  return (
    <Sheet open={open} title="¿Salir de la partida?" onClose={onClose}>
      {seated ? (
        <p className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">
          Salir de la partida hará que te declares en bancarrota: perderás tus propiedades y tu dinero, y la partida seguirá sin ti.
        </p>
      ) : (
        <p className="text-sm text-muted">Puedes volver a entrar más tarde con el código de la sala.</p>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn h-10 px-4" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-danger h-10 px-4" disabled={busy} onClick={confirm}>
          {seated ? 'Salir y declararme en bancarrota' : 'Salir'}
        </button>
      </div>
    </Sheet>
  );
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Countdown() {
  const { state, now } = useGame();
  if (state.endsAt === null || state.phase !== 'playing') return null;
  const left = state.endsAt - now;
  return (
    <span
      className={`pill inline-flex items-center gap-1 px-2 py-0.5 font-mono text-xs tabular-nums ${left < FIVE_MINUTES ? 'text-danger' : 'text-ink'}`}
      title="Tiempo restante de la partida"
      aria-live="off"
    >
      <Timer size={12} /> {clock(left)}
    </span>
  );
}

export function Hud({ backend }: { backend: SceneBackend | null }) {
  const { board, state, client, openDialog, cameraMode, setCameraMode } = useGame();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const online = client.myPlayerId !== null;

  const copy = () =>
    navigator.clipboard?.writeText(state.id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });

  return (
    <>
      <div className="pointer-events-none fixed top-[calc(0.75rem+var(--safe-top))] left-[calc(0.75rem+var(--safe-left))] z-20 flex h-9 max-w-[52vw] flex-nowrap items-center gap-2 overflow-hidden text-sm md:h-auto md:max-w-none md:flex-wrap">
        <span className="truncate font-display font-semibold tracking-tight drop-shadow">{board.name}</span>
        <span className="pill hidden items-center gap-1 px-2 py-0.5 text-xs text-muted sm:flex">
          {state.mode === 'async' ? <Hourglass size={12} /> : <ListOrdered size={12} />}
          {state.mode === 'async' ? 'Async' : 'Clásico'}
        </span>
        {state.rules.competitive && (
          <span className="pill hidden items-center gap-1 px-2 py-0.5 text-xs text-amber-300 sm:flex" title="Partida competitiva">
            <Trophy size={12} /> Competitivo
          </span>
        )}
        <Countdown />
        {backend && <span className="pill hidden px-2 py-0.5 text-[10px] tracking-wider text-muted uppercase md:inline">{backend}</span>}
        {online && <span className="h-2 w-2 shrink-0 rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]" title="En línea" />}
      </div>

      <div className="fixed top-[calc(0.75rem+var(--safe-top))] right-[calc(0.75rem+var(--safe-right))] z-20 flex items-center gap-2">
        {online && (
          <button className="btn hidden h-9 gap-1.5 px-3 font-mono text-xs tracking-[0.2em] sm:inline-flex" onClick={copy} title="Copiar código de sala">
            {state.id}
            {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
          </button>
        )}
        <button className="btn btn-icon h-9 w-9" onClick={() => openDialog({ kind: 'settings', tab: 'rules' })} aria-label="Ajustes" title="Ajustes">
          <Settings2 size={16} />
        </button>
        <CameraModeButton mode={cameraMode} onChange={setCameraMode} />
        <button className="btn btn-icon h-9 w-9" onClick={() => setLeaving(true)} aria-label="Salir" title="Salir">
          <LogOut size={16} />
        </button>
      </div>
      <LeaveConfirm open={leaving} onClose={() => setLeaving(false)} />
    </>
  );
}
