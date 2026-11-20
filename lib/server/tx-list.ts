import "server-only";
import type { Prisma } from "@prisma/client";
import { db, n } from "@/lib/db";
import { fromDate, toDate } from "@/lib/finance/date";
import type { CurrentUser } from "@/lib/auth/current";
import { getSettings, ownerNames, type OwnerNames } from "./settings";

export interface TxFilters {
  q?: string;
  from?: string;
  to?: string;
  type?: string;
  accountId?: number;
  categoryId?: number;
  owner?: "suami" | "istri" | "bersama";
  tag?: string;
  min?: number;
  max?: number;
  deleted?: boolean;
  debtId?: number;
  goalId?: number;
}

export function txWhere(user: CurrentUser, f: TxFilters): Prisma.TransactionWhereInput {
  void user;
  const and: Prisma.TransactionWhereInput[] = [];
  if (f.deleted) and.push({ deletedAt: { not: null, gte: new Date(Date.now() - 30 * 86_400_000) }, parentId: null });
  else and.push({ deletedAt: null });
  if (f.from) and.push({ date: { gte: toDate(f.from) } });
  if (f.to) and.push({ date: { lte: toDate(f.to) } });
  if (f.type) and.push({ type: f.type as Prisma.EnumTxTypeFilter["equals"] });
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.categoryId) and.push({ splits: { some: { OR: [{ categoryId: f.categoryId }, { category: { parentId: f.categoryId } }] } } });
  if (f.owner) and.push({ account: { owner: f.owner } });
  if (f.tag) and.push({ tags: { some: { tag: { name: f.tag.toLowerCase() } } } });
  if (f.min != null) and.push({ amount: { gte: BigInt(f.min) } });
  if (f.max != null) and.push({ amount: { lte: BigInt(f.max) } });
  if (f.debtId) and.push({ debtId: f.debtId });
  if (f.goalId) and.push({ goalId: f.goalId });
  if (f.q) and.push({ OR: [{ note: { contains: f.q } }, { splits: { some: { OR: [{ note: { contains: f.q } }, { category: { name: { contains: f.q } } }] } } }] });
  return { AND: and };
}

const include = {
  account: { select: { name: true, owner: true } },
  createdBy: { select: { name: true } },
  toAccount: { select: { name: true } },
  splits: { include: { category: { select: { name: true, icon: true, color: true, parent: { select: { name: true } } } } } },
  debt: { select: { name: true } },
  goal: { select: { name: true, icon: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.TransactionInclude;

type Row = Prisma.TransactionGetPayload<{ include: typeof include }>;

export function toTxView(t: Row, names: OwnerNames = { suami: "Suami", istri: "Istri", bersama: "Bersama" }) {
  const cat = t.splits[0]?.category;
  const meta: Record<string, { name: string; icon: string; color: string }> = {
    transfer: { name: "Transfer", icon: "arrow-left-right", color: "#2563EB" },
    debt_payment: { name: t.debt ? `Cicilan ${t.debt.name}` : "Bayar cicilan", icon: "landmark", color: "#F59E0B" },
    saving_deposit: { name: t.goal ? `Setor ${t.goal.name}` : "Setor tabungan", icon: "piggy-bank", color: "#6366F1" },
    adjustment: { name: "Penyesuaian", icon: "scale", color: "#94A3B8" },
  };
  const m = meta[t.type];
  const direction: "in" | "out" | "neutral" =
    t.type === "income" ? "in" : t.type === "adjustment" ? (n(t.amount) >= 0 ? "in" : "out") : t.type === "transfer" || t.type === "saving_deposit" ? "neutral" : "out";
  return {
    id: t.id,
    date: fromDate(t.date),
    time: t.time,
    type: t.type,
    amount: n(t.amount),
    direction,
    title: m?.name ?? (t.splits.length > 1 ? `${cat?.name ?? "Kategori"} +${t.splits.length - 1}` : cat?.name ?? "Tanpa kategori"),
    icon: m?.icon ?? cat?.icon ?? "circle",
    color: m?.color ?? cat?.color ?? "#94A3B8",
    note: t.note,
    account: t.account.name,
    toAccount: t.toAccount?.name ?? null,
    // Avatar = pemilik akun (suami/istri/bersama)
    by: names[t.account.owner],
    byLabel: t.account.owner,
    planned: t.status === "planned",
    deletedAt: t.deletedAt?.toISOString() ?? null,
    isFee: t.parentId != null,
  };
}

export type TxView = ReturnType<typeof toTxView>;

export async function listTransactions(user: CurrentUser, f: TxFilters, take = 60, skip = 0) {
  const names = ownerNames(await getSettings());
  const rows = await db.transaction.findMany({
    where: txWhere(user, f),
    include,
    orderBy: [{ date: "desc" }, { time: "desc" }, { id: "desc" }],
    take: take + 1,
    skip,
  });
  return { items: rows.slice(0, take).map((r) => toTxView(r, names)), hasMore: rows.length > take };
}

export async function getTransactionDetail(user: CurrentUser, id: number) {
  const t = await db.transaction.findFirst({
    where: { id },
    include: { ...include, children: true, updatedBy: { select: { name: true } } },
  });
  return t;
}
