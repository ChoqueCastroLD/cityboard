import { Check, Eye, Hash, Hourglass, ListOrdered, type LucideIcon, Plus, Search, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PublicGameSummary } from '../../client/api';
import { Segmented, type SegmentOption } from '../ui/Segmented';

type Filter = 'all' | 'classic' | 'async' | 'competitive' | 'playing';

const FILTERS: SegmentOption<Filter>[] = [
  { id: 'all', label: 'Todas' },
  { id: 'classic', label: 'Clásico', Icon: ListOrdered },
  { id: 'async', label: 'Async', Icon: Hourglass },
  { id: 'competitive', label: 'Competitivo', Icon: Trophy },
  { id: 'playing', label: 'En curso', Icon: Eye },
];

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

interface Props {
  games: PublicGameSummary[];
  loading: boolean;
  error: boolean;
  hasAccount: boolean;
  busy: boolean;
  onJoin: (code: string) => void;
  onCreate: () => void;
  onLogin: () => void;
}

interface Action {
  label: string;
  Icon?: LucideIcon;
  primary?: boolean;
  disabled?: boolean;
  run: () => void;
}

function matches(game: PublicGameSummary, filter: Filter, onlyOpen: boolean, text: string): boolean {
  if (filter === 'classic' && game.mode !== 'classic') return false;
  if (filter === 'async' && game.mode !== 'async') return false;
  if (filter === 'competitive' && !game.competitive) return false;
  if (filter === 'playing' && game.phase !== 'playing') return false;
  if (onlyOpen && game.players >= game.maxPlayers) return false;
  if (!text) return true;
  const needle = text.toLowerCase();
  return game.id.toLowerCase().includes(needle) || game.boardName.toLowerCase().includes(needle) || (game.hostName?.toLowerCase().includes(needle) ?? false);
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-12 animate-pulse rounded-xl bg-fill" />
      ))}
    </ul>
  );
}

function Swatch({ color }: { color: string | null }) {
  return <span className="h-5 w-5 shrink-0 rounded-md" style={{ background: color ?? 'var(--accent)' }} aria-hidden />;
}

function ModeCell({ mode }: { mode: PublicGameSummary['mode'] }) {
  const Icon = mode === 'async' ? Hourglass : ListOrdered;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon size={13} className="text-muted" /> {mode === 'async' ? 'Async' : 'Clásico'}
    </span>
  );
}

function Competitive() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-warn" title="Competitivo · solo cuentas">
      <Trophy size={10} /> Competitivo
    </span>
  );
}

function ActionButton({ action, busy }: { action: Action; busy: boolean }) {
  return (
    <button className={`btn h-8 px-3.5 text-xs ${action.primary ? 'btn-primary' : ''}`} disabled={busy || action.disabled} onClick={action.run}>
      {action.Icon && <action.Icon size={13} />} {action.label}
    </button>
  );
}

