import { shuffle } from 'capi-core';
import { useGame } from './context';

const SAMPLE_SIZE = 5;

export function CardPeek({ deckId, size = 'sm' }: { deckId: string; size?: 'sm' | 'md' }) {
  const { board, cardPeekSeed } = useGame();
  const deck = board.decks.find((d) => d.id === deckId);
  if (!deck) return null;
  const sample = shuffle(deck.cards, cardPeekSeed * 7919 + deck.id.length).items.slice(0, SAMPLE_SIZE);
  const text = size === 'md' ? 'text-sm' : 'text-[11px]';
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-muted">Mazo</span>
        <span className="font-medium">{deck.name}</span>
      </div>
      <span className="mt-1 block text-[10px] tracking-wide text-muted uppercase">Podría salir</span>
      <ul className={`mt-0.5 space-y-0.5 leading-snug text-ink/90 ${text}`}>
        {sample.map((card) => (
          <li key={card.id} className="flex gap-1.5">
            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full" style={{ background: deck.color ?? 'currentColor' }} />
            <span>{card.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
