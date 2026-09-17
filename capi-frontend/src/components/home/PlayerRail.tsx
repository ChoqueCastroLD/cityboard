import { Banknote, ChevronRight, Crown, Medal, Swords } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AccountUser, LeaderboardEntry } from '../../client/api';

const MEDAL = ['text-warn', 'text-muted', 'text-warn/70'];
const TOP = 5;

const cash = (n: number) => `$${Math.round(n).toLocaleString('es')}`;

interface Props {
  user: AccountUser | null;
  premium: boolean;
  savedRoom: string | null;
  byCash: LeaderboardEntry[];
  byWins: LeaderboardEntry[];
  loading: boolean;
  error: boolean;
  busy: boolean;
  onCeo: () => void;
  onResume: () => void;
}

function withMine(entries: LeaderboardEntry[], userId: string | null): { rows: LeaderboardEntry[]; mine: LeaderboardEntry | null } {
  const mine = userId ? (entries.find((e) => e.userId === userId) ?? null) : null;
  const top = entries.slice(0, TOP);
  return { rows: mine && !top.includes(mine) ? [...top, mine] : top, mine };
}

function Ranking({
  id,
  title,
  Icon,
  entries,
  mine,
  loading,
  error,
  empty,
  value,
}: {
  id: string;
  title: string;
  Icon: typeof Medal;
  entries: LeaderboardEntry[];
  mine: LeaderboardEntry | null;
  loading: boolean;
  error: boolean;
  empty: string;
  value: (entry: LeaderboardEntry) => ReactNode;
}) {
  return (
    <section className="flex flex-col" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 pb-1 text-base font-semibold">
        <Icon size={16} className="text-warn" /> {title}
      </h2>
      {loading && (
        <ul className="flex flex-col gap-2 py-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-8 animate-pulse rounded-lg bg-fill" />
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-danger">No se pudo cargar el ranking.</p>}
      {!loading && !error && entries.length === 0 && <p className="py-2 text-sm text-muted">{empty}</p>}
      {entries.length > 0 && (
        <ol className="flex flex-col">
          {entries.map((entry) => {
            const me = entry === mine;
            return (
              <li key={entry.userId} className={`flex items-center gap-2.5 border-b border-line py-2 text-sm ${me ? '-mx-2 rounded-lg bg-fill px-2' : ''}`}>
                <span className="grid w-5 place-items-center text-xs text-muted tabular-nums">
                  {entry.rank <= 3 ? <Medal size={15} className={MEDAL[entry.rank - 1]} aria-label={`Puesto ${entry.rank}`} /> : entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
                {me && <span className="text-xs text-muted">tú</span>}
                {value(entry)}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function PlayerRail({ user, premium, savedRoom, byCash, byWins, loading, error, busy, onCeo, onResume }: Props) {
  const userId = user?.id ?? null;
  const cashBoard = withMine(byCash, userId);
  const winsBoard = withMine(byWins, userId);
  const mine = cashBoard.mine;

  return (
    <div className="scrollbar-thin flex min-w-0 flex-col gap-6 md:min-h-0 md:overflow-y-auto">
      {savedRoom && (
        <button className="inline-flex items-center gap-1 self-start text-sm font-medium text-accent hover:underline disabled:opacity-50" disabled={busy} onClick={onResume}>
          Volver a la sala <span className="font-mono tracking-[0.15em]">{savedRoom}</span> <ChevronRight size={15} />
        </button>
      )}

      <Ranking
        id="ranking-wins"
        title="Victorias"
        Icon={Swords}
        entries={winsBoard.rows}
        mine={winsBoard.mine}
        loading={loading}
        error={error}
        empty="Aún no hay partidas competitivas."
        value={(entry) => (
          <span className="text-sm tabular-nums" title={`${entry.wins} victorias · ${entry.losses} derrotas`}>
            <span className="font-semibold text-ok">{entry.wins}</span>
            <span className="text-muted"> / </span>
            <span className="text-danger">{entry.losses}</span>
          </span>
        )}
      />

      <Ranking
        id="ranking-cash"
        title="Dinero"
        Icon={Banknote}
        entries={cashBoard.rows}
        mine={cashBoard.mine}
        loading={loading}
        error={error}
        empty="Aún no hay dinero acumulado."
        value={(entry) => <span className="font-semibold tabular-nums">{cash(entry.totalCash)}</span>}
      />
      <p className="-mt-3 text-xs text-muted">Solo partidas públicas competitivas y jugadores con cuenta. Victoria: acabar primero.</p>

      <button className="flex items-center gap-3 border-t border-line pt-4 text-left" onClick={onCeo}>
        <Crown size={18} className="shrink-0 text-warn" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">{premium ? 'Eres CEO' : 'CEO'}</span>
          <span className="truncate text-xs text-muted">{premium ? 'Gestiona tu suscripción' : '6 $ al mes · 6 fichas premium'}</span>
        </span>
        <span className="text-sm font-medium whitespace-nowrap text-accent">{premium ? 'Gestionar' : 'Hazte CEO'}</span>
      </button>
    </div>
  );
}
