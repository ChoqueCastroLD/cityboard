export const SKIP_ANIMATIONS_AFTER_MS = 5 * 60_000;

type Listener = (hiddenMs: number) => void;
const listeners = new Set<Listener>();
let hiddenAt: number | null = document.hidden ? Date.now() : null;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  const hiddenMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
  hiddenAt = null;
  for (const listener of listeners) listener(hiddenMs);
});

export const visibility = {
  onReturn(listener: Listener): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  shouldSkipAnimations: (hiddenMs: number) => hiddenMs >= SKIP_ANIMATIONS_AFTER_MS,
};
