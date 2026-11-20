/**
 * Utilitas tanggal berbasis string ISO "YYYY-MM-DD" (tanggal lokal Asia/Jakarta).
 * Semua perhitungan memakai UTC agar tidak terpengaruh zona waktu server.
 */
export type ISODate = string;

export const TZ = "Asia/Jakarta";

export function todayJakarta(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nowTimeJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function toDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function make(y: number, m: number, d: number): ISODate {
  // m 1–12, boleh di luar rentang (dinormalisasi)
  const date = new Date(Date.UTC(y, m - 1, d));
  return fromDate(date);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Tanggal di bulan (y,m) dengan hari `day`, dipotong ke akhir bulan bila perlu. */
export function clampDay(y: number, m: number, day: number): ISODate {
  const norm = new Date(Date.UTC(y, m - 1, 1));
  const yy = norm.getUTCFullYear();
  const mm = norm.getUTCMonth() + 1;
  return make(yy, mm, Math.min(day, daysInMonth(yy, mm)));
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

/** Tambah n bulan; hari dipotong ke akhir bulan (31 Jan + 1 = 28/29 Feb). */
export function addMonths(iso: ISODate, n: number, day?: number): ISODate {
  const { y, m, d } = parts(iso);
  return clampDay(y, m + n, day ?? d);
}

/** 0 = Minggu … 6 = Sabtu */
export function dayOfWeek(iso: ISODate): number {
  return toDate(iso).getUTCDay();
}

export function isWeekend(iso: ISODate): boolean {
  const w = dayOfWeek(iso);
  return w === 0 || w === 6;
}

export function previousWorkday(iso: ISODate): ISODate {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

export function lastWorkdayOfMonth(y: number, m: number): ISODate {
  return previousWorkday(make(y, m, daysInMonth(y, m)));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

/** Selisih bulan kalender (b − a), mengabaikan hari. */
export function diffMonths(a: ISODate, b: ISODate): number {
  const pa = parts(a);
  const pb = parts(b);
  return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function formatShortDate(iso: ISODate): string {
  const { d, m } = parts(iso);
  return `${d} ${BULAN[m - 1]}`;
}

export function formatDate(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export function formatLongDate(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${HARI[dayOfWeek(iso)]}, ${d} ${BULAN_PANJANG[m - 1]} ${y}`;
}

export function formatMonthYear(iso: ISODate): string {
  const { y, m } = parts(iso);
  return `${BULAN_PANJANG[m - 1]} ${y}`;
}

export function formatRange(start: ISODate, end: ISODate): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}
