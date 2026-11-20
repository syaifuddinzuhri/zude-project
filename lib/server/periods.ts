import "server-only";
import { db, n, type Tx } from "@/lib/db";
import { toDate, fromDate, type ISODate } from "@/lib/finance/date";
import type { Period } from "@/lib/finance/cycle";
import { getSettings, periodOf } from "./settings";

export async function ensurePeriod(p: Period, tx: Tx = db) {
  const existing = await tx.budgetPeriod.findUnique({ where: { periodStart: toDate(p.start) } });
  if (existing) return existing;
  const s = await getSettings();
  return tx.budgetPeriod.create({
    data: {
      periodStart: toDate(p.start),
      periodEnd: toDate(p.end),
      plannedIncome: BigInt(n(s.husbandSalary) + n(s.wifeSalary)),
    },
  });
}

/** Periode terkunci yang memuat tanggal ini, bila ada. */
export async function lockedPeriodFor(date: ISODate, tx: Tx = db) {
  const d = toDate(date);
  return tx.budgetPeriod.findFirst({ where: { status: "locked", periodStart: { lte: d }, periodEnd: { gte: d } } });
}

/**
 * Transaksi di bulan terkunci hanya boleh diubah dengan alasan (tercatat di log).
 * Lempar error bila alasan kosong.
 */
export async function assertEditable(dates: ISODate[], reason: string | null | undefined, tx: Tx = db) {
  for (const d of dates) {
    const locked = await lockedPeriodFor(d, tx);
    if (locked && !reason?.trim()) {
      throw new Error(`LOCKED:Bulan ${fromDate(locked.periodStart)} s.d. ${fromDate(locked.periodEnd)} sudah dikunci — isi alasan perubahan`);
    }
  }
}

export async function currentPeriod() {
  const s = await getSettings();
  return periodOf(s);
}
