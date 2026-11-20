import { addDays, addMonths, clampDay, dayOfWeek, lastWorkdayOfMonth, parts, type ISODate } from "./date";

export type Frequency = "daily" | "weekly" | "monthly" | "last_workday" | "yearly" | "every_n_months";

export interface RuleLike {
  frequency: Frequency;
  interval: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: ISODate;
  endDate: ISODate | null;
}

/** Kejadian ke-k (k ≥ 0) dari aturan, dihitung dari tanggal mulai. */
function occurrence(rule: RuleLike, k: number): ISODate {
  const interval = Math.max(1, rule.interval || 1);
  const s = parts(rule.startDate);
  switch (rule.frequency) {
    case "daily":
      return addDays(rule.startDate, k * interval);
    case "weekly": {
      const target = rule.dayOfWeek ?? dayOfWeek(rule.startDate);
      const shift = (target - dayOfWeek(rule.startDate) + 7) % 7;
      return addDays(rule.startDate, shift + k * 7 * interval);
    }
    case "monthly":
    case "every_n_months": {
      const day = rule.dayOfMonth ?? s.d;
      let first = clampDay(s.y, s.m, day);
      let offset = 0;
      if (first < rule.startDate) offset = 1;
      first = clampDay(s.y, s.m + offset, day);
      const { y, m } = parts(first);
      return clampDay(y, m + k * interval, day);
    }
    case "last_workday": {
      let first = lastWorkdayOfMonth(s.y, s.m);
      let offset = 0;
      if (first < rule.startDate) offset = 1;
      first = lastWorkdayOfMonth(s.y, s.m + offset);
      const { y, m } = parts(first);
      const base = new Date(Date.UTC(y, m - 1 + k * interval, 1));
      return lastWorkdayOfMonth(base.getUTCFullYear(), base.getUTCMonth() + 1);
    }
    case "yearly": {
      const month = rule.monthOfYear ?? s.m;
      const day = rule.dayOfMonth ?? s.d;
      let year = s.y;
      if (clampDay(year, month, day) < rule.startDate) year++;
      return clampDay(year + k * interval, month, day);
    }
  }
}

/** Semua kejadian dalam rentang [from, to] inklusif. */
export function occurrencesBetween(rule: RuleLike, from: ISODate, to: ISODate, limit = 400): ISODate[] {
  const out: ISODate[] = [];
  for (let k = 0; k < 100_000 && out.length < limit; k++) {
    const d = occurrence(rule, k);
    if (rule.endDate && d > rule.endDate) break;
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

/** Kejadian pertama ≥ `from`, atau null jika aturan sudah berakhir. */
export function nextOccurrence(rule: RuleLike, from: ISODate): ISODate | null {
  for (let k = 0; k < 100_000; k++) {
    const d = occurrence(rule, k);
    if (rule.endDate && d > rule.endDate) return null;
    if (d >= from) return d;
  }
  return null;
}

/** Kejadian setelah `after` (eksklusif). */
export function occurrenceAfter(rule: RuleLike, after: ISODate): ISODate | null {
  return nextOccurrence(rule, addDays(after, 1));
}

export type BillStatus = "paid" | "unpaid" | "late";

export function billStatus(dueDate: ISODate, today: ISODate, paid: boolean): BillStatus {
  if (paid) return "paid";
  return dueDate < today ? "late" : "unpaid";
}

/** Hari menuju jatuh tempo (H-n). */
export function daysUntil(today: ISODate, due: ISODate): number {
  return Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
}

export { addMonths };
