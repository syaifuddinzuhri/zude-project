import "server-only";
import { z } from "zod";
import { db, n, type Tx } from "@/lib/db";
import { fromDate, todayJakarta, toDate } from "@/lib/finance/date";
import {
  applyExtraPayment,
  buildSchedule,
  debtServiceRatio,
  scheduleForDebt,
  totalInterest,
  type ExtraMode,
  type RateChange,
  type ScheduleRow,
} from "@/lib/finance/amortization";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { createTransaction, remainingPrincipal } from "./transactions";

export const debtSchema = z.object({
  name: z.string().trim().min(1, "Nama hutang belum diisi").max(80),
  lender: z.string().trim().min(1, "Pemberi pinjaman belum diisi").max(80),
  type: z.enum(["kpr", "kendaraan", "kta", "kartu_kredit", "paylater", "pinjol", "keluarga", "cicilan_barang", "lainnya"]),
  borrower: z.enum(["suami", "istri", "bersama"]),
  principal: z.coerce.number().int().positive("Pokok awal belum diisi"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai belum diisi"),
  tenorMonths: z.coerce.number().int().min(1, "Tenor minimal 1 bulan").max(600),
  interestType: z.enum(["flat", "annuity", "floating", "zero"]),
  interestRate: z.coerce.number().min(0).max(100), // persen per tahun
  dueDay: z.coerce.number().int().min(1).max(31),
  lateFee: z.coerce.number().int().min(0).default(0),
  defaultAccountId: z.coerce.number().int().positive().nullish(),
  note: z.string().max(255).nullish(),
  /** Cicilan yang sudah dibayar sebelum mulai dicatat di ZuDe (ditandai lunas tanpa transaksi). */
  paidPeriods: z.coerce.number().int().min(0).default(0),
});

const toRows = (rows: ScheduleRow[], debtId: number) =>
  rows.map((r) => ({
    debtId,
    periodNo: r.periodNo,
    dueDate: toDate(r.dueDate),
    principalPart: BigInt(r.principal),
    interestPart: BigInt(r.interest),
    total: BigInt(r.total),
    remainingPrincipal: BigInt(r.remaining),
  }));

const fromRow = (r: { periodNo: number; dueDate: Date; principalPart: bigint; interestPart: bigint; total: bigint; remainingPrincipal: bigint }): ScheduleRow => ({
  periodNo: r.periodNo,
  dueDate: fromDate(r.dueDate),
  principal: n(r.principalPart),
  interest: n(r.interestPart),
  total: n(r.total),
  remaining: n(r.remainingPrincipal),
});

async function rateChangesOf(tx: Tx, debtId: number): Promise<RateChange[]> {
  const rc = await tx.debtRateChange.findMany({ where: { debtId }, orderBy: { effectiveDate: "asc" } });
  return rc.map((r) => ({ effectiveDate: fromDate(r.effectiveDate), rateBp: r.interestRateBp }));
}

export async function createDebt(user: CurrentUser, raw: unknown) {
  const i = debtSchema.parse(raw);
  const rateBp = i.interestType === "zero" ? 0 : Math.round(i.interestRate * 100);
  if (i.paidPeriods >= i.tenorMonths) throw new Error("Cicilan yang sudah dibayar harus kurang dari tenor");
  const rows = scheduleForDebt({ principal: i.principal, startDate: i.startDate, tenorMonths: i.tenorMonths, type: i.interestType, rateBp, dueDay: i.dueDay });
  const openingPaid = rows.slice(0, i.paidPeriods).reduce((a, r) => a + r.principal, 0);
  return db.$transaction(async (tx) => {
    const debt = await tx.debt.create({
      data: {
        name: i.name,
        lender: i.lender,
        type: i.type,
        borrower: i.borrower,
        principal: BigInt(i.principal),
        openingPaidPrincipal: BigInt(openingPaid),
        startDate: toDate(i.startDate),
        tenorMonths: i.tenorMonths,
        interestType: i.interestType,
        interestRateBp: rateBp,
        installmentAmount: BigInt(rows[i.paidPeriods]?.total ?? rows[0]?.total ?? 0),
        dueDay: i.dueDay,
        lateFee: BigInt(i.lateFee),
        defaultAccountId: i.defaultAccountId ?? null,
        note: i.note ?? null,
      },
    });
    await tx.debtSchedule.createMany({ data: toRows(rows, debt.id) });
    if (i.paidPeriods > 0) {
      await tx.debtSchedule.updateMany({ where: { debtId: debt.id, periodNo: { lte: i.paidPeriods } }, data: { status: "paid" } });
    }
    await audit(tx, { userId: user.id, entity: "debt", entityId: debt.id, action: "create", after: { ...i, rateBp } });
    return debt;
  });
}

export async function updateDebtInfo(user: CurrentUser, id: number, raw: unknown) {
  const i = z
    .object({
      name: z.string().trim().min(1).max(80),
      lender: z.string().trim().min(1).max(80),
      lateFee: z.coerce.number().int().min(0),
      defaultAccountId: z.coerce.number().int().positive().nullish(),
      note: z.string().max(255).nullish(),
    })
    .parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.debt.findUniqueOrThrow({ where: { id } });
    const after = await tx.debt.update({ where: { id }, data: { ...i, lateFee: BigInt(i.lateFee), defaultAccountId: i.defaultAccountId ?? null } });
    await audit(tx, { userId: user.id, entity: "debt", entityId: id, action: "update", before, after });
  });
}

