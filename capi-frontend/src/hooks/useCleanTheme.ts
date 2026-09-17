import { useEffect, useSyncExternalStore } from 'react';

const CLASS = 'theme-clean';
const KEY = 'capi:theme';

export type ThemePreference = 'auto' | 'light' | 'dark';

const listeners = new Set<() => void>();
let preference: ThemePreference = readPreference();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function applyPreference(): void {
  const root = document.documentElement;
  if (preference === 'auto') delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    if (next === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
  }
  applyPreference();
  for (const listener of listeners) listener();
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => preference,
  );
}

export function useCleanTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(CLASS);
    applyPreference();
    return () => {
      root.classList.remove(CLASS);
      delete root.dataset.theme;
    };
  }, []);
}
