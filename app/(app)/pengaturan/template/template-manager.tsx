"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAllocTemplateAction, saveAllocTemplateAction } from "@/lib/actions/finance";
import { formatRp } from "@/lib/finance/money";
import { useAppData } from "@/components/app-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Target = "account" | "goal" | "debt";
interface Item { targetType: Target; targetId: number; amount?: number | null; percent?: number | null; label: string }
interface Tpl { id?: number; name: string; trigger: "salary" | "bonus" | "manual"; items: Item[] }

export function TemplateManager({ templates }: { templates: Tpl[] }) {
  const d = useAppData();
  const [edit, setEdit] = useState<Tpl | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const nameOf = (it: Item) => (it.targetType === "account" ? d.accounts.find((a) => a.id === it.targetId)?.name : it.targetType === "goal" ? d.goals.find((g) => g.id === it.targetId)?.name : d.debts.find((x) => x.id === it.targetId)?.name) ?? "?";
  const setItem = (i: number, p: Partial<Item>) => setEdit((e) => e && { ...e, items: e.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });

  return (
    <div className="space-y-3">
      <p className="text-caption text-muted">Template memecah gaji/bonus ke pos-pos: bayar cicilan, setor tabungan, transfer uang jajan. Pos bisa nominal tetap atau persen dari sisa.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setEdit({ name: "Gaji bulanan", trigger: "salary", items: [] })}><Icon name="plus" size={18} /> Template gaji</Button>
        <Button variant="secondary" onClick={() => setEdit({ name: "Bonus/THR 50/30/20", trigger: "bonus", items: [] })}><Icon name="plus" size={18} /> Template bonus</Button>
      </div>
      {templates.length === 0 && <EmptyState icon="file-text" title="Belum ada template alokasi." />}
      {templates.map((t) => (
        <Card key={t.id} className="cursor-pointer" onClick={() => setEdit(t)}>
          <div className="flex items-center justify-between"><span className="font-semibold">{t.name}</span><span className="text-caption text-muted">{t.trigger === "salary" ? "Gaji" : t.trigger === "bonus" ? "Bonus" : "Manual"}</span></div>
          <ul className="mt-1 text-caption text-muted">
            {t.items.map((it, i) => <li key={i}>{it.label || nameOf(it)} · {it.percent != null ? `${it.percent}%` : formatRp(it.amount ?? 0)}</li>)}
          </ul>
        </Card>
      ))}

      <BottomSheet
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        title={edit?.id ? "Ubah template" : "Template baru"}
        footer={
          <Button block loading={pending} onClick={() => start(async () => { const r = await saveAllocTemplateAction(edit!.id ?? null, edit); if (!r.ok) return toast.error(r.error); toast.success("Template disimpan"); setEdit(null); router.refresh(); })}>
            Simpan
          </Button>
        }
      >
        {edit && (
          <>
            <Field label="Nama"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Segmented className="mb-3" size="sm" value={edit.trigger} onChange={(v) => setEdit({ ...edit, trigger: v })} options={[{ value: "salary", label: "Gaji" }, { value: "bonus", label: "Bonus/THR" }, { value: "manual", label: "Manual" }]} />
            <div className="space-y-3">
              {edit.items.map((it, i) => (
                <div key={i} className="rounded-btn bg-bg p-3">
                  <div className="mb-2 flex gap-2">
                    <Select className="w-32" value={it.targetType} onChange={(e) => setItem(i, { targetType: e.target.value as Target, targetId: 0 })}>
                      <option value="account">Transfer</option>
                      <option value="goal">Tabungan</option>
                      <option value="debt">Cicilan</option>
                    </Select>
                    <Select value={it.targetId || ""} onChange={(e) => setItem(i, { targetId: Number(e.target.value) })}>
                      <option value="">Pilih</option>
                      {(it.targetType === "account" ? d.accounts.map((a) => ({ id: a.id, name: a.name })) : it.targetType === "goal" ? d.goals.map((g) => ({ id: g.id, name: `${g.icon} ${g.name}` })) : d.debts.map((x) => ({ id: x.id, name: x.name }))).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Select className="w-28" value={it.percent != null ? "pct" : "fixed"} onChange={(e) => setItem(i, e.target.value === "pct" ? { percent: 10, amount: null } : { amount: 0, percent: null })}>
                      <option value="fixed">Nominal</option>
                      <option value="pct">Persen</option>
                    </Select>
                    {it.percent != null ? (
                      <Input inputMode="numeric" value={it.percent} onChange={(e) => setItem(i, { percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                    ) : (
                      <MoneyInput value={it.amount ?? 0} onChange={(v) => setItem(i, { amount: v })} />
                    )}
                    <button onClick={() => setEdit({ ...edit, items: edit.items.filter((_, k) => k !== i) })} className="flex h-12 w-9 items-center justify-center text-muted" aria-label="Hapus pos"><Icon name="x" size={16} /></button>
                  </div>
                  <Input className="mt-2" placeholder="Label (mis. Uang jajan istri)" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                </div>
              ))}
              <Button variant="secondary" block onClick={() => setEdit({ ...edit, items: [...edit.items, { targetType: "account", targetId: 0, amount: 0, percent: null, label: "" }] })}><Icon name="plus" size={18} /> Tambah pos</Button>
              {edit.id && <Button variant="ghost" block className="text-expense" onClick={() => start(async () => { const r = await deleteAllocTemplateAction(edit.id!); if (!r.ok) return toast.error(r.error); setEdit(null); router.refresh(); })}>Hapus template</Button>}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
