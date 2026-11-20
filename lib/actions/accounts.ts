"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run } from "@/lib/server/action";
import { audit } from "@/lib/server/audit";
import { balanceMap } from "@/lib/server/balances";
import { createTransaction } from "@/lib/server/transactions";
import { adjustmentFor } from "@/lib/finance/balance";
import { todayJakarta, toDate } from "@/lib/finance/date";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Nama akun belum diisi").max(80),
  type: z.enum(["bank", "ewallet", "cash", "credit_card", "paylater", "investment", "receivable"]),
  owner: z.enum(["suami", "istri", "bersama"]),
  openingBalance: z.coerce.number().int(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isArchived: z.coerce.boolean().default(false),
  includeInNetworth: z.coerce.boolean().default(true),
  creditLimit: z.coerce.number().int().min(0).nullish(),
  statementDay: z.coerce.number().int().min(1).max(31).nullish(),
  dueDay: z.coerce.number().int().min(1).max(31).nullish(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#14B8A6"),
  icon: z.string().max(32).default("wallet"),
});

export async function saveAccountAction(id: number | null, input: unknown) {
  return run(async (u) => {
    const i = accountSchema.parse(input);
    const data = {
      ...i,
      openingBalance: BigInt(i.openingBalance),
      openingDate: toDate(i.openingDate),
      creditLimit: i.creditLimit != null ? BigInt(i.creditLimit) : null,
    };
    return db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.account.findUniqueOrThrow({ where: { id } });
        const after = await tx.account.update({ where: { id }, data });
        await audit(tx, { userId: u.id, entity: "account", entityId: id, action: "update", before, after });
        return id;
      }
      const after = await tx.account.create({ data });
      await audit(tx, { userId: u.id, entity: "account", entityId: after.id, action: "create", after });
      return after.id;
    });
  });
}

/** Cocokkan saldo: buat transaksi Penyesuaian sebesar selisih. */
export async function reconcileAction(accountId: number, actualBalance: number, reason?: string, date?: string) {
  return run(async (u) => {
    const current = (await balanceMap()).get(accountId) ?? 0;
    const diff = adjustmentFor(current, Math.round(actualBalance));
    if (diff === 0) return 0;
    await createTransaction(u, { type: "adjustment", date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayJakarta(), amount: diff, accountId, note: "Penyesuaian saldo", reason });
    return diff;
  });
}

export async function deleteAccountAction(id: number) {
  return run(async (u) => {
    const used = await db.transaction.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });
    await db.$transaction(async (tx) => {
      const before = await tx.account.findUniqueOrThrow({ where: { id } });
      if (used > 0) {
        await tx.account.update({ where: { id }, data: { isArchived: true } });
        await audit(tx, { userId: u.id, entity: "account", entityId: id, action: "archive", before });
      } else {
        await tx.account.delete({ where: { id } });
        await audit(tx, { userId: u.id, entity: "account", entityId: id, action: "delete", before });
      }
    });
    return used > 0 ? "archived" : "deleted";
  });
}
