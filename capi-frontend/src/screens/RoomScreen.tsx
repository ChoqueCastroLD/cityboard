import { useNavigate, useParams } from '@tanstack/react-router';
import type { BoardDefinition, GameState } from 'capi-core';
import { Home, LogIn, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { RemoteGameClient } from '../client/RemoteGameClient';
import { session } from '../client/session';
import { AccountChip } from '../components/account/AccountChip';
import { LoginSheet } from '../components/account/LoginSheet';
import { GameScreen } from '../components/game/GameScreen';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAccount } from '../hooks/useAccount';
import { useGameState } from '../hooks/useGameClient';
import { useRoom } from '../hooks/useQueries';
import { money } from '../lib/format';
import { guarded, toast } from '../lib/toast';
import { useCleanTheme } from '../hooks/useCleanTheme';
import { guestName } from '../lib/guestName';
import { LobbyScreen } from './LobbyScreen';

function Session({ client, onLeave }: { client: RemoteGameClient; onLeave: () => void }) {
  const { board, state } = useGameState(client);
  if (state.phase === 'lobby') return <LobbyScreen client={client} board={board} state={state} onLeave={onLeave} />;
  return <GameScreen client={client} onLeave={onLeave} />;
}

function FinishedRoom({ code, board, game, onHome }: { code: string; board: BoardDefinition; game: GameState; onHome: () => void }) {
  useCleanTheme();
  const standings = game.players
    .filter((p) => !p.spectator)
    .map((p) => ({ ...p, cash: p.bankrupt ? (p.finalCash ?? 0) : p.cash }))
    .sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.cash - a.cash);
  return (
    <div className="safe-x flex h-full items-center justify-center bg-surface text-ink pt-safe-top pb-safe-bottom">
      <motion.section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-fill p-6" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div>
          <h2 className="text-lg font-semibold">Sala {code}</h2>
          <p className="text-sm text-muted">{board.name} · partida terminada</p>
        </div>
        <ol className="flex flex-col gap-1.5">
          {standings.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i === 0 ? 'bg-accent/15' : 'bg-surface'}`}>
              <span className="w-5 text-center text-sm font-bold tabular-nums text-muted">{i + 1}</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-medium">
                {p.name}
                {i === 0 && <Trophy size={13} className="text-warn" />}
              </span>
              <span className={`text-sm tabular-nums text-muted ${p.bankrupt ? 'line-through' : ''}`} title={p.bankrupt ? 'En bancarrota' : undefined}>
                {money(board, p.cash)}
              </span>
            </li>
          ))}
        </ol>
        <button className="btn btn-primary h-11" onClick={onHome}>
          Volver al inicio
        </button>
      </motion.section>
    </div>
  );
}

function JoinForm({ code, onJoined, onHome }: { code: string; onJoined: (client: RemoteGameClient) => void; onHome: () => void }) {
  const room = useRoom(code);
  useCleanTheme();
  const account = useAccount();
  const [guest, setName] = useState(() => guestName());
  const name = account.user?.name ?? guest;
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const join = () => {
    setBusy(true);
    void guarded(RemoteGameClient.join(code, name.trim()).then(onJoined)).finally(() => setBusy(false));
  };
  if (room.data?.game.phase === 'finished') return <FinishedRoom code={code} board={room.data.board} game={room.data.game} onHome={onHome} />;
  const competitive = room.data?.game.rules.competitive ?? false;
  const needsAccount = competitive && !account.user;
  return (
    <div className="safe-x flex h-full flex-col bg-surface text-ink pt-safe-top pb-safe-bottom">
      <header className="flex w-full items-center gap-3 px-1 pt-5 md:pt-7">
        <button className="font-display text-2xl font-bold tracking-tight" onClick={onHome}>
          Capichan
        </button>
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <button className="btn h-10 px-4" onClick={onHome}>
            <Home size={16} /> Inicio
          </button>
          <AccountChip onLogin={() => setLogin(true)} onCeo={() => setLogin(true)} />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center py-6">
        <motion.form
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-fill p-6"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          <h2 className="text-lg font-semibold">Sala {code}</h2>
          {room.isError ? (
            <p className="text-sm text-danger">Esta sala no existe o el servidor no responde.</p>
          ) : (
            <p className="text-sm text-muted">
              {room.data ? `${room.data.board.name} · ${room.data.game.players.length} jugador(es)${competitive ? ' · competitiva' : ''}` : 'Buscando la sala…'}
            </p>
          )}
          {room.data?.game.phase === 'playing' && (
            <p className="text-xs text-accent">La partida ya empezó: entrarás como espectador hasta que el anfitrión te siente.</p>
          )}
          {needsAccount && (
            <div className="flex flex-col gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm">
              <span>Esta partida es competitiva: necesitas una cuenta para unirte.</span>
              <button type="button" className="btn h-9 self-start px-4" onClick={() => setLogin(true)}>
                <LogIn size={15} /> Iniciar sesión
              </button>
            </div>
          )}
          {account.user ? (
            <span className="field flex h-11 items-center bg-surface text-sm">{account.user.name}</span>
          ) : (
            <input className="field bg-surface" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" autoFocus />
          )}
          <button className="btn btn-primary h-11" type="submit" disabled={busy || !name.trim() || room.isError || needsAccount}>
            Unirse
          </button>
          <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={onHome}>
            Volver al inicio
          </button>
        </motion.form>
      </div>
      <LoginSheet open={login} onClose={() => setLogin(false)} />
    </div>
  );
}

export function RoomScreen() {
  const { code: rawCode } = useParams({ from: '/room/$code' });
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();
  const [client, setClient] = useState<RemoteGameClient | null>(() => {
    const current = session.get();
    return current instanceof RemoteGameClient && current.gameId === code ? current : null;
  });
  const [resuming, setResuming] = useState(() => !client && RemoteGameClient.savedSession()?.gameId === code);

  useEffect(() => {
    if (!resuming) return;
    void RemoteGameClient.resume().then((resumed) => {
      if (resumed) {
        session.set(resumed);
        setClient(resumed);
      } else {
        toast('No se pudo recuperar tu asiento; únete de nuevo.', 'info');
      }
      setResuming(false);
    });
  }, [resuming]);

  const leave = () => {
    if (client?.getState().phase === 'finished') RemoteGameClient.forget();
    session.clear();
    void navigate({ to: '/' });
  };

  if (resuming) return null;
  if (!client) {
    return (
      <JoinForm
        code={code}
        onHome={() => void navigate({ to: '/' })}
        onJoined={(joined) => {
          session.set(joined);
          setClient(joined);
        }}
      />
    );
  }
  return <Session client={client} onLeave={leave} />;
}
