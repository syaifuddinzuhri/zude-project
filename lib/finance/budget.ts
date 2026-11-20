export type BudgetColor = "green" | "yellow" | "red";

export interface BudgetLine {
  budget: number;
  rollover: number;
  spent: number;
}

export function available(line: BudgetLine): number {
  return line.budget + line.rollover;
}

export function remaining(line: BudgetLine): number {
  return available(line) - line.spent;
}

export function usage(line: BudgetLine): number {
  const avail = available(line);
  if (avail <= 0) return line.spent > 0 ? Infinity : 0;
  return line.spent / avail;
}

/** Hijau < 80%, kuning 80–100%, merah > 100%. */
export function budgetColor(line: BudgetLine): BudgetColor {
  const u = usage(line);
  if (u > 1) return "red";
  if (u >= 0.8) return "yellow";
  return "green";
}

/** Nominal rollover yang dibawa ke periode berikutnya (bisa negatif bila lebih). */
export function nextRollover(line: BudgetLine, enabled: boolean): number {
  return enabled ? remaining(line) : 0;
}

/** Zero-based: pemasukan rencana − total alokasi. Target = 0. */
export function unallocated(plannedIncome: number, allocations: number[]): number {
  return plannedIncome - allocations.reduce((a, b) => a + b, 0);
}

/** Ambang notifikasi yang baru terlewati (80 dan/atau 100) setelah pengeluaran bertambah. */
export function crossedThresholds(before: BudgetLine, after: BudgetLine, thresholds = [0.8, 1]): number[] {
  const ub = usage(before);
  const ua = usage(after);
  return thresholds.filter((t) => ub < t && ua >= t).map((t) => Math.round(t * 100));
}

/** Sinking fund: nominal tahunan dibagi rata per bulan (dibulatkan ke atas). */
export function sinkingMonthly(annualAmount: number): number {
  return Math.ceil(annualAmount / 12);
}

/** Sinking fund dengan jatuh tempo: sisihkan sisa kebutuhan dibagi bulan tersisa. */
export function sinkingMonthlyUntilDue(annualAmount: number, saved: number, monthsLeft: number): number {
  const need = Math.max(0, annualAmount - saved);
  return Math.ceil(need / Math.max(1, monthsLeft));
}

export interface SpendableInput {
  budgets: BudgetLine[];
  income: number;
  outflow: number;
}

/**
 * Sisa uang yang bisa dipakai sampai gajian berikutnya.
 * Jika ada anggaran: Σ sisa anggaran pengeluaran (positif).
 * Tanpa anggaran: pemasukan − pengeluaran periode berjalan.
 */
export function spendable(input: SpendableInput): number {
  if (input.budgets.length > 0) {
    return input.budgets.reduce((a, l) => a + Math.max(0, remaining(l)), 0);
  }
  return input.income - input.outflow;
}

export function perDay(amount: number, daysLeft: number): number {
  return Math.floor(amount / Math.max(1, daysLeft));
}
