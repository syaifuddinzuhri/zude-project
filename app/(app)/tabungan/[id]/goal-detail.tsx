"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteGoalAction, depositGoalAction, withdrawGoalAction } from "@/lib/actions/finance";
import type { GoalView } from "@/lib/server/goals";
import { formatDate, formatShortDate } from "@/lib/finance/date";
import { formatPercent } from "@/lib/finance/money";
import { useAppData } from "@/components/app-data";
import { GoalForm, type GoalFormValue } from "@/components/goal-form";
import { Confetti } from "@/components/confetti";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { Ring } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

export function GoalDetail({ g, raw, history }: { g: GoalView; raw: GoalFormValue; history: { id: number; date: string; amount: number; note: string | null; txId: number | null }[] }) {
  const d = useAppData();
  const [sheet, setSheet] = useState<null | "deposit" | "withdraw" | "edit">(null);
  const [amount, setAmount] = useState(0);
  const [acc, setAcc] = useState<number>(d.lastAccountId ?? d.accounts[0]?.id ?? 0);
  const [celebrate, setCelebrate] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const submit = () =>
    start(async () => {
      const r = sheet === "deposit" ? await depositGoalAction({ goalId: g.id, fromAccountId: acc, amount }) : await withdrawGoalAction({ goalId: g.id, toAccountId: acc, amount });
      if (!r.ok) return toast.error(r.error);
      if (sheet === "deposit" && g.saved + amount >= g.target && g.target > 0) setCelebrate(true);
      toast.success(sheet === "deposit" ? "Setoran dicatat" : "Penarikan dicatat");
      setSheet(null);
      setAmount(0);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Confetti fire={celebrate} />
      <Card className="flex flex-col items-center text-center">
        <Ring value={g.progress} size={140} stroke={12} color={g.achieved ? "var(--income)" : g.onTrack ? "var(--primary)" : "var(--warning)"}>
          <div>
            <div className="text-4xl">{g.icon}</div>
            <div className="text-[15px] font-bold text-text">{formatPercent(g.progress)}</div>
          </div>
        </Ring>
        <Money value={g.saved} className="mt-3 text-h1" />
        <div className="text-caption text-muted">dari <Money value={g.target} />{g.isEmergency && " (dana darurat otomatis)"}</div>
        <div className="mt-3 grid w-full grid-cols-2 gap-2 text-left">
          <div className="rounded-btn bg-bg p-3">
            <div className="text-caption text-muted">Setoran dibutuhkan/bulan</div>
            <Money value={g.required} className="font-semibold" />
          </div>
          <div className="rounded-btn bg-bg p-3">
            <div className="text-caption text-muted">Status bulan ini</div>
            <div className={`font-semibold ${g.onTrack ? "text-income" : "text-warning"}`}>
              {g.achieved ? "Tercapai 🎉" : g.onTrack ? "On track" : <>Tertinggal <Money value={g.shortfall} short /></>}
            </div>
          </div>
        </div>
        <div className="mt-2 text-caption text-muted">
          {g.targetDate ? `Target ${formatDate(g.targetDate)}` : "Tanpa target tanggal"}
          {g.accountName && ` · disimpan di ${g.accountName}`}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => { setAcc(d.lastAccountId ?? d.accounts[0]?.id ?? 0); setSheet("deposit"); }}><Icon name="plus" size={18} /> Setor</Button>
        <Button variant="secondary" onClick={() => { setAcc(d.accounts.find((a) => a.id !== g.accountId)?.id ?? 0); setSheet("withdraw"); }}><Icon name="arrow-up-right" size={18} /> Tarik</Button>
      </div>
      <h2 className="text-h2">Riwayat</h2>
      <Card className="divide-y divide-border/70 py-1">
        {history.length === 0 ? (
          <p className="py-3 text-caption text-muted">Belum ada setoran.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="flex min-h-[52px] items-center justify-between py-2">
              <div>
                <div className="text-[14px] font-medium">{h.note ?? (h.amount >= 0 ? "Setoran" : "Penarikan")}</div>
                <div className="text-caption text-muted">{formatShortDate(h.date)}{h.txId && <> · <Link href={`/transaksi/${h.txId}`} className="text-primary">transaksi</Link></>}</div>
              </div>
              <Money value={h.amount} sign tone="auto" className="text-[14px] font-semibold" />
            </div>
          ))
        )}
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setSheet("edit")}><Icon name="pencil" size={18} /> Ubah</Button>
        <Button
          variant="ghost"
          className="text-expense"
          onClick={() => {
            if (!window.confirm("Hapus tujuan ini? Riwayat setoran ikut terhapus (transaksi tetap ada).")) return;
            start(async () => {
              const r = await deleteGoalAction(g.id);
              if (!r.ok) return toast.error(r.error);
              router.push("/tabungan");
              router.refresh();
            });
          }}
        >
          <Icon name="trash" size={18} /> Hapus
        </Button>
      </div>

      <BottomSheet open={sheet === "deposit" || sheet === "withdraw"} onOpenChange={(v) => !v && setSheet(null)} title={sheet === "deposit" ? `Setor ke ${g.name}` : `Tarik dari ${g.name}`} footer={<Button block loading={pending} onClick={submit}>{sheet === "deposit" ? "Setor" : "Tarik"}</Button>}>
        <Field label="Nominal"><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label={sheet === "deposit" ? "Dari akun" : "Ke akun"} hint={sheet === "deposit" && g.accountName ? `Uang dipindah ke ${g.accountName}` : sheet === "withdraw" && g.accountName ? `Dipindah dari ${g.accountName}` : "Alokasi virtual di akun yang sama"}>
          <Select value={acc} onChange={(e) => setAcc(Number(e.target.value))}>
            {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {sheet === "deposit" && g.required > 0 && (
          <button className="text-[13px] font-semibold text-primary" onClick={() => setAmount(g.shortfall || g.required)}>Isi kebutuhan bulan ini</button>
        )}
      </BottomSheet>
      <BottomSheet open={sheet === "edit"} onOpenChange={(v) => !v && setSheet(null)} title="Ubah tujuan">
        {sheet === "edit" && <GoalForm initial={raw} onDone={() => setSheet(null)} />}
      </BottomSheet>
    </div>
  );
}
