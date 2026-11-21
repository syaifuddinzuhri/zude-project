import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, n, type Tx } from "@/lib/db";
import { fromDate, nowTimeJakarta, toDate, todayJakarta } from "@/lib/finance/date";
import { normalizeSplits, validateSplits } from "@/lib/finance/splits";
import { crossedThresholds } from "@/lib/finance/budget";
import { canAllocate } from "@/lib/finance/goals";
import { formatRp } from "@/lib/finance/money";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { assertEditable, ensurePeriod } from "./periods";
import { getSettings, periodOf } from "./settings";
import { balanceMap } from "./balances";
import { notify } from "@/lib/notify";

const money = z.coerce.number().int("Nominal harus bilangan bulat");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

export const txInputSchema = z.object({
  type: z.enum(["income", "expense", "transfer", "debt_payment", "saving_deposit", "adjustment"]),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  amount: money,
  accountId: z.coerce.number().int().positive("Akun belum dipilih"),
  toAccountId: z.coerce.number().int().positive().nullish(),
  splits: z.array(z.object({ categoryId: z.coerce.number().int().positive(), amount: money, note: z.string().max(255).nullish() })).optional(),
  note: z.string().max(255).nullish(),
  beneficiary: z.enum(["suami", "istri", "anak", "keluarga", "bersama"]).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  feeAmount: money.min(0).optional(),
  status: z.enum(["planned", "realized"]).optional(),
  debtId: z.coerce.number().int().positive().nullish(),
  scheduleId: z.coerce.number().int().positive().nullish(),
  principalAmount: money.min(0).nullish(),
  goalId: z.coerce.number().int().positive().nullish(),
  recurringId: z.coerce.number().int().positive().nullish(),
  recurringDueDate: isoDate.nullish(),
  reason: z.string().max(255).nullish(),
});

export type TxInput = z.infer<typeof txInputSchema>;

async function systemCategory(tx: Tx, key: string) {
  const c = await tx.category.findUnique({ where: { systemKey: key } });
  if (!c) throw new Error(`Kategori sistem "${key}" belum ada — jalankan seed`);
  return c;
}

async function assertAccountsUsable(tx: Tx, _user: CurrentUser, ids: (number | null | undefined)[]) {
  for (const id of ids) {
    if (!id) continue;
    const a = await tx.account.findUnique({ where: { id } });
    if (!a) throw new Error("Akun tidak ditemukan");
  }
}

async function upsertTags(tx: Tx, names: string[] | undefined) {
  if (!names?.length) return [];
  const ids: number[] = [];
  for (const name of [...new Set(names.map((t) => t.toLowerCase()))]) {
    const t = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
    ids.push(t.id);
  }
  return ids;
}

interface Prepared {
  data: Omit<Prisma.TransactionUncheckedCreateInput, "createdById">;
  splits: { categoryId: number; amount: number; note?: string | null }[];
  fee: number;
  scheduleId: number | null;
}

