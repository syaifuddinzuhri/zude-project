export type Nature = "needs" | "wants" | "savings_debt";

export interface NatureTotals {
  needs: number;
  wants: number;
  savings_debt: number;
}

export function ratioBreakdown(t: NatureTotals) {
  const total = t.needs + t.wants + t.savings_debt;
  const r = (v: number) => (total > 0 ? v / total : 0);
  return { total, needs: r(t.needs), wants: r(t.wants), savings_debt: r(t.savings_debt) };
}

/** Savings rate = (tabungan + pokok hutang) ÷ pemasukan. */
export function savingsRate(income: number, saved: number): number {
  return income > 0 ? saved / income : 0;
}

export const CATEGORY_COLORS = ["#14B8A6", "#6366F1", "#F59E0B", "#EC4899", "#0EA5E9", "#84CC16", "#F97316", "#A855F7"];
export const OTHER_COLOR = "#94A3B8";

/** Ambil 8 teratas, sisanya digabung jadi "Lainnya". */
export function topWithOthers<T extends { name: string; value: number; color?: string }>(items: T[], n = 8) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, n).map((i, idx) => ({ ...i, color: i.color ?? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }));
  const rest = sorted.slice(n).reduce((a, i) => a + i.value, 0);
  return rest > 0 ? [...top, { name: "Lainnya", value: rest, color: OTHER_COLOR }] : top;
}
