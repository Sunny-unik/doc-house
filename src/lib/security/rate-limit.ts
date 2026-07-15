// Sliding-window rate limiter, in-memory.
//
// Trade-off: this is a per-process limiter, so it only guards a single Node
// instance. That's the honest choice for a single-region Vercel deployment —
// for horizontal scale we'd move the counters into Upstash Redis (already in
// .env.example) and swap the store below; the call sites don't have to change.
//
// The algorithm is a simple sliding window: keep a bounded array of hit
// timestamps per bucket, drop entries older than the window on each check.
// O(hits-in-window) per request, which is fine at our scale.

// A bucket records the window it was last used with, so the sweep can prune it
// against its own window rather than whichever caller happens to trigger it.
type Bucket = { hits: number[]; windowMs: number };

const store = new Map<string, Bucket>();

// Best-effort cleanup so idle buckets don't linger forever. Runs at most once
// per minute on any call.
let lastSweep = 0;
function maybeSweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    const cutoff = now - bucket.windowMs;
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length === 0) store.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number; // epoch ms
};

/**
 * Consume one hit against a bucket. Returns whether the caller is under the
 * limit and how many hits remain in the current window.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  const bucket = store.get(key) ?? { hits: [], windowMs };
  bucket.windowMs = windowMs;
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    store.set(key, bucket);
    return { ok: false, remaining: 0, resetAt: oldest + windowMs };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, resetAt: now + windowMs };
}

/**
 * Build a 429 Response with a Retry-After header from a rate-limit result.
 */
export function tooManyRequestsResponse(result: RateLimitResult) {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfter),
        "x-ratelimit-remaining": String(result.remaining),
      },
    },
  );
}
