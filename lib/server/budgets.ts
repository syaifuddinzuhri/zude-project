import "server-only";
import { z } from "zod";
import { db, n, toJson } from "@/lib/db";
import { fromDate, toDate, diffDays, todayJakarta, parts } from "@/lib/finance/date";
import { budgetColor, nextRollover, remaining, sinkingMonthly, unallocated, usage } from "@/lib/finance/budget";
import type { Period } from "@/lib/finance/cycle";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { ensurePeriod } from "./periods";
import { debtPaymentsIn, goalDepositsIn, spendingByParent } from "./stats";
import { getSettings, periodOf } from "./settings";

export async function budgetOverview(period: Period) {
  const bp = await ensurePeriod(period);
  const [rows, { byParent, byCat, cats }, deposits, payments, sinking] = await Promise.all([
    db.budget.findMany({ where: { periodId: bp.id }, include: { category: true, goal: true, debt: true } }),
    spendingByParent(period),
    goalDepositsIn(period),
    debtPaymentsIn(period),
    db.sinkingFund.findMany({ where: { isActive: true }, include: { category: true } }),
  ]);
  const lines = rows.map((b) => {
    let spent = 0;
    let name = "";
    let kind: "category" | "goal" | "debt" = "category";
    let color = "#94A3B8";
    let icon = "circle";
    if (b.category) {
      spent = b.category.parentId == null ? byParent.get(b.category.id) ?? 0 : byCat.get(b.category.id) ?? 0;
      name = b.category.name;
      color = b.category.color;
      icon = b.category.icon;
    } else if (b.goal) {
      kind = "goal";
      spent = deposits.get(b.goal.id) ?? 0;
      name = `Tabungan: ${b.goal.name}`;
      icon = "piggy-bank";
      color = "#6366F1";
    } else if (b.debt) {
      kind = "debt";
      spent = payments.get(b.debt.id) ?? 0;
      name = `Cicilan: ${b.debt.name}`;
      icon = "landmark";
      color = "#F59E0B";
    }
    const line = { budget: n(b.amount), rollover: n(b.rolloverAmount), spent };
    return {
      id: b.id,
      kind,
      categoryId: b.categoryId,
      goalId: b.goalId,
      debtId: b.debtId,
      name,
      color,
      icon,
      nature: b.category?.nature ?? null,
      rolloverEnabled: b.rolloverEnabled,
      ...line,
      remaining: remaining(line),
      usage: usage(line),
      status: budgetColor(line),
    };
  });
  const budgetedCats = new Set(rows.filter((r) => r.categoryId).map((r) => r.categoryId!));
  const unbudgeted = [...byParent.entries()]
    .filter(([id, v]) => v > 0 && !budgetedCats.has(id) && !cats.some((c) => c.parentId === id && budgetedCats.has(c.id)))
    .map(([id, v]) => {
      const c = cats.find((x) => x.id === id);
      return { categoryId: id, name: c?.name ?? "?", color: c?.color ?? "#94A3B8", icon: c?.icon ?? "circle", spent: v };
    });
  const planned = n(bp.plannedIncome);
  const allocations = lines.map((l) => l.budget);
  const today = todayJakarta();
  return {
    period: { id: bp.id, start: period.start, end: period.end, status: bp.status, plannedIncome: planned },
    lines: lines.sort((a, b) => (a.kind === b.kind ? b.budget - a.budget : a.kind.localeCompare(b.kind))),
    unbudgeted,
    unallocated: unallocated(planned, allocations),
    totalBudget: allocations.reduce((a, b) => a + b, 0),
    daysLeft: Math.max(1, diffDays(today < period.start ? period.start : today, period.end) + 1),
    sinking: sinking.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId, categoryName: s.category.name, annual: n(s.annualAmount), monthly: sinkingMonthly(n(s.annualAmount)), dueMonth: s.dueMonth })),
  };
}

export type BudgetOverview = Awaited<ReturnType<typeof budgetOverview>>;

