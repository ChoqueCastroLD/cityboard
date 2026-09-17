import { useSyncExternalStore } from 'react';
import { ApiError } from '../client/api';
import { translateError } from './errors';

export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

export const PREMIUM_REQUIRED_EVENT = 'capi:premium-required';
export const ACCOUNT_REQUIRED_EVENT = 'capi:account-required';

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, kind: Toast['kind'] = 'error'): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  window.setTimeout(() => dismiss(id), 3500);
}

export function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}

function report(e: unknown): void {
  if (e instanceof ApiError && e.code === 'PREMIUM_REQUIRED') window.dispatchEvent(new CustomEvent(PREMIUM_REQUIRED_EVENT));
  if (e instanceof ApiError && e.code === 'ACCOUNT_REQUIRED') window.dispatchEvent(new CustomEvent(ACCOUNT_REQUIRED_EVENT));
  toast(translateError(e instanceof Error ? e.message : String(e)));
}

export const guarded = (work: Promise<unknown>): Promise<void> => work.then(() => undefined, report);
