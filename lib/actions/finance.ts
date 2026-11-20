"use server";
import { z } from "zod";
import { db, n } from "@/lib/db";
import { run } from "@/lib/server/action";
import { audit } from "@/lib/server/audit";
import { changeRate, createDebt, deleteDebt, makeExtraPayment, payInstallment, previewExtraPayment, updateDebtInfo } from "@/lib/server/debts";
import { deleteGoal, depositToGoal, saveGoal, withdrawFromGoal } from "@/lib/server/goals";
import { confirmOccurrence, deleteRule, saveRule } from "@/lib/server/recurring";
import {
  applyBudgetTemplate,
  applySinkingFunds,
  copyFromPrevious,
  removeBudget,
  saveBudgetTemplate,
  saveSinkingFund,
  setBudget,
  setPlannedIncome,
} from "@/lib/server/budgets";
import { finalizePeriod } from "@/lib/server/closing";
import { deleteAllocationTemplate, runIncomeWizard, saveAllocationTemplate } from "@/lib/server/allocation";
import { toDate } from "@/lib/finance/date";

// ── Hutang ───────────────────────────────────────────────────────
export const createDebtAction = async (i: unknown) => run(async (u) => (await createDebt(u, i)).id);
export const updateDebtAction = async (id: number, i: unknown) => run((u) => updateDebtInfo(u, id, i));
export const deleteDebtAction = async (id: number) => run((u) => deleteDebt(u, id));
export const payInstallmentAction = async (i: unknown) => run(async (u) => (await payInstallment(u, i)).id);
export const extraPaymentAction = async (i: unknown) => run((u) => makeExtraPayment(u, i));
export const changeRateAction = async (i: unknown) => run((u) => changeRate(u, i));
export async function previewExtraAction(debtId: number, amount: number, mode: "reduce_tenor" | "reduce_installment") {
  return run(() => previewExtraPayment(debtId, amount, mode));
}

// ── Tabungan ─────────────────────────────────────────────────────
export const saveGoalAction = async (id: number | null, i: unknown) => run(async (u) => (await saveGoal(u, id, i)).id);
export const deleteGoalAction = async (id: number) => run((u) => deleteGoal(u, id));
export const depositGoalAction = async (i: unknown) => run(async (u) => (await depositToGoal(u, i)).id);
export const withdrawGoalAction = async (i: unknown) => run((u) => withdrawFromGoal(u, i));

// ── Tagihan berulang ─────────────────────────────────────────────
export const saveRuleAction = async (id: number | null, i: unknown) => run(async (u) => (await saveRule(u, id, i)).id);
export const deleteRuleAction = async (id: number) => run((u) => deleteRule(u, id));
export const confirmBillAction = async (i: unknown) => run(async (u) => (await confirmOccurrence(u, i)).id);

// ── Anggaran ─────────────────────────────────────────────────────
export const setBudgetAction = async (i: unknown) => run((u) => setBudget(u, i));
export const removeBudgetAction = async (id: number) => run((u) => removeBudget(u, id));
export const setPlannedIncomeAction = async (periodId: number, amount: number) => run((u) => setPlannedIncome(u, periodId, amount));
export const copyBudgetAction = async (periodId: number) => run((u) => copyFromPrevious(u, periodId));
export const saveBudgetTemplateAction = async (periodId: number, name: string) => run((u) => saveBudgetTemplate(u, periodId, name));
export const applyBudgetTemplateAction = async (periodId: number, templateId: number) => run((u) => applyBudgetTemplate(u, periodId, templateId));
export const saveSinkingAction = async (id: number | null, i: unknown) => run((u) => saveSinkingFund(u, id, i));
export const applySinkingAction = async (periodId: number) => run((u) => applySinkingFunds(u, periodId));
export async function deleteSinkingAction(id: number) {
  return run(async (u) => {
    const before = await db.sinkingFund.findUniqueOrThrow({ where: { id } });
    await db.sinkingFund.update({ where: { id }, data: { isActive: false } });
    await audit(db, { userId: u.id, entity: "sinking_fund", entityId: id, action: "delete", before });
  });
}

