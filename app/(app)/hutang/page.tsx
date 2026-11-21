import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { debtPayoffTimeline, debtSummary } from "@/lib/server/debts";
import { getSettings, periodOf } from "@/lib/server/settings";
import { periodTotals } from "@/lib/server/stats";
import { AppHeader, Page } from "@/components/app-header";
import { DebtsView } from "./debts-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hutang" };

export default async function HutangPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  await requireUser();
  const s = await getSettings();
  const prev = await periodTotals(periodOf(s, undefined, -1));
  const income = Math.max(prev.income, n(s.husbandSalary) + n(s.wifeSalary));
  const [summary, receivables, paidOff, timeline] = await Promise.all([
    debtSummary(income),
    db.receivable.findMany({ orderBy: [{ status: "asc" }, { promisedDate: "asc" }] }),
    db.debt.findMany({ where: { status: "paid_off" }, select: { id: true, name: true, principal: true } }),
    debtPayoffTimeline(),
  ]);
  return (
    <>
      <AppHeader title="Hutang & cicilan" back="/lainnya" />
      <Page>
        <DebtsView
          s={summary}
          timeline={timeline}
          income={income}
          openNew={(await searchParams).baru === "1"}
          paidOff={paidOff.map((d) => ({ id: d.id, name: d.name, principal: n(d.principal) }))}
          receivables={receivables.map((r) => ({ id: r.id, debtorName: r.debtorName, amount: n(r.amount), paid: n(r.paidAmount), date: fromDate(r.date), promisedDate: r.promisedDate ? fromDate(r.promisedDate) : null, status: r.status, note: r.note }))}
        />
      </Page>
    </>
  );
}
