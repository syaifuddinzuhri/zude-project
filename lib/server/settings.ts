import "server-only";
import { db } from "@/lib/db";
import { cycleStartDay, periodFor, shiftPeriod, type CycleSettings, type Period } from "@/lib/finance/cycle";
import { todayJakarta, type ISODate } from "@/lib/finance/date";

export async function getSettings() {
  const s = await db.householdSettings.findUnique({ where: { id: 1 } });
  return s ?? (await db.householdSettings.create({ data: { id: 1 } }));
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;

export function cycleOf(s: Settings): CycleSettings {
  return {
    cycleMode: s.cycleMode,
    cycleStartDay: s.cycleStartDay,
    husbandPayday: s.husbandPayday,
    wifePayday: s.wifePayday,
    paydayWeekendRule: s.paydayWeekendRule,
  };
}

/** Periode siklus untuk tanggal tertentu (default hari ini), bisa digeser `offset` siklus. */
export function periodOf(s: Settings, date: ISODate = todayJakarta(), offset = 0): Period {
  const day = cycleStartDay(cycleOf(s));
  const p = periodFor(date, day, s.paydayWeekendRule);
  return offset ? shiftPeriod(p, offset, day, s.paydayWeekendRule) : p;
}

export type OwnerNames = { suami: string; istri: string; bersama: string };

/** Nama tampilan suami/istri dari Pengaturan → Profil. */
export function ownerNames(s: Settings): OwnerNames {
  return { suami: s.husbandName || "Suami", istri: s.wifeName || "Istri", bersama: "Bersama" };
}