const targetSchema = z.object({
  periodId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().nullish(),
  goalId: z.coerce.number().int().positive().nullish(),
  debtId: z.coerce.number().int().positive().nullish(),
  amount: z.coerce.number().int().min(0),
  rolloverEnabled: z.coerce.boolean().default(false),
});

export async function setBudget(user: CurrentUser, raw: unknown) {
  const i = targetSchema.parse(raw);
  const targets = [i.categoryId, i.goalId, i.debtId].filter(Boolean);
  if (targets.length !== 1) throw new Error("Pilih satu kategori, tujuan, atau hutang");
  await db.$transaction(async (tx) => {
    const where = { periodId: i.periodId, categoryId: i.categoryId ?? null, goalId: i.goalId ?? null, debtId: i.debtId ?? null };
    const existing = await tx.budget.findFirst({ where });
    const data = { amount: BigInt(i.amount), rolloverEnabled: i.rolloverEnabled };
    const after = existing ? await tx.budget.update({ where: { id: existing.id }, data }) : await tx.budget.create({ data: { ...where, ...data } });
    await audit(tx, { userId: user.id, entity: "budget", entityId: after.id, action: existing ? "update" : "create", before: existing, after });
  });
}

export async function removeBudget(user: CurrentUser, id: number) {
  await db.$transaction(async (tx) => {
    const before = await tx.budget.findUniqueOrThrow({ where: { id } });
    await tx.budget.delete({ where: { id } });
    await audit(tx, { userId: user.id, entity: "budget", entityId: id, action: "delete", before });
  });
}

export async function setPlannedIncome(user: CurrentUser, periodId: number, amount: number) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Nominal tidak valid");
  await db.$transaction(async (tx) => {
    const before = await tx.budgetPeriod.findUniqueOrThrow({ where: { id: periodId } });
    await tx.budgetPeriod.update({ where: { id: periodId }, data: { plannedIncome: BigInt(amount) } });
    await audit(tx, { userId: user.id, entity: "budget_period", entityId: periodId, action: "update", before: { plannedIncome: before.plannedIncome }, after: { plannedIncome: amount } });
  });
}

/**
 * Salin anggaran dari periode sebelumnya. Rollover (sisa/kelebihan) dihitung
 * untuk baris yang rollover-nya aktif.
 */
export async function copyFromPrevious(user: CurrentUser, periodId: number) {
  const settings = await getSettings();
  const bp = await db.budgetPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const cur: Period = { start: fromDate(bp.periodStart), end: fromDate(bp.periodEnd) };
  const prev = periodOf(settings, cur.start, -1);
  const prevOverview = await budgetOverview(prev);
  if (prevOverview.lines.length === 0) throw new Error("Bulan lalu belum punya anggaran");
  await db.$transaction(async (tx) => {
    for (const l of prevOverview.lines) {
      const where = { periodId, categoryId: l.categoryId, goalId: l.goalId, debtId: l.debtId };
      const existing = await tx.budget.findFirst({ where });
      const data = {
        amount: BigInt(l.budget),
        rolloverEnabled: l.rolloverEnabled,
        rolloverAmount: BigInt(nextRollover({ budget: l.budget, rollover: l.rollover, spent: l.spent }, l.rolloverEnabled)),
      };
      if (existing) await tx.budget.update({ where: { id: existing.id }, data });
      else await tx.budget.create({ data: { ...where, ...data } });
    }
    if (n(bp.plannedIncome) === 0) await tx.budgetPeriod.update({ where: { id: periodId }, data: { plannedIncome: BigInt(prevOverview.period.plannedIncome) } });
    await audit(tx, { userId: user.id, entity: "budget_period", entityId: periodId, action: "copy_previous", after: { from: prev.start, lines: prevOverview.lines.length } });
  });
}

const templateItems = z.array(
  z.object({
    categoryId: z.number().nullish(),
    goalId: z.number().nullish(),
    debtId: z.number().nullish(),
    amount: z.number().int().min(0),
    rolloverEnabled: z.boolean().default(false),
  }),
);

