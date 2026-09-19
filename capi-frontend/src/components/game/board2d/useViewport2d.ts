import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

export interface Viewport2D {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD = 4;
const OVERSCROLL = 0.75;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useViewport2d(frameRef: RefObject<HTMLElement | null>, boardSize: () => { width: number; height: number } | null) {
  const [viewport, setViewport] = useState<Viewport2D>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const reset = useCallback(() => setViewport({ x: 0, y: 0, zoom: 1 }), []);

  // se puede arrastrar bastante más allá de las esquinas; el tope solo evita perder
  // el tablero de vista del todo
  const limit = useCallback(
    (x: number, y: number, zoom: number, overscroll = OVERSCROLL): { x: number; y: number } => {
      const frame = frameRef.current?.getBoundingClientRect();
      const board = boardSize();
      if (!frame || !board) return { x, y };
      const slackX = frame.width * overscroll;
      const slackY = frame.height * overscroll;
      const maxX = Math.max(0, (board.width * zoom - frame.width) / 2) + slackX;
      const maxY = Math.max(0, (board.height * zoom - frame.height) / 2) + slackY;
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

  // centra el encuadre en un punto del tablero dado en porcentaje
  const centerOn = useCallback(
    (xPercent: number, yPercent: number, minZoom?: number) => {
      const board = boardSize();
      if (!board) return;
      setViewport((current) => {
        // sin zoom cabe el tablero entero, así que seguir al turno no aporta nada
        if (!minZoom && current.zoom <= 1.05) return current;
        const zoom = minZoom ? Math.max(current.zoom, minZoom) : current.zoom;
        const x = -((xPercent - 50) / 100) * board.width * zoom;
        const y = -((yPercent - 50) / 100) * board.height * zoom;
        // el encuadre automático no deja hueco: solo el arrastre manual tiene holgura
        return { zoom, ...limit(x, y, zoom, 0) };
      });
    },
    [boardSize, limit],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, zoom: viewport.zoom };
        drag.current = null;
        setDragging(false);
        return;
      }
      drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y, moved: false };
    },
    [viewport.x, viewport.y, viewport.zoom],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // pellizco con dos dedos: acerca alrededor del punto medio
    const gesture = pinch.current;
    if (gesture && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      const midX = (a.x + b.x) / 2 - frame.left - frame.width / 2;
      const midY = (a.y + b.y) / 2 - frame.top - frame.height / 2;
      suppressClick.current = true;
      setViewport((current) => {
        const zoom = clamp(gesture.zoom * (distance / gesture.distance), MIN_ZOOM, MAX_ZOOM);
        const ratio = zoom / current.zoom;
        return { zoom, ...limit(midX - (midX - current.x) * ratio, midY - (midY - current.y) * ratio, zoom) };
      });
      return;
    }

    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // el puntero puede haberse soltado ya; seguir sin captura es inofensivo
      }
    }
    setViewport((view) => ({ ...view, ...limit(current.originX + dx, current.originY + dy, view.zoom) }));
  }, [frameRef, limit]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2 && pinch.current) {
      pinch.current = null;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.moved) {
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // idem: soltar una captura que ya no existe no debe romper nada
      }
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    drag.current = null;
    setDragging(false);
  }, []);

  const consumedClick = useCallback(() => suppressClick.current, []);

  return {
    viewport,
    dragging,
    reset,
    centerOn,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
    consumedClick,
  };
}
