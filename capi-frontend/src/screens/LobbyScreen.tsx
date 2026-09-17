import type { BoardDefinition, CommandBody, GameState, Player } from 'capi-core';
import { Check, Copy, Crown, Hourglass, LayoutGrid, Link2, ListOrdered, Loader2, LogIn, LogOut, SlidersHorizontal, Trophy, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GameClient } from '../client/GameClient';
import { CeoSheet } from '../components/account/CeoCard';
import { ChatPanel } from '../components/chat/ChatPanel';
import { LoginSheet } from '../components/account/LoginSheet';
import { RulePresets } from '../components/dialogs/RulePresets';
import { RulesEditor } from '../components/dialogs/RulesEditor';
import { ColorPicker, TokenPicker } from '../components/game/AppearancePickers';
import { MatchSetup } from '../components/game/MatchSetup';
import { PlayerMenuHost } from '../components/game/PlayerMenuHost';
import { Icon } from '../components/ui/Icon';
import { Segmented } from '../components/ui/Segmented';
import { Sheet } from '../components/ui/Sheet';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAccount } from '../hooks/useAccount';
import { useCleanTheme } from '../hooks/useCleanTheme';
import { useOutsideClose } from '../hooks/useOutsideClose';
import { onColor, tokenIcon } from '../lib/format';
import { rememberName } from '../lib/guestName';
import { guarded, PREMIUM_REQUIRED_EVENT } from '../lib/toast';

interface Props {
  client: GameClient;
  board: BoardDefinition;
  state: GameState;
  onLeave: () => void;
}

type Dispatch = (command: CommandBody) => Promise<void>;
type Tab = 'match' | 'rules';

const TABS = [
  { id: 'match' as const, label: 'Partida', Icon: LayoutGrid },
  { id: 'rules' as const, label: 'Ajustes', Icon: SlidersHorizontal },
];

function LobbyPlayer({
  player,
  client,
  state,
  isHost,
  open,
  onToggle,
  onClose,
  dispatch,
}: {
  player: Player;
  client: GameClient;
  state: GameState;
  isHost: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapper, open && client.myPlayerId !== player.id, onClose);
  const presence = client.getPresence();
  const offline = presence !== null && !presence.has(player.id);
  const isMe = client.myPlayerId === player.id;
  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-fill"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: player.color, boxShadow: isMe ? `0 0 0 2px var(--surface), 0 0 0 4px ${player.color}` : undefined }}>
          <Icon name={tokenIcon(client.board, player)} size={16} strokeWidth={2.4} style={{ color: onColor(player.color) }} />
        </span>
        <span className="flex flex-1 items-center gap-1.5 font-medium">
          {player.name}
          {state.hostId === player.id && <Crown size={12} className="text-warn" aria-label="Anfitrión" />}
          {isMe && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">Tú</span>}
          {offline && <WifiOff size={12} className="text-danger" aria-label="Desconectado" />}
        </span>
      </button>
      {!isMe && <PlayerMenuHost open={open} player={player} board={client.board} state={state} meId={client.myPlayerId} isHost={isHost} dispatch={dispatch} onClose={onClose} />}
    </div>
  );
}

function EditMeSheet({ me, client, state, open, onClose, dispatch, onPremiumLocked }: { me: Player; client: GameClient; state: GameState; open: boolean; onClose: () => void; dispatch: Dispatch; onPremiumLocked: () => void }) {
  const [name, setName] = useState(me.name);
  useEffect(() => {
    if (open) setName(me.name);
  }, [open, me.name]);
  const saveName = () => {
    const next = name.trim();
    if (!next || next === me.name) return;
    rememberName(next);
    void dispatch({ type: 'UPDATE_PLAYER', name: next });
  };
  return (
    <Sheet open={open} title="Tu jugador" onClose={onClose}>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          saveName();
        }}
      >
        <input className="field h-10 flex-1 bg-surface text-sm" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} onBlur={saveName} aria-label="Tu nombre" />
        <button type="submit" className="btn btn-icon h-10 w-10" aria-label="Guardar nombre">
          <Check size={15} />
        </button>
      </form>
      <ColorPicker player={me} state={state} size="md" onPick={(color) => void dispatch({ type: 'UPDATE_PLAYER', color })} />
      <TokenPicker player={me} board={client.board} state={state} size="md" onPremiumLocked={onPremiumLocked} onPick={(token) => void dispatch({ type: 'UPDATE_PLAYER', token })} />
    </Sheet>
  );
}

