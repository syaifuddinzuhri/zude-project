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

export interface CategoryCompareRow {
  id: number;
  current: number;
  previous: number;
  /** Rata-rata siklus pembanding (siklus tanpa data tetap dihitung 0) */
  average: number;
  /** Perubahan siklus ini terhadap rata-rata; null bila rata-rata 0 */
  change: number | null;
}

/**
 * Bandingkan pengeluaran per kategori: siklus ini vs siklus lalu vs rata-rata N siklus sebelumnya.
 * `history[0]` = siklus lalu, `history[1]` = dua siklus lalu, dst.
 */
export function compareCategories(current: Map<number, number>, history: Map<number, number>[]): CategoryCompareRow[] {
  const ids = new Set<number>([...current.keys(), ...history.flatMap((h) => [...h.keys()])]);
  const rows: CategoryCompareRow[] = [];
  for (const id of ids) {
    const cur = current.get(id) ?? 0;
    const prev = history[0]?.get(id) ?? 0;
    const average = history.length ? Math.round(history.reduce((a, h) => a + (h.get(id) ?? 0), 0) / history.length) : 0;
    if (cur === 0 && average === 0 && prev === 0) continue;
    rows.push({ id, current: cur, previous: prev, average, change: average > 0 ? (cur - average) / average : null });
  }
  return rows.sort((a, b) => b.current - a.current || b.average - a.average);
}
