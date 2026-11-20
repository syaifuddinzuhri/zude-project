import { diffMonths, type ISODate } from "./date";

/** Bulan tersisa termasuk bulan berjalan (min. 1). */
export function monthsLeft(today: ISODate, targetDate: ISODate): number {
  return Math.max(1, diffMonths(today, targetDate) + (targetDate.slice(8) >= today.slice(8) ? 1 : 0));
}

/** Setoran per bulan yang dibutuhkan agar target tercapai tepat waktu. */
export function requiredMonthly(target: number, saved: number, today: ISODate, targetDate: ISODate | null): number {
  const need = Math.max(0, target - saved);
  if (!targetDate || need === 0) return 0;
  return Math.ceil(need / monthsLeft(today, targetDate));
}

export interface GoalStatusInput {
  target: number;
  savedBeforePeriod: number;
  depositedThisPeriod: number;
  periodStart: ISODate;
  targetDate: ISODate | null;
}

export interface GoalStatus {
  saved: number;
  progress: number;
  required: number;
  shortfall: number;
  onTrack: boolean;
  achieved: boolean;
}

/** Status tujuan untuk siklus berjalan: dibandingkan setoran yang dibutuhkan sejak awal siklus. */
export function goalStatus(i: GoalStatusInput): GoalStatus {
  const saved = i.savedBeforePeriod + i.depositedThisPeriod;
  const achieved = saved >= i.target && i.target > 0;
  const required = requiredMonthly(i.target, i.savedBeforePeriod, i.periodStart, i.targetDate);
  const shortfall = Math.max(0, required - i.depositedThisPeriod);
  return {
    saved,
    progress: i.target > 0 ? Math.min(1, saved / i.target) : 0,
    required,
    shortfall,
    onTrack: achieved || shortfall === 0,
    achieved,
  };
}

/** Target dana darurat = N × pengeluaran wajib bulanan. */
export function emergencyTarget(monthlyNeeds: number, months: number): number {
  return Math.max(0, Math.round(monthlyNeeds * months));
}

/** Total alokasi virtual per akun tidak boleh melebihi saldo akun. */
export function canAllocate(accountBalance: number, existingAllocations: number, newAmount: number): boolean {
  return existingAllocations + newAmount <= accountBalance;
}

/** Rasio dana darurat: berapa bulan pengeluaran wajib yang tertutup. */
export function emergencyCoverage(saved: number, monthlyNeeds: number): number {
  if (monthlyNeeds <= 0) return 0;
  return saved / monthlyNeeds;
}