export async function deleteDebt(user: CurrentUser, id: number) {
  await db.$transaction(async (tx) => {
    const before = await tx.debt.findUniqueOrThrow({ where: { id } });
    const payments = await tx.transaction.count({ where: { debtId: id, deletedAt: null } });
    if (payments > 0) throw new Error("Hutang sudah punya pembayaran — tandai lunas atau hapus pembayarannya dulu");
    await tx.debt.delete({ where: { id } });
    await audit(tx, { userId: user.id, entity: "debt", entityId: id, action: "delete", before });
  });
}

/**
 * Hitung ulang jadwal yang belum dibayar dari sisa pokok aktual.
 * Baris lunas dipertahankan. `fixedInstallment` → mode kurangi tenor.
 */
export async function regenerateSchedule(tx: Tx, debtId: number, opts: { fixedInstallment?: number; periods?: number } = {}) {
  const debt = await tx.debt.findUniqueOrThrow({ where: { id: debtId } });
  const rows = await tx.debtSchedule.findMany({ where: { debtId }, orderBy: { periodNo: "asc" } });
  const paid = rows.filter((r) => r.status === "paid");
  const unpaid = rows.filter((r) => r.status !== "paid");
  const remaining = await remainingPrincipal(tx, debtId);
  const lastPaidNo = paid.at(-1)?.periodNo ?? 0;
  const nextNo = lastPaidNo + 1;
  const nextDue =
    unpaid[0]?.dueDate != null
      ? fromDate(unpaid[0].dueDate)
      : fromDate(rows.find((r) => r.periodNo === lastPaidNo)?.dueDate ?? debt.startDate);
  const periods = opts.periods ?? Math.max(1, unpaid.length || debt.tenorMonths - paid.length);
  const changes = await rateChangesOf(tx, debtId);

  const newRows =
    remaining <= 0
      ? []
      : buildSchedule({
          principal: remaining,
          periods,
          type: debt.interestType,
          rateBp: debt.interestRateBp,
          firstDueDate: unpaid[0] ? nextDue : fromDate(rows.at(-1)?.dueDate ?? debt.startDate),
          dueDay: debt.dueDay,
          startPeriodNo: nextNo,
          rateChanges: changes,
          fixedInstallment: opts.fixedInstallment,
          // Flat: bunga tetap dari pokok awal kecuali dihitung ulang setelah pelunasan sebagian
          flatBase: opts.fixedInstallment || opts.periods ? remaining : n(debt.principal),
        });

  // Baris belum dibayar yang punya tautan pembayaran (dihapus) dibiarkan tak bertaut.
  await tx.debtSchedule.deleteMany({ where: { debtId, status: { not: "paid" } } });
  // Nomor periode setelah baris lunas terakhir mungkin bentrok bila ada baris lunas di tengah: geser.
  const used = new Set(paid.map((p) => p.periodNo));
  let no = nextNo;
  const fixedRows = newRows.map((r) => {
    while (used.has(no)) no++;
    const row = { ...r, periodNo: no };
    used.add(no);
    no++;
    return row;
  });
  if (fixedRows.length) await tx.debtSchedule.createMany({ data: toRows(fixedRows, debtId) });
  await tx.debt.update({
    where: { id: debtId },
    data: { installmentAmount: BigInt(fixedRows[0]?.total ?? 0), status: remaining <= 0 ? "paid_off" : "active" },
  });
  return fixedRows;
}

/** Bayar cicilan periode tertentu (dari kalender tagihan / detail hutang). */
export async function payInstallment(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      scheduleId: z.coerce.number().int().positive(),
      accountId: z.coerce.number().int().positive("Akun pembayaran belum dipilih"),
      amount: z.coerce.number().int().positive().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().max(255).nullish(),
      reason: z.string().max(255).nullish(),
    })
    .parse(raw);
  const row = await db.debtSchedule.findUniqueOrThrow({ where: { id: i.scheduleId }, include: { debt: true } });
  return createTransaction(user, {
    type: "debt_payment",
    date: i.date ?? todayJakarta(),
    amount: i.amount ?? n(row.total),
    accountId: i.accountId,
    debtId: row.debtId,
    scheduleId: row.id,
    note: i.note ?? `Cicilan ke-${row.periodNo} ${row.debt.name}`,
    reason: i.reason,
  });
}

