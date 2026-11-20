import "server-only";
import { db, n } from "@/lib/db";
import { toDate } from "@/lib/finance/date";
import { topWithOthers, ratioBreakdown, savingsRate } from "@/lib/finance/report";
import { emergencyCoverage } from "@/lib/finance/goals";
import type { Period } from "@/lib/finance/cycle";
import { periodTotals, spendingByParent, goalSavedTotals } from "./stats";
import { debtSummary } from "./debts";
import { monthlyNeeds } from "./goals";
import { getSettings, ownerNames, periodOf } from "./settings";

const range = (p: Period) => ({ gte: toDate(p.start), lte: toDate(p.end) });

export async function reportData(offset: number, categoryId: number | null) {
  const s = await getSettings();
  const period = periodOf(s, undefined, offset);
  const periods = Array.from({ length: 12 }, (_, i) => periodOf(s, undefined, offset - 11 + i));

  const cashflow = await Promise.all(
    periods.map(async (p) => {
      const t = await periodTotals(p);
      return { label: p.end.slice(2, 7).replace("-", "/"), start: p.start, income: t.income, expense: t.expense + t.debtInterest, savings: t.savings + t.debtPrincipal };
    }),
  );

  const { byParent, cats } = await spendingByParent(period);
  const donut = topWithOthers(
    [...byParent.entries()].map(([id, value]) => {
      const c = cats.find((x) => x.id === id);
      return { id, name: c?.name ?? "?", value, color: c?.color };
    }),
  );

  const first = donut[0] as { id?: number } | undefined;
  const trendCat = categoryId ?? first?.id ?? null;
  const trend = trendCat
    ? await Promise.all(periods.map(async (p) => ({ label: p.end.slice(2, 7).replace("-", "/"), value: (await spendingByParent(p)).byParent.get(trendCat) ?? 0 })))
    : [];

  // Rasio needs / wants / tabungan+hutang
  const natureRows = await db.transactionSplit.findMany({
    where: { transaction: { deletedAt: null, status: "realized", type: { in: ["expense", "debt_payment"] }, date: range(period) } },
    select: { amount: true, category: { select: { nature: true, parent: { select: { nature: true } } } } },
  });
  const totals = await periodTotals(period);
  const nat = { needs: 0, wants: 0, savings_debt: totals.savings + totals.debtPrincipal };
  for (const r of natureRows) {
    const k = r.category.nature ?? r.category.parent?.nature ?? "wants";
    nat[k] += n(r.amount);
  }
  const ratio = ratioBreakdown(nat);
  const debts = await debtSummary(totals.income || n(s.husbandSalary) + n(s.wifeSalary));
  const needs = await monthlyNeeds([periodOf(s, undefined, offset - 1), periodOf(s, undefined, offset - 2), periodOf(s, undefined, offset - 3)]);
  const emergencyGoals = await db.goal.findMany({ where: { isEmergency: true }, select: { id: true } });
  const saved = await goalSavedTotals();
  const emergencySaved = emergencyGoals.reduce((a, g) => a + (saved.get(g.id) ?? 0), 0);

  // Per orang: menurut pemilik akun (suami/istri/bersama)
  const ownerRows = await db.transaction.findMany({
    where: { deletedAt: null, status: "realized", date: range(period), type: { in: ["income", "expense"] } },
    select: { amount: true, type: true, account: { select: { owner: true } } },
  });
  const perPerson = (["suami", "istri", "bersama"] as const).map((o) => ({
    name: ownerNames(s)[o],
    label: o,
    income: ownerRows.filter((r) => r.account.owner === o && r.type === "income").reduce((a, r) => a + n(r.amount), 0),
    expense: ownerRows.filter((r) => r.account.owner === o && r.type === "expense").reduce((a, r) => a + n(r.amount), 0),
  }));
  const byBenef = await db.transaction.groupBy({ by: ["beneficiary"], where: { deletedAt: null, status: "realized", date: range(period), type: "expense", beneficiary: { not: null } }, _sum: { amount: true } });
  const byOwner = await db.transaction.findMany({
    where: { deletedAt: null, status: "realized", date: range(period), type: "expense" },
    select: { amount: true, account: { select: { owner: true } } },
  });
  const ownerTotals = { bersama: 0, suami: 0, istri: 0 } as Record<string, number>;
  for (const r of byOwner) ownerTotals[r.account.owner] += n(r.amount);

  return {
    period,
    offset,
    cashflow,
    donut,
    donutTotal: donut.reduce((a, d) => a + d.value, 0),
    trend,
    trendCat,
    categories: cats.filter((c) => c.parentId === null).map((c) => ({ id: c.id, name: c.name })),
    ratio: { ...ratio, raw: nat, target: { needs: s.ratioNeeds / 100, wants: s.ratioWants / 100, savings_debt: s.ratioSavings / 100 } },
    savingsRate: savingsRate(totals.income, totals.savings + totals.debtPrincipal),
    dsr: debts.dsr,
    emergency: { coverage: emergencyCoverage(emergencySaved, needs), months: s.emergencyMonths, saved: emergencySaved, needs },
    totals,
    perPerson,
    beneficiary: byBenef.map((b) => ({ name: b.beneficiary!, value: n(b._sum.amount) })),
    ownerTotals,
  };
}

export type ReportData = Awaited<ReturnType<typeof reportData>>;
