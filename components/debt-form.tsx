"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createDebtAction } from "@/lib/actions/finance";
import { scheduleForDebt } from "@/lib/finance/amortization";
import { formatRp } from "@/lib/finance/money";
import { todayJakarta } from "@/lib/finance/date";
import { DEBT_TYPE_LABEL, INTEREST_TYPE_LABEL } from "@/lib/utils";
import { useAppData, useOwnerName } from "./app-data";
import { Button } from "./ui/button";
import { DecimalInput, Field, Input, MoneyInput, Select, Textarea } from "./ui/field";
import { useToast } from "./ui/toast";

export function DebtForm({ onDone }: { onDone: (id: number) => void }) {
  const d = useAppData();
  const { option } = useOwnerName();
  const [v, setV] = useState({
    name: "",
    lender: "",
    type: "kpr",
    borrower: "bersama",
    principal: 0,
    startDate: todayJakarta(),
    tenorMonths: 12,
    interestType: "annuity",
    interestRate: null as number | null,
    dueDay: 5,
    lateFee: 0,
    defaultAccountId: (d.accounts[0]?.id ?? null) as number | null,
    note: "",
    paidPeriods: 0,
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const preview = useMemo(() => {
    try {
      if (!v.principal || !v.tenorMonths) return null;
      const rows = scheduleForDebt({
        principal: v.principal,
        startDate: v.startDate,
        tenorMonths: v.tenorMonths,
        type: v.interestType as "flat",
        rateBp: v.interestType === "zero" ? 0 : Math.round((v.interestRate ?? 0) * 100),
        dueDay: v.dueDay,
      });
      return { first: rows[0]?.total ?? 0, interest: rows.reduce((s, r) => s + r.interest, 0) };
    } catch {
      return null;
    }
  }, [v]);
  const num = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nama"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. KPR Rumah" /></Field>
        <Field label="Pemberi pinjaman"><Input value={v.lender} onChange={(e) => setV({ ...v, lender: e.target.value })} placeholder="mis. BTN" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jenis">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value, interestType: e.target.value === "cicilan_barang" ? "zero" : v.interestType })}>
            {Object.entries(DEBT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Peminjam">
          <Select value={v.borrower} onChange={(e) => setV({ ...v, borrower: e.target.value })}>
            <option value="bersama">Bersama</option>
            <option value="suami">{option("suami")}</option>
            <option value="istri">{option("istri")}</option>
          </Select>
        </Field>
      </div>
      <Field label="Pokok awal"><MoneyInput value={v.principal} onChange={(x) => setV({ ...v, principal: x })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Mulai"><Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
        <Field label="Tenor (bln)"><Input inputMode="numeric" value={v.tenorMonths || ""} onChange={(e) => setV({ ...v, tenorMonths: num(e.target.value) })} /></Field>
        <Field label="Jatuh tempo tgl"><Input inputMode="numeric" value={v.dueDay || ""} onChange={(e) => setV({ ...v, dueDay: Math.min(31, num(e.target.value)) })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tipe bunga">
          <Select value={v.interestType} onChange={(e) => setV({ ...v, interestType: e.target.value })}>
            {Object.entries(INTEREST_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Bunga % per tahun">
          <DecimalInput suffix="%" disabled={v.interestType === "zero"} value={v.interestType === "zero" ? 0 : v.interestRate} onChange={(n) => setV({ ...v, interestRate: n })} placeholder="mis. 19,8" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Denda keterlambatan"><MoneyInput value={v.lateFee} onChange={(x) => setV({ ...v, lateFee: x })} /></Field>
        <Field label="Sudah dibayar (bln)" hint="Cicilan sebelum pakai ZuDe"><Input inputMode="numeric" value={v.paidPeriods || ""} onChange={(e) => setV({ ...v, paidPeriods: num(e.target.value) })} /></Field>
      </div>
      <Field label="Akun pembayaran default">
        <Select value={v.defaultAccountId ?? ""} onChange={(e) => setV({ ...v, defaultAccountId: Number(e.target.value) || null })}>
          <option value="">—</option>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Catatan"><Textarea value={v.note} maxLength={255} rows={3} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      {preview && (
        <p className="mb-3 rounded-btn bg-primary-soft px-3 py-2 text-[13px]">
          Cicilan pertama <b>{formatRp(preview.first)}</b> · total bunga {formatRp(preview.interest)}
        </p>
      )}
      <Button
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await createDebtAction(v);
            if (!r.ok) return toast.error(r.error);
            toast.success("Hutang dicatat & jadwal dibuat");
            onDone(r.data);
            router.refresh();
          })
        }
      >
        Simpan & buat jadwal
      </Button>
    </div>
  );
}
