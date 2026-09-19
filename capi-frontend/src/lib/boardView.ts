import { useCallback, useEffect, useState } from 'react';

export type BoardView = '2d' | '3d';

const KEY = 'capi:board-view';
const EVENT = 'capi:board-view-change';

export function readBoardView(): BoardView {
  try {
    return window.localStorage.getItem(KEY) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}

export function writeBoardView(view: BoardView): void {
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    // el almacenamiento puede estar bloqueado; la preferencia dura la sesión
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: view }));
}

export function useBoardView(): [BoardView, (view: BoardView) => void] {
  const [view, setView] = useState<BoardView>(readBoardView);

  useEffect(() => {
    const sync = () => setView(readBoardView());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((next: BoardView) => {
    setView(next);
    writeBoardView(next);
  }, []);

  return [view, update];
}