async function prepare(tx: Tx, user: CurrentUser, i: TxInput): Promise<Prepared> {
  const base = {
    date: toDate(i.date),
    time: i.time ?? nowTimeJakarta(),
    type: i.type,
    accountId: i.accountId,
    note: i.note?.trim() || null,
    beneficiary: i.beneficiary ?? null,
    status: i.status ?? "realized",
    recurringId: i.recurringId ?? null,
    recurringDueDate: i.recurringDueDate ? toDate(i.recurringDueDate) : null,
  };
  await assertAccountsUsable(tx, user, [i.accountId, i.toAccountId]);

  switch (i.type) {
    case "income":
    case "expense": {
      const splits = normalizeSplits(i.splits ?? []);
      const check = validateSplits(i.amount, splits);
      if (!check.ok) throw new Error(check.message);
      const kinds = await tx.category.findMany({ where: { id: { in: splits.map((s) => s.categoryId) } } });
      if (kinds.some((c) => c.kind !== i.type)) throw new Error("Kategori tidak sesuai jenis transaksi");
      return { data: { ...base, amount: BigInt(i.amount), toAccountId: null }, splits, fee: 0, scheduleId: null };
    }
    case "transfer": {
      if (i.amount <= 0) throw new Error("Nominal belum diisi");
      if (!i.toAccountId) throw new Error("Akun tujuan belum dipilih");
      if (i.toAccountId === i.accountId) throw new Error("Akun asal dan tujuan sama");
      return {
        data: { ...base, amount: BigInt(i.amount), toAccountId: i.toAccountId, feeAmount: BigInt(i.feeAmount ?? 0) },
        splits: [],
        fee: i.feeAmount ?? 0,
        scheduleId: null,
      };
    }
    case "saving_deposit": {
      if (i.amount <= 0) throw new Error("Nominal belum diisi");
      if (!i.goalId) throw new Error("Tujuan tabungan belum dipilih");
      const goal = await tx.goal.findUnique({ where: { id: i.goalId } });
      if (!goal) throw new Error("Tujuan tidak ditemukan");
      const to = i.toAccountId ?? goal.accountId ?? i.accountId;
      return {
        data: { ...base, amount: BigInt(i.amount), toAccountId: to, goalId: goal.id, feeAmount: BigInt(i.feeAmount ?? 0) },
        splits: [],
        fee: i.feeAmount ?? 0,
        scheduleId: null,
      };
    }
    case "debt_payment": {
      if (i.amount <= 0) throw new Error("Nominal belum diisi");
      if (!i.debtId) throw new Error("Hutang belum dipilih");
      const debt = await tx.debt.findUnique({ where: { id: i.debtId } });
      if (!debt) throw new Error("Hutang tidak ditemukan");
      let principal = i.principalAmount ?? null;
      let scheduleId: number | null = null;
      if (i.scheduleId) {
        const row = await tx.debtSchedule.findUnique({ where: { id: i.scheduleId } });
        if (!row || row.debtId !== debt.id) throw new Error("Jadwal cicilan tidak ditemukan");
        if (row.status === "paid") throw new Error("Cicilan periode ini sudah dibayar");
        scheduleId = row.id;
        if (principal == null) {
          // Bayar bunga dulu, sisanya pokok; kelebihan dari cicilan = biaya/denda.
          const interest = Math.min(i.amount, n(row.interestPart));
          principal = Math.min(n(row.principalPart), i.amount - interest);
        }
      }
      if (principal == null) principal = i.amount;
      if (principal > i.amount) throw new Error("Pokok melebihi nominal pembayaran");
      const remaining = await remainingPrincipal(tx, debt.id);
      if (principal > remaining) throw new Error(`Pokok melebihi sisa hutang (${formatRp(remaining)})`);
      const interest = i.amount - principal;
      const splits = interest > 0 ? [{ categoryId: (await systemCategory(tx, "debt_interest")).id, amount: interest, note: "Bunga/biaya cicilan" }] : [];
      return {
        data: { ...base, amount: BigInt(i.amount), toAccountId: null, debtId: debt.id, principalAmount: BigInt(principal) },
        splits,
        fee: 0,
        scheduleId,
      };
    }
    case "adjustment": {
      if (i.amount === 0) throw new Error("Saldo sudah sama, tidak perlu penyesuaian");
      return { data: { ...base, amount: BigInt(i.amount), toAccountId: null }, splits: [], fee: 0, scheduleId: null };
    }
  }
}

/** Sisa pokok = pokok awal − Σ pokok dari pembayaran yang tidak terhapus. */
export async function remainingPrincipal(tx: Tx, debtId: number): Promise<number> {
  const [debt, paid] = await Promise.all([
    tx.debt.findUniqueOrThrow({ where: { id: debtId } }),
    tx.transaction.aggregate({ where: { debtId, type: "debt_payment", deletedAt: null, status: "realized" }, _sum: { principalAmount: true } }),
  ]);
  return n(debt.principal) - n(debt.openingPaidPrincipal) - n(paid._sum.principalAmount);
}

