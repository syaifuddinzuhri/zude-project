"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reconcileAction } from "@/lib/actions/accounts";
import { confirmBillAction, finalizePeriodAction, payInstallmentAction } from "@/lib/actions/finance";
import { formatRange, formatShortDate } from "@/lib/finance/date";
import { formatRp } from "@/lib/finance/money";
import type { BillItem } from "@/lib/server/recurring";
import { useAppData } from "@/components/app-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, MoneyInput, Select } from "@/components/ui/field";
import { CategoryIcon, Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";

const STEPS = ["Cocokkan saldo", "Tagihan", "Ringkasan", "Sisa uang", "Kunci"];

export function CloseWizard(p: {
  periodId: number;
  period: { start: string; end: string };
  accounts: { id: number; name: string; balance: number; icon: string; color: string }[];
  pending: BillItem[];
  totals: { income: number; expense: number; savings: number; debtPayment: number; debtInterest: number };
  leftover: number;
  lines: { name: string; budget: number; spent: number; status: "green" | "yellow" | "red"; kind: string }[];
}) {
  const d = useAppData();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [actual, setActual] = useState<Record<number, number>>(() => Object.fromEntries(p.accounts.map((a) => [a.id, a.balance])));
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [decision, setDecision] = useState<{ action: "rollover" | "goal" | "debt" | "none"; amount: number; goalId: number | null; debtId: number | null; fromAccountId: number | null }>({
    action: "rollover",
    amount: Math.max(0, p.leftover),
    goalId: d.goals[0]?.id ?? null,
    debtId: d.debts[0]?.id ?? null,
    fromAccountId: d.lastAccountId ?? d.accounts[0]?.id ?? null,
  });

  const reconcile = (id: number) =>
    start(async () => {
      const r = await reconcileAction(id, actual[id], "Tutup buku", p.period.end);
      if (!r.ok) return toast.error(r.error);
      setDone((x) => ({ ...x, [id]: true }));
      toast.success(r.data === 0 ? "Cocok ✓" : `Penyesuaian ${formatRp(r.data, { sign: true })}`);
      router.refresh();
    });

  const payBill = (b: BillItem) =>
    start(async () => {
      const acc = b.accountId ?? d.lastAccountId ?? d.accounts[0]?.id;
      const r = b.kind === "debt" ? await payInstallmentAction({ scheduleId: b.scheduleId, accountId: acc, date: b.dueDate }) : await confirmBillAction({ ruleId: b.id, dueDate: b.dueDate, amount: b.amount, accountId: acc, date: b.dueDate });
      if (!r.ok) return toast.error(r.error);
      toast.success(`${b.name} dicatat`);
      router.refresh();
    });

  const finalize = () =>
    start(async () => {
      const r = await finalizePeriodAction({ periodId: p.periodId, leftoverAction: decision.action, amount: decision.amount, goalId: decision.goalId, debtId: decision.debtId, fromAccountId: decision.fromAccountId });
      if (!r.ok) return toast.error(r.error);
      toast.success("Bulan ditutup & dikunci 🔒");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="mb-2 text-center text-caption text-muted">Siklus {formatRange(p.period.start, p.period.end)}</div>
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className="flex flex-1 flex-col items-center gap-1" aria-current={i === step ? "step" : undefined}>
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold", i < step ? "bg-income text-white" : i === step ? "bg-primary text-on-primary" : "bg-border text-muted")}>
                {i < step ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <span className={cn("text-[10px] font-semibold leading-tight", i === step ? "text-text" : "text-muted")}>{s}</span>
            </button>
          ))}
        </div>
      </Card>

      {step === 0 && (
        <Card>
          <h2 className="text-h2">1. Cocokkan saldo</h2>
          <p className="mb-3 text-caption text-muted">Isi saldo nyata tiap akun. Bila beda, dibuat transaksi Penyesuaian di tanggal akhir siklus.</p>
          <div className="space-y-3">
            {p.accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <CategoryIcon icon={a.icon} color={a.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{a.name}</div>
                  <div className="text-caption text-muted">Di ZuDe <Money value={a.balance} /></div>
                </div>
                <div className="w-36"><MoneyInput value={actual[a.id] ?? 0} onChange={(v) => setActual((x) => ({ ...x, [a.id]: v }))} /></div>
                <Button size="icon" variant={done[a.id] ? "secondary" : "primary"} onClick={() => reconcile(a.id)} aria-label={`Cocokkan ${a.name}`} disabled={pending}>
                  <Icon name="check" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="text-h2">2. Tagihan belum dibayar</h2>
          {p.pending.length === 0 ? (
            <p className="py-2 text-caption text-muted">Semua tagihan siklus ini sudah dibayar ✓</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {p.pending.map((b) => (
                <li key={b.key} className="flex min-h-[56px] items-center gap-2 py-2">
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold">{b.name}</div>
                    <div className="text-caption text-muted">{formatShortDate(b.dueDate)} · <Money value={b.amount} /></div>
                  </div>
                  <Button size="sm" loading={pending} onClick={() => payBill(b)}>Sudah bayar</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <h2 className="mb-2 text-h2">3. Ringkasan bulan</h2>
            <dl className="space-y-1.5 text-[14px]">
              <Line label="Pemasukan" v={p.totals.income} cls="text-income" />
              <Line label="Pengeluaran" v={-(p.totals.expense + p.totals.debtInterest)} cls="text-expense" />
              <Line label="Tabungan" v={-p.totals.savings} />
              <Line label="Pembayaran hutang (pokok)" v={-(p.totals.debtPayment - p.totals.debtInterest)} />
              <div className="border-t border-border pt-1.5"><Line label={p.leftover >= 0 ? "Surplus" : "Defisit"} v={p.leftover} cls={p.leftover >= 0 ? "text-income font-bold" : "text-expense font-bold"} /></div>
            </dl>
          </Card>
          <Card className="space-y-3">
            <div className="text-[14px] font-semibold">Anggaran vs realisasi</div>
            {p.lines.length === 0 && <p className="text-caption text-muted">Tidak ada anggaran di siklus ini.</p>}
            {p.lines.map((l) => (
              <div key={l.name}>
                <div className="flex justify-between text-[13px]"><span>{l.name}</span><span className="text-muted"><Money value={l.spent} short /> / <Money value={l.budget} short /></span></div>
                <ProgressBar className="mt-1" value={l.budget ? l.spent / l.budget : 1} status={l.kind === "category" ? l.status : "green"} />
              </div>
            ))}
          </Card>
        </>
      )}

      {step === 3 && (
        <Card>
          <h2 className="text-h2">4. Putuskan sisa uang</h2>
          <p className="mb-3 text-caption text-muted">Sisa siklus ini: <b className={p.leftover >= 0 ? "text-income" : "text-expense"}>{formatRp(p.leftover)}</b></p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {([["rollover", "Rollover ke anggaran"], ["goal", "Setor ke tujuan"], ["debt", "Pelunasan hutang ekstra"], ["none", "Biarkan"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDecision({ ...decision, action: k })} className={cn("pressable min-h-[52px] rounded-btn px-3 text-[13px] font-semibold", decision.action === k ? "bg-primary text-on-primary" : "bg-bg")}>{l}</button>
            ))}
          </div>
          {decision.action === "rollover" && <p className="text-caption text-muted">Sisa/kelebihan tiap kategori dibawa ke anggaran siklus berikutnya.</p>}
          {(decision.action === "goal" || decision.action === "debt") && (
            <>
              <Field label="Nominal"><MoneyInput value={decision.amount} onChange={(v) => setDecision({ ...decision, amount: v })} /></Field>
              {decision.action === "goal" ? (
                <Field label="Tujuan">
                  <Select value={decision.goalId ?? ""} onChange={(e) => setDecision({ ...decision, goalId: Number(e.target.value) })}>{d.goals.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}</Select>
                </Field>
              ) : (
                <Field label="Hutang" hint="Dibayar sebagai pelunasan sebagian (kurangi tenor)">
                  <Select value={decision.debtId ?? ""} onChange={(e) => setDecision({ ...decision, debtId: Number(e.target.value) })}>{d.debts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
                </Field>
              )}
              <Field label="Dari akun">
                <Select value={decision.fromAccountId ?? ""} onChange={(e) => setDecision({ ...decision, fromAccountId: Number(e.target.value) })}>{d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
              </Field>
            </>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h2 className="text-h2">5. Kunci bulan</h2>
          <p className="my-2 text-[14px] text-muted">
            Snapshot disimpan dan tidak berubah walau data lama diedit. Setelah dikunci, transaksi siklus ini hanya bisa diubah dengan mengisi alasan (tercatat di log).
          </p>
          <Button block variant="hero" loading={pending} onClick={async () => (await confirm({ title: "Tutup & kunci bulan ini?", message: "Snapshot disimpan. Setelah dikunci, transaksi siklus ini hanya bisa diubah dengan mengisi alasan.", tone: "primary", icon: "lock", confirmLabel: "Kunci" })) && finalize()}>
            <Icon name="lock" /> Tutup & kunci bulan
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Kembali</Button>
        <Button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>Lanjut</Button>
      </div>
    </div>
  );
}

function Line({ label, v, cls }: { label: string; v: number; cls?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("money", cls)}><Money value={v} sign /></dd>
    </div>
  );
}
