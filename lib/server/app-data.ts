import "server-only";
import { db, n } from "@/lib/db";
import { addDays, fromDate, todayJakarta, toDate } from "@/lib/finance/date";
import type { CurrentUser } from "@/lib/auth/current";
import type { AppData } from "@/components/app-data";
import { accountsWithBalance } from "./balances";
import { dueBadgeCount } from "./reminders";
import { getSettings, ownerNames } from "./settings";

export async function loadAppData(user: CurrentUser): Promise<AppData> {
  const since = toDate(addDays(todayJakarta(), -90));
  const [settings, accounts, categories, freq, goals, debts, unread, badge] = await Promise.all([
    getSettings(),
    accountsWithBalance(user),
    db.category.findMany({ where: { isArchived: false }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.transactionSplit.groupBy({
      by: ["categoryId"],
      where: { transaction: { deletedAt: null, date: { gte: since }, type: { in: ["income", "expense"] } } },
      _count: { _all: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 30,
    }),
    db.goal.findMany({ where: { isAchieved: false }, orderBy: { priority: "asc" } }),
    db.debt.findMany({ where: { status: "active" }, include: { schedule: { where: { status: { not: "paid" } }, orderBy: { periodNo: "asc" }, take: 1 } } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    dueBadgeCount(user).catch(() => 0),
  ]);
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
  const frequent = { expense: [] as number[], income: [] as number[] };
  for (const f of freq) {
    const k = kindOf.get(f.categoryId);
    if (k && frequent[k].length < 8) frequent[k].push(f.categoryId);
  }
  return {
    me: { id: user.id, name: user.name },
    names: ownerNames(settings),
    accounts: accounts
      .filter((a) => !a.isArchived)
      .map((a) => ({ id: a.id, name: a.name, type: a.type, owner: a.owner, color: a.color, icon: a.icon, balance: a.balance })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId, icon: c.icon, color: c.color })),
    frequent,
    goals: goals.map((g) => ({ id: g.id, name: g.name, icon: g.icon, accountId: g.accountId })),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      nextScheduleId: d.schedule[0]?.id ?? null,
      nextAmount: n(d.schedule[0]?.total ?? d.installmentAmount),
      nextDue: d.schedule[0] ? fromDate(d.schedule[0].dueDate) : null,
      defaultAccountId: d.defaultAccountId,
    })),
    lastAccountId: user.lastAccountId && accounts.some((a) => a.id === user.lastAccountId && !a.isArchived) ? user.lastAccountId : null,
    unread,
    badge,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  };
}
