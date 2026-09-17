import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useGame } from './context';

export interface DiceRoll {
  id: number;
  playerId: string;
  dice: [number, number];
  settled: boolean;
}

const FACES = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
const TUMBLE_MS = 80;
const LINGER_MS = 1800;

function randomFace(except: number): number {
  const face = 1 + Math.floor(Math.random() * 6);
  return face === except ? (face % 6) + 1 : face;
}

function Die({ value, rolling, delay }: { value: number; rolling: boolean; delay: number }) {
  const Face = FACES[value - 1] ?? Dice1;
  return (
    <motion.span
      className="text-ink"
      animate={rolling ? { rotate: [0, -14, 12, -8, 0], y: [0, -6, 0, -3, 0] } : { rotate: 0, y: 0, scale: [1.25, 1] }}
      transition={rolling ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay } : { duration: 0.25 }}
    >
      <Face size={40} strokeWidth={1.75} />
    </motion.span>
  );
}

export function DiceOverlay({ roll, onHidden }: { roll: DiceRoll | null; onHidden: (id: number) => void }) {
  const { state } = useGame();
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  const rolling = !!roll && !roll.settled;
  const player = roll ? state.players.find((p) => p.id === roll.playerId) : undefined;

  useEffect(() => {
    if (!roll) return;
    if (roll.settled) {
      setFaces(roll.dice);
      const timer = window.setTimeout(() => onHidden(roll.id), LINGER_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setInterval(() => setFaces(([a, b]) => [randomFace(a), randomFace(b)]), TUMBLE_MS);
    return () => window.clearInterval(timer);
  }, [roll, onHidden]);

  return (
    <AnimatePresence>
      {roll && player && (
        <motion.div
          key={roll.id}
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="glass pointer-events-none fixed top-[calc(6.5rem+var(--safe-top))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 max-md:scale-90 md:top-[calc(0.75rem+var(--safe-top))] md:gap-3 md:px-4 md:py-2 short:top-[calc(0.75rem+var(--safe-top))]"
          aria-live="polite"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
          <span className="text-sm font-semibold">{player.name}</span>
          <span className="flex items-center gap-1.5">
            <Die value={faces[0]} rolling={rolling} delay={0} />
            <Die value={faces[1]} rolling={rolling} delay={0.12} />
          </span>
          {roll.settled && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold tabular-nums">
              {roll.dice[0] + roll.dice[1]}
              {roll.dice[0] === roll.dice[1] && <span className="ml-1 font-medium text-accent">dobles</span>}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
