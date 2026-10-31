/**
 * Sliding-window rate limiter used by every external provider.
 * Injective clock makes it deterministic in tests.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(limit) || limit < 1) {
      throw new Error("Rate limiter limit must be at least 1");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("Rate limiter window must be positive");
    }
  }

  tryAcquire(key: string): boolean {
    const timestamp = this.now();
    const cutoff = timestamp - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((hit) => hit > cutoff);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(timestamp);
    this.hits.set(key, recent);
    return true;
  }

  remaining(key: string): number {
    const cutoff = this.now() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((hit) => hit > cutoff);
    return Math.max(0, this.limit - recent.length);
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.hits.clear();
      return;
    }
    this.hits.delete(key);
  }
}
