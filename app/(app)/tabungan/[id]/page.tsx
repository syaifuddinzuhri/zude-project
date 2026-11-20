import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { goalsOverview } from "@/lib/server/goals";
import { getSettings, periodOf } from "@/lib/server/settings";
import { AppHeader, Page } from "@/components/app-header";
import { GoalDetail } from "./goal-detail";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const s = await getSettings();
  const goals = await goalsOverview(periodOf(s), [periodOf(s, undefined, -1), periodOf(s, undefined, -2), periodOf(s, undefined, -3)]);
  const g = goals.find((x) => x.id === id);
  if (!g) notFound();
  const raw = await db.goal.findUniqueOrThrow({ where: { id } });
  const history = await db.goalAllocation.findMany({ where: { goalId: id }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 200 });
  return (
    <>
      <AppHeader title={g.name} back="/tabungan" />
      <Page>
        <GoalDetail
          g={g}
          raw={{ id, name: raw.name, targetAmount: n(raw.targetAmount), targetDate: raw.targetDate ? fromDate(raw.targetDate) : null, accountId: raw.accountId, owner: raw.owner, priority: raw.priority, icon: raw.icon, isEmergency: raw.isEmergency }}
          history={history.map((h) => ({ id: h.id, date: fromDate(h.date), amount: n(h.amount), note: h.note, txId: h.transactionId }))}
        />
      </Page>
    </>
  );
}
