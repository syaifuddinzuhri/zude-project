"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run } from "@/lib/server/action";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/notify";

const householdSchema = z.object({
  cycleMode: z.enum(["husband_payday", "wife_payday", "manual"]),
  cycleStartDay: z.coerce.number().int().min(1).max(31),
  husbandPayday: z.coerce.number().int().min(1).max(31),
  wifePayday: z.coerce.number().int().min(1).max(31),
  husbandSalary: z.coerce.number().int().min(0),
  wifeSalary: z.coerce.number().int().min(0),
  husbandSalaryAccountId: z.coerce.number().int().positive().nullish(),
  wifeSalaryAccountId: z.coerce.number().int().positive().nullish(),
  husbandTemplateId: z.coerce.number().int().positive().nullish(),
  wifeTemplateId: z.coerce.number().int().positive().nullish(),
  paydayWeekendRule: z.coerce.boolean(),
  bigExpenseThreshold: z.coerce.number().int().min(0),
  emergencyMonths: z.coerce.number().int().min(1).max(36),
  ratioNeeds: z.coerce.number().int().min(0).max(100),
  ratioWants: z.coerce.number().int().min(0).max(100),
  ratioSavings: z.coerce.number().int().min(0).max(100),
});

export async function saveHouseholdAction(input: unknown) {
  return run(async (u) => {
    const i = householdSchema.parse(input);
    if (i.ratioNeeds + i.ratioWants + i.ratioSavings !== 100) throw new Error("Total target rasio harus 100%");
    const before = await db.householdSettings.findUnique({ where: { id: 1 } });
    const data = {
      ...i,
      husbandSalary: BigInt(i.husbandSalary),
      wifeSalary: BigInt(i.wifeSalary),
      bigExpenseThreshold: BigInt(i.bigExpenseThreshold),
      husbandSalaryAccountId: i.husbandSalaryAccountId ?? null,
      wifeSalaryAccountId: i.wifeSalaryAccountId ?? null,
      husbandTemplateId: i.husbandTemplateId ?? null,
      wifeTemplateId: i.wifeTemplateId ?? null,
    };
    const after = await db.householdSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    await audit(db, { userId: u.id, entity: "household_settings", entityId: 1, action: "update", before, after });
  });
}

const namesSchema = z.object({
  husbandName: z.string().trim().min(1, "Nama suami belum diisi").max(40),
  wifeName: z.string().trim().min(1, "Nama istri belum diisi").max(40),
});

export async function saveNamesAction(input: unknown) {
  return run(async (u) => {
    const i = namesSchema.parse(input);
    const before = await db.householdSettings.findUnique({ where: { id: 1 }, select: { husbandName: true, wifeName: true } });
    await db.householdSettings.upsert({ where: { id: 1 }, create: { id: 1, ...i }, update: i });
    await audit(db, { userId: u.id, entity: "household_settings", entityId: 1, action: "update", before, after: i });
  });
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nama belum diisi").max(80),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
  hideAmountInPush: z.coerce.boolean(),
  dailyReminderTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function saveProfileAction(input: unknown) {
  return run(async (u) => {
    const i = profileSchema.parse(input);
    await db.user.update({ where: { id: u.id }, data: i });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: "update", after: i });
  });
}

export async function setNotificationPrefAction(type: string, channel: "push" | "inapp" | "email", enabled: boolean) {
  return run(async (u) => {
    const field = channel === "push" ? "pushEnabled" : channel === "inapp" ? "inappEnabled" : "emailEnabled";
    await db.notificationPref.upsert({
      where: { userId_type: { userId: u.id, type } },
      create: { userId: u.id, type, [field]: enabled },
      update: { [field]: enabled },
    });
  });
}

export async function sendTestNotificationAction() {
  return run(async (u) => {
    const subs = await db.pushSubscription.count({ where: { userId: u.id } });
    await notify([u.id], { type: "test", title: "Notifikasi uji", body: "Push ZuDe berhasil 🎉", url: "/pengaturan/notifikasi", dedupeKey: `test:${Date.now()}`, urgent: true });
    return subs;
  });
}

export async function markNotificationsReadAction(ids?: number[]) {
  return run(async (u) => {
    await db.notification.updateMany({ where: { userId: u.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  });
}

export async function removeDeviceAction(id: number) {
  return run(async (u) => {
    await db.pushSubscription.deleteMany({ where: { id, userId: u.id } });
  });
}