async function writeChildren(tx: Tx, user: CurrentUser, txId: number, p: Prepared, i: TxInput) {
  if (p.splits.length) {
    await tx.transactionSplit.createMany({
      data: p.splits.map((s) => ({ transactionId: txId, categoryId: s.categoryId, amount: BigInt(s.amount), note: s.note ?? null })),
    });
  }
  const tagIds = await upsertTags(tx, i.tags);
  if (tagIds.length) await tx.transactionTag.createMany({ data: tagIds.map((tagId) => ({ transactionId: txId, tagId })) });

  if (p.fee > 0) {
    const feeCat = await systemCategory(tx, "bank_fee");
    const child = await tx.transaction.create({
      data: {
        date: p.data.date,
        time: p.data.time,
        type: "expense",
        accountId: p.data.accountId,
        amount: BigInt(p.fee),
        note: "Biaya admin transfer",
        status: p.data.status,
        parentId: txId,
        createdById: user.id,
      },
    });
    await tx.transactionSplit.create({ data: { transactionId: child.id, categoryId: feeCat.id, amount: BigInt(p.fee) } });
  }

  if (p.data.type === "saving_deposit" && p.data.goalId && p.data.status === "realized") {
    await tx.goalAllocation.create({
      data: { goalId: p.data.goalId as number, transactionId: txId, amount: p.data.amount as bigint, date: p.data.date as Date, createdById: user.id },
    });
  }

  if (p.scheduleId) {
    const row = await tx.debtSchedule.findUniqueOrThrow({ where: { id: p.scheduleId } });
    const full = n(p.data.amount as bigint) >= n(row.total) || n(p.data.principalAmount as bigint) >= n(row.principalPart);
    await tx.debtSchedule.update({ where: { id: row.id }, data: { status: full ? "paid" : row.status, paymentTransactionId: txId } });
  }

  if (p.data.type === "debt_payment" && p.data.debtId) {
    const left = await remainingPrincipal(tx, p.data.debtId as number);
    await tx.debt.update({ where: { id: p.data.debtId as number }, data: { status: left <= 0 ? "paid_off" : "active" } });
  }
}

/** Validasi alokasi virtual: total tujuan di satu akun ≤ saldo akun (dibaca di dalam DB transaction yang sama). */
async function checkGoalCapacity(tx: Tx, accountId: number | null) {
  if (!accountId) return;
  const goals = await tx.goal.findMany({ where: { accountId }, select: { id: true } });
  const alloc = await tx.goalAllocation.aggregate({ where: { goalId: { in: goals.map((g) => g.id) } }, _sum: { amount: true } });
  const bal = (await balanceMap(tx)).get(accountId) ?? 0;
  if (!canAllocate(bal, n(alloc._sum.amount), 0)) {
    throw new Error(`Total alokasi tujuan melebihi saldo akun (${formatRp(bal)})`);
  }
}

export async function createTransaction(user: CurrentUser, raw: unknown, opts: { tx?: Tx; skipNotify?: boolean } = {}) {
  const i = txInputSchema.parse(raw);
  const run = async (tx: Tx) => {
    await assertEditable([i.date], i.reason, tx);
    const p = await prepare(tx, user, i);
    const created = await tx.transaction.create({ data: { ...p.data, createdById: user.id } });
    await writeChildren(tx, user, created.id, p, i);
    if (p.data.type === "saving_deposit" && p.data.goalId) {
      await checkGoalCapacity(tx, (p.data.toAccountId as number) ?? null);
    }
    await tx.user.update({ where: { id: user.id }, data: { lastAccountId: i.accountId } });
    await audit(tx, { userId: user.id, entity: "transaction", entityId: created.id, action: "create", after: { ...p.data, splits: p.splits, fee: p.fee }, reason: i.reason });
    return created;
  };
  const created = opts.tx ? await run(opts.tx) : await db.$transaction(run, { timeout: 20_000 });
  if (!opts.skipNotify) await afterWrite(user, created.id).catch((e) => console.error("[afterWrite]", e));
  return created;
}

async function loadVisible(tx: Tx, user: CurrentUser, id: number) {
  const t = await tx.transaction.findFirst({
    where: { id },
    include: { splits: true, tags: { include: { tag: true } }, children: true },
  });
  if (!t) throw new Error("Transaksi tidak ditemukan");
  return t;
}

