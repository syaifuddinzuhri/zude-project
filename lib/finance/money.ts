/** Semua nominal adalah integer rupiah. */

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export const HIDDEN = "Rp ••••••";

export function formatNumber(n: number): string {
  return nf.format(Math.round(n));
}

/** `Rp 1.234.567`, negatif `−Rp 1.234.567`. Opsi `sign` menambahkan `+` untuk positif. */
export function formatRp(n: number, opts: { sign?: boolean } = {}): string {
  const v = Math.round(n);
  const abs = nf.format(Math.abs(v));
  if (v < 0) return `−Rp ${abs}`;
  if (opts.sign && v > 0) return `+Rp ${abs}`;
  return `Rp ${abs}`;
}

/** Ringkas untuk kartu kecil: `Rp 1,25 jt`, `Rp 350 rb`, `Rp 1,2 M`. */
export function formatRpShort(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  const fmt = (x: number, unit: string) =>
    `${sign}Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(x)} ${unit}`;
  if (abs >= 1_000_000_000_000) return fmt(abs / 1_000_000_000_000, "T");
  if (abs >= 1_000_000_000) return fmt(abs / 1_000_000_000, "M");
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "jt");
  if (abs >= 1_000) return fmt(Math.floor(abs / 1_000), "rb").replace(/,\d+ rb$/, " rb");
  return `${sign}Rp ${abs}`;
}

/** Ambil angka dari teks bebas ("Rp 1.250.000" → 1250000). */
export function parseRp(text: string): number {
  const digits = text.replace(/[^\d-]/g, "");
  const n = parseInt(digits || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Bagi `total` ke beberapa bobot tanpa kehilangan rupiah (sisa ke item terbesar). */
export function allocateByPercent(total: number, percents: number[]): number[] {
  const raw = percents.map((p) => Math.floor((total * p) / 100));
  const used = sum(raw);
  const target = Math.round((total * sum(percents)) / 100);
  let rest = target - used;
  const order = percents.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  let k = 0;
  while (rest > 0 && order.length) {
    raw[order[k % order.length][1]] += 1;
    rest--;
    k++;
  }
  return raw;
}

/** Persen dari basis poin (750 → "7,5%"). */
export function formatRateBp(bp: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(bp / 100)}%`;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(ratio * 100)}%`;
}
