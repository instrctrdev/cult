import { AppError } from './errors';

/**
 * In-process fixed-window limiter.
 *
 * Deliberately not Redis: the brief rules out extra paid services, and the
 * Hostinger Node target runs a single app process, so a module-level Map is
 * an accurate limiter there. If the app is ever scaled to multiple
 * instances this must move to a shared store — see docs/DEPLOYMENT.md.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export interface RateLimitOptions {
  /** Bucket name, e.g. 'login'. */
  key: string;
  /** Caller identity — usually an IP, optionally an email. */
  identifier: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const id = `${opts.key}:${opts.identifier}`;
  const existing = buckets.get(id);

  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > opts.limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: retryAfter };
  }
  return { ok: true, remaining: opts.limit - existing.count, retryAfterSeconds: retryAfter };
}

/** Throws a 429 when the caller is over budget. */
export function enforceRateLimit(opts: RateLimitOptions): void {
  const result = rateLimit(opts);
  if (!result.ok) {
    throw new AppError('RATE_LIMITED', `Too many attempts. Please try again in ${result.retryAfterSeconds}s.`, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

/** Best-effort client IP behind Hostinger's proxy. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
