import { Square } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import type { IconComponent } from './iconMap';

interface Props {
  name: string | undefined;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

let loaded: Record<string, IconComponent | undefined> | null = null;
let loading: Promise<Record<string, IconComponent | undefined>> | null = null;
const waiters = new Set<() => void>();

function loadIcons(): Promise<Record<string, IconComponent | undefined>> {
  loading ??= import('./iconMap').then((m) => {
    loaded = m.iconMap;
    for (const w of waiters) w();
    waiters.clear();
    return m.iconMap;
  });
  return loading;
}

export function Icon({ name, size = 18, className, strokeWidth = 2, style }: Props) {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (loaded) return;
    const wake = () => rerender((n) => n + 1);
    waiters.add(wake);
    void loadIcons();
    return () => {
      waiters.delete(wake);
    };
  }, []);
  const Component = (name && loaded?.[name]) || (loaded ? Square : null);
  if (!Component) return <span className={`inline-block rounded bg-white/10 ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden />;
  return <Component size={size} className={className} strokeWidth={strokeWidth} style={style} />;
}
