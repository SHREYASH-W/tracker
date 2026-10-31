import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "@/server/providers/rate-limit";

describe("SlidingWindowRateLimiter", () => {
  it("allows requests up to the limit, then blocks", () => {
    let now = 1_000;
    const limiter = new SlidingWindowRateLimiter(2, 60_000, () => now);

    expect(limiter.tryAcquire("groq")).toBe(true);
    expect(limiter.tryAcquire("groq")).toBe(true);
    expect(limiter.tryAcquire("groq")).toBe(false);
    expect(limiter.remaining("groq")).toBe(0);
  });

  it("frees slots once the window slides past old hits", () => {
    let now = 1_000;
    const limiter = new SlidingWindowRateLimiter(1, 60_000, () => now);

    expect(limiter.tryAcquire("groq")).toBe(true);
    expect(limiter.tryAcquire("groq")).toBe(false);

    now += 60_001;
    expect(limiter.tryAcquire("groq")).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, () => 5_000);

    expect(limiter.tryAcquire("groq")).toBe(true);
    expect(limiter.tryAcquire("gemini")).toBe(true);
    expect(limiter.tryAcquire("groq")).toBe(false);
    expect(limiter.tryAcquire("gemini")).toBe(false);
  });

  it("resets one key or all keys", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, () => 5_000);
    limiter.tryAcquire("groq");
    limiter.tryAcquire("gemini");

    limiter.reset("groq");
    expect(limiter.tryAcquire("groq")).toBe(true);
    expect(limiter.tryAcquire("gemini")).toBe(false);

    limiter.reset();
    expect(limiter.tryAcquire("gemini")).toBe(true);
  });

  it("rejects invalid configuration", () => {
    expect(() => new SlidingWindowRateLimiter(0, 1_000)).toThrow();
    expect(() => new SlidingWindowRateLimiter(1, 0)).toThrow();
  });
});
