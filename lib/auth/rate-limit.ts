import "server-only";
import { db } from "@/lib/db";

/**
 * Pembatas percobaan gagal, disimpan di database (berlaku lintas instance serverless).
 * `check` dulu sebelum memverifikasi; panggil `recordFailure` bila gagal, `reset` bila berhasil.
 */
export async function checkLimit(key: string, limit: number, windowMs = 15 * 60_000): Promise<{ ok: boolean; retryAfterSec: number }> {
  const since = new Date(Date.now() - windowMs);
  const rows = await db.authAttempt.findMany({ where: { key, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: limit, select: { createdAt: true } });
  if (rows.length < limit) return { ok: true, retryAfterSec: 0 };
  const retry = Math.ceil((rows[0].createdAt.getTime() + windowMs - Date.now()) / 1000);
  return { ok: false, retryAfterSec: Math.max(1, retry) };
}

export async function recordFailure(...keys: string[]) {
  await db.authAttempt.createMany({ data: keys.map((key) => ({ key })) });
}

export async function resetLimit(key: string) {
  await db.authAttempt.deleteMany({ where: { key } });
}

/** Bersihkan catatan lama (dipanggil cron). */
export async function pruneAttempts() {
  await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
}
