import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

// The limiter has module-level state. Using a random key per test isolates
// buckets from each other without needing a reset hook.
function uniqueKey(prefix: string) {
  return `${prefix}:${Math.random().toString(36).slice(2)}`;
}

describe("rateLimit", () => {
  it("allows every request up to the limit", () => {
    const key = uniqueKey("under");
    const opts = { limit: 5, windowMs: 60_000 };
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, opts).ok).toBe(true);
    }
  });

  it("blocks the request that would exceed the limit", () => {
    const key = uniqueKey("over");
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) rateLimit(key, opts);

    const overflow = rateLimit(key, opts);
    expect(overflow.ok).toBe(false);
    expect(overflow.remaining).toBe(0);
    expect(overflow.resetAt).toBeGreaterThan(Date.now());
  });

  it("scopes buckets so an unrelated key isn't affected", () => {
    const a = uniqueKey("a");
    const b = uniqueKey("b");
    const opts = { limit: 1, windowMs: 60_000 };

    expect(rateLimit(a, opts).ok).toBe(true);
    expect(rateLimit(b, opts).ok).toBe(true); // different bucket, still fresh
    expect(rateLimit(a, opts).ok).toBe(false); // A already at limit
    expect(rateLimit(b, opts).ok).toBe(false); // B now also at limit
  });

  it("reports remaining requests correctly across the window", () => {
    const key = uniqueKey("remaining");
    const opts = { limit: 5, windowMs: 60_000 };

    expect(rateLimit(key, opts).remaining).toBe(4);
    expect(rateLimit(key, opts).remaining).toBe(3);
    expect(rateLimit(key, opts).remaining).toBe(2);
  });

  it("readmits requests after the sliding window has elapsed", () => {
    const key = uniqueKey("sliding");
    // 1 ms window so the second call fires after the window has already passed.
    const opts = { limit: 1, windowMs: 1 };

    expect(rateLimit(key, opts).ok).toBe(true);

    // Busy-wait a couple of milliseconds to guarantee window rollover without
    // needing to plumb in fake timers.
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* wait */
    }

    expect(rateLimit(key, opts).ok).toBe(true);
  });
});
