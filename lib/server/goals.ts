import "server-only";
import { z } from "zod";
import { db, n } from "@/lib/db";
import { fromDate, todayJakarta, toDate } from "@/lib/finance/date";
import { emergencyTarget, goalStatus } from "@/lib/finance/goals";
import type { Period } from "@/lib/finance/cycle";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { createTransaction } from "./transactions";
import { getSettings } from "./settings";
import { goalDepositsIn, goalSavedTotals } from "./stats";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Nama tujuan belum diisi").max(80),
  targetAmount: z.coerce.number().int().min(0),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("").transform(() => null)),
  accountId: z.coerce.number().int().positive().nullish(),
  owner: z.enum(["suami", "istri", "bersama"]),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  icon: z.string().max(16).default("🎯"),
  isEmergency: z.coerce.boolean().default(false),
});

export async function saveGoal(user: CurrentUser, id: number | null, raw: unknown) {
  const i = goalSchema.parse(raw);
  const data = {
    name: i.name,
    targetAmount: BigInt(i.targetAmount),
    targetDate: i.targetDate ? toDate(i.targetDate) : null,
    accountId: i.accountId ?? null,
    owner: i.owner,
    priority: i.priority,
    icon: i.icon,
    isEmergency: i.isEmergency,
  };
  return db.$transaction(async (tx) => {
    const before = id ? await tx.goal.findUniqueOrThrow({ where: { id } }) : null;
    const g = id ? await tx.goal.update({ where: { id }, data }) : await tx.goal.create({ data });
    await audit(tx, { userId: user.id, entity: "goal", entityId: g.id, action: id ? "update" : "create", before, after: g });
    return g;
  });
}

export async function deleteGoal(user: CurrentUser, id: number) {
  await db.$transaction(async (tx) => {
    const before = await tx.goal.findUniqueOrThrow({ where: { id } });
    await tx.goal.delete({ where: { id } });
    await audit(tx, { userId: user.id, entity: "goal", entityId: id, action: "delete", before });
  });
}

/** Setor ke tujuan: transaksi saving_deposit (pindah ke akun tujuan bila berbeda). */
export async function depositToGoal(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      goalId: z.coerce.number().int().positive(),
      fromAccountId: z.coerce.number().int().positive("Akun sumber belum dipilih"),
      amount: z.coerce.number().int().positive("Nominal belum diisi"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().max(255).nullish(),
    })
    .parse(raw);
  const goal = await db.goal.findUniqueOrThrow({ where: { id: i.goalId } });
  return createTransaction(user, {
    type: "saving_deposit",
    date: i.date ?? todayJakarta(),
    amount: i.amount,
    accountId: i.fromAccountId,
    toAccountId: goal.accountId ?? i.fromAccountId,
    goalId: goal.id,
    note: i.note ?? `Setor ${goal.name}`,
  });
}

/** Tarik dari tujuan: alokasi negatif, plus transfer bila uang dipindah ke akun lain. */
export async function withdrawFromGoal(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      goalId: z.coerce.number().int().positive(),
      toAccountId: z.coerce.number().int().positive().nullish(),
      amount: z.coerce.number().int().positive("Nominal belum diisi"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().max(255).nullish(),
    })
    .parse(raw);
  const date = i.date ?? todayJakarta();
  await db.$transaction(async (tx) => {
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: i.goalId } });
    const saved = n((await tx.goalAllocation.aggregate({ where: { goalId: goal.id }, _sum: { amount: true } }))._sum.amount);
    if (i.amount > saved) throw new Error("Nominal melebihi saldo tujuan");
    let transactionId: number | null = null;
    if (goal.accountId && i.toAccountId && i.toAccountId !== goal.accountId) {
      const t = await createTransaction(
        user,
        { type: "transfer", date, amount: i.amount, accountId: goal.accountId, toAccountId: i.toAccountId, note: i.note ?? `Tarik dari ${goal.name}` },
        { tx, skipNotify: true },
      );
      transactionId = t.id;
    }
    const a = await tx.goalAllocation.create({
      data: { goalId: goal.id, transactionId, amount: BigInt(-i.amount), date: toDate(date), note: i.note ?? "Penarikan", createdById: user.id },
    });
    await tx.goal.update({ where: { id: goal.id }, data: { isAchieved: false } });
    await audit(tx, { userId: user.id, entity: "goal_allocation", entityId: a.id, action: "create", after: a });
  });
}

/** Pengeluaran wajib bulanan rata-rata (3 periode terakhir dari split kategori `needs`). */
export async function monthlyNeeds(periods: Period[]): Promise<number> {
  if (periods.length === 0) return 0;
  let total = 0;
  for (const p of periods) {
    const agg = await db.transactionSplit.aggregate({
      where: {
        category: { OR: [{ nature: "needs" }, { parent: { nature: "needs" } }] },
        transaction: { deletedAt: null, status: "realized", type: { in: ["expense", "debt_payment"] }, date: { gte: toDate(p.start), lte: toDate(p.end) } },
      },
      _sum: { amount: true },
    });
    total += n(agg._sum.amount);
  }
  return Math.round(total / periods.length);
}

export async function goalsOverview(period: Period, pastPeriods: Period[]) {
  const [goals, savedBefore, deposited, settings] = await Promise.all([
    db.goal.findMany({ orderBy: [{ isAchieved: "asc" }, { priority: "asc" }, { id: "asc" }], include: { account: true } }),
    goalSavedTotals(period.start),
    goalDepositsIn(period),
    getSettings(),
  ]);
  const needs = goals.some((g) => g.isEmergency) ? await monthlyNeeds(pastPeriods) : 0;
  return goals.map((g) => {
    const target = g.isEmergency && needs > 0 ? emergencyTarget(needs, settings.emergencyMonths) : n(g.targetAmount);
    const st = goalStatus({
      target,
      savedBeforePeriod: savedBefore.get(g.id) ?? 0,
      depositedThisPeriod: deposited.get(g.id) ?? 0,
      periodStart: period.start,
      targetDate: g.targetDate ? fromDate(g.targetDate) : null,
    });
    return {
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: g.owner,
      priority: g.priority,
      isEmergency: g.isEmergency,
      accountId: g.accountId,
      accountName: g.account?.name ?? null,
      targetDate: g.targetDate ? fromDate(g.targetDate) : null,
      target,
      ...st,
    };
  });
}

export type GoalView = Awaited<ReturnType<typeof goalsOverview>>[number];
