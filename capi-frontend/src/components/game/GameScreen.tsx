import { getAvailableActions } from 'capi-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameClient } from '../../client/GameClient';
import { useBoardTheme } from '../../hooks/useBoardTheme';
import { useGameState } from '../../hooks/useGameClient';
import { usePhone, useTouch } from '../../hooks/useMediaQuery';
import { useNow } from '../../hooks/useNow';
import { useVoice } from '../../hooks/useVoice';
import { useBoardView } from '../../lib/boardView';
import { presentation, presentationKey } from '../../lib/presentation';
import { guarded, PREMIUM_REQUIRED_EVENT } from '../../lib/toast';
import { visibility } from '../../lib/visibility';
import type { CameraMode, IBoardScene, SceneBackend } from '../../three/types';
import { CeoSheet } from '../account/CeoCard';
import { LoginSheet } from '../account/LoginSheet';
import { AuctionsSheet } from '../dialogs/AuctionsSheet';
import { LoanSheet } from '../dialogs/LoanSheet';
import { LogSheet } from '../dialogs/LogSheet';
import { SettingsSheet } from '../dialogs/SettingsSheet';
import { TileSheet } from '../dialogs/TileSheet';
import { TradeSheet } from '../dialogs/TradeSheet';
import { ChatPanel } from '../chat/ChatPanel';
import { Board2D } from './Board2D';
import { Board3D } from './Board3D';
import { BottomDock } from './BottomDock';
import { CardReveal, type CardRevealRequest } from './CardReveal';
import { DiceOverlay, type DiceRoll } from './DiceOverlay';
import { type DialogState, GameContext, type GameContextValue } from './context';
import { EventFeed } from './EventFeed';
import { EventHeadline } from './EventHeadline';
import { GameOver } from './GameOver';
import { Hud } from './Hud';
import { PlayerChips } from './PlayerChips';
import { type TileHover, TileTooltip } from './TileTooltip';
import { type TokenHover, TokenTooltip } from './TokenTooltip';

interface Props {
  client: GameClient;
  onLeave: () => void;
}

