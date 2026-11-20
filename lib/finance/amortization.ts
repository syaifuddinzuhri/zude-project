import { addMonths, parts, type ISODate } from "./date";

export type InterestType = "flat" | "annuity" | "floating" | "zero";

export interface RateChange {
  effectiveDate: ISODate;
  rateBp: number; // persen per tahun × 100
}

export interface ScheduleRow {
  periodNo: number;
  dueDate: ISODate;
  principal: number;
  interest: number;
  total: number;
  remaining: number;
}

export interface ScheduleParams {
  /** Pokok yang akan diamortisasi (pokok awal, atau sisa pokok saat dihitung ulang). */
  principal: number;
  /** Jumlah periode yang dijadwalkan (diabaikan bila `fixedInstallment` diisi). */
  periods: number;
  type: InterestType;
  rateBp: number;
  /** Tanggal jatuh tempo periode pertama dalam jadwal ini. */
  firstDueDate: ISODate;
  dueDay: number;
  startPeriodNo?: number;
  /** Floating: riwayat perubahan bunga (selain `rateBp` dasar). */
  rateChanges?: RateChange[];
  /** Jika diisi: cicilan tetap, tenor dihitung (mode "kurangi tenor"). */
  fixedInstallment?: number;
  /** Bunga flat dihitung dari pokok basis ini (default = principal). */
  flatBase?: number;
}

const MAX_PERIODS = 600;

export function monthlyRate(rateBp: number): number {
  return rateBp / 10000 / 12;
}

/** Cicilan anuitas (PMT), dibulatkan ke rupiah. */
export function annuityPayment(principal: number, rateBp: number, n: number): number {
  if (n <= 0) return principal;
  const r = monthlyRate(rateBp);
  if (r === 0) return Math.ceil(principal / n);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
}

/** Bunga yang berlaku pada tanggal tertentu (perubahan terakhir ≤ tanggal). */
export function rateAt(date: ISODate, baseBp: number, changes: RateChange[] = []): number {
  let rate = baseBp;
  for (const c of [...changes].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))) {
    if (c.effectiveDate <= date) rate = c.rateBp;
  }
  return rate;
}

export function dueDateFor(firstDueDate: ISODate, index: number, dueDay: number): ISODate {
  return addMonths(firstDueDate, index, dueDay);
}

/** Jatuh tempo pertama: bulan setelah tanggal mulai, pada `dueDay`. */
export function firstDueDateFrom(startDate: ISODate, dueDay: number): ISODate {
  const { y, m } = parts(startDate);
  return addMonths(`${y}-${String(m).padStart(2, "0")}-01`, 1, dueDay);
}

export function buildSchedule(p: ScheduleParams): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const startNo = p.startPeriodNo ?? 1;
  let remaining = p.principal;
  if (remaining <= 0) return rows;

  const flatBase = p.flatBase ?? p.principal;
  const fixed = p.fixedInstallment;
  const n = fixed ? MAX_PERIODS : Math.max(1, p.periods);

  let currentRate = p.type === "zero" ? 0 : p.rateBp;
  let pmt = p.type === "annuity" || p.type === "floating" ? annuityPayment(remaining, currentRate, n) : 0;
  const flatPrincipal = Math.floor(p.principal / n);

  for (let i = 0; i < n && remaining > 0; i++) {
    const dueDate = dueDateFor(p.firstDueDate, i, p.dueDay);
    const left = n - i;
    let interest = 0;
    let principal = 0;

    switch (p.type) {
      case "zero":
        interest = 0;
        principal = fixed ? fixed : left === 1 ? remaining : flatPrincipal;
        break;
      case "flat":
        interest = Math.round(flatBase * monthlyRate(p.rateBp));
        principal = fixed ? fixed - interest : left === 1 ? remaining : flatPrincipal;
        break;
      case "floating": {
        const r = rateAt(dueDate, p.rateBp, p.rateChanges);
        if (r !== currentRate) {
          currentRate = r;
          if (!fixed) pmt = annuityPayment(remaining, currentRate, left);
        }
        interest = Math.round(remaining * monthlyRate(currentRate));
        principal = (fixed ?? pmt) - interest;
        if (!fixed && left === 1) principal = remaining;
        break;
      }
      case "annuity":
        interest = Math.round(remaining * monthlyRate(currentRate));
        principal = (fixed ?? pmt) - interest;
        if (!fixed && left === 1) principal = remaining;
        break;
    }

    if (principal <= 0) {
      throw new Error("Cicilan tidak cukup menutup bunga — perbesar nominal cicilan");
    }
    principal = Math.min(principal, remaining);
    remaining -= principal;
    rows.push({
      periodNo: startNo + i,
      dueDate,
      principal,
      interest,
      total: principal + interest,
      remaining,
    });
  }
  return rows;
}

