const KEY = 'capi:name';

export function rememberName(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
  }
}

export function guestName(): string {
  try {
    const stored = localStorage.getItem(KEY)?.trim();
    if (stored) return stored;
  } catch {
  }
  const generated = `Invitado ${Math.floor(100 + Math.random() * 900)}`;
  rememberName(generated);
  return generated;
}
