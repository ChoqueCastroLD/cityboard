import type { BoardDefinition, GameMode, GameState } from 'capi-core';
import { Hourglass, ListOrdered, Lock, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBoards } from '../../hooks/useQueries';
import { Switch } from '../ui/Switch';

interface Props {
  board: BoardDefinition;
  state: GameState;
  isHost: boolean;
  onBoard: (boardId: string) => void;
  onMode: (mode: GameMode) => void;
  onCompetitive: (competitive: boolean) => void;
  presets?: ReactNode;
}

function Choice({
  active,
  disabled,
  onClick,
  title,
  subtitle,
  icon,
  image,
  accent,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon?: ReactNode;
  image?: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-14 items-start gap-2.5 rounded-xl border p-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
        active ? 'border-accent bg-accent/10' : 'border-transparent bg-surface enabled:hover:bg-fill-2 disabled:opacity-60'
      }`}
    >
      {image ? (
        <img src={image} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        accent && <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" style={{ background: accent }} aria-hidden />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-muted">{subtitle}</span>
      </span>
    </button>
  );
}

export function MatchSetup({ board, state, isHost, onBoard, onMode, onCompetitive, presets }: Props) {
  const boards = useBoards();
  const options = boards.data ?? [];
  const listed = options.some((b) => b.id === board.id)
    ? options
    : [{ id: board.id, name: board.name, description: board.description, tileCount: board.tiles.length, currency: board.currency, theme: board.theme, thumbnail: undefined }, ...options];

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl bg-fill p-4" aria-label="Partida">
      {!isHost && (
        <span className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
          <Lock size={12} /> Solo el anfitrión puede cambiar el tablero, el modo y las reglas.
        </span>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wider text-muted uppercase">Tablero</span>
        {boards.isError && (
          <p className="rounded-lg bg-danger/15 px-3 py-2 text-xs text-danger" role="alert">
            No se pudo cargar la lista de tableros.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2" data-testid="board-picker">
          {listed.map((b) => (
            <Choice
              key={b.id}
              active={b.id === board.id}
              disabled={!isHost}
              onClick={() => b.id !== board.id && onBoard(b.id)}
              image={b.thumbnail}
              accent={b.theme?.background ?? b.theme?.accent ?? 'rgba(255,255,255,0.1)'}
              title={b.name}
              subtitle={`${b.tileCount} casillas · ${b.currency.symbol}${b.description ? ` · ${b.description}` : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wider text-muted uppercase">Modo de juego</span>
        <div className="grid gap-2 sm:grid-cols-2" data-testid="mode-picker">
          <Choice
            active={state.mode === 'classic'}
            disabled={!isHost}
            onClick={() => state.mode !== 'classic' && onMode('classic')}
            icon={<ListOrdered size={14} />}
            title="Clásico"
            subtitle="Por turnos, uno después de otro."
          />
          <Choice
            active={state.mode === 'async'}
            disabled={!isHost}
            onClick={() => state.mode !== 'async' && onMode('async')}
            icon={<Hourglass size={14} />}
            title="Async"
            subtitle="Todos juegan a la vez; tras cada movimiento tu ficha espera su reloj de arena."
          />
        </div>
      </div>

      {presets && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-wider text-muted uppercase">Configuración rápida</span>
          {presets}
        </div>
      )}

      <label className={`flex items-start justify-between gap-4 rounded-xl bg-surface p-3 ${isHost ? '' : 'opacity-70'}`}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Trophy size={15} className="text-warn" /> Competitivo
          </span>
          <span className="text-[11px] leading-snug text-muted">
            De 4 a 6 jugadores con cuenta, reglas oficiales fijas, 2 h, sin entradas a media partida; el dinero final cuenta para el ranking.
          </span>
        </span>
        <Switch checked={state.rules.competitive} disabled={!isHost} label="Competitivo" onChange={onCompetitive} />
      </label>
    </section>
  );
}
