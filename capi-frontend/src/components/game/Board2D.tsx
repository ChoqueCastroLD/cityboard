import type { BoardDefinition, GameEvent } from 'capi-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameClient } from '../../client/GameClient';
import { useGameState } from '../../hooks/useGameClient';
import type { CameraMode, CardDrawnEvent, IBoardScene, ScreenPoint } from '../../three/types';
import { Dice2D, type Throw2D } from './board2d/Dice2D';
import { buildBoardLayout2D, seatOffset } from './board2d/layout2d';
import { Tile2D } from './board2d/Tile2D';
import { Token2D } from './board2d/Token2D';
import { useViewport2d } from './board2d/useViewport2d';

const STEP_MS = 140;
const DICE_MS = 700;

interface Props {
  client: GameClient;
  board: BoardDefinition;
  controlledId: string | null;
  highlight: string[];
  focusTileId: string | null;
  focusPlayerId: string | null;
  cameraMode: CameraMode;
  onTileClick: (tileId: string) => void;
  onTokenClick: (playerId: string) => void;
  onTokenHover: (playerId: string | null, at: ScreenPoint | null) => void;
  onTileHover: (tileId: string | null, at: ScreenPoint | null) => void;
  onCardDrawn: (event: CardDrawnEvent, resume: () => void) => void;
  onDiceRoll: (playerId: string, dice: [number, number], settled: Promise<void>) => void;
  onScene: (scene: IBoardScene | null) => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function Board2D(props: Props) {
  const { client, board, controlledId, highlight, focusTileId, focusPlayerId, cameraMode } = props;
  const { state } = useGameState(client);
  const layout = useMemo(() => buildBoardLayout2D(board), [board]);
  const callbacks = useRef(props);
  callbacks.current = props;

  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(client.getState().players.map((p) => [p.id, p.position])),
  );
  const [stepping, setStepping] = useState<Record<string, boolean>>({});
  const [thrown, setThrown] = useState<Throw2D | null>(null);
  const throwId = useRef(0);
  const busy = useRef(new Set<string>());
  const queues = useRef(new Map<string, Promise<void>>());
  const resumes = useRef(new Set<() => void>());
  const skip = useRef(false);
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const available = frame.getBoundingClientRect();
      if (available.width === 0 || available.height === 0) return;
      const width = Math.min(available.width, available.height * layout.ratio);
      const next = { width, height: width / layout.ratio };
      boxRef.current = next;
      setBox(next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [layout.ratio]);

  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const boxRef = useRef<{ width: number; height: number } | null>(null);

  const { viewport, dragging, reset, centerOn, handlers, consumedClick } = useViewport2d(frameRef, useCallback(() => boxRef.current, []));

  const centerOnPlayer = useCallback(
    (playerId: string | null, minZoom?: number) => {
      if (!playerId) return;
      const index = positionsRef.current[playerId] ?? client.getState().players.find((p) => p.id === playerId)?.position;
      const rect = index === undefined ? undefined : layoutRef.current.byIndex.get(index);
      if (rect) centerOn(rect.centerX, rect.centerY, minZoom);
    },
    [centerOn, client],
  );

  const throwDice = useCallback(
    (playerId: string, dice: [number, number], settled: Promise<void>) => {
      const id = ++throwId.current;
      const player = client.getState().players.find((p) => p.id === playerId);
      const index = positionsRef.current[playerId] ?? player?.position ?? 0;
      const rect = layoutRef.current.byIndex.get(index);
      const size = boxRef.current;
      const fromX = rect && size ? ((rect.centerX - 50) / 100) * size.width : 0;
      const fromY = rect && size ? ((rect.centerY - 50) / 100) * size.height : 0;
      setThrown({ id, playerId, color: player?.color ?? '#ffffff', dice, fromX, fromY, settled: false });
      void settled.then(() => setThrown((current) => (current?.id === id ? { ...current, settled: true } : current)));
    },
    [client],
  );

  const place = useCallback((playerId: string, index: number) => {
    positionsRef.current = { ...positionsRef.current, [playerId]: index };
    setPositions((current) => (current[playerId] === index ? current : { ...current, [playerId]: index }));
  }, []);

