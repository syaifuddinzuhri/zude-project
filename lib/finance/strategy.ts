import { monthlyRate } from "./amortization";

export interface StrategyDebt {
  id: number;
  name: string;
  balance: number;
  rateBp: number;
  minPayment: number;
}

export type Strategy = "snowball" | "avalanche";

export interface StrategyResult {
  strategy: Strategy;
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffMonth: Record<number, number>;
  order: number[];
  feasible: boolean;
}

const MAX_MONTHS = 600;

/**
 * Simulasi pelunasan bulanan:
 * 1. Bunga bulan berjalan ditambahkan ke saldo.
 * 2. Semua hutang dibayar minimal.
 * 3. Dana ekstra + cicilan dari hutang yang sudah lunas dialirkan ke hutang target
 *    (snowball: saldo terkecil; avalanche: bunga tertinggi).
 */
export function simulateStrategy(debts: StrategyDebt[], extraPerMonth: number, strategy: Strategy): StrategyResult {
  const state = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const order = [...state]
    .sort((a, b) =>
      strategy === "snowball" ? a.balance - b.balance || b.rateBp - a.rateBp : b.rateBp - a.rateBp || a.balance - b.balance,
    )
    .map((d) => d.id);
  const budget = state.reduce((a, d) => a + d.minPayment, 0) + Math.max(0, extraPerMonth);
  const payoffMonth: Record<number, number> = {};
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  while (state.some((d) => d.balance > 0) && month < MAX_MONTHS) {
    month++;
    for (const d of state) {
      if (d.balance <= 0) continue;
      const interest = Math.round(d.balance * monthlyRate(d.rateBp));
      d.balance += interest;
      totalInterest += interest;
    }
    let pool = budget;
    for (const d of state) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minPayment, d.balance, pool);
      d.balance -= pay;
      pool -= pay;
      totalPaid += pay;
    }
    for (const id of order) {
      if (pool <= 0) break;
      const d = state.find((x) => x.id === id)!;
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, pool);
      d.balance -= pay;
      pool -= pay;
      totalPaid += pay;
    }
    for (const d of state) {
      if (d.balance <= 0 && payoffMonth[d.id] === undefined) payoffMonth[d.id] = month;
    }
  }

  return {
    strategy,
    months: month,
    totalInterest,
    totalPaid,
    payoffMonth,
    order,
    feasible: state.every((d) => d.balance <= 0),
  };
}

export function compareStrategies(debts: StrategyDebt[], extraPerMonth: number) {
  const snowball = simulateStrategy(debts, extraPerMonth, "snowball");
  const avalanche = simulateStrategy(debts, extraPerMonth, "avalanche");
  const baseline = simulateStrategy(debts, 0, "avalanche");
  return { snowball, avalanche, baseline };
}