export function LobbyScreen({ client, board, state, onLeave }: Props) {
  useCleanTheme();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('match');
  const isHost = client.myPlayerId !== null && client.myPlayerId === state.hostId;
  const me = state.players.find((p) => p.id === client.myPlayerId) ?? null;
  const dispatch: Dispatch = (command) => guarded(client.dispatch(command));
  const account = useAccount();
  const [login, setLogin] = useState(false);
  const [ceo, setCeo] = useState(false);

  useEffect(() => {
    const openCeo = () => setCeo(true);
    window.addEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
    return () => window.removeEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
  }, []);

  const copy = () =>
    navigator.clipboard?.writeText(state.id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });

  const seated = state.order.length;
  const minimum = state.rules.competitive ? 4 : 2;
  const startControl = isHost ? (
    <button className="btn btn-primary h-10 min-w-[13.5rem] px-5" disabled={seated < minimum} onClick={() => dispatch({ type: 'START' })}>
      {seated < minimum ? `Esperando jugadores (${seated}/${minimum})` : 'Empezar partida'}
    </button>
  ) : (
    <span className="inline-flex h-10 items-center gap-2 rounded-full bg-fill px-4 text-sm text-muted">
      <Loader2 size={14} className="animate-spin" /> Esperando al anfitrión
    </span>
  );
  const inviteLink = `${window.location.origin}/room/${state.id}`;
  const share = () => {
    const done = () => {
      setShared(true);
      window.setTimeout(() => setShared(false), 1500);
    };
    if (navigator.share) {
      void navigator.share({ title: `Capi · sala ${state.id}`, text: `Únete a mi partida en Capi`, url: inviteLink }).then(done).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(inviteLink).then(done);
  };

  return (
    <div className="scrollbar-thin safe-x flex h-full flex-col items-center overflow-y-auto bg-surface text-ink pt-safe-top pb-safe-bottom md:justify-center md:overflow-hidden">
      <div className="flex w-full max-w-6xl min-w-0 flex-col gap-5 px-1 pt-5 pb-8 md:h-full md:min-h-0 md:gap-6 md:py-6">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight md:text-3xl">{board.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                {state.mode === 'async' ? <Hourglass size={13} /> : <ListOrdered size={13} />}
                {state.mode === 'async' ? 'Async' : 'Clásico'}
              </span>
              <span>·</span>
              <span>
                {seated} {seated === 1 ? 'jugador' : 'jugadores'} de {state.rules.maxPlayers}
              </span>
              {state.rules.competitive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn" title="De 4 a 6 jugadores con cuenta, reglas oficiales fijas, 2 horas">
                  <Trophy size={11} /> Competitivo
                </span>
              )}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <ThemeToggle />
            <button className="btn h-10 gap-3 px-4 font-mono text-base tracking-[0.25em]" onClick={copy} title="Copiar código de la sala">
              {state.id}
              {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} className="text-muted" />}
            </button>
            <button className="btn h-10 min-w-[9.5rem] px-4" onClick={share} title="Enviar enlace de invitación">
              {shared ? <Check size={16} className="text-ok" /> : <Link2 size={16} />} {shared ? 'Enlace copiado' : 'Enlace para unirse'}
            </button>
            {startControl}
            <button className="btn btn-icon h-10 w-10" onClick={onLeave} aria-label="Salir de la sala">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {state.rules.competitive && !account.user && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn/10 px-4 py-3 text-sm" role="alert">
            <span>Necesitas una cuenta para jugar competitivo.</span>
            <button className="btn h-9 px-4" onClick={() => setLogin(true)}>
              <LogIn size={15} /> Entrar
            </button>
          </div>
        )}

        <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
          <div className="flex min-h-0 flex-col gap-5">
            <section className="flex shrink-0 flex-col gap-1">
              <h2 className="flex items-center gap-2 pb-1 text-base font-semibold">
                Jugadores <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-muted tabular-nums">{state.players.length}</span>
              </h2>
              <ul className="flex flex-col">
                {state.players.map((p) => (
                  <li key={p.id} className="border-b border-line last:border-b-0">
                    <LobbyPlayer
                      player={p}
                      client={client}
                      state={state}
                      isHost={isHost}
                      open={openId === p.id}
                      onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                      onClose={() => setOpenId(null)}
                      dispatch={dispatch}
                    />
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-xs text-muted">Comparte el código o el enlace para que los demás se unan.</p>
            </section>
            <div className="min-h-0 flex-1">
              <ChatPanel client={client} canWrite={!!me} inline />
            </div>
            {me && <EditMeSheet me={me} client={client} state={state} open={openId === me.id} onClose={() => setOpenId(null)} dispatch={dispatch} onPremiumLocked={() => setCeo(true)} />}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <Segmented options={TABS} value={tab} onChange={setTab} label="Sección" size="md" className="self-start" />
            <div className="scrollbar-thin min-h-0 flex-1 md:overflow-y-auto">
            {tab === 'match' ? (
              <MatchSetup
                board={board}
                state={state}
                isHost={isHost}
                onBoard={(boardId) => void dispatch({ type: 'SET_BOARD', boardId })}
                onMode={(mode) => void dispatch({ type: 'SET_MODE', mode })}
                onCompetitive={(competitive) => void dispatch({ type: 'SET_RULES', rules: { competitive } })}
                presets={<RulePresets rules={state.rules} editable={isHost} onApply={(rules) => void dispatch({ type: 'SET_RULES', rules })} />}
              />
            ) : (
              <section className="flex min-h-full min-w-0 flex-col gap-3 rounded-2xl bg-fill p-4">
                <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">{isHost ? 'Puedes cambiar las reglas hasta empezar; después quedan fijadas.' : 'Solo el anfitrión puede cambiar las reglas; quedan fijadas al empezar.'}</p>
                <div className="min-w-0 overflow-x-hidden">
                  <RulePresets rules={state.rules} editable={isHost} onApply={(rules) => void dispatch({ type: 'SET_RULES', rules })} />
                  <RulesEditor rules={state.rules} mode={state.mode} editable={isHost} onChange={(rules) => void dispatch({ type: 'SET_RULES', rules })} />
                </div>
              </section>
            )}
            </div>
          </div>
        </div>
      </div>
      <LoginSheet open={login} onClose={() => setLogin(false)} />
      <CeoSheet open={ceo} onClose={() => setCeo(false)} onLogin={() => (setCeo(false), setLogin(true))} />
    </div>
  );
}
