"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReceivableAction, receivablePaymentAction, saveReceivableAction } from "@/lib/actions/finance";
import { formatDate, formatMonthYear, formatShortDate, todayJakarta } from "@/lib/finance/date";
import type { PayoffPoint } from "@/lib/finance/payoff";
import { formatPercent, formatRateBp } from "@/lib/finance/money";
import { DEBT_TYPE_LABEL, INTEREST_TYPE_LABEL } from "@/lib/utils";
import { DebtForm } from "@/components/debt-form";
import { CountdownChip, PayoffChart } from "@/components/payoff-chart";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, OptionalDateInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { Gauge, ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";

interface Summary {
  total: number;
  monthly: number;
  dsr: number;
  freeDate: string | null;
  items: { id: number; name: string; lender: string; type: string; interestType: string; rateBp: number; principal: number; remaining: number; progress: number; nextDue: string | null; nextAmount: number; nextStatus: string | null; endDate: string | null; periodsLeft: number }[];
}
interface Receivable { id: number; debtorName: string; amount: number; paid: number; date: string; promisedDate: string | null; status: string; note: string | null }

export function DebtsView({ s, income, receivables, openNew, paidOff, timeline }: { s: Summary; income: number; receivables: Receivable[]; openNew: boolean; paidOff: { id: number; name: string; principal: number }[]; timeline: PayoffPoint[] }) {
  const [open, setOpen] = useState(openNew);
  const [rv, setRv] = useState<null | "new" | Receivable>(null);
  const router = useRouter();
  return (
    <div className="space-y-3">
      <Card className="hero text-white">
        <div className="relative flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[13px] text-white/80">Total hutang</div>
            <Money value={s.total} countUp className="text-display" />
            <div className="text-[13px] text-white/85">Cicilan/bulan <Money value={s.monthly} short className="font-semibold text-white" /></div>
            <div className="text-[13px] text-white/85">{s.freeDate ? `Bebas hutang ${formatDate(s.freeDate)}` : "Tidak ada hutang aktif"}</div>
          </div>
          <div className="flex flex-col items-center">
            <Gauge value={s.dsr} size={100} />
            <div className="-mt-1 text-[12px] font-bold">DSR {formatPercent(s.dsr)}</div>
          </div>
        </div>
      </Card>
      {s.dsr > 0.3 && (
        <p className="rounded-btn bg-expense/10 px-3 py-2 text-[13px] text-expense">
          <Icon name="alert" size={14} className="mr-1 inline" />
          DSR di atas 30% dari pemasukan (<Money value={income} short />). Pertimbangkan pelunasan dipercepat.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setOpen(true)}><Icon name="plus" size={18} /> Hutang baru</Button>
        <Link href="/hutang/simulasi" className="pressable glass inline-flex h-12 items-center justify-center gap-2 rounded-btn font-semibold"><Icon name="calculator" size={18} /> Simulasi</Link>
      </div>
      {s.items.length === 0 ? (
        <EmptyState icon="landmark" title="Tidak ada hutang aktif." />
      ) : (
        s.items.map((d) => (
          <Link key={d.id} href={`/hutang/${d.id}`} className="block">
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-semibold">{d.name}</div>
                  <div className="text-caption text-muted">{DEBT_TYPE_LABEL[d.type]} · {d.lender} · {INTEREST_TYPE_LABEL[d.interestType]} {d.rateBp ? formatRateBp(d.rateBp) : ""}</div>
                </div>
                <div className="text-right">
                  <Money value={d.remaining} className="text-[16px] font-bold" />
                  <div className="text-caption text-muted">sisa {d.periodsLeft} bln</div>
                </div>
              </div>
              <ProgressBar className="my-2" value={d.progress} color="var(--income)" />
              <div className="flex justify-between text-caption text-muted">
                <span>Lunas {formatPercent(d.progress)}</span>
                {d.nextDue && (
                  <span className={d.nextStatus === "late" ? "font-semibold text-expense" : ""}>
                    {d.nextStatus === "late" ? "Terlambat · " : "Berikutnya "}
                    {formatShortDate(d.nextDue)} · <Money value={d.nextAmount} short />
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))
      )}
      {s.items.length > 0 && <PayoffJourney items={s.items} timeline={timeline} />}
      {paidOff.length > 0 && (
        <details className="rounded-card bg-surface p-4 shadow-card">
          <summary className="cursor-pointer text-[14px] font-semibold">Sudah lunas ({paidOff.length}) 🎉</summary>
          <ul className="mt-2 space-y-1">
            {paidOff.map((p) => (
              <li key={p.id}><Link href={`/hutang/${p.id}`} className="flex justify-between text-[14px]"><span>{p.name}</span><Money value={p.principal} short /></Link></li>
            ))}
          </ul>
        </details>
      )}

      <SectionTitle title="Piutang" action={<button onClick={() => setRv("new")} className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"><Icon name="plus" size={16} /> Tambah</button>} />
      <Card className="divide-y divide-border/70 py-1">
        {receivables.length === 0 && <p className="py-3 text-caption text-muted">Catat uang yang dipinjam orang lain dari kita.</p>}
        {receivables.map((r) => (
          <button key={r.id} onClick={() => setRv(r)} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
            <Icon name="hand-coins" className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{r.debtorName}</div>
              <div className={`text-caption ${r.status === "open" && r.promisedDate && r.promisedDate < todayJakarta() ? "text-expense" : "text-muted"}`}>
                {r.status === "paid" ? "Lunas ✓" : r.promisedDate ? `Janji bayar ${formatShortDate(r.promisedDate)}` : "Tanpa tanggal janji"}
              </div>
            </div>
            <div className="text-right">
              <Money value={r.amount - r.paid} className="text-[14px] font-semibold" />
              {r.paid > 0 && <div className="text-caption text-muted">dari <Money value={r.amount} short /></div>}
            </div>
          </button>
        ))}
      </Card>

      <BottomSheet open={open} onOpenChange={setOpen} title="Hutang baru">
        {open && <DebtForm onDone={(id) => { setOpen(false); router.push(`/hutang/${id}`); }} />}
      </BottomSheet>
      <ReceivableSheet r={rv} onClose={() => setRv(null)} />
    </div>
  );
}

function ReceivableSheet({ r, onClose }: { r: Receivable | "new" | null; onClose: () => void }) {
  const isNew = r === "new";
  const cur = r && r !== "new" ? r : null;
  const [v, setV] = useState({ debtorName: "", amount: 0, date: todayJakarta(), promisedDate: "", note: "" });
  const [pay, setPay] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  if (!r) return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error((res as { error: string }).error);
      toast.success(msg);
      onClose();
      router.refresh();
    });
  return (
    <BottomSheet open={!!r} onOpenChange={(x) => !x && onClose()} title={isNew ? "Piutang baru" : cur!.debtorName}>
      {isNew ? (
        <>
          <Field label="Nama peminjam"><Input value={v.debtorName} onChange={(e) => setV({ ...v, debtorName: e.target.value })} /></Field>
          <Field label="Nominal"><MoneyInput value={v.amount} onChange={(x) => setV({ ...v, amount: x })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tanggal pinjam"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <Field label="Janji bayar"><OptionalDateInput value={v.promisedDate} onChange={(x) => setV({ ...v, promisedDate: x })} /></Field>
          </div>
          <Field label="Catatan"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
          <Button block loading={pending} onClick={() => run(() => saveReceivableAction(null, v), "Piutang dicatat")}>Simpan</Button>
        </>
      ) : (
        <>
          <p className="mb-3 text-[14px]">Sisa <b><Money value={cur!.amount - cur!.paid} /></b> dari <Money value={cur!.amount} />{cur!.note ? ` · ${cur!.note}` : ""}</p>
          {cur!.status === "open" && (
            <>
              <Field label="Terima cicilan"><MoneyInput value={pay} onChange={setPay} /></Field>
              <Button block loading={pending} onClick={() => run(() => receivablePaymentAction(cur!.id, pay, todayJakarta()), "Pembayaran piutang dicatat")}>Catat pembayaran</Button>
              <p className="mt-2 text-caption text-muted">Catat juga pemasukannya di akun tujuan bila uang sudah diterima.</p>
            </>
          )}
          <Button variant="ghost" block className="mt-2 text-expense" onClick={async () => (await confirm({ title: `Hapus piutang ${cur!.debtorName}?`, message: "Catatan piutang & riwayat pembayarannya dihapus." })) && run(() => deleteReceivableAction(cur!.id), "Piutang dihapus")}>Hapus</Button>
        </>
      )}
    </BottomSheet>
  );
}

/** Grafik sisa pokok + urutan hutang yang lunas lebih dulu. */
function PayoffJourney({ items, timeline }: { items: Summary["items"]; timeline: PayoffPoint[] }) {
  const today = todayJakarta();
  const order = items.filter((d) => d.endDate).sort((a, b) => a.endDate!.localeCompare(b.endDate!));
  return (
    <Card>
      <SectionTitle title="Perjalanan bebas hutang" />
      <PayoffChart points={timeline} />
      <p className="mb-3 mt-1 text-caption text-muted">Garis tegas = sisa pokok tercatat. Putus-putus = proyeksi bila cicilan dibayar sesuai jadwal.</p>
      <div className="mb-1 text-[14px] font-semibold">Urutan lunas</div>
      <ol className="divide-y divide-border/70">
        {order.map((d, i) => (
          <li key={d.id}>
            <Link href={`/hutang/${d.id}`} className="flex min-h-[52px] items-center gap-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{d.name}</div>
                <div className="text-caption text-muted">Lunas {formatMonthYear(d.endDate!)} · sisa <Money value={d.remaining} short /></div>
              </div>
              <CountdownChip endDate={d.endDate!} today={today} />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
