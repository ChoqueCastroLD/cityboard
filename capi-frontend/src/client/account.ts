const ACCOUNT_KEY = 'capi:account';

let token: string | null = readToken();
const listeners = new Set<() => void>();

function readToken(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function emit(): void {
  for (const l of listeners) l();
}

export const accountToken = (): string | null => token;

export function setAccountToken(next: string | null): void {
  token = next;
  try {
    if (next) localStorage.setItem(ACCOUNT_KEY, next);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
  }
  emit();
}

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
