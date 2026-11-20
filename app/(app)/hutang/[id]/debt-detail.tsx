"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { changeRateAction, deleteDebtAction, extraPaymentAction, payInstallmentAction, previewExtraAction, updateDebtAction } from "@/lib/actions/finance";
import { formatDate, formatShortDate, todayJakarta } from "@/lib/finance/date";
import { formatPercent, formatRateBp, formatRp } from "@/lib/finance/money";
import { DEBT_TYPE_LABEL, INTEREST_TYPE_LABEL } from "@/lib/utils";
import { useOwnerName } from "@/components/app-data";
import { useAppData } from "@/components/app-data";
import { Confetti } from "@/components/confetti";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";

interface D {
  id: number; name: string; lender: string; type: string; borrower: string; principal: number; remaining: number; interestType: string; rateBp: number; tenor: number;
  dueDay: number; lateFee: number; status: string; note: string | null; defaultAccountId: number | null; remainingInterest: number; paidTotal: number; rateChanges: { date: string; bp: number }[];
}
interface Row { id: number; no: number; due: string; principal: number; interest: number; total: number; remaining: number; status: string; txId: number | null }

export function DebtDetail({ d, schedule, payScheduleId }: { d: D; schedule: Row[]; payScheduleId: number | null }) {
  const app = useAppData();
  const { name } = useOwnerName();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<null | "pay" | "extra" | "rate" | "edit">(null);
  const [payRow, setPayRow] = useState<Row | null>(null);
  const [acc, setAcc] = useState<number>(d.defaultAccountId ?? app.accounts[0]?.id ?? 0);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<"reduce_tenor" | "reduce_installment">("reduce_tenor");
  const [preview, setPreview] = useState<{ interestSaved: number; periodsSaved: number; newInstallment: number } | null>(null);
  const [rate, setRate] = useState({ date: todayJakarta(), rate: d.rateBp / 100 });
  const [info, setInfo] = useState({ name: d.name, lender: d.lender, lateFee: d.lateFee, defaultAccountId: d.defaultAccountId, note: d.note ?? "" });
  const [celebrate, setCelebrate] = useState(false);
  const nextRef = useRef<HTMLLIElement>(null);
  const next = schedule.find((r) => r.status !== "paid");
  const paidCount = schedule.filter((r) => r.status === "paid").length;
  const progress = d.principal ? 1 - d.remaining / d.principal : 1;

  useEffect(() => {
    if (payScheduleId) {
      const r = schedule.find((x) => x.id === payScheduleId && x.status !== "paid");
      if (r) openPay(r);
    }
    nextRef.current?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sheet !== "extra" || !amount) return setPreview(null);
    const t = setTimeout(async () => {
      const r = await previewExtraAction(d.id, amount, mode);
      setPreview(r.ok ? r.data : null);
    }, 300);
    return () => clearTimeout(t);
  }, [sheet, amount, mode, d.id]);

  function openPay(r: Row) {
    setPayRow(r);
    setAmount(r.total);
    setAcc(d.defaultAccountId ?? app.accounts[0]?.id ?? 0);
    setSheet("pay");
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, afterPaid?: boolean) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error((r as { error: string }).error);
      toast.success(msg);
      setSheet(null);
      if (afterPaid && d.remaining - (payRow?.principal ?? amount) <= 0) setCelebrate(true);
      router.replace(`/hutang/${d.id}`);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Confetti fire={celebrate} />
      <Card>
        <div className="text-caption text-muted">{DEBT_TYPE_LABEL[d.type]} · {d.lender} · {name(d.borrower)}</div>
        <div className="flex items-baseline justify-between">
          <Money value={d.remaining} className="text-h1" />
          <span className="text-caption text-muted">dari <Money value={d.principal} short /></span>
        </div>
        <ProgressBar className="my-2" value={progress} color="var(--income)" />
        <div className="grid grid-cols-3 gap-2 text-caption text-muted">
          <div>Bunga<br /><b className="text-[14px] text-text">{INTEREST_TYPE_LABEL[d.interestType]} {d.interestType !== "zero" && formatRateBp(d.rateBp)}</b></div>
          <div>Tenor<br /><b className="text-[14px] text-text">{paidCount}/{schedule.length} bln</b></div>
          <div>Sisa bunga<br /><Money value={d.remainingInterest} short className="text-[14px] font-bold text-text" /></div>
        </div>
        {d.status === "paid_off" && <div className="mt-3 rounded-btn bg-income/15 px-3 py-2 text-center font-semibold text-income">Lunas 🎉</div>}
        {schedule.at(-1) && d.status !== "paid_off" && <div className="mt-2 text-caption text-muted">Perkiraan lunas {formatDate(schedule.at(-1)!.due)}</div>}
      </Card>

      {d.status !== "paid_off" && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => next && openPay(next)} disabled={!next}>Bayar{next && <> <Money value={next.total} short /></>}</Button>
          <Button variant="secondary" onClick={() => { setAmount(0); setSheet("extra"); }}>Pelunasan sebagian</Button>
          <Link href="/hutang/simulasi" className="pressable glass inline-flex h-12 items-center justify-center gap-2 rounded-btn font-semibold"><Icon name="calculator" size={18} /> Simulasi</Link>
          {d.interestType === "floating" ? <Button variant="secondary" onClick={() => setSheet("rate")}>Ubah bunga</Button> : <Button variant="ghost" onClick={() => setSheet("edit")}>Ubah info</Button>}
        </div>
      )}

      <h2 className="text-h2">Jadwal cicilan</h2>
      <Card className="p-2">
        <ol className="relative">
          {schedule.map((r) => {
            const isNext = r.id === next?.id;
            return (
              <li key={r.id} ref={isNext ? nextRef : undefined} className={cn("relative flex items-center gap-3 rounded-2xl px-2 py-2.5", isNext && "bg-primary-soft")}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", r.status === "paid" ? "bg-income text-white" : r.status === "late" ? "bg-expense text-white" : isNext ? "bg-primary text-on-primary" : "bg-border text-muted")}>
                  {r.status === "paid" ? <Icon name="check" size={16} /> : r.no}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[14px] font-semibold">
                    <span>{formatShortDate(r.due)} {r.due.slice(0, 4)}</span>
                    <Money value={r.total} />
                  </div>
                  <div className="flex justify-between text-caption text-muted">
                    <span>Pokok <Money value={r.principal} short /> · Bunga <Money value={r.interest} short /></span>
                    <span>Sisa <Money value={r.remaining} short /></span>
                  </div>
                </div>
                {r.status !== "paid" && d.status !== "paid_off" && (
                  <button onClick={() => openPay(r)} className="min-h-[44px] px-1 text-[13px] font-bold text-primary">Bayar</button>
                )}
                {r.status === "paid" && r.txId && <Link href={`/transaksi/${r.txId}`} className="min-h-[44px] px-1 pt-3 text-[12px] text-muted">Lihat</Link>}
              </li>
            );
          })}
        </ol>
      </Card>
      {d.rateChanges.length > 0 && (
        <Card>
          <div className="mb-1 text-[14px] font-semibold">Riwayat perubahan bunga</div>
          {d.rateChanges.map((c) => <div key={c.date} className="flex justify-between text-caption text-muted"><span>{formatDate(c.date)}</span><span>{formatRateBp(c.bp)}</span></div>)}
        </Card>
      )}
      <Link href={`/transaksi?hutang=${d.id}`} className="block text-center text-[13px] font-semibold text-primary">Semua pembayaran ({formatRp(d.paidTotal)}) →</Link>

      <BottomSheet open={sheet === "pay"} onOpenChange={(v) => !v && setSheet(null)} title={payRow ? `Bayar cicilan ke-${payRow.no}` : "Bayar"} description={payRow ? `Jatuh tempo ${formatDate(payRow.due)} · pokok ${formatRp(payRow.principal)} + bunga ${formatRp(payRow.interest)}` : undefined} footer={<Button block loading={pending} onClick={() => run(() => payInstallmentAction({ scheduleId: payRow!.id, accountId: acc, amount }), "Cicilan dibayar ✓", true)}>Bayar & catat</Button>}>
        <Field label="Nominal" hint={payRow?.status === "late" && d.lateFee ? `Terlambat — tambahkan denda ${formatRp(d.lateFee)} bila dikenakan` : "Kelebihan dari cicilan dicatat sebagai biaya/denda"}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Dari akun">
          <Select value={acc} onChange={(e) => setAcc(Number(e.target.value))}>{app.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </Field>
      </BottomSheet>

      <BottomSheet open={sheet === "extra"} onOpenChange={(v) => !v && setSheet(null)} title="Pelunasan sebagian" footer={<Button block loading={pending} disabled={!amount} onClick={() => run(() => extraPaymentAction({ debtId: d.id, accountId: acc, amount, mode }), "Pelunasan sebagian dicatat", true)}>Bayar pokok</Button>}>
        <Field label="Nominal pokok tambahan"><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <Segmented className="mb-3" value={mode} onChange={setMode} options={[{ value: "reduce_tenor", label: "Kurangi tenor" }, { value: "reduce_installment", label: "Kurangi cicilan" }]} />
        <Field label="Dari akun">
          <Select value={acc} onChange={(e) => setAcc(Number(e.target.value))}>{app.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </Field>
        {preview && (
          <div className="rounded-btn bg-income/10 p-3 text-[14px]">
            Hemat bunga <b className="text-income">{formatRp(preview.interestSaved)}</b>
            {mode === "reduce_tenor" ? <> · lunas <b>{preview.periodsSaved} bulan</b> lebih cepat</> : <> · cicilan baru <b>{formatRp(preview.newInstallment)}</b></>}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === "rate"} onOpenChange={(v) => !v && setSheet(null)} title="Perubahan bunga floating" footer={<Button block loading={pending} onClick={() => run(() => changeRateAction({ debtId: d.id, effectiveDate: rate.date, interestRate: rate.rate }), "Bunga diperbarui & jadwal dihitung ulang")}>Simpan</Button>}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Berlaku mulai"><Input type="date" value={rate.date} onChange={(e) => setRate({ ...rate, date: e.target.value })} /></Field>
          <Field label="Bunga % per tahun"><Input inputMode="decimal" value={rate.rate} onChange={(e) => setRate({ ...rate, rate: Number(e.target.value.replace(",", ".")) || 0 })} /></Field>
        </div>
        <p className="text-caption text-muted">Bunga saat ini {formatPercent(d.rateBp / 10000, 2)}. Jadwal yang belum dibayar dihitung ulang dari sisa pokok.</p>
      </BottomSheet>

      <BottomSheet open={sheet === "edit"} onOpenChange={(v) => !v && setSheet(null)} title="Ubah info hutang" footer={<Button block loading={pending} onClick={() => run(() => updateDebtAction(d.id, info), "Disimpan")}>Simpan</Button>}>
        <Field label="Nama"><Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
        <Field label="Pemberi pinjaman"><Input value={info.lender} onChange={(e) => setInfo({ ...info, lender: e.target.value })} /></Field>
        <Field label="Denda keterlambatan"><MoneyInput value={info.lateFee} onChange={(x) => setInfo({ ...info, lateFee: x })} /></Field>
        <Field label="Akun pembayaran default">
          <Select value={info.defaultAccountId ?? ""} onChange={(e) => setInfo({ ...info, defaultAccountId: Number(e.target.value) || null })}>
            <option value="">—</option>
            {app.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Catatan"><Input value={info.note} onChange={(e) => setInfo({ ...info, note: e.target.value })} /></Field>
        <Button variant="ghost" block className="text-expense" onClick={async () => (await confirm({ title: `Hapus hutang "${d.name}"?`, message: "Jadwal cicilannya ikut terhapus. Hanya bisa bila belum ada pembayaran." })) && start(async () => { const r = await deleteDebtAction(d.id); if (!r.ok) return toast.error(r.error); router.push("/hutang"); router.refresh(); })}>
          Hapus hutang
        </Button>
      </BottomSheet>
    </div>
  );
}
