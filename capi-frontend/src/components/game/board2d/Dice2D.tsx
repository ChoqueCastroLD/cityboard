import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

export interface Throw2D {
  id: number;
  playerId: string;
  color: string;
  dice: [number, number];
  fromX: number;
  fromY: number;
  settled: boolean;
}

const FACES = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
const TUMBLE_MS = 70;
const LINGER_MS = 1500;

function randomFace(except: number): number {
  const face = 1 + Math.floor(Math.random() * 6);
  return face === except ? (face % 6) + 1 : face;
}

function Die({ value, rolling, spin, color }: { value: number; rolling: boolean; spin: number; color: string }) {
  const Face = FACES[value - 1] ?? Dice1;
  return (
    <motion.span
      className="grid place-items-center rounded-[22%] bg-white text-[#12121c] shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      style={{ width: '2.6em', height: '2.6em', outline: `0.14em solid ${color}` }}
      animate={rolling ? { rotate: [0, spin * 0.5, spin] } : { rotate: 0, scale: [1.18, 1] }}
      transition={rolling ? { duration: 0.6, repeat: Infinity, ease: 'linear' } : { duration: 0.28, ease: 'backOut' }}
    >
      <Face size="70%" strokeWidth={1.9} />
    </motion.span>
  );
}

export function Dice2D({ roll, size, onDone }: { roll: Throw2D | null; size: number; onDone: (id: number) => void }) {
  const [faces, setFaces] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    if (!roll) return;
    if (roll.settled) {
      setFaces(roll.dice);
      const timer = window.setTimeout(() => onDone(roll.id), LINGER_MS);
      return () => window.clearTimeout(timer);
    }
    setFaces(([a, b]) => [randomFace(a), randomFace(b)]);
    const timer = window.setInterval(() => setFaces(([a, b]) => [randomFace(a), randomFace(b)]), TUMBLE_MS);
    return () => window.clearInterval(timer);
  }, [roll, onDone]);

  return (
    <AnimatePresence>
      {roll && (
        <motion.div
          key={roll.id}
          className="pointer-events-none absolute top-1/2 left-1/2 z-30 flex items-center gap-[0.6em]"
          style={{ fontSize: `${size}px`, translate: '-50% -50%' }}
          initial={{ x: roll.fromX, y: roll.fromY, scale: 0.35, opacity: 0.4 }}
          animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 130, damping: 16, mass: 0.7 }}
          aria-live="polite"
        >
          <Die value={faces[0]} rolling={!roll.settled} spin={420} color={roll.color} />
          <Die value={faces[1]} rolling={!roll.settled} spin={-500} color={roll.color} />
          {roll.settled && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full bg-black/65 px-[0.6em] py-[0.15em] text-[1.4em] font-bold text-white tabular-nums"
            >
              {roll.dice[0] + roll.dice[1]}
              {roll.dice[0] === roll.dice[1] && <span className="ml-[0.3em] text-[0.7em] font-semibold text-warn">dobles</span>}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