  const enqueue = useCallback(
    (playerId: string, task: () => Promise<void>) => {
      busy.current.add(playerId);
      setStepping((current) => ({ ...current, [playerId]: true }));
      const previous = queues.current.get(playerId) ?? Promise.resolve();
      const next = previous
        .then(task)
        .catch(() => undefined)
        .then(() => {
          if (queues.current.get(playerId) !== next) return;
          busy.current.delete(playerId);
          setStepping((current) => ({ ...current, [playerId]: false }));
        });
      queues.current.set(playerId, next);
    },
    [],
  );

  const walk = useCallback(
    async (playerId: string, to: number) => {
      const count = board.tiles.length;
      if (skip.current) return place(playerId, to);
      let current = positionsRef.current[playerId] ?? client.getState().players.find((p) => p.id === playerId)?.position ?? 0;
      let guard = 0;
      while (current !== to && guard < count) {
        current = (current + 1) % count;
        guard += 1;
        place(playerId, current);
        if (skip.current) break;
        await sleep(STEP_MS);
      }
      place(playerId, to);
    },
    [board.tiles.length, client, place],
  );

  useEffect(() => {
    const scene: IBoardScene = {
      ready: Promise.resolve({ backend: 'webgl' as const }),
      setState: () => undefined,
      play: () => undefined,
      rollDice: () => Promise.resolve(),
      projectPlayer: (playerId: string): ScreenPoint | null => {
        const element = tokenRefs.current.get(playerId);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      },
      focusTile: (tileId: string | null) => {
        const rect = tileId ? layoutRef.current.byId.get(tileId) : undefined;
        if (rect) centerOn(rect.centerX, rect.centerY, 1.5);
      },
      focusPlayer: (playerId: string | null) => centerOnPlayer(playerId, 1.5),
      highlightTiles: () => undefined,
      setControlledPlayer: () => undefined,
      setCameraMode: () => undefined,
      catchUp: () => {
        skip.current = true;
        for (const resume of resumes.current) resume();
        resumes.current.clear();
        const settled = Object.fromEntries(client.getState().players.map((p) => [p.id, p.position]));
        positionsRef.current = settled;
        setPositions(settled);
        window.setTimeout(() => (skip.current = false), 0);
      },
      resize: () => undefined,
      dispose: () => undefined,
    };
    callbacks.current.onScene(scene);
    return () => callbacks.current.onScene(null);
  }, [client, centerOn, centerOnPlayer]);

  useEffect(() => {
    if (focusPlayerId) centerOnPlayer(focusPlayerId, 1.5);
  }, [focusPlayerId, centerOnPlayer]);

  useEffect(() => {
    const rect = focusTileId ? layout.byId.get(focusTileId) : undefined;
    if (rect) centerOn(rect.centerX, rect.centerY, 1.5);
  }, [focusTileId, layout, centerOn]);

  const followId = cameraMode === 'locked' ? null : cameraMode === 'player' ? controlledId : state.activePlayerId;
  const followIndex = followId ? positions[followId] : undefined;
  useEffect(() => {
    if (!followId || focusPlayerId || focusTileId) return;
    centerOnPlayer(followId);
  }, [followId, followIndex, focusPlayerId, focusTileId, centerOnPlayer]);

