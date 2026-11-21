/**
 * Garis waktu sisa pokok hutang per bulan:
 * - bulan lalu s/d bulan ini: sisa nyata dari pembayaran yang tercatat
 * - bulan depan s/d lunas: proyeksi dari jadwal cicilan yang belum dibayar
 */
import { diffMonths, parts, type ISODate } from "./date";

export interface PayoffDebtInput {
  /** Bulan pertama hutang dicatat di ZuDe (titik awal riwayat) */
  trackFrom: ISODate;
  /** Pokok awal − pokok yang sudah dibayar sebelum dicatat */
  base: number;
  payments: { date: ISODate; principal: number }[];
  unpaid: { due: ISODate; principal: number }[];
}

export interface PayoffPoint {
  /** "YYYY-MM" */
  month: string;
  /** Sisa nyata di akhir bulan (null untuk bulan depan) */
  actual: number | null;
  /** Proyeksi sisa di akhir bulan (null untuk bulan lalu) */
  projected: number | null;
}

const ym = (iso: ISODate) => iso.slice(0, 7);
function addMonth(month: string, n: number) {
  const { y, m } = parts(`${month}-01`);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function payoffTimeline(debts: PayoffDebtInput[], today: ISODate, monthsBack = 12): PayoffPoint[] {
  if (debts.length === 0) return [];
  const cur = ym(today);
  // Riwayat mulai dari bulan hutang pertama dicatat, paling jauh `monthsBack` bulan ke belakang
  const earliest = debts.map((d) => ym(d.trackFrom)).sort()[0];
  const floor = addMonth(cur, -monthsBack);
  const start = earliest < floor ? floor : earliest;

  const remainingAt = (month: string) =>
    debts.reduce((sum, d) => {
      if (ym(d.trackFrom) > month) return sum;
      const paid = d.payments.filter((p) => ym(p.date) <= month).reduce((a, p) => a + p.principal, 0);
      return sum + Math.max(0, d.base - paid);
    }, 0);

  const points: PayoffPoint[] = [];
  for (let m = start; m < cur; m = addMonth(m, 1)) points.push({ month: m, actual: remainingAt(m), projected: null });

  const now = debts.reduce((sum, d) => sum + Math.max(0, d.base - d.payments.reduce((a, p) => a + p.principal, 0)), 0);
  points.push({ month: cur, actual: now, projected: now });

  const unpaid = debts.flatMap((d) => d.unpaid);
  if (now <= 0 || unpaid.length === 0) return points;
  // Cicilan bulan ini / yang terlambat dianggap terbayar di titik bulan depan
  const last = unpaid.map((u) => ym(u.due)).sort().at(-1)!;
  const end = last > cur ? last : addMonth(cur, 1);
  for (let m = addMonth(cur, 1); m <= end; m = addMonth(m, 1)) {
    const due = unpaid.filter((u) => ym(u.due) <= m).reduce((a, u) => a + u.principal, 0);
    points.push({ month: m, actual: null, projected: Math.max(0, now - due) });
  }
  return points;
}

/** Hitung mundur ke tanggal lunas: "terlambat" / "bulan ini" / "3 bln lagi". */
export function payoffCountdown(endDate: string, today: string): { label: string; late: boolean } {
  if (endDate < today) return { label: "terlambat", late: true };
  const n = diffMonths(today, endDate);
  return { label: n <= 0 ? "bulan ini" : `${n} bln lagi`, late: false };
}
