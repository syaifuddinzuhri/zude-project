import "server-only";
import { db, n } from "@/lib/db";
import { addDays, diffDays, todayJakarta } from "@/lib/finance/date";
import { isPayday, nextPayday, cycleStartDay, type Period } from "@/lib/finance/cycle";
import { perDay, spendable } from "@/lib/finance/budget";
import type { CurrentUser } from "@/lib/auth/current";
import { accountsWithBalance } from "./balances";
import { budgetOverview } from "./budgets";
import { billsBetween } from "./recurring";
import { contributions, periodTotals, spendingByParent, type OwnerFilter } from "./stats";
import { debtSummary } from "./debts";
import { goalsOverview } from "./goals";
import { getSettings, periodOf, cycleOf, ownerNames } from "./settings";
import { listTransactions } from "./tx-list";

const LIQUID = new Set(["bank", "ewallet", "cash"]);

export async function netWorth(user: CurrentUser) {
  const [accounts, assets] = await Promise.all([
    accountsWithBalance(user),
    db.asset.findMany({ include: { valuations: { orderBy: { date: "desc" }, take: 1 } } }),
  ]);
  const accTotal = accounts.filter((a) => a.includeInNetworth && !a.isArchived).reduce((s, a) => s + a.balance, 0);
  const assetTotal = assets.reduce((s, a) => s + n(a.valuations[0]?.value), 0);
  const debts = await debtSummary(0);
  return { accounts: accTotal, assets: assetTotal, debts: debts.total, total: accTotal + assetTotal - debts.total };
}

export async function dashboardData(user: CurrentUser, offset: number, owner: OwnerFilter) {
  const settings = await getSettings();
  const today = todayJakarta();
  const period: Period = periodOf(settings, today, offset);
  const isCurrent = offset === 0;
  const [accounts, totals, overview, byParent, bills, recent, contrib, nw] = await Promise.all([
    accountsWithBalance(user),
    periodTotals(period, owner),
    budgetOverview(period),
    spendingByParent(period, owner),
    billsBetween(user, today, addDays(today, 7), today),
    listTransactions(user, owner === "semua" ? {} : { owner }, 5),
    contributions(period),
    netWorth(user),
  ]);
  const monthlyIncome = totals.income || n(settings.husbandSalary) + n(settings.wifeSalary);
  const [debts, goals] = await Promise.all([debtSummary(monthlyIncome), goalsOverview(period, [periodOf(settings, today, -1), periodOf(settings, today, -2), periodOf(settings, today, -3)])]);

  const liquid = accounts.filter((a) => LIQUID.has(a.type) && !a.isArchived && (owner === "semua" || a.owner === owner));
  const available = liquid.reduce((s, a) => s + a.balance, 0);
  const expenseLines = overview.lines.filter((l) => l.kind === "category");
  const outflow = totals.expense + totals.savings + totals.debtPayment;
  const left = owner === "semua" ? spendable({ budgets: expenseLines, income: totals.income, outflow }) : totals.income - outflow;
  const daysLeft = Math.max(1, diffDays(today < period.start ? period.start : today, period.end) + 1);

  const cats = byParent.cats;
  const topSpending = [...byParent.byParent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, spent]) => {
      const c = cats.find((x) => x.id === id);
      const line = expenseLines.find((l) => l.categoryId === id);
      return { id, name: c?.name ?? "?", icon: c?.icon ?? "circle", color: c?.color ?? "#94A3B8", spent, budget: line ? line.budget + line.rollover : null, status: line?.status ?? null, budgetId: line?.id ?? null };
    });

  // Kartu "Hari ini gajian?" untuk suami/istri yang gajiannya hari ini dan belum dicatat
  let payday: "suami" | "istri" | null = null;
  if (isCurrent) {
    for (const who of ["suami", "istri"] as const) {
      const day = who === "suami" ? settings.husbandPayday : settings.wifePayday;
      if (!isPayday(today, day, settings.paydayWeekendRule)) continue;
      const cat = await db.category.findUnique({ where: { systemKey: `salary_${who}` } });
      const recorded = cat
        ? (await db.transactionSplit.count({ where: { categoryId: cat.id, transaction: { deletedAt: null, date: { gte: new Date(`${addDays(today, -3)}T00:00:00Z`) } } } })) > 0
        : false;
      if (!recorded) {
        payday = who;
        break;
      }
    }
  }

  return {
    period,
    isCurrent,
    today,
    available,
    totals,
    left,
    perDay: perDay(Math.max(0, left), daysLeft),
    daysLeft,
    nextPayday: nextPayday(today, cycleStartDay(cycleOf(settings)), settings.paydayWeekendRule),
    topSpending,
    hasBudget: expenseLines.length > 0,
    bills: bills.filter((b) => b.status !== "paid"),
    goals: goals.filter((g) => !g.achieved).slice(0, 4),
    debts: { total: debts.total, monthly: debts.monthly, dsr: debts.dsr, freeDate: debts.freeDate, count: debts.items.length },
    netWorth: nw.total,
    contrib,
    recent: recent.items,
    payday,
    names: ownerNames(settings),
    hasAccounts: accounts.length > 0,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
