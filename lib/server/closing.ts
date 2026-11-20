import "server-only";
import { z } from "zod";
import { db, n, toJson } from "@/lib/db";
import { fromDate, todayJakarta } from "@/lib/finance/date";
import type { Period } from "@/lib/finance/cycle";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { budgetOverview } from "./budgets";
import { periodTotals, spendingByParent } from "./stats";
import { balanceMap } from "./balances";
import { billsBetween } from "./recurring";
import { getSettings, periodOf } from "./settings";
import { createTransaction } from "./transactions";
import { makeExtraPayment, debtSummary } from "./debts";

export async function closingData(user: CurrentUser, period: Period) {
  const [overview, totals, bills, byParent] = await Promise.all([
    budgetOverview(period),
    periodTotals(period),
    billsBetween(user, period.start, period.end),
    spendingByParent(period),
  ]);
  const leftover = totals.income - totals.expense - totals.savings - totals.debtPayment;
  const pending = bills.filter((b) => b.status !== "paid");
  return { overview, totals, leftover, pending, categories: byParent };
}

export async function buildSnapshot(user: CurrentUser, period: Period) {
  const settings = await getSettings();
  const { overview, totals, leftover } = await closingData(user, period);
  const [accounts, balances, goals, debts] = await Promise.all([
    db.account.findMany({ where: { isArchived: false } }),
    balanceMap(),
    db.goal.findMany({ include: { allocations: true } }),
    debtSummary(totals.income || n(settings.husbandSalary) + n(settings.wifeSalary)),
  ]);
  return {
    period,
    createdAt: new Date().toISOString(),
    totals,
    leftover,
    budget: overview.lines.map((l) => ({ categoryId: l.categoryId, goalId: l.goalId, debtId: l.debtId, name: l.name, kind: l.kind, budget: l.budget, rollover: l.rollover, spent: l.spent, remaining: l.remaining, status: l.status })),
    unbudgeted: overview.unbudgeted,
    plannedIncome: overview.period.plannedIncome,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, owner: a.owner, balance: balances.get(a.id) ?? 0 })),
    goals: goals.map((g) => ({ id: g.id, name: g.name, target: n(g.targetAmount), saved: g.allocations.reduce((s, a) => s + n(a.amount), 0) })),
    debts: { total: debts.total, monthly: debts.monthly, dsr: debts.dsr, freeDate: debts.freeDate },
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

export const finalizeSchema = z.object({
  periodId: z.coerce.number().int().positive(),
  leftoverAction: z.enum(["rollover", "goal", "debt", "none"]),
  goalId: z.coerce.number().int().positive().nullish(),
  debtId: z.coerce.number().int().positive().nullish(),
  amount: z.coerce.number().int().min(0).default(0),
  fromAccountId: z.coerce.number().int().positive().nullish(),
});

/** Langkah 4 & 5: putuskan sisa uang, simpan snapshot, kunci bulan. */
export async function finalizePeriod(user: CurrentUser, raw: unknown) {
  const i = finalizeSchema.parse(raw);
  const bp = await db.budgetPeriod.findUniqueOrThrow({ where: { id: i.periodId } });
  if (bp.status === "locked") throw new Error("Bulan ini sudah ditutup");
  const period: Period = { start: fromDate(bp.periodStart), end: fromDate(bp.periodEnd) };
  const settings = await getSettings();

  if (i.leftoverAction === "goal" && i.amount > 0) {
    if (!i.goalId || !i.fromAccountId) throw new Error("Pilih tujuan & akun sumber");
    const goal = await db.goal.findUniqueOrThrow({ where: { id: i.goalId } });
    await createTransaction(user, {
      type: "saving_deposit",
      date: period.end,
      amount: i.amount,
      accountId: i.fromAccountId,
      toAccountId: goal.accountId ?? i.fromAccountId,
      goalId: goal.id,
      note: "Sisa uang tutup buku",
    });
  } else if (i.leftoverAction === "debt" && i.amount > 0) {
    if (!i.debtId || !i.fromAccountId) throw new Error("Pilih hutang & akun sumber");
    await makeExtraPayment(user, { debtId: i.debtId, accountId: i.fromAccountId, amount: i.amount, mode: "reduce_tenor", date: period.end });
  }

  const snapshot = await buildSnapshot(user, period);

  await db.$transaction(async (tx) => {
    if (i.leftoverAction === "rollover") {
      // Aktifkan rollover di periode berikutnya untuk semua kategori anggaran bulan ini
      const next = periodOf(settings, period.end, 1);
      const existingNext = await tx.budgetPeriod.findUnique({ where: { periodStart: new Date(`${next.start}T00:00:00Z`) } });
      const nextBp =
        existingNext ??
        (await tx.budgetPeriod.create({
          data: { periodStart: new Date(`${next.start}T00:00:00Z`), periodEnd: new Date(`${next.end}T00:00:00Z`), plannedIncome: bp.plannedIncome },
        }));
      for (const l of snapshot.budget) {
        if (l.kind !== "category" || !l.categoryId) continue;
        const where = { periodId: nextBp.id, categoryId: l.categoryId, goalId: null, debtId: null };
        const ex = await tx.budget.findFirst({ where });
        const data = { rolloverEnabled: true, rolloverAmount: BigInt(l.remaining) };
        if (ex) await tx.budget.update({ where: { id: ex.id }, data });
        else await tx.budget.create({ data: { ...where, ...data, amount: BigInt(l.budget) } });
      }
    }
    await tx.budgetPeriod.update({
      where: { id: bp.id },
      data: { status: "locked", closedAt: new Date(), closedById: user.id, snapshotJson: toJson(snapshot) },
    });
    await audit(tx, { userId: user.id, entity: "budget_period", entityId: bp.id, action: "lock", after: { leftoverAction: i.leftoverAction, amount: i.amount, closedOn: todayJakarta() } });
  });
}