/** Simulasi pelunasan sebagian tanpa menyimpan. */
export async function previewExtraPayment(debtId: number, extra: number, mode: ExtraMode) {
  const debt = await db.debt.findUniqueOrThrow({ where: { id: debtId } });
  const unpaid = (await db.debtSchedule.findMany({ where: { debtId, status: { not: "paid" } }, orderBy: { periodNo: "asc" } })).map(fromRow);
  const remaining = await remainingPrincipal(db, debtId);
  return applyExtraPayment({
    remaining,
    currentUnpaid: unpaid,
    extra,
    mode,
    type: debt.interestType,
    rateBp: debt.interestRateBp,
    dueDay: debt.dueDay,
    rateChanges: await rateChangesOf(db, debtId),
  });
}

export async function makeExtraPayment(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      debtId: z.coerce.number().int().positive(),
      accountId: z.coerce.number().int().positive("Akun pembayaran belum dipilih"),
      amount: z.coerce.number().int().positive("Nominal belum diisi"),
      mode: z.enum(["reduce_tenor", "reduce_installment"]),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      reason: z.string().max(255).nullish(),
    })
    .parse(raw);
  const preview = await previewExtraPayment(i.debtId, i.amount, i.mode);
  await db.$transaction(
    async (tx) => {
      const before = await tx.debtSchedule.findMany({ where: { debtId: i.debtId, status: { not: "paid" } } });
      const t = await createTransaction(
        user,
        {
          type: "debt_payment",
          date: i.date ?? todayJakarta(),
          amount: i.amount,
          principalAmount: i.amount,
          accountId: i.accountId,
          debtId: i.debtId,
          note: `Pelunasan sebagian (${i.mode === "reduce_tenor" ? "kurangi tenor" : "kurangi cicilan"})`,
          reason: i.reason,
        },
        { tx, skipNotify: true },
      );
      const unpaid = before.sort((a, b) => a.periodNo - b.periodNo);
      if (i.mode === "reduce_tenor") await regenerateSchedule(tx, i.debtId, { fixedInstallment: n(unpaid[0]?.total ?? 0) || undefined, periods: unpaid.length });
      else await regenerateSchedule(tx, i.debtId, { periods: unpaid.length });
      await audit(tx, {
        userId: user.id,
        entity: "debt",
        entityId: i.debtId,
        action: "extra_payment",
        before: { unpaid: before.length },
        after: { transactionId: t.id, mode: i.mode, interestSaved: preview.interestSaved, periodsSaved: preview.periodsSaved },
      });
    },
    { timeout: 30_000 },
  );
  return preview;
}

/** KPR floating: catat perubahan bunga lalu hitung ulang jadwal. */
export async function changeRate(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      debtId: z.coerce.number().int().positive(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      interestRate: z.coerce.number().min(0).max(100),
    })
    .parse(raw);
  await db.$transaction(async (tx) => {
    const debt = await tx.debt.findUniqueOrThrow({ where: { id: i.debtId } });
    if (debt.interestType !== "floating") throw new Error("Perubahan bunga hanya untuk tipe floating");
    const rc = await tx.debtRateChange.create({ data: { debtId: i.debtId, effectiveDate: toDate(i.effectiveDate), interestRateBp: Math.round(i.interestRate * 100) } });
    const unpaid = await tx.debtSchedule.count({ where: { debtId: i.debtId, status: { not: "paid" } } });
    await regenerateSchedule(tx, i.debtId, { periods: unpaid });
    await audit(tx, { userId: user.id, entity: "debt", entityId: i.debtId, action: "rate_change", after: rc });
  });
}

/** Ringkasan hutang: total, cicilan per bulan, DSR, tanggal bebas hutang. */
export async function debtSummary(monthlyIncome: number) {
  const debts = await db.debt.findMany({ where: { status: "active" }, include: { schedule: { orderBy: { periodNo: "asc" } } } });
  let total = 0;
  let monthly = 0;
  let freeDate: string | null = null;
  const items = [];
  for (const d of debts) {
    const remaining = await remainingPrincipal(db, d.id);
    const unpaid = d.schedule.filter((r) => r.status !== "paid");
    const next = unpaid[0];
    const last = unpaid.at(-1);
    total += remaining;
    monthly += n(next?.total ?? d.installmentAmount);
    if (last && (!freeDate || fromDate(last.dueDate) > freeDate)) freeDate = fromDate(last.dueDate);
    const principal = n(d.principal);
    items.push({
      id: d.id,
      name: d.name,
      lender: d.lender,
      type: d.type,
      borrower: d.borrower,
      interestType: d.interestType,
      rateBp: d.interestRateBp,
      principal,
      remaining,
      progress: principal > 0 ? 1 - remaining / principal : 1,
      nextDue: next ? fromDate(next.dueDate) : null,
      nextAmount: n(next?.total ?? 0),
      nextScheduleId: next?.id ?? null,
      nextStatus: next?.status ?? null,
      endDate: last ? fromDate(last.dueDate) : null,
      remainingInterest: totalInterest(unpaid.map(fromRow)),
      periodsLeft: unpaid.length,
      defaultAccountId: d.defaultAccountId,
    });
  }
  return { total, monthly, dsr: debtServiceRatio(monthly, monthlyIncome), freeDate, items };
}

export { fromRow as scheduleRowFromDb };
