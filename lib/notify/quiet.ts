import { nowTimeJakarta, todayJakarta, addDays } from "@/lib/finance/date";

/** Apakah jam "HH:mm" berada dalam rentang jam tenang (bisa melewati tengah malam). */
export function inQuietHours(time: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end ? time >= start && time < end : time >= start || time < end;
}

/** Waktu (UTC Date) akhir jam tenang berikutnya, dalam WIB. */
export function quietEndAt(end: string, now = new Date()): Date {
  const today = todayJakarta(now);
  const time = nowTimeJakarta(now);
  const day = time < end ? today : addDays(today, 1);
  return new Date(`${day}T${end}:00+07:00`);
}
