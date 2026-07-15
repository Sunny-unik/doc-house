import { describe, expect, it, vi } from "vitest";
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

  // Kept last: it leaves the module-level sweep timestamp in the future, which
  // suppresses sweeps in any test that runs after it. Harmless here (nothing
  // else asserts on sweeping), but add new tests above this one.
  it("sweeps each bucket against its own window, not the caller's", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));

      const hourly = uniqueKey("hourly");
      const hourOpts = { limit: 2, windowMs: 3_600_000 };
      const minutely = uniqueKey("minutely");
      const minuteOpts = { limit: 100, windowMs: 60_000 };

      // Prime the sweep gate so the sweep we care about is the one below.
      rateLimit(minutely, minuteOpts);

      // Exhaust the hourly bucket.
      expect(rateLimit(hourly, hourOpts).ok).toBe(true);
      expect(rateLimit(hourly, hourOpts).ok).toBe(true);
      expect(rateLimit(hourly, hourOpts).ok).toBe(false);

      // Two minutes on, a short-window caller triggers a sweep. The hourly
      // bucket's hits are older than the 60s window that caller passes, but
      // still well inside the hour the bucket was configured with.
      vi.advanceTimersByTime(120_000);
      rateLimit(minutely, minuteOpts);

      // The sweep must not have discarded them.
      expect(rateLimit(hourly, hourOpts).ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