export async function updateTransaction(user: CurrentUser, id: number, raw: unknown) {
  const i = txInputSchema.parse(raw);
  await db.$transaction(
    async (tx) => {
      const old = await loadVisible(tx, user, id);
      if (old.parentId) throw new Error("Biaya admin diubah lewat transaksi transfernya");
      if (old.type === "debt_payment" || i.type === "debt_payment") {
        if (old.type !== i.type || n(old.amount) !== i.amount || old.accountId !== i.accountId) {
          throw new Error("Pembayaran cicilan tidak bisa diubah nominal/akunnya — hapus lalu bayar ulang");
        }
      }
      await assertEditable([fromDate(old.date), i.date], i.reason, tx);
      // Hapus turunan lama lalu tulis ulang
      await tx.transactionSplit.deleteMany({ where: { transactionId: id } });
      await tx.transactionTag.deleteMany({ where: { transactionId: id } });
      await tx.transaction.deleteMany({ where: { parentId: id } });
      await tx.goalAllocation.deleteMany({ where: { transactionId: id } });

      if (old.type === "debt_payment") {
        // Hanya catatan/tanggal/jam/penerima yang berubah; split bunga dipertahankan
        await tx.transaction.update({
          where: { id },
          data: { date: toDate(i.date), time: i.time ?? old.time, note: i.note?.trim() || null, beneficiary: i.beneficiary ?? null, updatedById: user.id },
        });
        if (old.splits.length) {
          await tx.transactionSplit.createMany({ data: old.splits.map((s) => ({ transactionId: id, categoryId: s.categoryId, amount: s.amount, note: s.note })) });
        }
        const tagIds = await upsertTags(tx, i.tags);
        if (tagIds.length) await tx.transactionTag.createMany({ data: tagIds.map((tagId) => ({ transactionId: id, tagId })) });
      } else {
        const p = await prepare(tx, user, i);
        await tx.transaction.update({ where: { id }, data: { ...p.data, feeAmount: p.data.feeAmount ?? BigInt(0), goalId: p.data.goalId ?? null, updatedById: user.id } });
        await writeChildren(tx, user, id, p, i);
      }
      await audit(tx, {
        userId: user.id,
        entity: "transaction",
        entityId: id,
        action: "update",
        before: { ...old, tags: old.tags.map((t) => t.tag.name) },
        after: i,
        reason: i.reason,
      });
    },
    { timeout: 20_000 },
  );
  await afterWrite(user, id).catch((e) => console.error("[afterWrite]", e));
}

export async function deleteTransaction(user: CurrentUser, id: number, reason?: string | null) {
  await db.$transaction(async (tx) => {
    const old = await loadVisible(tx, user, id);
    if (old.parentId) throw new Error("Hapus lewat transaksi transfernya");
    await assertEditable([fromDate(old.date)], reason, tx);
    const now = new Date();
    await tx.transaction.updateMany({ where: { OR: [{ id }, { parentId: id }] }, data: { deletedAt: now, updatedById: user.id } });
    await tx.goalAllocation.deleteMany({ where: { transactionId: id } });
    if (old.type === "debt_payment" && old.debtId) {
      // Jadwal tetap menyimpan tautan; status kembali belum dibayar (dipulihkan saat restore).
      await tx.debtSchedule.updateMany({ where: { paymentTransactionId: id }, data: { status: "unpaid" } });
      await tx.debt.update({ where: { id: old.debtId }, data: { status: "active" } });
    }
    await audit(tx, { userId: user.id, entity: "transaction", entityId: id, action: "delete", before: old, reason });
  });
}

/** Pulihkan transaksi yang dihapus ≤ 30 hari. */
export async function restoreTransaction(user: CurrentUser, id: number, reason?: string | null) {
  await db.$transaction(async (tx) => {
    const old = await tx.transaction.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!old) throw new Error("Transaksi tidak ditemukan");
    if (Date.now() - old.deletedAt!.getTime() > 30 * 86_400_000) throw new Error("Sudah lebih dari 30 hari, tidak bisa dipulihkan");
    await assertEditable([fromDate(old.date)], reason, tx);
    await tx.transaction.updateMany({ where: { OR: [{ id }, { parentId: id }] }, data: { deletedAt: null, updatedById: user.id } });
    if (old.type === "saving_deposit" && old.goalId) {
      await tx.goalAllocation.create({ data: { goalId: old.goalId, transactionId: id, amount: old.amount, date: old.date, createdById: user.id } });
    }
    if (old.type === "debt_payment" && old.debtId) {
      await tx.debtSchedule.updateMany({ where: { paymentTransactionId: id }, data: { status: "paid" } });
      const left = await remainingPrincipal(tx, old.debtId);
      await tx.debt.update({ where: { id: old.debtId }, data: { status: left <= 0 ? "paid_off" : "active" } });
    }
    await audit(tx, { userId: user.id, entity: "transaction", entityId: id, action: "restore", after: old, reason });
  });
}

