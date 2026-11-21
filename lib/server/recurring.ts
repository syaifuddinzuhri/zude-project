import "server-only";
import { z } from "zod";
import { db, n } from "@/lib/db";
import { fromDate, todayJakarta, toDate, type ISODate } from "@/lib/finance/date";
import { billStatus, nextOccurrence, occurrenceAfter, occurrencesBetween, type RuleLike } from "@/lib/finance/recurring";
import type { CurrentUser } from "@/lib/auth/current";
import { audit } from "./audit";
import { createTransaction, txInputSchema } from "./transactions";

export const templateSchema = z.object({
  type: z.enum(["income", "expense", "transfer", "saving_deposit"]),
  amount: z.coerce.number().int().positive("Nominal belum diisi"),
  accountId: z.coerce.number().int().positive("Akun belum dipilih"),
  toAccountId: z.coerce.number().int().positive().nullish(),
  categoryId: z.coerce.number().int().positive().nullish(),
  goalId: z.coerce.number().int().positive().nullish(),
  note: z.string().max(255).nullish(),
  beneficiary: z.enum(["suami", "istri", "anak", "keluarga", "bersama"]).nullish(),
});
export type Template = z.infer<typeof templateSchema>;

export const ruleSchema = z.object({
  name: z.string().trim().min(1, "Nama tagihan belum diisi").max(80),
  template: templateSchema,
  frequency: z.enum(["daily", "weekly", "monthly", "last_workday", "yearly", "every_n_months"]),
  interval: z.coerce.number().int().min(1).max(36).default(1),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullish(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullish(),
  monthOfYear: z.coerce.number().int().min(1).max(12).nullish(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("").transform(() => null)),
  mode: z.enum(["auto", "confirm"]),
  isActive: z.coerce.boolean().default(true),
});

export function ruleLike(r: { frequency: RuleLike["frequency"]; interval: number; dayOfMonth: number | null; dayOfWeek: number | null; monthOfYear: number | null; startDate: Date; endDate: Date | null }): RuleLike {
  return {
    frequency: r.frequency,
    interval: r.interval,
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    monthOfYear: r.monthOfYear,
    startDate: fromDate(r.startDate),
    endDate: r.endDate ? fromDate(r.endDate) : null,
  };
}

export async function saveRule(user: CurrentUser, id: number | null, raw: unknown) {
  const i = ruleSchema.parse(raw);
  if ((i.template.type === "income" || i.template.type === "expense") && !i.template.categoryId) throw new Error("Kategori belum dipilih");
  if (i.template.type === "transfer" && !i.template.toAccountId) throw new Error("Akun tujuan belum dipilih");
  if (i.template.type === "saving_deposit" && !i.template.goalId) throw new Error("Tujuan tabungan belum dipilih");
  const rl: RuleLike = { ...i, interval: i.interval, dayOfMonth: i.dayOfMonth ?? null, dayOfWeek: i.dayOfWeek ?? null, monthOfYear: i.monthOfYear ?? null, endDate: i.endDate ?? null };
  const next = nextOccurrence(rl, i.startDate > todayJakarta() ? i.startDate : todayJakarta()) ?? i.startDate;
  const data = {
    name: i.name,
    templateJson: i.template,
    frequency: i.frequency,
    interval: i.interval,
    dayOfMonth: i.dayOfMonth ?? null,
    dayOfWeek: i.dayOfWeek ?? null,
    monthOfYear: i.monthOfYear ?? null,
    startDate: toDate(i.startDate),
    nextRunDate: toDate(next),
    endDate: i.endDate ? toDate(i.endDate) : null,
    mode: i.mode,
    isActive: i.isActive,
  };
  return db.$transaction(async (tx) => {
    const before = id ? await tx.recurringRule.findUniqueOrThrow({ where: { id } }) : null;
    const r = id ? await tx.recurringRule.update({ where: { id }, data }) : await tx.recurringRule.create({ data });
    await audit(tx, { userId: user.id, entity: "recurring_rule", entityId: r.id, action: id ? "update" : "create", before, after: r });
    return r;
  });
}

export async function deleteRule(user: CurrentUser, id: number) {
  await db.$transaction(async (tx) => {
    const before = await tx.recurringRule.findUniqueOrThrow({ where: { id } });
    await tx.recurringRule.update({ where: { id }, data: { isActive: false } });
    await audit(tx, { userId: user.id, entity: "recurring_rule", entityId: id, action: "delete", before });
  });
}

function txFromTemplate(t: Template, date: ISODate, ruleId: number, amount?: number) {
  const amt = amount ?? t.amount;
  return txInputSchema.parse({
    type: t.type,
    date,
    amount: amt,
    accountId: t.accountId,
    toAccountId: t.toAccountId ?? null,
    splits: t.categoryId ? [{ categoryId: t.categoryId, amount: amt }] : undefined,
    goalId: t.goalId ?? null,
    note: t.note ?? null,
    beneficiary: t.beneficiary ?? null,
    recurringId: ruleId,
    recurringDueDate: date,
  });
}

/** Konfirmasi/bayar satu kejadian tagihan (nominal boleh diubah, mis. listrik). */
export async function confirmOccurrence(user: CurrentUser, raw: unknown) {
  const i = z
    .object({
      ruleId: z.coerce.number().int().positive(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.coerce.number().int().positive("Nominal belum diisi"),
      accountId: z.coerce.number().int().positive().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      reason: z.string().max(255).nullish(),
    })
    .parse(raw);
  const rule = await db.recurringRule.findUniqueOrThrow({ where: { id: i.ruleId } });
  const exists = await db.transaction.findFirst({ where: { recurringId: rule.id, recurringDueDate: toDate(i.dueDate), deletedAt: null } });
  if (exists) throw new Error("Tagihan ini sudah dicatat");
  const t = templateSchema.parse(rule.templateJson);
  const input = txFromTemplate({ ...t, accountId: i.accountId ?? t.accountId }, i.date ?? todayJakarta(), rule.id, i.amount);
  const created = await createTransaction(user, { ...input, recurringDueDate: i.dueDate, reason: i.reason });
  await advanceRule(rule.id);
  return created;
}

async function advanceRule(ruleId: number) {
  const rule = await db.recurringRule.findUniqueOrThrow({ where: { id: ruleId } });
  const next = occurrenceAfter(ruleLike(rule), fromDate(rule.nextRunDate));
  await db.recurringRule.update({ where: { id: ruleId }, data: next ? { nextRunDate: toDate(next) } : { isActive: false } });
}

/** Dipanggil cron harian: catat otomatis aturan mode `auto` yang sudah jatuh tempo. */
export async function runAutoRules(systemUser: CurrentUser, today = todayJakarta()) {
  const rules = await db.recurringRule.findMany({ where: { isActive: true, mode: "auto", nextRunDate: { lte: toDate(today) } } });
  let created = 0;
  for (const rule of rules) {
    let guard = 0;
    let r = rule;
    while (r.isActive && fromDate(r.nextRunDate) <= today && guard++ < 62) {
      const due = fromDate(r.nextRunDate);
      const exists = await db.transaction.findFirst({ where: { recurringId: r.id, recurringDueDate: toDate(due), deletedAt: null } });
      if (!exists) {
        try {
          const t = templateSchema.parse(r.templateJson);
          await createTransaction(systemUser, txFromTemplate(t, due, r.id));
          created++;
        } catch (e) {
          console.error(`[recurring ${r.id}]`, e);
          break;
        }
      }
      await advanceRule(r.id);
      r = await db.recurringRule.findUniqueOrThrow({ where: { id: r.id } });
    }
  }
  return created;
}

export interface BillItem {
  key: string;
  kind: "recurring" | "debt";
  id: number;
  name: string;
  dueDate: ISODate;
  amount: number;
  status: "paid" | "unpaid" | "late";
  mode?: "auto" | "confirm";
  accountId: number | null;
  txId: number | null;
  scheduleId?: number;
  debtId?: number;
}

/** Semua tagihan (aturan berulang pengeluaran + cicilan hutang) dalam rentang tanggal. */
export async function billsBetween(user: CurrentUser, from: ISODate, to: ISODate, today = todayJakarta()): Promise<BillItem[]> {
  const [rules, schedule] = await Promise.all([
    db.recurringRule.findMany({ where: { isActive: true } }),
    db.debtSchedule.findMany({
      where: { dueDate: { gte: toDate(from), lte: toDate(to) }, debt: { status: { in: ["active", "paid_off"] } } },
      include: { debt: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  const items: BillItem[] = [];
  for (const r of rules) {
    const t = templateSchema.safeParse(r.templateJson);
    if (!t.success || t.data.type !== "expense") continue;
    const dates = occurrencesBetween(ruleLike(r), from, to);
    if (!dates.length) continue;
    const paid = await db.transaction.findMany({
      where: { recurringId: r.id, recurringDueDate: { in: dates.map(toDate) }, deletedAt: null },
      select: { id: true, recurringDueDate: true, amount: true },
    });
    for (const d of dates) {
      const p = paid.find((x) => x.recurringDueDate && fromDate(x.recurringDueDate) === d);
      items.push({
        key: `r${r.id}:${d}`,
        kind: "recurring",
        id: r.id,
        name: r.name,
        dueDate: d,
        amount: p ? n(p.amount) : t.data.amount,
        status: billStatus(d, today, Boolean(p)),
        mode: r.mode,
        accountId: t.data.accountId,
        txId: p?.id ?? null,
      });
    }
  }
  for (const s of schedule) {
    items.push({
      key: `d${s.id}`,
      kind: "debt",
      id: s.id,
      name: `${s.debt.name} (ke-${s.periodNo})`,
      dueDate: fromDate(s.dueDate),
      amount: n(s.total),
      status: billStatus(fromDate(s.dueDate), today, s.status === "paid"),
      accountId: s.debt.defaultAccountId,
      txId: s.paymentTransactionId,
      scheduleId: s.id,
      debtId: s.debtId,
    });
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}
