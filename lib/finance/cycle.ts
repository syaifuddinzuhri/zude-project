import { addDays, clampDay, formatRange, parts, previousWorkday, type ISODate } from "./date";

export type CycleMode = "husband_payday" | "wife_payday" | "manual";

export interface CycleSettings {
  cycleMode: CycleMode;
  cycleStartDay: number;
  husbandPayday: number;
  wifePayday: number;
  paydayWeekendRule: boolean;
}

export interface Period {
  start: ISODate;
  end: ISODate;
}

export function cycleStartDay(s: CycleSettings): number {
  if (s.cycleMode === "husband_payday") return s.husbandPayday;
  if (s.cycleMode === "wife_payday") return s.wifePayday;
  return s.cycleStartDay;
}

/**
 * Tanggal jangkar di bulan (y,m) untuk hari `day`.
 * - Hari dipotong ke akhir bulan (mis. 31 → 30 Nov).
 * - Jika `weekendRule` aktif dan tanggal jatuh di akhir pekan, maju ke hari kerja sebelumnya.
 */
export function anchorDate(y: number, m: number, day: number, weekendRule: boolean): ISODate {
  const d = clampDay(y, m, day);
  return weekendRule ? previousWorkday(d) : d;
}

/** Siklus bulan keuangan yang memuat tanggal `date`. */
export function periodFor(date: ISODate, startDay: number, weekendRule = false): Period {
  const { y, m } = parts(date);
  const here = anchorDate(y, m, startDay, weekendRule);
  if (date >= here) {
    const next = anchorDate(y, m + 1, startDay, weekendRule);
    return { start: here, end: addDays(next, -1) };
  }
  const prev = anchorDate(y, m - 1, startDay, weekendRule);
  return { start: prev, end: addDays(here, -1) };
}

export function periodForSettings(date: ISODate, s: CycleSettings): Period {
  return periodFor(date, cycleStartDay(s), s.paydayWeekendRule);
}

/** Geser siklus sebanyak `offset` (−1 = bulan lalu, +1 = bulan depan). */
export function shiftPeriod(p: Period, offset: number, startDay: number, weekendRule = false): Period {
  let cur = p;
  for (let i = 0; i < Math.abs(offset); i++) {
    cur = offset > 0 ? periodFor(addDays(cur.end, 1), startDay, weekendRule) : periodFor(addDays(cur.start, -1), startDay, weekendRule);
  }
  return cur;
}

export function periodLabel(p: Period): string {
  return formatRange(p.start, p.end);
}

/** Tanggal gajian berikutnya (≥ hari ini). */
export function nextPayday(today: ISODate, payday: number, weekendRule = false): ISODate {
  const { y, m } = parts(today);
  const here = anchorDate(y, m, payday, weekendRule);
  return here >= today ? here : anchorDate(y, m + 1, payday, weekendRule);
}

export function isPayday(today: ISODate, payday: number, weekendRule = false): boolean {
  const { y, m } = parts(today);
  return anchorDate(y, m, payday, weekendRule) === today;
}
