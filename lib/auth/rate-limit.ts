/** Rate limit sederhana di memori (satu proses Node, cukup untuk satu akun rumah tangga). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 15 * 60_000): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
