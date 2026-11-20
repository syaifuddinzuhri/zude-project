import { requireUser } from "@/lib/auth/current";
import { budgetOverview } from "@/lib/server/budgets";
import { getSettings, periodOf } from "@/lib/server/settings";
import { db, n } from "@/lib/db";
import { AppHeader, Page } from "@/components/app-header";
import { PeriodSwitcher } from "@/components/period-switcher";
import { BudgetView } from "./budget-view";
import { debtSummary } from "@/lib/server/debts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anggaran" };

export default async function AnggaranPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireUser();
  const offset = Math.max(-24, Math.min(12, parseInt((await searchParams).p ?? "0", 10) || 0));
  const settings = await getSettings();
  const period = periodOf(settings, undefined, offset);
  const [overview, templates, debts] = await Promise.all([
    budgetOverview(period),
    db.budgetTemplate.findMany({ orderBy: { id: "asc" } }),
    debtSummary(n(settings.husbandSalary) + n(settings.wifeSalary)),
  ]);
  return (
    <>
      <AppHeader title="Anggaran" large />
      <Page className="space-y-3">
        <PeriodSwitcher period={period} offset={offset} basePath="/anggaran" />
        <BudgetView o={overview} templates={templates.map((t) => ({ id: t.id, name: t.name }))} debts={debts.items.map((d) => ({ id: d.id, name: d.name, monthly: d.nextAmount }))} />
      </Page>
    </>
  );
}
