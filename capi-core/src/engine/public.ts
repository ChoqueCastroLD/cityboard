import type { GameState } from './state';

export function toPublicState(state: GameState): GameState {
  const decks: GameState['decks'] = {};
  for (const id of Object.keys(state.decks)) decks[id] = { draw: [], discard: [] };
  return { ...state, rng: 0, decks };
}
