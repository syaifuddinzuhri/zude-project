"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGoalAction } from "@/lib/actions/finance";
import { useAppData, useOwnerName } from "./app-data";
import { Button } from "./ui/button";
import { Field, Input, MoneyInput, OptionalDateInput, Select, Switch } from "./ui/field";
import { useToast } from "./ui/toast";
import { cn } from "@/lib/utils";

export const GOAL_PRESETS = [
  { name: "Dana Darurat", icon: "🛟", isEmergency: true },
  { name: "Dana Pendidikan Anak", icon: "🎓" },
  { name: "DP Rumah", icon: "🏠" },
  { name: "Haji/Umrah", icon: "🕋" },
  { name: "Liburan", icon: "🏖️" },
  { name: "Ganti Kendaraan", icon: "🚗" },
];
const ICONS = ["🎯", "🛟", "🎓", "🏠", "🕋", "🏖️", "🚗", "💍", "👶", "💻", "📱", "🎁"];

export interface GoalFormValue {
  id?: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  accountId: number | null;
  owner: string;
  priority: number;
  icon: string;
  isEmergency: boolean;
}

export function GoalForm({ initial, onDone }: { initial?: Partial<GoalFormValue>; onDone: (id: number) => void }) {
  const d = useAppData();
  const { option } = useOwnerName();
  const [v, setV] = useState<GoalFormValue>({ name: "", targetAmount: 0, targetDate: null, accountId: null, owner: "bersama", priority: 3, icon: "🎯", isEmergency: false, ...initial });
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div>
      {!v.id && (
        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
          {GOAL_PRESETS.map((p) => (
            <button key={p.name} type="button" onClick={() => setV({ ...v, name: p.name, icon: p.icon, isEmergency: Boolean(p.isEmergency) })} className={cn("pressable h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold", v.name === p.name ? "bg-primary text-on-primary" : "bg-surface shadow-card")}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>
      )}
      <Field label="Nama tujuan"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Ikon">
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setV({ ...v, icon: i })} className={cn("flex h-11 w-11 items-center justify-center rounded-full text-xl", v.icon === i ? "bg-primary-soft ring-2 ring-primary" : "bg-surface shadow-card")}>{i}</button>
          ))}
        </div>
      </Field>
      <Switch checked={v.isEmergency} onChange={(x) => setV({ ...v, isEmergency: x })} label="Dana darurat" description="Target otomatis = N × pengeluaran wajib bulanan (N di Pengaturan)" />
      <div className="grid grid-cols-2 gap-2">
        <Field label={v.isEmergency ? "Target (cadangan)" : "Target nominal"}><MoneyInput value={v.targetAmount} onChange={(x) => setV({ ...v, targetAmount: x })} /></Field>
        <Field label="Target tanggal"><OptionalDateInput value={v.targetDate} onChange={(x) => setV({ ...v, targetDate: x || null })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Akun penyimpanan">
          <Select value={v.accountId ?? ""} onChange={(e) => setV({ ...v, accountId: Number(e.target.value) || null })}>
            <option value="">—</option>
            {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
      <Field label="Prioritas">
        <Select value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p}{p === 1 ? " (tertinggi)" : p === 5 ? " (terendah)" : ""}</option>)}
        </Select>
      </Field>
      <Button
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await saveGoalAction(v.id ?? null, v);
            if (!r.ok) return toast.error(r.error);
            toast.success("Tujuan disimpan");
            onDone(r.data);
            router.refresh();
          })
        }
      >
        Simpan
      </Button>
    </div>
  );
}
