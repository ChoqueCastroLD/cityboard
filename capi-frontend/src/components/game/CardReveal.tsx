import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { CardDrawnEvent, ScreenPoint } from '../../three/types';
import { Icon } from '../ui/Icon';
import { useGame } from './context';

export interface CardRevealRequest {
  event: CardDrawnEvent;

  resume: () => void;
}

interface Props {
  reveal: CardRevealRequest | null;

  project: (playerId: string) => ScreenPoint | null;
  onDone: (reveal: CardRevealRequest) => void;
}

const CARD_W = 220;
const CARD_H = 150;
const cardWidth = () => Math.min(CARD_W, Math.floor(window.innerWidth * 0.78));
const MARGIN = 12;
const SHUFFLE_MS = 1200;
const READ_MS = 5000;
const READ_REDUCED_MS = 3000;
const DECK_SIZE = 5;

type Phase = 'shuffle' | 'read' | 'done';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fanKeyframes = (i: number) => {
  const steps = 6;
  const x: number[] = [];
  const rotate: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const phase = ((i + s) % DECK_SIZE) - (DECK_SIZE - 1) / 2;
    x.push(phase * 26);
    rotate.push(phase * 9);
  }
  return { x, rotate };
};

export function CardReveal({ reveal, project, onDone }: Props) {
  const { board } = useGame();
  const [phase, setPhase] = useState<Phase>('shuffle');
  const anchor = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finishRef = useRef<() => void>(() => undefined);
  const activeReveal = useRef<CardRevealRequest | null>(null);

  useEffect(() => {
    if (!reveal || document.hidden) return;
    const reduced = reducedMotion();
    const shuffle = reduced ? 0 : SHUFFLE_MS;
    setPhase(shuffle ? 'shuffle' : 'read');
    const t1 = setTimeout(() => setPhase('read'), shuffle);
    const t2 = setTimeout(() => setPhase('done'), shuffle + (reduced ? READ_REDUCED_MS : READ_MS));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reveal]);

  useEffect(() => {
    if (!reveal) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setPhase('done');
      onDoneRef.current(reveal);
    };
    finishRef.current = finish;
    activeReveal.current = reveal;
    const onHidden = () => document.hidden && finish();
    document.addEventListener('visibilitychange', onHidden);
    if (document.hidden) finish();
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      activeReveal.current = null;
      setTimeout(() => {
        if (activeReveal.current !== reveal) finish();
      }, 0);
    };
  }, [reveal]);
  useEffect(() => {
    if (phase === 'done') finishRef.current();
  }, [phase]);

  useEffect(() => {
    if (!reveal) return;
    let frame = 0;
    const tick = () => {
      const at = project(reveal.event.playerId);
      const el = anchor.current;
      if (at && el) {
        const width = window.innerWidth;
        const half = cardWidth() / 2;
        const x = Math.min(Math.max(at.x, half + MARGIN), width - half - MARGIN);
        const y = Math.max(at.y - 16, CARD_H + MARGIN);
        el.style.transform = `translate(${x}px, ${y}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [reveal, project]);

  const event = reveal?.event;
  const deck = event ? board.decks.find((d) => d.id === event.deckId) : undefined;
  const icon = event ? board.tiles.find((t) => t.type === 'card' && t.deckId === event.deckId)?.icon : undefined;
  const color = deck?.color ?? 'var(--accent)';
  const readMs = reducedMotion() ? READ_REDUCED_MS : READ_MS;

  return (
    <div ref={anchor} className="pointer-events-none fixed top-0 left-0 z-30 will-change-transform" style={{ transform: 'translate(-9999px, -9999px)' }}>
      <AnimatePresence>
        {reveal && event && phase !== 'done' && (
          <motion.div
            key={`${event.at}-${event.cardId}`}
            data-testid="card-reveal"
            data-phase={phase}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ width: cardWidth(), height: CARD_H, perspective: 800 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          >
            {phase === 'shuffle' &&
              Array.from({ length: DECK_SIZE }, (_, i) => {
                const { x, rotate } = fanKeyframes(i);
                return (
                  <motion.div
                    key={i}
                    className="glass absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden"
                    style={{ transformOrigin: '50% 120%' }}
                    initial={{ opacity: 0, y: 20, x: x[0], rotate: rotate[0] }}
                    animate={{ opacity: 1, y: 0, x, rotate }}
                    transition={{ duration: SHUFFLE_MS / 1000, ease: 'easeInOut', times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1] }}
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
                    {deck?.image ? (
                      <img src={deck.image} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      <span style={{ color }}>
                        <Icon name={icon} size={30} />
                      </span>
                    )}
                    <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{deck?.name ?? event.deckId}</span>
                  </motion.div>
                );
              })}

            {phase === 'read' && (
              <motion.button
                type="button"
                onClick={() => setPhase('done')}
                title="Clic para continuar"
                className="glass pointer-events-auto absolute inset-0 flex cursor-pointer flex-col overflow-hidden text-left"
                initial={{ rotateY: 90, scale: 0.85, opacity: 0 }}
                animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <motion.div
                  className="h-0.5 w-full bg-white"
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: readMs / 1000, ease: 'linear' }}
                />
                <div className="h-1.5 w-full" style={{ background: color }} />
                <div className="flex items-center gap-2 px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  <span style={{ color }}>
                    <Icon name={icon} size={14} />
                  </span>
                  {deck?.name ?? event.deckId}
                </div>
                <p className="px-3 pt-1 pb-3 text-sm leading-snug text-ink">{event.text}</p>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
