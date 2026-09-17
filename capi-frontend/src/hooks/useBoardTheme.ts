import type { BoardTheme } from 'capi-core';
import { useEffect } from 'react';

export function useBoardTheme(theme: BoardTheme | undefined) {
  useEffect(() => {
    const root = document.documentElement.style;
    if (theme?.accent) root.setProperty('--accent', theme.accent);
    if (theme?.background) root.setProperty('--bg', theme.background);
    return () => {
      root.removeProperty('--accent');
      root.removeProperty('--bg');
    };
  }, [theme]);
}