export function GameScreen({ client, onLeave }: Props) {
  const { board, state, log, presence, disconnectDeadlines } = useGameState(client);
  useBoardTheme(board.theme);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [backend, setBackend] = useState<SceneBackend | null>(null);
  const [boardView, setBoardView] = useBoardView();
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [hover, setHover] = useState<TokenHover | null>(null);
  const [tileHover, setTileHover] = useState<TileHover | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => (window.matchMedia('(max-width: 767px)').matches && client.myPlayerId ? 'player' : 'map'));
  const [ceo, setCeo] = useState(false);
  const [login, setLogin] = useState(false);
  useEffect(() => {
    const openCeo = () => setCeo(true);
    window.addEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
    return () => window.removeEventListener(PREMIUM_REQUIRED_EVENT, openCeo);
  }, []);
  const touch = useTouch() || usePhone();
  const [cardPeekSeed, setCardPeekSeed] = useState(1);
  useEffect(
    () =>
      client.subscribe((_next, events) => {
        const drawn = events.filter((e) => e.type === 'CARD_DRAWN').length;
        if (drawn > 0) setCardPeekSeed((seed) => seed + drawn);
      }),
    [client],
  );

  const [cardQueue, setCardQueue] = useState<CardRevealRequest[]>([]);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const diceRollId = useRef(0);
  const onDiceRoll = useCallback((playerId: string, dice: [number, number], settled: Promise<void>) => {
    const id = ++diceRollId.current;
    setDiceRoll({ id, playerId, dice, settled: false });
    void settled.then(() => setDiceRoll((current) => (current?.id === id ? { ...current, settled: true } : current)));
  }, []);
  const hideDice = useCallback((id: number) => setDiceRoll((current) => (current?.id === id ? null : current)), []);
  const cardReveal = cardQueue[0] ?? null;
  const cardQueueRef = useRef(cardQueue);
  cardQueueRef.current = cardQueue;
  const sceneRef = useRef<IBoardScene | null>(null);
  const projectPlayer = useCallback((playerId: string) => sceneRef.current?.projectPlayer(playerId) ?? null, []);
  const finishCard = useCallback((reveal: CardRevealRequest) => {
    reveal.resume();
    presentation.finish(presentationKey(reveal.event));
    setCardQueue((queue) => queue.filter((r) => r !== reveal));
  }, []);

  const voice = useVoice(client);
  const [catchUpId, setCatchUpId] = useState(0);
  useEffect(
    () =>
      visibility.onReturn((hiddenMs) => {
        if (!visibility.shouldSkipAnimations(hiddenMs)) return;
        presentation.flush();
        for (const reveal of cardQueueRef.current) reveal.resume();
        setCardQueue([]);
        setDiceRoll(null);
        sceneRef.current?.catchUp();
        setCatchUpId((id) => id + 1);
      }),
    [],
  );

  const controlledId = client.myPlayerId;

  const needsClock =
    state.phase === 'playing' &&
    (state.mode === 'async' || state.rules.afkTimeoutMs > 0 || state.endsAt !== null || disconnectDeadlines.size > 0 || state.auctions.some((a) => a.endsAt !== null));
  const now = useNow(needsClock || hover !== null);

  const me = state.players.find((p) => p.id === controlledId) ?? null;
  const actions = useMemo(
    () => (controlledId ? getAvailableActions(board, state, controlledId, now) : null),
    [board, state, controlledId, now],
  );
  const dispatch = useCallback<GameContextValue['dispatch']>((command) => guarded(client.dispatch(command)), [client]);
  const openDialog = useCallback((d: DialogState) => setDialog(d), []);
  const highlight = useMemo(() => actions?.buildable ?? [], [actions]);

  const value: GameContextValue = {
    client,
    board,
    state,
    log,
    presence,
    disconnectDeadlines,
    presenting: cardReveal !== null,
    cardPeekSeed,
    catchUpId,
    voice,
    cameraMode,
    setCameraMode,
    now,
    controlledId,
    me,
    actions,
    isHost: client.myPlayerId !== null && client.myPlayerId === state.hostId,
    dispatch,
    focusedPlayerId,
    focusPlayer: setFocusedPlayerId,
    openDialog,
    leave: onLeave,
  };

  return (
    <GameContext.Provider value={value}>
      <div className="relative h-full w-full overflow-hidden">
        {boardView === '3d' ? (
          <Board3D
            key={`3d-${board.id}`}
            client={client}
            board={board}
            now={now}
            controlledId={controlledId}
            highlight={highlight}
            focusTileId={dialog?.kind === 'tile' ? dialog.tileId : null}
            focusPlayerId={focusedPlayerId}
            cameraMode={cameraMode}
            onTileClick={(tileId) => setDialog({ kind: 'tile', tileId })}
            onTokenClick={(playerId) => setFocusedPlayerId((current) => (current === playerId ? null : playerId))}
            onTokenHover={(playerId, at) => setHover(playerId && at ? { playerId, at } : null)}
            onTileHover={(tileId, at) => setTileHover(tileId && at ? { tileId, at } : null)}
            onCardDrawn={(event, resume) => setCardQueue((queue) => [...queue, { event, resume }])}
            onDiceRoll={onDiceRoll}
            onScene={(scene) => (sceneRef.current = scene)}
            onReady={setBackend}
          />
        ) : (
          <Board2D
            key={`2d-${board.id}`}
            client={client}
            board={board}
            controlledId={controlledId}
            highlight={highlight}
            focusTileId={dialog?.kind === 'tile' ? dialog.tileId : null}
            focusPlayerId={focusedPlayerId}
            onTileClick={(tileId) => setDialog({ kind: 'tile', tileId })}
            onTokenClick={(playerId) => setFocusedPlayerId((current) => (current === playerId ? null : playerId))}
            onTokenHover={(playerId, at) => setHover(playerId && at ? { playerId, at } : null)}
            onTileHover={(tileId, at) => setTileHover(tileId && at ? { tileId, at } : null)}
            onCardDrawn={(event, resume) => setCardQueue((queue) => [...queue, { event, resume }])}
            onDiceRoll={onDiceRoll}
            onScene={(scene) => (sceneRef.current = scene)}
          />
        )}
        <TokenTooltip hover={touch || cardReveal ? null : hover} />
        <TileTooltip hover={touch || dialog || cardReveal ? null : tileHover} />
        <CardReveal reveal={cardReveal} project={projectPlayer} onDone={finishCard} />
        <DiceOverlay roll={diceRoll} onHidden={hideDice} />
        <EventHeadline />
        <Hud backend={boardView === '3d' ? backend : null} boardView={boardView} onBoardView={setBoardView} />
        <PlayerChips />
        <EventFeed />
        <BottomDock />
        <ChatPanel client={client} canWrite={!!me} tone="glass" raise />

        <TileSheet tileId={dialog?.kind === 'tile' ? dialog.tileId : null} onClose={() => setDialog(null)} />
        <TradeSheet
          open={dialog?.kind === 'trade' || dialog?.kind === 'trade-view'}
          withId={dialog?.kind === 'trade' ? dialog.withId : undefined}
          tradeId={dialog?.kind === 'trade-view' ? dialog.tradeId : undefined}
          onClose={() => setDialog(null)}
        />
        <LoanSheet open={dialog?.kind === 'loan'} onClose={() => setDialog(null)} />
        <SettingsSheet open={dialog?.kind === 'settings'} tab={dialog?.kind === 'settings' ? dialog.tab : 'rules'} onTab={(tab) => setDialog({ kind: 'settings', tab })} onClose={() => setDialog(null)} />
        <AuctionsSheet open={dialog?.kind === 'auctions'} onClose={() => setDialog(null)} />
        <LogSheet open={dialog?.kind === 'log'} onClose={() => setDialog(null)} />
        <CeoSheet open={ceo} onClose={() => setCeo(false)} onLogin={() => (setCeo(false), setLogin(true))} />
        <LoginSheet open={login} onClose={() => setLogin(false)} />
        {state.phase === 'finished' && <GameOver />}
      </div>
    </GameContext.Provider>
  );
}
