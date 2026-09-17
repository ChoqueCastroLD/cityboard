import { ScrollText } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { describeEvent, isVisibleEvent } from '../../lib/describe';
import { useGame } from './context';

const STICKY_PX = 24;

export function EventFeed() {
  const { log, board, state } = useGame();
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICKY_PX;
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  useEffect(() => {
    const el = scroller.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el) el.style.scrollBehavior = reduced ? 'auto' : 'smooth';
  }, []);

  const visible = log.filter((entry) => isVisibleEvent(entry.event));

  return (
    <div className="fixed top-1/2 right-[calc(0.75rem+var(--safe-right))] z-10 hidden w-[300px] -translate-y-1/2 flex-col items-end gap-1.5 lg:flex short:hidden" aria-label="Registro">
      <span className="pill flex w-max items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted uppercase">
        <ScrollText size={11} /> Registro en vivo
      </span>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="feed-scroll flex h-40 max-h-[40vh] w-full flex-col items-end gap-1.5 overflow-y-auto overscroll-contain pl-1"
        style={{ overflowAnchor: 'none' }}
        aria-live="polite"
      >
        {visible.length === 0 && <span className="px-3 text-xs text-muted">Aún no ha pasado nada.</span>}
        {visible.map((entry) => (
          <motion.span
            key={entry.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="pill max-w-full shrink-0 px-3 py-1 text-right text-xs leading-snug"
          >
            {describeEvent(entry.event, board, state)}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