// ── Tutup buku ───────────────────────────────────────────────────
export const finalizePeriodAction = async (i: unknown) => run((u) => finalizePeriod(u, i));

// ── Alokasi gaji ─────────────────────────────────────────────────
export const saveAllocTemplateAction = async (id: number | null, i: unknown) => run(async (u) => (await saveAllocationTemplate(u, id, i)).id);
export const deleteAllocTemplateAction = async (id: number) => run((u) => deleteAllocationTemplate(u, id));
export const incomeWizardAction = async (i: unknown) => run((u) => runIncomeWizard(u, i));

// ── Piutang ──────────────────────────────────────────────────────
const receivableSchema = z.object({
  debtorName: z.string().trim().min(1, "Nama peminjam belum diisi").max(80),
  amount: z.coerce.number().int().positive("Nominal belum diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  promisedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("").transform(() => null)),
  note: z.string().max(255).nullish(),
});

export async function saveReceivableAction(id: number | null, input: unknown) {
  return run(async (u) => {
    const i = receivableSchema.parse(input);
    const data = { ...i, amount: BigInt(i.amount), date: toDate(i.date), promisedDate: i.promisedDate ? toDate(i.promisedDate) : null };
    const r = id ? await db.receivable.update({ where: { id }, data }) : await db.receivable.create({ data });
    await audit(db, { userId: u.id, entity: "receivable", entityId: r.id, action: id ? "update" : "create", after: r });
  });
}

export async function receivablePaymentAction(id: number, amount: number, date: string) {
  return run(async (u) => {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Nominal belum diisi");
    const r = await db.receivable.findUniqueOrThrow({ where: { id } });
    const history = (Array.isArray(r.historyJson) ? r.historyJson : []) as { date: string; amount: number }[];
    const paid = n(r.paidAmount) + amount;
    if (paid > n(r.amount)) throw new Error("Pembayaran melebihi sisa piutang");
    const after = await db.receivable.update({
      where: { id },
      data: { paidAmount: BigInt(paid), status: paid >= n(r.amount) ? "paid" : "open", historyJson: [...history, { date, amount }] },
    });
    await audit(db, { userId: u.id, entity: "receivable", entityId: id, action: "payment", before: r, after });
  });
}

export async function deleteReceivableAction(id: number) {
  return run(async (u) => {
    const before = await db.receivable.findUniqueOrThrow({ where: { id } });
    await db.receivable.delete({ where: { id } });
    await audit(db, { userId: u.id, entity: "receivable", entityId: id, action: "delete", before });
  });
}

// ── Aset ─────────────────────────────────────────────────────────
const assetSchema = z.object({
  name: z.string().trim().min(1, "Nama aset belum diisi").max(80),
  type: z.enum(["property", "vehicle", "gold", "mutual_fund", "stock", "crypto", "pension", "other"]),
  owner: z.enum(["suami", "istri", "bersama"]),
  unit: z.string().max(16).nullish(),
  quantity: z.coerce.number().min(0).nullish(),
  value: z.coerce.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function saveAssetAction(id: number | null, input: unknown) {
  return run(async (u) => {
    const i = assetSchema.parse(input);
    await db.$transaction(async (tx) => {
      const data = { name: i.name, type: i.type, owner: i.owner, unit: i.unit ?? null, quantity: i.quantity ?? null };
      const a = id ? await tx.asset.update({ where: { id }, data }) : await tx.asset.create({ data });
      await tx.assetValuation.create({ data: { assetId: a.id, date: toDate(i.date), value: BigInt(i.value) } });
      await audit(tx, { userId: u.id, entity: "asset", entityId: a.id, action: id ? "update" : "create", after: { ...data, value: i.value, date: i.date } });
    });
  });
}

export async function deleteAssetAction(id: number) {
  return run(async (u) => {
    const before = await db.asset.findUniqueOrThrow({ where: { id } });
    await db.asset.delete({ where: { id } });
    await audit(db, { userId: u.id, entity: "asset", entityId: id, action: "delete", before });
  });
}