export interface DebtInput {
  principal: number;
  startDate: ISODate;
  tenorMonths: number;
  type: InterestType;
  rateBp: number;
  dueDay: number;
  rateChanges?: RateChange[];
}

/** Jadwal penuh dari awal pinjaman. */
export function scheduleForDebt(d: DebtInput): ScheduleRow[] {
  return buildSchedule({
    principal: d.principal,
    periods: d.tenorMonths,
    type: d.type,
    rateBp: d.rateBp,
    firstDueDate: firstDueDateFrom(d.startDate, d.dueDay),
    dueDay: d.dueDay,
    rateChanges: d.rateChanges,
  });
}

export function totalInterest(rows: ScheduleRow[]): number {
  return rows.reduce((a, r) => a + r.interest, 0);
}

export type ExtraMode = "reduce_tenor" | "reduce_installment";

export interface ExtraPaymentParams {
  /** Sisa pokok sebelum pelunasan sebagian. */
  remaining: number;
  /** Jadwal belum dibayar saat ini (untuk menghitung penghematan). */
  currentUnpaid: ScheduleRow[];
  extra: number;
  mode: ExtraMode;
  type: InterestType;
  rateBp: number;
  dueDay: number;
  rateChanges?: RateChange[];
}

export interface ExtraPaymentResult {
  schedule: ScheduleRow[];
  interestSaved: number;
  periodsSaved: number;
  newInstallment: number;
}

/**
 * Pelunasan sebagian: pokok berkurang `extra`, lalu jadwal sisa dihitung ulang.
 * - reduce_tenor: cicilan tetap, tenor lebih pendek
 * - reduce_installment: tenor tetap, cicilan lebih kecil
 */
export function applyExtraPayment(p: ExtraPaymentParams): ExtraPaymentResult {
  const unpaid = p.currentUnpaid;
  if (unpaid.length === 0) return { schedule: [], interestSaved: 0, periodsSaved: 0, newInstallment: 0 };
  const extra = Math.min(p.extra, p.remaining);
  const newPrincipal = p.remaining - extra;
  const first = unpaid[0];
  const base = {
    principal: newPrincipal,
    type: p.type,
    rateBp: p.rateBp,
    firstDueDate: first.dueDate,
    dueDay: p.dueDay,
    startPeriodNo: first.periodNo,
    rateChanges: p.rateChanges,
  };
  let schedule: ScheduleRow[];
  if (newPrincipal <= 0) {
    schedule = [];
  } else if (p.mode === "reduce_installment") {
    schedule = buildSchedule({ ...base, periods: unpaid.length });
  } else {
    // Cicilan dipertahankan sama seperti cicilan berikutnya saat ini.
    schedule = buildSchedule({ ...base, periods: unpaid.length, fixedInstallment: first.total, flatBase: newPrincipal });
  }
  return {
    schedule,
    interestSaved: totalInterest(unpaid) - totalInterest(schedule),
    periodsSaved: unpaid.length - schedule.length,
    newInstallment: schedule[0]?.total ?? 0,
  };
}

/** Hitung ulang jadwal floating dari sisa pokok saat bunga berubah. */
export function recalcFromRemaining(params: {
  remaining: number;
  remainingPeriods: number;
  nextPeriodNo: number;
  nextDueDate: ISODate;
  type: InterestType;
  rateBp: number;
  dueDay: number;
  rateChanges?: RateChange[];
  flatBase?: number;
}): ScheduleRow[] {
  return buildSchedule({
    principal: params.remaining,
    periods: params.remainingPeriods,
    type: params.type,
    rateBp: params.rateBp,
    firstDueDate: params.nextDueDate,
    dueDay: params.dueDay,
    startPeriodNo: params.nextPeriodNo,
    rateChanges: params.rateChanges,
    flatBase: params.flatBase,
  });
}

/** Debt Service Ratio = total cicilan ÷ total pemasukan bulanan. */
export function debtServiceRatio(monthlyInstallments: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return monthlyInstallments > 0 ? 1 : 0;
  return monthlyInstallments / monthlyIncome;
}
