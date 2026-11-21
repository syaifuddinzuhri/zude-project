import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { totalInterest } from "@/lib/finance/amortization";
import { remainingPrincipal } from "@/lib/server/transactions";
import { debtPayoffTimeline, scheduleRowFromDb } from "@/lib/server/debts";
import { AppHeader, Page } from "@/components/app-header";
import { DebtDetail } from "./debt-detail";

export const dynamic = "force-dynamic";

export default async function DebtPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bayar?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const debt = await db.debt.findUnique({ where: { id }, include: { schedule: { orderBy: { periodNo: "asc" } }, rateChanges: { orderBy: { effectiveDate: "asc" } }, defaultAccount: true } });
  if (!debt) notFound();
  const remaining = await remainingPrincipal(db, id);
  const unpaid = debt.schedule.filter((r) => r.status !== "paid");
  const timeline = await debtPayoffTimeline(id);
  const paidInterest = await db.transaction.aggregate({ where: { debtId: id, deletedAt: null, type: "debt_payment" }, _sum: { amount: true, principalAmount: true } });
  return (
    <>
      <AppHeader title={debt.name} back="/hutang" />
      <Page>
        <DebtDetail
          payScheduleId={Number((await searchParams).bayar) || null}
          timeline={timeline}
          d={{
            id,
            name: debt.name,
            lender: debt.lender,
            type: debt.type,
            borrower: debt.borrower,
            principal: n(debt.principal),
            remaining,
            interestType: debt.interestType,
            rateBp: debt.rateChanges.at(-1)?.interestRateBp ?? debt.interestRateBp,
            tenor: debt.tenorMonths,
            dueDay: debt.dueDay,
            lateFee: n(debt.lateFee),
            status: debt.status,
            note: debt.note,
            defaultAccountId: debt.defaultAccountId,
            remainingInterest: totalInterest(unpaid.map(scheduleRowFromDb)),
            paidTotal: n(paidInterest._sum.amount),
            rateChanges: debt.rateChanges.map((r) => ({ date: fromDate(r.effectiveDate), bp: r.interestRateBp })),
          }}
          schedule={debt.schedule.map((r) => ({ id: r.id, no: r.periodNo, due: fromDate(r.dueDate), principal: n(r.principalPart), interest: n(r.interestPart), total: n(r.total), remaining: n(r.remainingPrincipal), status: r.status, txId: r.paymentTransactionId }))}
        />
      </Page>
    </>
  );
}