export async function saveBudgetTemplate(user: CurrentUser, periodId: number, name: string) {
  const rows = await db.budget.findMany({ where: { periodId } });
  if (!rows.length) throw new Error("Belum ada anggaran untuk disimpan");
  const items = rows.map((r) => ({ categoryId: r.categoryId, goalId: r.goalId, debtId: r.debtId, amount: n(r.amount), rolloverEnabled: r.rolloverEnabled }));
  const t = await db.budgetTemplate.create({ data: { name: name.trim() || "Template anggaran", itemsJson: toJson(items) } });
  await audit(db, { userId: user.id, entity: "budget_template", entityId: t.id, action: "create", after: t });
}

export async function applyBudgetTemplate(user: CurrentUser, periodId: number, templateId: number) {
  const t = await db.budgetTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const items = templateItems.parse(t.itemsJson);
  await db.$transaction(async (tx) => {
    for (const it of items) {
      const where = { periodId, categoryId: it.categoryId ?? null, goalId: it.goalId ?? null, debtId: it.debtId ?? null };
      const existing = await tx.budget.findFirst({ where });
      const data = { amount: BigInt(it.amount), rolloverEnabled: it.rolloverEnabled };
      if (existing) await tx.budget.update({ where: { id: existing.id }, data });
      else await tx.budget.create({ data: { ...where, ...data } });
    }
    await audit(tx, { userId: user.id, entity: "budget_period", entityId: periodId, action: "apply_template", after: { templateId } });
  });
}

export const sinkingSchema = z.object({
  name: z.string().trim().min(1, "Nama belum diisi").max(80),
  categoryId: z.coerce.number().int().positive("Kategori belum dipilih"),
  annualAmount: z.coerce.number().int().positive("Nominal tahunan belum diisi"),
  dueMonth: z.coerce.number().int().min(1).max(12),
  accountId: z.coerce.number().int().positive().nullish(),
});

export async function saveSinkingFund(user: CurrentUser, id: number | null, raw: unknown) {
  const i = sinkingSchema.parse(raw);
  const data = { ...i, annualAmount: BigInt(i.annualAmount), accountId: i.accountId ?? null };
  await db.$transaction(async (tx) => {
    const before = id ? await tx.sinkingFund.findUnique({ where: { id } }) : null;
    const after = id ? await tx.sinkingFund.update({ where: { id }, data }) : await tx.sinkingFund.create({ data });
    await audit(tx, { userId: user.id, entity: "sinking_fund", entityId: after.id, action: id ? "update" : "create", before, after });
  });
}

/**
 * Sisihkan otomatis: tambahkan nominal bulanan sinking fund ke anggaran kategorinya
 * (dengan rollover aktif agar dana menumpuk sampai bulan jatuh tempo).
 */
export async function applySinkingFunds(user: CurrentUser, periodId: number) {
  const funds = await db.sinkingFund.findMany({ where: { isActive: true } });
  const bp = await db.budgetPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const month = parts(fromDate(bp.periodEnd)).m;
  await db.$transaction(async (tx) => {
    const byCat = new Map<number, number>();
    for (const f of funds) byCat.set(f.categoryId, (byCat.get(f.categoryId) ?? 0) + sinkingMonthly(n(f.annualAmount)));
    for (const [categoryId, amount] of byCat) {
      const existing = await tx.budget.findFirst({ where: { periodId, categoryId, goalId: null, debtId: null } });
      if (existing) await tx.budget.update({ where: { id: existing.id }, data: { amount: { increment: BigInt(amount) }, rolloverEnabled: true } });
      else await tx.budget.create({ data: { periodId, categoryId, amount: BigInt(amount), rolloverEnabled: true } });
    }
    await audit(tx, { userId: user.id, entity: "budget_period", entityId: periodId, action: "apply_sinking", after: { month, funds: funds.length } });
  });
}

export { toDate };
