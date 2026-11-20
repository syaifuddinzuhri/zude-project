"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { incomeWizardAction } from "@/lib/actions/finance";
import { resolveAmounts } from "@/lib/finance/allocation";
import { formatRp } from "@/lib/finance/money";
import { useAppData } from "@/components/app-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { Confetti } from "@/components/confetti";
import { cn } from "@/lib/utils";

type Target = "account" | "goal" | "debt";
interface Item { targetType: Target; targetId: number; amount?: number | null; percent?: number | null; label: string }
interface Tpl { id: number; name: string; trigger: string; items: Item[] }

export function IncomeWizard({
  who: initialWho,
  settings,
  categories,
  templates,
}: {
  who: "suami" | "istri";
  settings: Record<"suami" | "istri", { amount: number; accountId: number | null; templateId: number | null }>;
  categories: Record<string, number | null>;
  templates: Tpl[];
}) {
  const d = useAppData();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);
  const [who, setWho] = useState(initialWho);
  const [kind, setKind] = useState<"gaji" | "bonus" | "thr">("gaji");
  const [amount, setAmount] = useState(settings[initialWho].amount);
  const [accountId, setAccountId] = useState<number>(settings[initialWho].accountId ?? d.lastAccountId ?? d.accounts[0]?.id ?? 0);
  const [tplId, setTplId] = useState<number | null>(settings[initialWho].templateId);
  const [items, setItems] = useState<(Item & { value: number })[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (kind === "gaji") {
      setAmount(settings[who].amount);
      if (settings[who].accountId) setAccountId(settings[who].accountId!);
      setTplId(settings[who].templateId);
    } else {
      setTplId(templates.find((t) => t.trigger === "bonus")?.id ?? null);
    }
  }, [who, kind, settings, templates]);

  const tpl = templates.find((t) => t.id === tplId) ?? null;
  const goToItems = () => {
    if (!amount) return toast.error("Nominal belum diisi");
    if (!accountId) return toast.error("Akun tujuan belum dipilih");
    const base = tpl?.items ?? [];
    const vals = resolveAmounts(amount, base);
    setItems(base.map((it, i) => ({ ...it, value: vals[i] })));
    setStep(2);
  };
  const allocated = items.reduce((s, i) => s + i.value, 0);
  const left = amount - allocated;
  const categoryId = kind === "gaji" ? categories[`salary_${who}`] : categories[kind];

  const targetName = useMemo(
    () => (it: Item) =>
      it.targetType === "account" ? d.accounts.find((a) => a.id === it.targetId)?.name : it.targetType === "goal" ? d.goals.find((g) => g.id === it.targetId)?.name : d.debts.find((x) => x.id === it.targetId)?.name,
    [d],
  );

  const submit = () =>
    start(async () => {
      const r = await incomeWizardAction({ amount, accountId, categoryId, items: items.map((i) => ({ targetType: i.targetType, targetId: i.targetId, amount: i.value, label: i.label })) });
      if (!r.ok) return toast.error(r.error);
      setDone(true);
      toast.success(`Tercatat: pemasukan + ${r.data.count} alokasi`);
      setTimeout(() => router.push("/"), 900);
    });

  return (
    <div className="space-y-3">
      <Confetti fire={done} />
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => <span key={s} className={cn("h-2 rounded-full transition-all", step >= s ? "w-8 bg-primary" : "w-2 bg-border")} />)}
      </div>

      {step === 1 && (
        <Card>
          <Segmented className="mb-3" value={who} onChange={setWho} options={[{ value: "suami", label: d.names.suami }, { value: "istri", label: d.names.istri }]} />
          <Segmented className="mb-3" size="sm" value={kind} onChange={setKind} options={[{ value: "gaji", label: "Gaji" }, { value: "bonus", label: "Bonus" }, { value: "thr", label: "THR" }]} />
          <Field label="Nominal masuk" hint={kind === "gaji" && settings[who].amount ? `Perkiraan di Pengaturan: ${formatRp(settings[who].amount)}` : undefined}>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Masuk ke akun">
            <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>{d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
          <Field label="Template alokasi">
            <Select value={tplId ?? ""} onChange={(e) => setTplId(Number(e.target.value) || null)}>
              <option value="">Tanpa template (atur manual)</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Link href="/pengaturan/template" className="mb-3 block text-[13px] font-semibold text-primary">Kelola template alokasi →</Link>
          <Button block onClick={goToItems}>Lanjut</Button>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <div className="flex items-baseline justify-between">
              <span className="text-caption text-muted">Sisa belum dialokasikan</span>
              <span className={cn("money text-h2", left < 0 ? "text-expense" : left === 0 ? "text-income" : "")}>{formatRp(left)}</span>
            </div>
            <div className="text-caption text-muted">dari {formatRp(amount)} — sisa tetap di akun penerima (amplop belanja)</div>
          </Card>
          <Card className="space-y-3">
            {items.length === 0 && <p className="text-caption text-muted">Tambahkan pos: bayar cicilan, setor tabungan, transfer uang jajan.</p>}
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon name={it.targetType === "account" ? "arrow-left-right" : it.targetType === "goal" ? "piggy-bank" : "landmark"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{it.label || targetName(it) || "?"}</div>
                  <div className="text-caption text-muted">{it.targetType === "account" ? "Transfer" : it.targetType === "goal" ? "Setor tabungan" : "Bayar cicilan"} · {targetName(it)}{it.percent != null ? ` · ${it.percent}%` : ""}</div>
                </div>
                <div className="w-32"><MoneyInput value={it.value} onChange={(v) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, value: v } : x)))} /></div>
                <button onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} className="flex h-11 w-8 items-center justify-center text-muted" aria-label="Hapus pos"><Icon name="x" size={16} /></button>
              </div>
            ))}
            <AddItem onAdd={(it) => setItems((xs) => [...xs, { ...it, value: Math.max(0, left) }])} />
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button>
            <Button onClick={() => (left < 0 ? toast.error("Alokasi melebihi nominal") : setStep(3))}>Lanjut</Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Card>
            <h2 className="mb-2 text-h2">Konfirmasi</h2>
            <ul className="space-y-1.5 text-[14px]">
              <li className="flex justify-between"><span>Pemasukan {kind === "gaji" ? `gaji ${d.names[who]}` : kind.toUpperCase()} → {d.accounts.find((a) => a.id === accountId)?.name}</span><b className="money text-income">+{formatRp(amount)}</b></li>
              {items.filter((i) => i.value > 0).map((i, k) => (
                <li key={k} className="flex justify-between gap-2"><span className="truncate">{i.label || targetName(i)}</span><span className="money">{formatRp(i.value)}</span></li>
              ))}
              <li className="flex justify-between border-t border-border pt-1.5"><span className="text-muted">Tetap di akun penerima</span><span className="money">{formatRp(left)}</span></li>
            </ul>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Kembali</Button>
            <Button loading={pending} onClick={submit}>Catat semua</Button>
          </div>
        </>
      )}
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (it: Item) => void }) {
  const d = useAppData();
  const [type, setType] = useState<Target>("account");
  const [id, setId] = useState<number>(0);
  const opts = type === "account" ? d.accounts.map((a) => ({ id: a.id, name: a.name })) : type === "goal" ? d.goals.map((g) => ({ id: g.id, name: `${g.icon} ${g.name}` })) : d.debts.map((x) => ({ id: x.id, name: x.name }));
  return (
    <div className="flex gap-2 border-t border-border pt-3">
      <Select className="w-32" value={type} onChange={(e) => { setType(e.target.value as Target); setId(0); }}>
        <option value="account">Transfer</option>
        <option value="goal">Tabungan</option>
        <option value="debt">Cicilan</option>
      </Select>
      <Select value={id || ""} onChange={(e) => setId(Number(e.target.value))}>
        <option value="">Pilih tujuan</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
      <Button size="icon" variant="secondary" disabled={!id} onClick={() => { const name = opts.find((o) => o.id === id)?.name ?? ""; onAdd({ targetType: type, targetId: id, label: name }); setId(0); }} aria-label="Tambah pos">
        <Icon name="plus" />
      </Button>
    </div>
  );
}
