import "server-only";
import { db, n, type Tx } from "@/lib/db";
import { creditCardStatus } from "@/lib/finance/balance";
import type { CurrentUser } from "@/lib/auth/current";

const live = { deletedAt: null, status: "realized" as const };

/** Saldo semua akun dari agregat SQL (setara `computeBalances` di lib/finance). */
export async function balanceMap(tx: Tx = db): Promise<Map<number, number>> {
  const [accounts, out, inc] = await Promise.all([
    tx.account.findMany({ select: { id: true, openingBalance: true } }),
    tx.transaction.groupBy({ by: ["accountId", "type"], where: live, _sum: { amount: true } }),
    tx.transaction.groupBy({
      by: ["toAccountId"],
      where: { ...live, type: { in: ["transfer", "saving_deposit"] }, toAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  const map = new Map(accounts.map((a) => [a.id, n(a.openingBalance)]));
  for (const g of out) {
    const v = n(g._sum.amount);
    const sign = g.type === "income" || g.type === "adjustment" ? 1 : -1;
    map.set(g.accountId, (map.get(g.accountId) ?? 0) + sign * v);
  }
  for (const g of inc) {
    if (g.toAccountId == null) continue;
    map.set(g.toAccountId, (map.get(g.toAccountId) ?? 0) + n(g._sum.amount));
  }
  return map;
}

export async function accountsWithBalance(user: CurrentUser, opts: { includeArchived?: boolean } = {}) {
  const [accounts, balances] = await Promise.all([
    db.account.findMany({
      where: opts.includeArchived ? {} : { isArchived: false },
      orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    balanceMap(),
  ]);
  return accounts.map((a) => {
    const balance = balances.get(a.id) ?? 0;
    const cc = a.type === "credit_card" || a.type === "paylater" ? creditCardStatus(balance, a.creditLimit != null ? n(a.creditLimit) : null) : null;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      owner: a.owner,
      isArchived: a.isArchived,
      includeInNetworth: a.includeInNetworth,
      color: a.color,
      icon: a.icon,
      openingBalance: n(a.openingBalance),
      openingDate: a.openingDate.toISOString().slice(0, 10),
      creditLimit: a.creditLimit != null ? n(a.creditLimit) : null,
      statementDay: a.statementDay,
      dueDay: a.dueDay,
      balance,
      outstanding: cc?.outstanding ?? null,
      availableCredit: cc?.available ?? null,
    };
  });
}

export type AccountView = Awaited<ReturnType<typeof accountsWithBalance>>[number];