  useEffect(() => {
    const play = (events: GameEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case 'ROLLED': {
            const settled = sleep(DICE_MS);
            throwDice(event.playerId, event.dice, settled);
            enqueue(event.playerId, () => (skip.current ? Promise.resolve() : settled));
            break;
          }
          case 'MOVED':
            enqueue(event.playerId, () => walk(event.playerId, event.to));
            break;
          case 'CARD_DRAWN': {
            const drawn = event as CardDrawnEvent;
            enqueue(event.playerId, () =>
              skip.current
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    let done = false;
                    const resume = () => {
                      if (done) return;
                      done = true;
                      resumes.current.delete(resume);
                      resolve();
                    };
                    resumes.current.add(resume);
                    callbacks.current.onCardDrawn(drawn, resume);
                  }),
            );
            break;
          }
        }
      }
    };
    return client.subscribe((_next, events) => play(events));
  }, [client, enqueue, walk, throwDice]);

  useEffect(() => {
    setPositions((current) => {
      let changed = false;
      const next = { ...current };
      for (const player of state.players) {
        if (busy.current.has(player.id)) continue;
        if (next[player.id] === player.position) continue;
        next[player.id] = player.position;
        changed = true;
      }
      for (const id of Object.keys(next)) {
        if (state.players.some((p) => p.id === id)) continue;
        delete next[id];
        changed = true;
      }
      return changed ? next : current;
    });
  }, [state.players]);

  const seats = useMemo(() => {
    const perTile = new Map<number, string[]>();
    for (const player of state.players) {
      if (player.spectator) continue;
      const index = positions[player.id] ?? player.position;
      const list = perTile.get(index) ?? [];
      list.push(player.id);
      perTile.set(index, list);
    }
    return perTile;
  }, [positions, state.players]);

  const highlighted = useMemo(() => new Set(highlight), [highlight]);

  return (
    <div
      ref={frameRef}
      className={`absolute inset-2 flex touch-none items-center justify-center overflow-hidden sm:inset-4 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      {...handlers}
      onDoubleClick={reset}
    >
      <div
        className="relative rounded-2xl bg-[var(--board-bg)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={
          box
            ? {
                width: `${box.width}px`,
                height: `${box.height}px`,
                fontSize: `${Math.max(4.5, box.width / 92)}px`,
                transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
                transition: dragging ? 'none' : 'transform 120ms ease-out',
              }
            : { visibility: 'hidden', aspectRatio: String(layout.ratio), width: '100%' }
        }
      >
        <div
          className="absolute flex flex-col items-center justify-center gap-1 text-center"
          style={{ left: `${layout.inner.left}%`, top: `${layout.inner.top}%`, width: `${layout.inner.width}%`, height: `${layout.inner.height}%` }}
        >
          <span className="font-display text-xl font-bold tracking-tight opacity-70 sm:text-3xl">{board.name}</span>
          <span className="text-[0.6rem] tracking-[0.3em] text-muted uppercase sm:text-xs">{state.mode === 'async' ? 'Async' : 'Clásico'}</span>
        </div>

        <Dice2D roll={thrown} size={Math.max(12, Math.round((box?.width ?? 700) / 42))} onDone={(id) => setThrown((current) => (current?.id === id ? null : current))} />

        {layout.tiles.map((rect) => {
          const tile = board.tiles[rect.index]!;
          return (
            <Tile2D
              key={rect.id}
              tile={tile}
              rect={rect}
              board={board}
              state={state}
              owner={state.properties[tile.id]}
              highlighted={highlighted.has(tile.id)}
              focused={focusTileId === tile.id}
              compact={(box?.width ?? 0) * viewport.zoom < 520}
              onClick={(id) => !consumedClick() && callbacks.current.onTileClick(id)}
              onHover={(id, at) => callbacks.current.onTileHover(id, at)}
            />
          );
        })}

        {state.players
          .filter((player) => !player.spectator)
          .map((player) => {
            const index = positions[player.id] ?? player.position;
            const rect = layout.byIndex.get(index) ?? layout.tiles[0]!;
            const here = seats.get(index) ?? [player.id];
            const offset = seatOffset(here.indexOf(player.id), here.length);
            return (
              <Token2D
                key={player.id}
                player={player}
                board={board}
                x={rect.centerX}
                y={rect.centerY}
                offsetX={offset.x / 10}
                offsetY={offset.y / 10}
                active={state.activePlayerId === player.id || focusPlayerId === player.id}
                controlled={controlledId === player.id}
                stepMs={stepping[player.id] ? STEP_MS : 0}
                hopKey={index}
                size={Math.max(16, Math.round((box?.width ?? 700) / 34))}
                onClick={(id) => !consumedClick() && callbacks.current.onTokenClick(id)}
                onHover={(id, at) => callbacks.current.onTokenHover(id, at)}
                innerRef={(el) => {
                  if (el) tokenRefs.current.set(player.id, el);
                  else tokenRefs.current.delete(player.id);
                }}
              />
            );
          })}
      </div>
    </div>
  );
}
