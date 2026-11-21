"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { confirmBillAction, deleteRuleAction, payInstallmentAction, saveRuleAction } from "@/lib/actions/finance";
import { addDays, dayOfWeek, diffDays, formatLongDate, formatShortDate, parts, todayJakarta } from "@/lib/finance/date";
import type { BillItem, Template } from "@/lib/server/recurring";
import { FREQUENCY_LABEL, TX_TYPE_LABEL } from "@/lib/utils";
import { useAppData } from "@/components/app-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, IntInput, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface RuleView {
  id: number;
  name: string;
  frequency: string;
  interval: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  mode: "auto" | "confirm";
  template: Template | null;
}

const STATUS = {
  paid: { label: "Sudah", cls: "bg-income/15 text-income" },
  unpaid: { label: "Belum", cls: "bg-warning/15 text-warning" },
  late: { label: "Terlambat", cls: "bg-expense/15 text-expense" },
};
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function BillsView({ period, bills, rules, payKey }: { period: { start: string; end: string }; bills: BillItem[]; rules: RuleView[]; payKey?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pay, setPay] = useState<BillItem | null>(null);
  const [ruleSheet, setRuleSheet] = useState<RuleView | "new" | null>(null);
  const today = todayJakarta();

  useEffect(() => {
    if (payKey) {
      const b = bills.find((x) => x.key === payKey);
      if (b && b.status !== "paid") setPay(b);
    }
  }, [payKey, bills]);

  const days = useMemo(() => {
    const n = diffDays(period.start, period.end) + 1;
    return Array.from({ length: n }, (_, i) => addDays(period.start, i));
  }, [period]);
  const byDay = useMemo(() => {
    const m = new Map<string, BillItem[]>();
    for (const b of bills) m.set(b.dueDate, [...(m.get(b.dueDate) ?? []), b]);
    return m;
  }, [bills]);
  const list = selected ? bills.filter((b) => b.dueDate === selected) : bills;
  const totals = {
    unpaid: bills.filter((b) => b.status !== "paid").reduce((s, b) => s + b.amount, 0),
    paid: bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0),
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3"><div className="text-caption text-muted">Belum dibayar</div><Money value={totals.unpaid} className="text-[17px] font-bold text-warning" /></Card>
        <Card className="p-3"><div className="text-caption text-muted">Sudah dibayar</div><Money value={totals.paid} className="text-[17px] font-bold text-income" /></Card>
      </div>

      <Card className="p-3">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
          {DOW.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: dayOfWeek(period.start) }).map((_, i) => <div key={`e${i}`} />)}
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const st = items.some((b) => b.status === "late") ? "late" : items.some((b) => b.status === "unpaid") ? "unpaid" : items.length ? "paid" : null;
            return (
              <button
                key={d}
                onClick={() => setSelected(selected === d ? null : d)}
                className={cn("flex h-11 flex-col items-center justify-center rounded-xl text-[13px]", d === today && "font-bold text-primary", selected === d && "bg-primary-soft")}
                aria-label={`${formatLongDate(d)}${items.length ? `, ${items.length} tagihan` : ""}`}
              >
                {parts(d).d}
                <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", st === "late" ? "bg-expense" : st === "unpaid" ? "bg-warning" : st === "paid" ? "bg-income" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </Card>

      <SectionTitle title={selected ? formatLongDate(selected) : "Semua tagihan siklus ini"} action={selected && <button className="min-h-[44px] text-[13px] font-semibold text-primary" onClick={() => setSelected(null)}>Semua</button>} />
      {list.length === 0 ? (
        <EmptyState icon="calendar-clock" title="Belum ada tagihan" action="Tambah tagihan" onAction={() => setRuleSheet("new")} />
      ) : (
        <Card className="divide-y divide-border/70 py-1">
          {list.map((b) => (
            <div key={b.key} className="flex min-h-[64px] items-center gap-3 py-2">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", b.kind === "debt" ? "bg-[#F59E0B26] text-[#B45309]" : "bg-primary-soft text-primary")}>
                <Icon name={b.kind === "debt" ? "landmark" : "receipt"} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{b.name}</div>
                <div className="flex items-center gap-1.5 text-caption text-muted">
                  {formatShortDate(b.dueDate)}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", STATUS[b.status].cls)}>{STATUS[b.status].label}</span>
                  {b.mode === "auto" && <span className="text-[10px]">· otomatis</span>}
                </div>
              </div>
              <div className="text-right">
                <Money value={b.amount} className="text-[14px] font-semibold" />
                {b.status !== "paid" ? (
                  <button onClick={() => setPay(b)} className="block min-h-[32px] w-full text-right text-[13px] font-bold text-primary">Bayar</button>
                ) : b.txId ? (
                  <Link href={`/transaksi/${b.txId}`} className="block text-[12px] text-muted">Lihat</Link>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle title="Aturan berulang" action={<button onClick={() => setRuleSheet("new")} className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"><Icon name="plus" size={16} /> Tambah</button>} />
      <Card className="divide-y divide-border/70 py-1">
        {rules.length === 0 && <p className="py-3 text-caption text-muted">Listrik, internet, SPP, langganan, gaji, transfer uang jajan rutin…</p>}
        {rules.map((r) => (
          <button key={r.id} onClick={() => setRuleSheet(r)} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left">
            <Icon name="repeat" className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{r.name}</div>
              <div className="text-caption text-muted">
                {FREQUENCY_LABEL[r.frequency]}{r.interval > 1 ? ` ×${r.interval}` : ""} · {r.template ? TX_TYPE_LABEL[r.template.type] : "?"} · {r.mode === "auto" ? "otomatis" : "konfirmasi"} · berikutnya {formatShortDate(r.nextRunDate)}
              </div>
            </div>
            <Money value={r.template?.amount ?? 0} short className="text-[14px] font-semibold" />
          </button>
        ))}
      </Card>

      <PaySheet bill={pay} onClose={() => setPay(null)} />
      <RuleSheet rule={ruleSheet} onClose={() => setRuleSheet(null)} />
    </>
  );
}

function PaySheet({ bill, onClose }: { bill: BillItem | null; onClose: () => void }) {
  const d = useAppData();
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    if (bill) {
      setAmount(bill.amount);
      setAccountId(bill.accountId ?? d.lastAccountId ?? d.accounts[0]?.id ?? 0);
      setNeedReason(false);
      setReason("");
    }
  }, [bill, d]);
  if (!bill) return null;
  const submit = () =>
    start(async () => {
      const r =
        bill.kind === "debt"
          ? await payInstallmentAction({ scheduleId: bill.scheduleId, accountId, amount, reason: reason || undefined })
          : await confirmBillAction({ ruleId: bill.id, dueDate: bill.dueDate, amount, accountId, reason: reason || undefined });
      if (!r.ok) {
        if (r.locked) return setNeedReason(true);
        return toast.error(r.error);
      }
      toast.success("Tagihan dibayar ✓");
      onClose();
      router.replace("/tagihan");
      router.refresh();
    });
  return (
    <BottomSheet open={!!bill} onOpenChange={(v) => !v && onClose()} title={`Bayar ${bill.name}`} description={`Jatuh tempo ${formatLongDate(bill.dueDate)}`} footer={<Button block loading={pending} onClick={submit} disabled={needReason && !reason.trim()}>Bayar & catat</Button>}>
      <Field label="Nominal" hint={bill.kind === "recurring" ? "Bisa diubah bila tagihan berubah-ubah (mis. listrik)" : "Pokok & bunga diisi otomatis dari jadwal"}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Dari akun">
        <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      {needReason && <Input placeholder="Alasan (bulan terkunci)" value={reason} onChange={(e) => setReason(e.target.value)} />}
    </BottomSheet>
  );
}

function RuleSheet({ rule, onClose }: { rule: RuleView | "new" | null; onClose: () => void }) {
  const d = useAppData();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const blank = {
    name: "",
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 1 as number | null,
    dayOfWeek: null as number | null,
    monthOfYear: null as number | null,
    startDate: todayJakarta(),
    endDate: "" as string | null,
    mode: "confirm" as "auto" | "confirm",
    template: { type: "expense", amount: 0, accountId: d.lastAccountId ?? d.accounts[0]?.id ?? 0, toAccountId: null, categoryId: null, goalId: null, note: null } as Template,
  };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (rule === "new") setV(blank);
    else if (rule) setV({ ...rule, endDate: rule.endDate ?? "", template: rule.template ?? blank.template });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule]);
  if (!rule) return null;
  const t = v.template;
  const setT = (p: Partial<Template>) => setV({ ...v, template: { ...t, ...p } });
  const cats = d.categories.filter((c) => c.kind === (t.type === "income" ? "income" : "expense"));
  const save = () =>
    start(async () => {
      const r = await saveRuleAction(rule === "new" ? null : rule.id, { ...v, template: { ...t, note: t.note || v.name } });
      if (!r.ok) return toast.error(r.error);
      toast.success("Tagihan berulang disimpan");
      onClose();
      router.refresh();
    });
  return (
    <BottomSheet open={!!rule} onOpenChange={(x) => !x && onClose()} title={rule === "new" ? "Tagihan / transaksi berulang" : "Ubah aturan"} footer={<Button block loading={pending} onClick={save}>Simpan</Button>}>
      <Field label="Nama"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. Listrik PLN" /></Field>
      <Segmented
        className="mb-3"
        size="sm"
        value={t.type}
        onChange={(x) => setT({ type: x as Template["type"], categoryId: null })}
        options={[{ value: "expense", label: "Keluar" }, { value: "income", label: "Masuk" }, { value: "transfer", label: "Transfer" }, { value: "saving_deposit", label: "Tabungan" }]}
      />
      <Field label="Nominal perkiraan"><MoneyInput value={t.amount} onChange={(x) => setT({ amount: x })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Akun">
          <Select value={t.accountId} onChange={(e) => setT({ accountId: Number(e.target.value) })}>
            {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {(t.type === "expense" || t.type === "income") && (
          <Field label="Kategori">
            <Select value={t.categoryId ?? ""} onChange={(e) => setT({ categoryId: Number(e.target.value) || null })}>
              <option value="">Pilih</option>
              {cats.filter((c) => c.parentId === null).map((p) => (
                <optgroup key={p.id} label={p.name}>
                  <option value={p.id}>{p.name}</option>
                  {cats.filter((c) => c.parentId === p.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
        {t.type === "transfer" && (
          <Field label="Ke akun">
            <Select value={t.toAccountId ?? ""} onChange={(e) => setT({ toAccountId: Number(e.target.value) || null })}>
              <option value="">Pilih</option>
              {d.accounts.filter((a) => a.id !== t.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        {t.type === "saving_deposit" && (
          <Field label="Tujuan">
            <Select value={t.goalId ?? ""} onChange={(e) => setT({ goalId: Number(e.target.value) || null })}>
              <option value="">Pilih</option>
              {d.goals.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pola">
          <Select value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value, interval: e.target.value === "every_n_months" ? Math.max(2, v.interval) : 1 })}>
            {Object.entries(FREQUENCY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        {(v.frequency === "every_n_months" || v.frequency === "daily" || v.frequency === "weekly") && (
          <Field label={v.frequency === "every_n_months" ? "Setiap N bulan" : v.frequency === "weekly" ? "Setiap N minggu" : "Setiap N hari"}>
            <IntInput min={1} max={365} value={v.interval} onChange={(n) => setV((x) => ({ ...x, interval: n }))} />
          </Field>
        )}
        {(v.frequency === "monthly" || v.frequency === "every_n_months" || v.frequency === "yearly") && (
          <Field label="Tanggal">
            <IntInput min={1} max={31} value={v.dayOfMonth ?? 1} onChange={(n) => setV((x) => ({ ...x, dayOfMonth: n }))} />
          </Field>
        )}
        {v.frequency === "yearly" && (
          <Field label="Bulan">
            <Select value={v.monthOfYear ?? 1} onChange={(e) => setV({ ...v, monthOfYear: Number(e.target.value) })}>
              {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </Field>
        )}
        {v.frequency === "weekly" && (
          <Field label="Hari">
            <Select value={v.dayOfWeek ?? 1} onChange={(e) => setV({ ...v, dayOfWeek: Number(e.target.value) })}>
              {DOW.map((x, i) => <option key={x} value={i}>{x}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mulai"><Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
        <Field label="Berakhir (opsional)"><Input type="date" value={v.endDate ?? ""} onChange={(e) => setV({ ...v, endDate: e.target.value })} /></Field>
      </div>
      <Segmented
        className="mb-1"
        value={v.mode}
        onChange={(m) => setV({ ...v, mode: m })}
        options={[{ value: "confirm", label: "Tunggu konfirmasi" }, { value: "auto", label: "Catat otomatis" }]}
      />
      <p className="mb-3 text-caption text-muted">{v.mode === "confirm" ? "Muncul di kalender; nominal bisa diubah saat bayar." : "Dicatat otomatis oleh cron harian pada tanggalnya."}</p>
      {rule !== "new" && (
        <Button variant="ghost" block className="text-expense" onClick={() => start(async () => { const r = await deleteRuleAction(rule.id); if (!r.ok) return toast.error(r.error); toast.success("Aturan dihentikan"); onClose(); router.refresh(); })}>
          Hentikan aturan ini
        </Button>
      )}
    </BottomSheet>
  );
}
