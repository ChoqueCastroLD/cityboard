import type { BoardDefinition } from 'capi-core';
import { useEffect, useRef } from 'react';
import type { GameClient } from '../../client/GameClient';
import { createBoardScene } from '../../three';
import type { CameraMode, CardDrawnEvent, IBoardScene, SceneBackend, ScreenPoint } from '../../three/types';

interface Props {
  client: GameClient;
  board: BoardDefinition;

  now: number;
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
  onReady: (backend: SceneBackend) => void;
}

export function Board3D(props: Props) {
  const { client, board, now, controlledId, highlight, focusTileId, focusPlayerId, cameraMode } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IBoardScene | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createBoardScene(canvas, {
      board,
      callbacks: {
        onTileClick: (id) => callbacks.current.onTileClick(id),
        onTokenClick: (id) => callbacks.current.onTokenClick(id),
        onTokenHover: (id, at) => callbacks.current.onTokenHover(id, at),
        onTileHover: (id, at) => callbacks.current.onTileHover(id, at),
        onCardDrawn: (event, resume) => callbacks.current.onCardDrawn(event, resume),
        onDiceRoll: (playerId, dice, settled) => callbacks.current.onDiceRoll(playerId, dice, settled),
      },
    });
    sceneRef.current = scene;
    callbacks.current.onScene(scene);
    let alive = true;
    void scene.ready.then(({ backend }) => alive && callbacks.current.onReady(backend));
    scene.setState(client.getState(), Date.now());

    const unsubscribe = client.subscribe((next, events) => {
      scene.play(events);
      scene.setState(next, Date.now());
    });
    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);
    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener('resize', onResize);
      scene.dispose();
      sceneRef.current = null;
      callbacks.current.onScene(null);
    };
  }, [board, client]);

  useEffect(() => sceneRef.current?.setState(client.getState(), now), [client, now]);
  useEffect(() => sceneRef.current?.setControlledPlayer(controlledId), [controlledId]);
  useEffect(() => sceneRef.current?.highlightTiles(highlight), [highlight]);
  useEffect(() => sceneRef.current?.focusTile(focusTileId), [focusTileId]);
  useEffect(() => sceneRef.current?.focusPlayer(focusPlayerId), [focusPlayerId]);
  useEffect(() => sceneRef.current?.setCameraMode(cameraMode), [cameraMode]);

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" aria-label="Tablero" />;
}
