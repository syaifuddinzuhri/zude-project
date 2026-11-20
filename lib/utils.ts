import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const OWNER_LABEL: Record<string, string> = { suami: "Suami", istri: "Istri", bersama: "Bersama" };

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: "Rekening bank",
  ewallet: "E-wallet",
  cash: "Tunai",
  credit_card: "Kartu kredit",
  paylater: "Paylater",
  investment: "Investasi",
  receivable: "Piutang",
};

export const TX_TYPE_LABEL: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  debt_payment: "Bayar Cicilan",
  saving_deposit: "Setor Tabungan",
  adjustment: "Penyesuaian",
};

export const DEBT_TYPE_LABEL: Record<string, string> = {
  kpr: "KPR",
  kendaraan: "Kendaraan (KKB)",
  kta: "Kredit Tanpa Agunan",
  kartu_kredit: "Kartu Kredit",
  paylater: "Paylater",
  pinjol: "Pinjaman Online",
  keluarga: "Pinjaman Keluarga/Teman",
  cicilan_barang: "Cicilan barang (0%)",
  lainnya: "Lainnya",
};

export const INTEREST_TYPE_LABEL: Record<string, string> = {
  flat: "Flat",
  annuity: "Efektif (anuitas)",
  floating: "Floating",
  zero: "0%",
};

export const BENEFICIARY_LABEL: Record<string, string> = { suami: "Suami", istri: "Istri", anak: "Anak", keluarga: "Keluarga" };

export const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  last_workday: "Hari kerja terakhir",
  yearly: "Tahunan",
  every_n_months: "Setiap N bulan",
};

export const NATURE_LABEL: Record<string, string> = { needs: "Wajib", wants: "Keinginan", savings_debt: "Tabungan/Hutang" };

export const ASSET_TYPE_LABEL: Record<string, string> = {
  property: "Properti",
  vehicle: "Kendaraan",
  gold: "Emas",
  mutual_fund: "Reksa dana",
  stock: "Saham",
  crypto: "Kripto",
  pension: "BPJS TK/JHT",
  other: "Lainnya",
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Terjadi kesalahan, coba lagi";
}