/** Duplikat ke hari ini. */
export async function duplicateTransaction(user: CurrentUser, id: number) {
  const t = await loadVisible(db, user, id);
  if (t.type === "debt_payment") throw new Error("Pembayaran cicilan tidak bisa diduplikat");
  return createTransaction(user, {
    type: t.type,
    date: todayJakarta(),
    amount: n(t.amount),
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    splits: t.splits.map((s) => ({ categoryId: s.categoryId, amount: n(s.amount), note: s.note })),
    note: t.note,
    beneficiary: t.beneficiary,
    tags: t.tags.map((x) => x.tag.name),
    feeAmount: t.children.reduce((a, c) => a + n(c.amount), 0),
    goalId: t.goalId,
  });
}

/** Notifikasi setelah transaksi tersimpan: pengeluaran besar & ambang anggaran. */
async function afterWrite(user: CurrentUser, txId: number) {
  const t = await db.transaction.findUnique({ where: { id: txId }, include: { account: true, splits: { include: { category: true } } } });
  if (!t || t.deletedAt || t.status !== "realized" || t.type !== "expense") return;
  const settings = await getSettings();
  const amount = n(t.amount);
  const users = await db.user.findMany({ select: { id: true } });

  if (t.account.owner === "bersama" && amount >= n(settings.bigExpenseThreshold)) {
    const cat = t.splits[0]?.category.name ?? "Pengeluaran";
    await notify(
      users.map((u) => u.id),
      {
        type: "big_expense",
        title: "Pengeluaran besar dari akun bersama",
        body: `${formatRp(amount)} — ${cat} (${t.account.name})`,
        bodyNoAmount: `Pengeluaran besar — ${cat} (${t.account.name})`,
        url: `/transaksi/${t.id}`,
        dedupeKey: `big:${t.id}`,
      },
    );
  }

  // Ambang anggaran 80% / 100%
  const period = periodOf(settings, fromDate(t.date));
  const bp = await ensurePeriod(period);
  for (const s of t.splits) {
    const catIds = [s.categoryId, s.category.parentId].filter((x): x is number => x != null);
    const budget = await db.budget.findFirst({ where: { periodId: bp.id, categoryId: { in: catIds } }, include: { category: true } });
    if (!budget || !budget.category) continue;
    const scope = budget.category.parentId == null ? { OR: [{ id: budget.categoryId! }, { parentId: budget.categoryId! }] } : { id: budget.categoryId! };
    const cats = await db.category.findMany({ where: scope, select: { id: true } });
    const spentAgg = await db.transactionSplit.aggregate({
      where: {
        categoryId: { in: cats.map((c) => c.id) },
        transaction: { deletedAt: null, status: "realized", type: { in: ["expense", "debt_payment"] }, date: { gte: toDate(period.start), lte: toDate(period.end) } },
      },
      _sum: { amount: true },
    });
    const after = n(spentAgg._sum.amount);
    const line = { budget: n(budget.amount), rollover: n(budget.rolloverAmount) };
    const crossed = crossedThresholds({ ...line, spent: after - n(s.amount) }, { ...line, spent: after });
    for (const pct of crossed) {
      const usedPct = Math.round((after / Math.max(1, line.budget + line.rollover)) * 100);
      await notify(
        users.map((u) => u.id),
        {
          type: "budget_threshold",
          title: pct >= 100 ? "Anggaran terlampaui" : "Anggaran hampir habis",
          body: `Anggaran ${budget.category.name} sudah ${usedPct}%`,
          url: `/anggaran/${budget.id}`,
          dedupeKey: `budget:${budget.id}:${pct}`,
        },
      );
    }
  }
}
