export type Ease = (t: number) => number;

export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack: Ease = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
export const linear: Ease = (t) => t;

export interface TweenSpec {
  duration: number;
  ease?: Ease;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

interface Active extends TweenSpec {
  start: number;
  resolve: () => void;
  cancelled: boolean;
}

export interface TweenHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export class Tweens {
  private readonly active: Active[] = [];
  private now = 0;

  add(spec: TweenSpec): TweenHandle {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => (resolve = r));
    const entry: Active = { ...spec, start: this.now, resolve, cancelled: false };
    this.active.push(entry);
    return { promise, cancel: () => (entry.cancelled = true) };
  }

  run(spec: TweenSpec): Promise<void> {
    return this.add(spec).promise;
  }

  delay(ms: number): Promise<void> {
    return this.run({ duration: ms, onUpdate: () => undefined });
  }

  update(now: number): void {
    this.now = now;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tw = this.active[i]!;
      if (tw.cancelled) {
        this.active.splice(i, 1);
        tw.resolve();
        continue;
      }
      const raw = tw.duration <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.duration);
      tw.onUpdate((tw.ease ?? easeOutCubic)(raw));
      if (raw >= 1) {
        this.active.splice(i, 1);
        tw.onComplete?.();
        tw.resolve();
      }
    }
  }

  get pending(): number {
    return this.active.length;
  }

  settle(): void {
    const batch = this.active.splice(0);
    for (const tw of batch) {
      if (!tw.cancelled) {
        tw.onUpdate((tw.ease ?? easeOutCubic)(1));
        tw.onComplete?.();
      }
      tw.resolve();
    }
  }

  clear(): void {
    for (const tw of this.active) tw.resolve();
    this.active.length = 0;
  }
}
