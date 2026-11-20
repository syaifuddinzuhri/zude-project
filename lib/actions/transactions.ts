"use server";
import { run } from "@/lib/server/action";
import { createTransaction, deleteTransaction, duplicateTransaction, restoreTransaction, updateTransaction } from "@/lib/server/transactions";
import { db } from "@/lib/db";
import { regenerateSchedule } from "@/lib/server/debts";

export async function createTxAction(input: unknown) {
  return run(async (u) => (await createTransaction(u, input)).id);
}

export async function updateTxAction(id: number, input: unknown) {
  return run((u) => updateTransaction(u, id, input));
}

async function regenIfExtra(id: number) {
  const t = await db.transaction.findUnique({ where: { id }, include: { scheduleRows: true } });
  if (t?.type === "debt_payment" && t.debtId && t.scheduleRows.length === 0) {
    await db.$transaction(async (tx) => {
      const unpaid = await tx.debtSchedule.count({ where: { debtId: t.debtId!, status: { not: "paid" } } });
      await regenerateSchedule(tx, t.debtId!, { periods: Math.max(1, unpaid) });
    });
  }
}

export async function deleteTxAction(id: number, reason?: string) {
  return run(async (u) => {
    await deleteTransaction(u, id, reason);
    await regenIfExtra(id);
  });
}

export async function restoreTxAction(id: number, reason?: string) {
  return run(async (u) => {
    await restoreTransaction(u, id, reason);
    await regenIfExtra(id);
  });
}

export async function duplicateTxAction(id: number) {
  return run(async (u) => (await duplicateTransaction(u, id)).id);
}
