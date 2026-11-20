import "server-only";
import { z } from "zod";
import { db, n, toJson } from "@/lib/db";
import { todayJakarta } from "@/lib/finance/date";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { createTransaction } from "./transactions";

export const allocItemSchema = z.object({
  targetType: z.enum(["account", "goal", "debt"]),
  targetId: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().min(0).nullish(),
  percent: z.coerce.number().min(0).max(100).nullish(),
  label: z.string().max(80).default(""),
});
export type AllocItem = z.infer<typeof allocItemSchema>;

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Nama template belum diisi").max(80),
  trigger: z.enum(["salary", "bonus", "manual"]),
  items: z.array(allocItemSchema).min(1, "Tambahkan minimal satu pos"),
});

export async function saveAllocationTemplate(user: CurrentUser, id: number | null, raw: unknown) {
  const i = templateSchema.parse(raw);
  const data = { name: i.name, trigger: i.trigger, itemsJson: toJson(i.items) };
  return db.$transaction(async (tx) => {
    const before = id ? await tx.allocationTemplate.findUnique({ where: { id } }) : null;
    const t = id ? await tx.allocationTemplate.update({ where: { id }, data }) : await tx.allocationTemplate.create({ data });
    await audit(tx, { userId: user.id, entity: "allocation_template", entityId: t.id, action: id ? "update" : "create", before, after: t });
    return t;
  });
}

export async function deleteAllocationTemplate(user: CurrentUser, id: number) {
  await db.$transaction(async (tx) => {
    const before = await tx.allocationTemplate.findUniqueOrThrow({ where: { id } });
    await tx.allocationTemplate.delete({ where: { id } });
    await audit(tx, { userId: user.id, entity: "allocation_template", entityId: id, action: "delete", before });
  });
}

export { resolveAmounts } from "@/lib/finance/allocation";

export const incomeWizardSchema = z.object({
  amount: z.coerce.number().int().positive("Nominal gaji belum diisi"),
  accountId: z.coerce.number().int().positive("Akun tujuan gaji belum dipilih"),
  categoryId: z.coerce.number().int().positive("Kategori belum dipilih"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(255).nullish(),
  items: z.array(z.object({ targetType: z.enum(["account", "goal", "debt"]), targetId: z.coerce.number().int().positive(), amount: z.coerce.number().int().min(0), label: z.string().max(80).default("") })),
});

/** Gaji/bonus masuk → semua transfer, setoran, dan cicilan tercatat sekaligus dalam satu DB transaction. */
export async function runIncomeWizard(user: CurrentUser, raw: unknown) {
  const i = incomeWizardSchema.parse(raw);
  const items = i.items.filter((x) => x.amount > 0);
  const totalAlloc = items.reduce((a, x) => a + x.amount, 0);
  if (totalAlloc > i.amount) throw new Error("Total alokasi melebihi nominal pemasukan");
  const date = i.date ?? todayJakarta();
  const result = await db.$transaction(
    async (tx) => {
      const cat = await tx.category.findUniqueOrThrow({ where: { id: i.categoryId } });
      const income = await createTransaction(
        user,
        { type: "income", date, amount: i.amount, accountId: i.accountId, splits: [{ categoryId: i.categoryId, amount: i.amount }], note: i.note ?? cat.name },
        { tx, skipNotify: true },
      );
      let count = 0;
      for (const it of items) {
        if (it.targetType === "account") {
          if (it.targetId === i.accountId) continue;
          await createTransaction(user, { type: "transfer", date, amount: it.amount, accountId: i.accountId, toAccountId: it.targetId, note: it.label || "Alokasi gaji" }, { tx, skipNotify: true });
        } else if (it.targetType === "goal") {
          const goal = await tx.goal.findUniqueOrThrow({ where: { id: it.targetId } });
          await createTransaction(
            user,
            { type: "saving_deposit", date, amount: it.amount, accountId: i.accountId, toAccountId: goal.accountId ?? i.accountId, goalId: goal.id, note: it.label || `Setor ${goal.name}` },
            { tx, skipNotify: true },
          );
        } else {
          const next = await tx.debtSchedule.findFirst({ where: { debtId: it.targetId, status: { not: "paid" } }, orderBy: { periodNo: "asc" } });
          await createTransaction(
            user,
            {
              type: "debt_payment",
              date,
              amount: it.amount,
              accountId: i.accountId,
              debtId: it.targetId,
              scheduleId: next?.id ?? null,
              note: it.label || (next ? `Cicilan ke-${next.periodNo}` : "Bayar hutang"),
            },
            { tx, skipNotify: true },
          );
        }
        count++;
      }
      await audit(tx, { userId: user.id, entity: "income_wizard", entityId: income.id, action: "create", after: { amount: i.amount, items } });
      return { incomeId: income.id, count };
    },
    { timeout: 60_000 },
  );
  return result;
}

export async function templatesFor(trigger?: "salary" | "bonus" | "manual") {
  const rows = await db.allocationTemplate.findMany({ where: trigger ? { trigger } : {}, orderBy: { id: "asc" } });
  return rows.map((t) => ({ id: t.id, name: t.name, trigger: t.trigger, items: z.array(allocItemSchema).parse(t.itemsJson) }));
}

export { n };
