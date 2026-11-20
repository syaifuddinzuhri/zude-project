"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAccountAction } from "@/lib/actions/accounts";
import { todayJakarta } from "@/lib/finance/date";
import { ACCOUNT_TYPE_LABEL } from "@/lib/utils";
import { useOwnerName } from "./app-data";
import { Button } from "./ui/button";
import { Field, Input, MoneyInput, Select, Switch } from "./ui/field";
import { ACCOUNT_ICONS, Icon } from "./ui/icon";
import { useToast } from "./ui/toast";
import { cn } from "@/lib/utils";

const COLORS = ["#14B8A6", "#6366F1", "#F59E0B", "#EC4899", "#0EA5E9", "#84CC16", "#F97316", "#A855F7", "#0F766E", "#475569"];

export interface AccountFormValue {
  id?: number;
  name: string;
  type: string;
  owner: string;
  openingBalance: number;
  openingDate: string;
  isArchived: boolean;
  includeInNetworth: boolean;
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  color: string;
  icon: string;
}

export function AccountForm({ initial, onDone }: { initial?: Partial<AccountFormValue>; onDone: () => void }) {
  const [v, setV] = useState<AccountFormValue>({
    name: "",
    type: "bank",
    owner: "bersama",
    openingBalance: 0,
    openingDate: todayJakarta(),
    isArchived: false,
    includeInNetworth: true,
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    color: COLORS[0],
    icon: "wallet",
    ...initial,
  });
  const { option } = useOwnerName();
  const [negative, setNegative] = useState((initial?.openingBalance ?? 0) < 0);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const isCredit = v.type === "credit_card" || v.type === "paylater";

  const save = () =>
    start(async () => {
      const r = await saveAccountAction(v.id ?? null, { ...v, openingBalance: negative ? -Math.abs(v.openingBalance) : Math.abs(v.openingBalance) });
      if (!r.ok) return toast.error(r.error);
      toast.success("Akun disimpan");
      onDone();
      router.refresh();
    });

  return (
    <div>
      <Field label="Nama akun">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. BCA Zuhri" autoFocus={!v.id} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jenis">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Pemilik">
          <Select value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })}>
            <option value="bersama">Bersama</option>
            <option value="suami">{option("suami")}</option>
            <option value="istri">{option("istri")}</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={isCredit ? "Tagihan awal" : "Saldo awal"}>
          <MoneyInput value={Math.abs(v.openingBalance)} onChange={(x) => setV({ ...v, openingBalance: x })} />
        </Field>
        <Field label="Per tanggal">
          <Input type="date" value={v.openingDate} onChange={(e) => setV({ ...v, openingDate: e.target.value })} />
        </Field>
      </div>
      <label className="-mt-1 mb-3 flex min-h-[44px] items-center gap-2 text-[14px]">
        <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={negative || isCredit} disabled={isCredit} onChange={(e) => setNegative(e.target.checked)} />
        Saldo negatif (hutang/tagihan)
      </label>
      {isCredit && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Limit"><MoneyInput value={v.creditLimit ?? 0} onChange={(x) => setV({ ...v, creditLimit: x || null })} /></Field>
          <Field label="Tgl cetak"><Input inputMode="numeric" value={v.statementDay ?? ""} onChange={(e) => setV({ ...v, statementDay: Number(e.target.value.replace(/\D/g, "")) || null })} /></Field>
          <Field label="Jatuh tempo"><Input inputMode="numeric" value={v.dueDay ?? ""} onChange={(e) => setV({ ...v, dueDay: Number(e.target.value.replace(/\D/g, "")) || null })} /></Field>
        </div>
      )}
      <Field label="Ikon & warna">
        <div className="mb-2 flex flex-wrap gap-2">
          {ACCOUNT_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setV({ ...v, icon: i })} className={cn("flex h-11 w-11 items-center justify-center rounded-full", v.icon === i ? "bg-primary text-on-primary" : "bg-surface shadow-card")} aria-label={i}>
              <Icon name={i} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setV({ ...v, color: c })} className={cn("h-9 w-9 rounded-full", v.color === c && "ring-2 ring-text ring-offset-2 ring-offset-[var(--surface)]")} style={{ background: c }} aria-label={`Warna ${c}`} />
          ))}
        </div>
      </Field>
      <Switch checked={v.includeInNetworth} onChange={(x) => setV({ ...v, includeInNetworth: x })} label="Termasuk net worth" />
      {v.id && <Switch checked={v.isArchived} onChange={(x) => setV({ ...v, isArchived: x })} label="Arsipkan" description="Disembunyikan dari pilihan akun" />}
      <Button block className="mt-3" loading={pending} onClick={save}>
        Simpan
      </Button>
    </div>
  );
}
