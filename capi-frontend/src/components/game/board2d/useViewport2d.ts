import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

export interface Viewport2D {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useViewport2d(frameRef: RefObject<HTMLElement | null>, boardSize: () => { width: number; height: number } | null) {
  const [viewport, setViewport] = useState<Viewport2D>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const reset = useCallback(() => setViewport({ x: 0, y: 0, zoom: 1 }), []);

  // el tablero nunca puede salirse del encuadre: sin zoom queda centrado y fijo
  const limit = useCallback(
    (x: number, y: number, zoom: number): { x: number; y: number } => {
      const frame = frameRef.current?.getBoundingClientRect();
      const board = boardSize();
      if (!frame || !board) return { x, y };
      const maxX = Math.max(0, (board.width * zoom - frame.width) / 2);
      const maxY = Math.max(0, (board.height * zoom - frame.height) / 2);
      return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    },
    [boardSize, frameRef],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const pointerX = event.clientX - rect.left - rect.width / 2;
      const pointerY = event.clientY - rect.top - rect.height / 2;
      setViewport((current) => {
        const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
        const ratio = zoom / current.zoom;
        return { zoom, ...limit(pointerX - (pointerX - current.x) * ratio, pointerY - (pointerY - current.y) * ratio, zoom) };
      });
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [frameRef, limit]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y, moved: false };
    },
    [viewport.x, viewport.y],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setViewport((view) => ({ ...view, ...limit(current.originX + dx, current.originY + dy, view.zoom) }));
  }, [limit]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.moved) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    drag.current = null;
    setDragging(false);
  }, []);

  const consumedClick = useCallback(() => suppressClick.current, []);

  return { viewport, dragging, reset, handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }, consumedClick };
}
