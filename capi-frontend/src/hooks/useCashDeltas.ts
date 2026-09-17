import type { GameState } from 'capi-core';
import { useEffect, useRef, useState } from 'react';

export interface CashDelta {
  id: number;
  playerId: string;
  amount: number;
}

const SHOW_MS = 2600;

export function useCashDeltas(state: GameState, catchUpId: number): CashDelta[] {
  const previous = useRef<Map<string, number> | null>(null);
  const lastCatchUp = useRef(catchUpId);
  const nextId = useRef(0);
  const [deltas, setDeltas] = useState<CashDelta[]>([]);

  useEffect(() => {
    const caughtUp = lastCatchUp.current !== catchUpId;
    lastCatchUp.current = catchUpId;
    const current = new Map(state.players.map((p) => [p.id, p.cash]));
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    const fresh: CashDelta[] = [];
    for (const [playerId, cash] of current) {
      const was = before.get(playerId);
      if (was === undefined || was === cash) continue;
      fresh.push({ id: nextId.current++, playerId, amount: cash - was });
    }
    if (caughtUp) setDeltas(fresh);
    else if (fresh.length > 0) setDeltas((list) => [...list, ...fresh]);
    if (fresh.length === 0) return;
    window.setTimeout(() => setDeltas((list) => list.filter((d) => !fresh.includes(d))), SHOW_MS);
  }, [state, catchUpId]);

  return deltas;
}
