import { describe, expect, it } from "vitest";
import { TtlCache } from "@/server/providers/cache";

describe("TtlCache", () => {
  it("returns values until the TTL expires", () => {
    let now = 1_000;
    const cache = new TtlCache<string>(5_000, 10, () => now);

    cache.set("a", "alpha");
    expect(cache.get("a")).toBe("alpha");

    now += 4_999;
    expect(cache.get("a")).toBe("alpha");

    now += 1;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(60_000, 2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("refreshing a key moves it to the newest slot", () => {
    const cache = new TtlCache<number>(60_000, 2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("deletes and clears entries", () => {
    const cache = new TtlCache<number>(60_000);
    cache.set("a", 1);
    cache.set("b", 2);

    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rejects invalid configuration", () => {
    expect(() => new TtlCache<number>(0)).toThrow();
    expect(() => new TtlCache<number>(1_000, 0)).toThrow();
  });
});
