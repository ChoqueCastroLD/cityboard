import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RemoteGameClient } from '../client/RemoteGameClient';
import { session } from '../client/session';
import { AccountChip } from '../components/account/AccountChip';
import { CeoSheet } from '../components/account/CeoCard';
import { LoginSheet } from '../components/account/LoginSheet';
import { GamesExplorer } from '../components/home/GamesExplorer';
import { PlayerRail } from '../components/home/PlayerRail';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAccount } from '../hooks/useAccount';
import { useCleanTheme } from '../hooks/useCleanTheme';
import { useBoards, useLeaderboard, usePublicGames } from '../hooks/useQueries';
import { guestName } from '../lib/guestName';
import { ACCOUNT_REQUIRED_EVENT, guarded, PREMIUM_REQUIRED_EVENT } from '../lib/toast';

const prefetchRoom = () => void import('./RoomScreen');

export function HomeScreen() {
  useCleanTheme();
  const navigate = useNavigate();
  const account = useAccount();
  const boards = useBoards();
  const serverOk = boards.isSuccess;
  const publicGames = usePublicGames(serverOk);
  const leaderboard = useLeaderboard(serverOk);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [ceo, setCeo] = useState(false);

  const name = account.user ? account.user.name : guestName();
  const savedRoom = RemoteGameClient.savedSession();
  const games = publicGames.data ?? [];
  const seated = games.reduce((sum, g) => sum + g.players, 0);

  useEffect(() => {
    const openCeo = () => setCeo(true);
    const openLogin = () => setLogin(true);
    window.addEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
    window.addEventListener(ACCOUNT_REQUIRED_EVENT, openLogin);
    return () => {
      window.removeEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
      window.removeEventListener(ACCOUNT_REQUIRED_EVENT, openLogin);
    };
  }, []);

  useEffect(() => {
    const billing = new URLSearchParams(window.location.search).get('billing');
    if (!billing) return;
    if (billing === 'success') void account.refresh();
    window.history.replaceState(null, '', '/');
  }, [account]);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    void guarded(work()).finally(() => setBusy(false));
  };

  const createRoom = () =>
    run(async () => {
      const boardId = boards.data?.[0]?.id;
      if (!boardId) throw new Error('No hay tableros disponibles.');
      const client = await RemoteGameClient.create(boardId, 'classic', name);
      session.set(client);
      await navigate({ to: '/room/$code', params: { code: client.gameId } });
    });

  const joinRoom = (roomCode: string) =>
    run(async () => {
      const client = await RemoteGameClient.join(roomCode, name);
      session.set(client);
      await navigate({ to: '/room/$code', params: { code: client.gameId } });
    });

  const resume = () =>
    run(async () => {
      if (savedRoom) await navigate({ to: '/room/$code', params: { code: savedRoom.gameId } });
    });

  return (
    <div className="scrollbar-thin safe-x flex h-full flex-col items-center overflow-y-auto bg-surface text-ink pt-safe-top pb-safe-bottom md:justify-center md:overflow-hidden">
      <div className="flex w-full max-w-6xl flex-col gap-6 px-1 pt-5 pb-10 md:max-h-full md:min-h-0 md:gap-8 md:py-6">
        <header className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold tracking-tight">Capichan</span>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            <button className="btn btn-primary h-10 shrink-0 px-4" disabled={busy || !serverOk} onMouseEnter={prefetchRoom} onFocus={prefetchRoom} onClick={createRoom}>
              <Plus size={16} /> Crear sala
            </button>
            <AccountChip onLogin={() => setLogin(true)} onCeo={() => setCeo(true)} />
          </div>
        </header>

        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance md:text-4xl">Mesas abiertas</h1>
          {boards.isError ? (
            <p className="text-sm text-danger" role="alert">
              No se puede conectar con el servidor. Comprueba que la API esté en marcha e inténtalo de nuevo.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className={`h-2 w-2 rounded-full ${serverOk ? 'bg-ok' : 'bg-muted'}`} aria-hidden />
              {serverOk ? `${games.length} ${games.length === 1 ? 'mesa' : 'mesas'} · ${seated} ${seated === 1 ? 'jugador' : 'jugadores'} en línea · se actualiza sola` : 'Conectando con el servidor…'}
            </p>
          )}
        </div>

        <div className="grid gap-8 md:min-h-0 md:grid-cols-[minmax(0,1fr)_280px] md:gap-10">
          <GamesExplorer
            games={games}
            loading={serverOk && publicGames.isPending}
            error={publicGames.isError}
            hasAccount={!!account.user}
            busy={busy || !serverOk}
            onJoin={joinRoom}
            onCreate={createRoom}
            onLogin={() => setLogin(true)}
          />
          <PlayerRail
            user={account.user ?? null}
            premium={account.premium}
            savedRoom={savedRoom?.gameId ?? null}
            byCash={leaderboard.data?.entries ?? []}
            byWins={leaderboard.data?.wins ?? []}
            loading={serverOk && leaderboard.isPending}
            error={leaderboard.isError}
            busy={busy}
            onCeo={() => (account.user ? setCeo(true) : setLogin(true))}
            onResume={resume}
          />
        </div>
      </div>

      <LoginSheet open={login} onClose={() => setLogin(false)} />
      <CeoSheet open={ceo} onClose={() => setCeo(false)} onLogin={() => (setCeo(false), setLogin(true))} />
    </div>
  );
}
