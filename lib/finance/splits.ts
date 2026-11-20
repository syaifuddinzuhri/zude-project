export interface SplitInput {
  categoryId: number;
  amount: number;
  note?: string | null;
}

export type SplitCheck = { ok: true } | { ok: false; message: string };

/** Jumlah split harus sama dengan nominal transaksi, minimal satu baris, semua positif. */
export function validateSplits(total: number, splits: SplitInput[]): SplitCheck {
  if (!Number.isInteger(total) || total <= 0) return { ok: false, message: "Nominal belum diisi" };
  if (splits.length === 0) return { ok: false, message: "Kategori belum dipilih" };
  for (const s of splits) {
    if (!Number.isInteger(s.amount) || s.amount <= 0) return { ok: false, message: "Nominal tiap kategori harus lebih dari 0" };
    if (!s.categoryId) return { ok: false, message: "Kategori belum dipilih" };
  }
  const sum = splits.reduce((a, s) => a + s.amount, 0);
  if (sum !== total) {
    const diff = total - sum;
    return {
      ok: false,
      message: diff > 0 ? `Masih ada Rp ${diff.toLocaleString("id-ID")} yang belum dibagi` : `Pembagian kelebihan Rp ${(-diff).toLocaleString("id-ID")}`,
    };
  }
  return { ok: true };
}

/** Sisa nominal yang belum dibagi (untuk UI split). */
export function unsplitRemainder(total: number, splits: { amount: number }[]): number {
  return total - splits.reduce((a, s) => a + s.amount, 0);
}

/** Gabungkan split dengan kategori sama. */
export function normalizeSplits(splits: SplitInput[]): SplitInput[] {
  const map = new Map<number, SplitInput>();
  for (const s of splits) {
    const prev = map.get(s.categoryId);
    if (prev) prev.amount += s.amount;
    else map.set(s.categoryId, { ...s });
  }
  return [...map.values()];
}
