import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getTransactionDetail } from "@/lib/server/tx-list";
import { lockedPeriodFor } from "@/lib/server/periods";
import { AppHeader, Page } from "@/components/app-header";
import { n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { TxDetail } from "./tx-detail";
import { getSettings, ownerNames } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export default async function TxPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const t = await getTransactionDetail(user, id);
  if (!t) notFound();
  const locked = Boolean(await lockedPeriodFor(fromDate(t.date)));
  const view = {
    id: t.id,
    type: t.type,
    amount: n(t.amount),
    principal: n(t.principalAmount),
    date: fromDate(t.date),
    time: t.time,
    account: t.account.name,
    accountId: t.accountId,
    toAccount: t.toAccount?.name ?? null,
    toAccountId: t.toAccountId,
    splits: t.splits.map((s) => ({ categoryId: s.categoryId, amount: n(s.amount), note: s.note, name: s.category.parent ? `${s.category.parent.name} › ${s.category.name}` : s.category.name, icon: s.category.icon, color: s.category.color })),
    note: t.note,
    beneficiary: t.beneficiary,
    tags: t.tags.map((x) => x.tag.name),
    fee: t.children.filter((c) => !c.deletedAt).reduce((s, c) => s + n(c.amount), 0),
    status: t.status,
    debtId: t.debtId,
    debtName: t.debt?.name ?? null,
    goalId: t.goalId,
    goalName: t.goal ? `${t.goal.icon} ${t.goal.name}` : null,
    by: ownerNames(await getSettings())[t.account.owner],
    updatedBy: t.updatedById ? "diubah" : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deleted: Boolean(t.deletedAt),
    isFee: t.parentId != null,
    parentId: t.parentId,
    locked,
  };
  return (
    <>
      <AppHeader title="Detail transaksi" back />
      <Page>
        <TxDetail t={view} />
      </Page>
    </>
  );
}
