import { HttpError } from './http-error';

interface Window {
  hits: number[];
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now = Date.now()): boolean {
    const window = this.windows.get(key) ?? { hits: [] };
    window.hits = window.hits.filter((t) => now - t < this.windowMs);
    if (window.hits.length >= this.limit) {
      this.windows.set(key, window);
      return false;
    }
    window.hits.push(now);
    this.windows.set(key, window);
    return true;
  }

  assert(key: string): void {
    if (!this.hit(key)) throw new HttpError(429, 'RATE_LIMITED', 'Demasiados intentos, espera unos minutos.');
  }

  sweep(now = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.hits.every((t) => now - t >= this.windowMs)) this.windows.delete(key);
    }
  }
}

const TEN_MINUTES = 10 * 60 * 1000;

export const limits = {
  requestCodeByEmail: new RateLimiter(5, TEN_MINUTES),
  requestCodeByIp: new RateLimiter(10, TEN_MINUTES),
  verifyByIp: new RateLimiter(10, TEN_MINUTES),
  createGameByIp: new RateLimiter(20, TEN_MINUTES),
};

export function sweepLimits(): void {
  for (const limiter of Object.values(limits)) limiter.sweep();
}

export const clientIp = (request: Request, server: { requestIP?: (r: Request) => { address: string } | null } | null): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return server?.requestIP?.(request)?.address ?? 'local';
};
