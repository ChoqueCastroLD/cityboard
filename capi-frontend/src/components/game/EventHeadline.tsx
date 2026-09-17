import type { GameEvent, GameEventType } from 'capi-core';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { describeEvent, isVisibleEvent } from '../../lib/describe';
import { useGame } from './context';

const SHOW_MS = 2600;

const HEADLINE_TYPES = new Set<GameEventType>([
  'BOUGHT',
  'TRADE_ACCEPTED',
  'JAILED',
  'RELEASED',
  'BANKRUPT',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_REMOVED',
  'PLAYER_SPAWNED',
  'HOST_CHANGED',
  'GAME_OVER',
]);

const isHeadline = (event: GameEvent) => isVisibleEvent(event) && (HEADLINE_TYPES.has(event.type) || (event.type === 'AUCTION_ENDED' && event.winnerId !== null));

const asTitle = (sentence: string) => sentence.replace(/\.$/, '');

export function EventHeadline() {
  const { log, board, state, catchUpId } = useGame();
  const seen = useRef(-1);
  const lastCatchUp = useRef(catchUpId);
  const [queue, setQueue] = useState<{ id: number; text: string }[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const caughtUp = lastCatchUp.current !== catchUpId;
    lastCatchUp.current = catchUpId;
    const fresh = log.filter((entry) => entry.id > seen.current);
    if (fresh.length > 0) seen.current = fresh[fresh.length - 1]!.id;
    const titles = fresh.filter((entry) => isHeadline(entry.event)).map((entry) => ({ id: entry.id, text: asTitle(describeEvent(entry.event, board, state)) }));
    if (caughtUp) setQueue(titles.slice(-1));
    else if (titles.length > 0) setQueue((q) => [...q, ...titles]);
  }, [log, board, state, catchUpId]);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setQueue((q) => q.filter((t) => t.id !== current.id)), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [current]);

  return (
    <div className="pointer-events-none fixed top-[calc(9.75rem+var(--safe-top))] left-1/2 z-20 w-full -translate-x-1/2 px-3 md:top-[calc(5rem+var(--safe-top))] md:w-auto md:px-0 short:top-[calc(3.5rem+var(--safe-top))]">
      <AnimatePresence mode="wait">
        {current && (
          <motion.h2
            key={current.id}
            initial={{ opacity: 0, y: -10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="glass mx-auto max-w-[min(94vw,720px)] px-4 py-2 text-center font-display text-base font-bold tracking-tight text-ink sm:text-lg md:px-6 md:py-3 md:text-2xl"
            aria-live="polite"
          >
            {current.text}
          </motion.h2>
        )}
      </AnimatePresence>
    </div>
  );
}
