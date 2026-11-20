import "server-only";
import { db, n } from "@/lib/db";
import { toDate } from "@/lib/finance/date";
import type { Period } from "@/lib/finance/cycle";
import type { Owner } from "@prisma/client";

export type OwnerFilter = "semua" | Owner;

function range(p: Period) {
  return { gte: toDate(p.start), lte: toDate(p.end) };
}

function ownerWhere(f: OwnerFilter) {
  return f === "semua" ? {} : { account: { owner: f } };
}

/**
 * Ringkasan periode (semua akun, atau hanya milik suami/istri/bersama).
 */
export async function periodTotals(p: Period, owner: OwnerFilter = "semua") {
  const base = { deletedAt: null, status: "realized" as const, date: range(p), ...ownerWhere(owner) };
  const byType = await db.transaction.groupBy({ by: ["type"], where: base, _sum: { amount: true, principalAmount: true } });
  const get = (t: string) => byType.find((g) => g.type === t);
  const debt = get("debt_payment");
  return {
    income: n(get("income")?._sum.amount),
    expense: n(get("expense")?._sum.amount),
    savings: n(get("saving_deposit")?._sum.amount),
    debtPayment: n(debt?._sum.amount),
    debtPrincipal: n(debt?._sum.principalAmount),
    debtInterest: n(debt?._sum.amount) - n(debt?._sum.principalAmount),
  };
}

/** Pengeluaran per kategori (split pengeluaran + bagian bunga cicilan). */
export async function spendingByCategory(p: Period, owner: OwnerFilter = "semua") {
  const rows = await db.transactionSplit.groupBy({
    by: ["categoryId"],
    where: {
      transaction: { deletedAt: null, status: "realized", type: { in: ["expense", "debt_payment"] }, date: range(p), ...ownerWhere(owner) },
    },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.categoryId, n(r._sum.amount)]));
}

export async function incomeByCategory(p: Period, owner: OwnerFilter = "semua") {
  const rows = await db.transactionSplit.groupBy({
    by: ["categoryId"],
    where: { transaction: { deletedAt: null, status: "realized", type: "income", date: range(p), ...ownerWhere(owner) } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.categoryId, n(r._sum.amount)]));
}

/** Kategori induk → total (anak digabung ke induk). */
export async function spendingByParent(p: Period, owner: OwnerFilter = "semua") {
  const [byCat, cats] = await Promise.all([spendingByCategory(p, owner), db.category.findMany({ where: { kind: "expense" } })]);
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
  const out = new Map<number, number>();
  for (const [catId, v] of byCat) {
    const pid = parentOf.get(catId) ?? catId;
    out.set(pid, (out.get(pid) ?? 0) + v);
  }
  return { byParent: out, byCat, cats };
}

/** Setoran bersih ke tujuan dalam periode. */
export async function goalDepositsIn(p: Period) {
  const rows = await db.goalAllocation.groupBy({ by: ["goalId"], where: { date: range(p) }, _sum: { amount: true } });
  return new Map(rows.map((r) => [r.goalId, n(r._sum.amount)]));
}

export async function goalSavedTotals(before?: string) {
  const rows = await db.goalAllocation.groupBy({
    by: ["goalId"],
    where: before ? { date: { lt: toDate(before) } } : {},
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.goalId, n(r._sum.amount)]));
}

export async function debtPaymentsIn(p: Period) {
  const rows = await db.transaction.groupBy({
    by: ["debtId"],
    where: { deletedAt: null, status: "realized", type: "debt_payment", date: range(p), debtId: { not: null } },
    _sum: { amount: true },
  });
  return new Map(rows.filter((r) => r.debtId != null).map((r) => [r.debtId!, n(r._sum.amount)]));
}

/**
 * Kontribusi suami vs istri ke pos bersama dalam periode:
 * transfer/setoran dari akun milik suami/istri ke akun bersama, ditambah
 * gaji yang langsung masuk ke akun bersama (menurut kategori Gaji Suami/Istri).
 */
export async function contributions(p: Period) {
  const [transfers, salaries] = await Promise.all([
    db.transaction.findMany({
      where: {
        deletedAt: null,
        status: "realized",
        date: range(p),
        type: { in: ["transfer", "saving_deposit"] },
        toAccount: { owner: "bersama" },
        account: { owner: { in: ["suami", "istri"] } },
      },
      select: { amount: true, account: { select: { owner: true } } },
    }),
    db.transactionSplit.findMany({
      where: {
        category: { systemKey: { in: ["salary_suami", "salary_istri"] } },
        transaction: { deletedAt: null, status: "realized", date: range(p), type: "income", account: { owner: "bersama" } },
      },
      select: { amount: true, category: { select: { systemKey: true } } },
    }),
  ]);
  let suami = 0;
  let istri = 0;
  for (const r of transfers) {
    if (r.account.owner === "suami") suami += n(r.amount);
    else istri += n(r.amount);
  }
  for (const s of salaries) {
    if (s.category.systemKey === "salary_suami") suami += n(s.amount);
    else istri += n(s.amount);
  }
  return { suami, istri };
}
