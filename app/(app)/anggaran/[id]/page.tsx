import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { budgetOverview } from "@/lib/server/budgets";
import { listTransactions } from "@/lib/server/tx-list";
import { AppHeader, Page } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { TxRow } from "@/components/tx-row";
import { BudgetActions } from "./budget-actions";

export const dynamic = "force-dynamic";

export default async function BudgetDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const b = await db.budget.findUnique({ where: { id }, include: { period: true, category: true } });
  if (!b || !b.category) notFound();
  const period = { start: fromDate(b.period.periodStart), end: fromDate(b.period.periodEnd) };
  const o = await budgetOverview(period);
  const line = o.lines.find((l) => l.id === id)!;
  const { items } = await listTransactions(user, { categoryId: b.categoryId!, from: period.start, to: period.end }, 200);
  return (
    <>
      <AppHeader title={b.category.name} back="/anggaran" />
      <Page className="space-y-3">
        <Card>
          <div className="text-caption text-muted">{line.remaining >= 0 ? "Sisa anggaran" : "Melebihi anggaran"}</div>
          <Money value={Math.abs(line.remaining)} className={`text-h1 ${line.remaining < 0 ? "text-expense" : ""}`} />
          <ProgressBar className="my-2" value={line.usage} status={line.status} />
          <div className="grid grid-cols-3 gap-2 text-caption text-muted">
            <div>Anggaran<br /><Money value={n(b.amount)} className="text-[14px] font-semibold text-text" /></div>
            <div>Rollover<br /><Money value={n(b.rolloverAmount)} sign className="text-[14px] font-semibold text-text" /></div>
            <div>Terpakai<br /><Money value={line.spent} className="text-[14px] font-semibold text-text" /></div>
          </div>
          {o.period.status !== "locked" && <BudgetActions id={id} />}
        </Card>
        <h2 className="text-h2">Riwayat</h2>
        <Card className="divide-y divide-border/70 py-1">
          {items.length === 0 ? <p className="py-3 text-caption text-muted">Belum ada transaksi di kategori ini.</p> : items.map((t) => <TxRow key={t.id} t={t} />)}
        </Card>
      </Page>
    </>
  );
}
