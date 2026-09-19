import type { BoardDefinition, GameEvent } from 'capi-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameClient } from '../../client/GameClient';
import { useGameState } from '../../hooks/useGameClient';
import type { CardDrawnEvent, IBoardScene, ScreenPoint } from '../../three/types';
import { buildBoardLayout2D, seatOffset } from './board2d/layout2d';
import { Tile2D } from './board2d/Tile2D';
import { Token2D } from './board2d/Token2D';

const STEP_MS = 140;
const DICE_MS = 700;

interface Props {
  client: GameClient;
  board: BoardDefinition;
  controlledId: string | null;
  highlight: string[];
  focusTileId: string | null;
  focusPlayerId: string | null;
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
  const { client, board, controlledId, highlight, focusTileId, focusPlayerId } = props;
  const { state } = useGameState(client);
  const layout = useMemo(() => buildBoardLayout2D(board), [board]);
  const callbacks = useRef(props);
  callbacks.current = props;

  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(client.getState().players.map((p) => [p.id, p.position])),
  );
  const [stepping, setStepping] = useState<Record<string, boolean>>({});
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
      setBox({ width, height: width / layout.ratio });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [layout.ratio]);

  const place = useCallback((playerId: string, index: number) => {
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
      let current = positions[playerId] ?? client.getState().players.find((p) => p.id === playerId)?.position ?? 0;
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
    [board.tiles.length, client, place, positions],
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
      focusTile: () => undefined,
      focusPlayer: () => undefined,
      highlightTiles: () => undefined,
      setControlledPlayer: () => undefined,
      setCameraMode: () => undefined,
      catchUp: () => {
        skip.current = true;
        for (const resume of resumes.current) resume();
        resumes.current.clear();
        setPositions(Object.fromEntries(client.getState().players.map((p) => [p.id, p.position])));
        window.setTimeout(() => (skip.current = false), 0);
      },
      resize: () => undefined,
      dispose: () => undefined,
    };
    callbacks.current.onScene(scene);
    return () => callbacks.current.onScene(null);
  }, [client]);

  useEffect(() => {
    const play = (events: GameEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case 'ROLLED': {
            const settled = sleep(DICE_MS);
            callbacks.current.onDiceRoll(event.playerId, event.dice, settled);
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
  }, [client, enqueue, walk]);

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
    <div ref={frameRef} className="absolute inset-2 flex items-center justify-center overflow-hidden sm:inset-4">
      <div
        className="relative rounded-2xl bg-[var(--board-bg)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={
          box
            ? { width: `${box.width}px`, height: `${box.height}px`, fontSize: `${Math.max(4.5, box.width / 92)}px` }
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
              compact={(box?.width ?? 0) < 520}
              onClick={(id) => callbacks.current.onTileClick(id)}
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
                onClick={(id) => callbacks.current.onTokenClick(id)}
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
