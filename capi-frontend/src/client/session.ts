import type { GameClient } from './GameClient';

let current: GameClient | null = null;

export const session = {
  get: (): GameClient | null => current,
  set(client: GameClient): void {
    if (current && current !== client) current.dispose();
    current = client;
  },
  clear(): void {
    current?.dispose();
    current = null;
  },
};
