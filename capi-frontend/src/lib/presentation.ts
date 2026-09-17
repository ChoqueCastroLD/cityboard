import type { CardDrawnEvent } from '../three/types';

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

export const FLUSH_KEY = '*';

export const presentationKey = (event: CardDrawnEvent) => `${event.at}:${event.playerId}:${event.deckId}:${event.cardId}`;

export const presentation = {
  finish(key: string): void {
    for (const listener of listeners) listener(key);
  },
  flush(): void {
    this.finish(FLUSH_KEY);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