export function GamesExplorer({ games, loading, error, hasAccount, busy, onJoin, onCreate, onLogin }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [text, setText] = useState('');

  const rows = useMemo(() => games.filter((g) => matches(g, filter, onlyOpen, text.trim())), [games, filter, onlyOpen, text]);
  const code = text.trim().toUpperCase();
  const codeLike = CODE_PATTERN.test(code);

  const actionFor = (game: PublicGameSummary): Action => {
    if (game.competitive && !hasAccount) return { label: 'Requiere cuenta', run: onLogin };
    if (game.phase === 'playing') {
      if (game.competitive) return { label: 'En curso', disabled: true, run: () => undefined };
      return { label: 'Ver partida', Icon: Eye, run: () => onJoin(game.id) };
    }
    if (game.players >= game.maxPlayers) return { label: 'Llena', disabled: true, run: () => undefined };
    return { label: 'Unirse', primary: true, run: () => onJoin(game.id) };
  };

  const headers = ['Código', 'Tablero', 'Modo', 'Reglas', 'Anfitrión', 'Jugadores', ''];

  return (
    <section className="flex min-w-0 flex-col gap-4 md:min-h-0" aria-labelledby="explorer-title">
      <h2 id="explorer-title" className="sr-only">
        Lista de mesas
      </h2>
      <form
        className="flex flex-wrap items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (codeLike) onJoin(code);
        }}
      >
        <label className="field flex h-10 w-full items-center gap-2 px-3 sm:w-60">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            value={text}
            maxLength={24}
            onChange={(e) => setText(e.target.value)}
            placeholder="Código o nombre de tablero"
            aria-label="Buscar por código, tablero o anfitrión"
          />
        </label>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Filtrar mesas" />
        <button
          type="button"
          className={`ml-auto inline-flex h-8 items-center gap-1.5 text-xs font-medium whitespace-nowrap transition ${onlyOpen ? 'text-accent' : 'text-muted hover:text-ink'}`}
          aria-pressed={onlyOpen}
          onClick={() => setOnlyOpen(!onlyOpen)}
        >
          <span className="grid w-3.5 place-items-center">{onlyOpen && <Check size={13} />}</span> Solo con plazas
        </button>
      </form>

      {error && <p className="text-xs text-danger">No se pudo cargar la lista de mesas.</p>}
      {loading && <Skeleton />}

      {!loading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-fill px-4 py-12 text-center">
          <p className="text-sm text-muted">
            {codeLike ? `No hay ninguna mesa pública con el código ${code}.` : games.length === 0 ? 'No hay mesas abiertas ahora mismo.' : 'Ninguna mesa coincide con ese filtro.'}
          </p>
          {codeLike ? (
            <button className="btn btn-primary h-10 px-4" disabled={busy} onClick={() => onJoin(code)}>
              <Hash size={14} /> Entrar con el código {code}
            </button>
          ) : (
            games.length === 0 && (
              <button className="btn btn-primary h-10 px-4" disabled={busy} onClick={onCreate}>
                <Plus size={15} /> Crear la primera mesa
              </button>
            )
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="scrollbar-thin md:min-h-0 md:overflow-y-auto">
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="text-left text-xs font-medium text-muted">
                {headers.map((h, i) => (
                  <th key={i} className="border-b border-line px-2.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const action = actionFor(g);
                return (
                  <tr key={g.id} className="transition hover:bg-fill">
                    <td className="border-b border-line px-2.5 py-3 font-mono text-xs tracking-[0.2em]">{g.id}</td>
                    <td className="border-b border-line px-2.5 py-3">
                      <span className="flex items-center gap-2.5 font-semibold whitespace-nowrap">
                        <Swatch color={g.boardAccent} /> {g.boardName} {g.competitive && <Competitive />}
                      </span>
                    </td>
                    <td className="border-b border-line px-2.5 py-3">
                      <ModeCell mode={g.mode} />
                    </td>
                    <td className="border-b border-line px-2.5 py-3 whitespace-nowrap text-muted">{g.preset ?? 'Personalizadas'}</td>
                    <td className="border-b border-line px-2.5 py-3 whitespace-nowrap text-muted">{g.hostName ?? '—'}</td>
                    <td className="border-b border-line px-2.5 py-3 tabular-nums">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Users size={13} className="text-muted" /> {g.players} de {g.maxPlayers}
                        {g.phase === 'playing' && <span className="text-xs text-muted">· en curso</span>}
                      </span>
                    </td>
                    <td className="border-b border-line px-2.5 py-3 text-right whitespace-nowrap">
                      <ActionButton action={action} busy={busy} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="flex flex-col md:hidden">
            {rows.map((g) => {
              const action = actionFor(g);
              return (
                <li key={g.id} className="flex items-center gap-3 border-b border-line py-3">
                  <Swatch color={g.boardAccent} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {g.boardName} {g.competitive && <Competitive />}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                      <span className="font-mono tracking-[0.15em]">{g.id}</span>· <ModeCell mode={g.mode} />· {g.preset ?? 'Personalizadas'}
                      {g.hostName && ` · ${g.hostName}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-sm tabular-nums">
                    <Users size={13} className="text-muted" /> {g.players}/{g.maxPlayers}
                  </span>
                  <ActionButton action={action} busy={busy} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted">
        <Hash size={13} /> Las salas privadas no aparecen en la lista. Escribe su código en el buscador y pulsa Enter.
      </p>
    </section>
  );
}
