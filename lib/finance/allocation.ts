import { allocateByPercent } from "./money";

export interface AllocLike {
  amount?: number | null;
  percent?: number | null;
}

/** Nominal tiap pos: nominal tetap dulu, sisanya dibagi menurut persen (tanpa kehilangan rupiah). */
export function resolveAmounts(total: number, items: AllocLike[]): number[] {
  const fixed = items.map((i) => (i.amount != null && i.percent == null ? i.amount : 0));
  const rest = Math.max(0, total - fixed.reduce((a, b) => a + b, 0));
  const pctIdx = items.map((i, idx) => (i.percent != null ? idx : -1)).filter((i) => i >= 0);
  const pctAmounts = allocateByPercent(rest, pctIdx.map((i) => items[i].percent!));
  const out = [...fixed];
  pctIdx.forEach((idx, k) => (out[idx] = pctAmounts[k]));
  return out;
}
