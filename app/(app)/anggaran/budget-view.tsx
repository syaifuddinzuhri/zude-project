"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applyBudgetTemplateAction,
  applySinkingAction,
  copyBudgetAction,
  deleteSinkingAction,
  saveBudgetTemplateAction,
  saveSinkingAction,
  setBudgetAction,
  setPlannedIncomeAction,
} from "@/lib/actions/finance";
import type { BudgetOverview } from "@/lib/server/budgets";
import { formatRp } from "@/lib/finance/money";
import { useAppData } from "@/components/app-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Switch } from "@/components/ui/field";
import { CategoryIcon, Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Target = { kind: "category" | "goal" | "debt"; id: number | null; amount: number; rollover: boolean };

export function BudgetView({ o, templates, debts }: { o: BudgetOverview; templates: { id: number; name: string }[]; debts: { id: number; name: string; monthly: number }[] }) {
  const d = useAppData();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<null | "budget" | "income" | "tools" | "sinking">(null);
  const [target, setTarget] = useState<Target>({ kind: "category", id: null, amount: 0, rollover: false });
  const [income, setIncome] = useState(o.period.plannedIncome);
  const [tplName, setTplName] = useState("");
  const [sf, setSf] = useState({ name: "", categoryId: 0, annualAmount: 0, dueMonth: 1 });
  const locked = o.period.status === "locked";

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, close = true) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error((r as { error: string }).error);
      toast.success(ok);
      if (close) setSheet(null);
      router.refresh();
    });

  const openBudget = (t: Partial<Target>) => {
    setTarget({ kind: "category", id: null, amount: 0, rollover: false, ...t });
    setSheet("budget");
  };

  const expenseParents = d.categories.filter((c) => c.kind === "expense" && c.parentId === null);
  const unalloc = o.unallocated;
  const categoryLines = o.lines.filter((l) => l.kind === "category");
  const otherLines = o.lines.filter((l) => l.kind !== "category");

  return (
    <>
      <Card className={cn("border-2", unalloc === 0 ? "border-income/40" : unalloc > 0 ? "border-warning/40" : "border-expense/40")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-caption text-muted">Belum dialokasikan</div>
            <Money value={unalloc} className={cn("text-h1", unalloc === 0 ? "text-income" : unalloc > 0 ? "text-warning" : "text-expense")} />
            <div className="mt-0.5 text-caption text-muted">
              {unalloc === 0 ? "Semua pemasukan sudah punya tugas ✓" : unalloc > 0 ? "Alokasikan sampai Rp 0 (zero-based)" : "Alokasi melebihi rencana pemasukan"}
            </div>
          </div>
          {!locked && (
            <Button size="icon" variant="secondary" onClick={() => setSheet("tools")} aria-label="Alat anggaran">
              <Icon name="ellipsis" />
            </Button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
          <button disabled={locked} onClick={() => { setIncome(o.period.plannedIncome); setSheet("income"); }} className="rounded-btn bg-bg px-3 py-2 text-left">
            <div className="text-caption text-muted">Rencana pemasukan ✎</div>
            <Money value={o.period.plannedIncome} className="font-semibold" />
          </button>
          <div className="rounded-btn bg-bg px-3 py-2">
            <div className="text-caption text-muted">Total dialokasikan</div>
            <Money value={o.totalBudget} className="font-semibold" />
          </div>
        </div>
        {locked && <p className="mt-2 text-caption text-warning">Siklus ini sudah ditutup & dikunci.</p>}
      </Card>

      <SectionTitle title="Kategori" action={!locked && <button onClick={() => openBudget({})} className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"><Icon name="plus" size={16} /> Tambah</button>} />
      {categoryLines.length === 0 ? (
        <EmptyState icon="chart-pie" title="Belum ada anggaran di siklus ini." action={locked ? undefined : "Salin dari bulan lalu"} onAction={() => act(() => copyBudgetAction(o.period.id), "Anggaran bulan lalu disalin", false)} />
      ) : (
        <Card className="space-y-4">
          {categoryLines.map((l) => (
            <Link key={l.id} href={`/anggaran/${l.id}`} className="block">
              <div className="flex items-center gap-3">
                <CategoryIcon icon={l.icon} color={l.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">
                      {l.name}
                      {l.rolloverEnabled && <Icon name="repeat" size={12} className="ml-1 inline text-muted" />}
                    </span>
                    <Money value={l.remaining} className={cn("text-[14px] font-semibold", l.remaining < 0 && "text-expense")} />
                  </div>
                  <ProgressBar className="my-1.5" value={l.usage} status={l.status} />
                  <div className="flex justify-between text-caption text-muted">
                    <span>
                      <Money value={l.spent} short /> dari <Money value={l.budget + l.rollover} short />
                      {l.rollover !== 0 && <> (rollover <Money value={l.rollover} short sign />)</>}
                    </span>
                    <span>{l.remaining >= 0 ? "sisa" : "lebih"}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {o.unbudgeted.length > 0 && (
        <Card>
          <SectionTitle title="Tanpa anggaran" />
          <ul className="divide-y divide-border/70">
            {o.unbudgeted.map((u) => (
              <li key={u.categoryId} className="flex items-center gap-3 py-2">
                <CategoryIcon icon={u.icon} color={u.color} size={32} />
                <span className="flex-1 text-[14px] font-medium">{u.name}</span>
                <Money value={u.spent} className="text-[14px] text-expense" />
                {!locked && (
                  <button onClick={() => openBudget({ kind: "category", id: u.categoryId, amount: u.spent })} className="min-h-[44px] px-2 text-[13px] font-semibold text-primary">
                    Anggarkan
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SectionTitle title="Tabungan & cicilan" action={!locked && <button onClick={() => openBudget({ kind: "goal" })} className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"><Icon name="plus" size={16} /> Tambah</button>} />
      <Card className="space-y-4">
        {otherLines.length === 0 && <p className="text-caption text-muted">Alokasikan juga setoran tabungan & cicilan agar zero-based.</p>}
        {otherLines.map((l) => (
          <button key={l.id} className="block w-full text-left" disabled={locked} onClick={() => openBudget({ kind: l.kind, id: l.goalId ?? l.debtId, amount: l.budget, rollover: l.rolloverEnabled })}>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">{l.name}</span>
              <span className="text-caption text-muted"><Money value={l.spent} short /> / <Money value={l.budget} short /></span>
            </div>
            <ProgressBar className="mt-1.5" value={l.usage} color={l.spent >= l.budget ? "var(--income)" : "var(--accent)"} />
          </button>
        ))}
      </Card>

      <SectionTitle title="Sinking fund" action={!locked && <button onClick={() => setSheet("sinking")} className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"><Icon name="plus" size={16} /> Tambah</button>} />
      <Card>
        {o.sinking.length === 0 ? (
          <p className="text-caption text-muted">Pengeluaran tahunan (pajak kendaraan, SPP tahunan, lebaran, asuransi) dibagi rata per bulan.</p>
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              {o.sinking.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold">{s.name}</div>
                    <div className="text-caption text-muted">{s.categoryName} · <Money value={s.annual} short />/thn · jatuh {MONTHS[s.dueMonth - 1]}</div>
                  </div>
                  <Money value={s.monthly} className="text-[14px] font-semibold" />
                  {!locked && (
                    <button onClick={() => act(() => deleteSinkingAction(s.id), "Sinking fund dihapus", false)} className="flex h-11 w-9 items-center justify-center text-muted" aria-label="Hapus">
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!locked && (
              <Button variant="secondary" size="sm" block className="mt-2" loading={pending} onClick={() => act(() => applySinkingAction(o.period.id), "Sinking fund disisihkan ke anggaran", false)}>
                Sisihkan bulan ini ke anggaran ({formatRp(o.sinking.reduce((a, s) => a + s.monthly, 0))})
              </Button>
            )}
          </>
        )}
      </Card>

      {/* Sheet tambah/ubah anggaran */}
      <BottomSheet
        open={sheet === "budget"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Atur anggaran"
        footer={
          <Button
            block
            loading={pending}
            onClick={() =>
              act(
                () =>
                  setBudgetAction({
                    periodId: o.period.id,
                    categoryId: target.kind === "category" ? target.id : null,
                    goalId: target.kind === "goal" ? target.id : null,
                    debtId: target.kind === "debt" ? target.id : null,
                    amount: target.amount,
                    rolloverEnabled: target.rollover,
                  }),
                "Anggaran disimpan",
              )
            }
          >
            Simpan
          </Button>
        }
      >
        <Segmented
          className="mb-3"
          value={target.kind}
          onChange={(k) => setTarget({ ...target, kind: k, id: null })}
          options={[
            { value: "category", label: "Kategori" },
            { value: "goal", label: "Tabungan" },
            { value: "debt", label: "Cicilan" },
          ]}
        />
        <Field label={target.kind === "category" ? "Kategori" : target.kind === "goal" ? "Tujuan" : "Hutang"}>
          <Select
            value={target.id ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value) || null;
              const debt = target.kind === "debt" ? debts.find((x) => x.id === id) : null;
              const existing = o.lines.find((l) => (target.kind === "category" ? l.categoryId : target.kind === "goal" ? l.goalId : l.debtId) === id);
              setTarget({ ...target, id, amount: existing?.budget ?? debt?.monthly ?? target.amount, rollover: existing?.rolloverEnabled ?? target.rollover });
            }}
          >
            <option value="">Pilih</option>
            {target.kind === "category" &&
              expenseParents.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  <option value={p.id}>{p.name} (semua)</option>
                  {d.categories.filter((c) => c.parentId === p.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            {target.kind === "goal" && d.goals.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            {target.kind === "debt" && debts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label="Nominal per siklus">
          <MoneyInput value={target.amount} onChange={(v) => setTarget({ ...target, amount: v })} />
        </Field>
        {target.kind === "category" && <Switch checked={target.rollover} onChange={(v) => setTarget({ ...target, rollover: v })} label="Rollover" description="Sisa atau kelebihan dibawa ke bulan berikutnya" />}
        {unalloc !== 0 && <p className="mt-2 text-caption text-muted">Belum dialokasikan saat ini: {formatRp(unalloc)}</p>}
      </BottomSheet>

      <BottomSheet open={sheet === "income"} onOpenChange={(v) => !v && setSheet(null)} title="Rencana pemasukan siklus ini" footer={<Button block loading={pending} onClick={() => act(() => setPlannedIncomeAction(o.period.id, income), "Rencana pemasukan disimpan")}>Simpan</Button>}>
        <MoneyInput value={income} onChange={setIncome} autoFocus />
        <p className="mt-2 text-caption text-muted">Default: perkiraan gaji suami + istri dari Pengaturan.</p>
      </BottomSheet>

      <BottomSheet open={sheet === "tools"} onOpenChange={(v) => !v && setSheet(null)} title="Alat anggaran">
        <div className="space-y-2 pb-2">
          <Button variant="secondary" block loading={pending} onClick={() => act(() => copyBudgetAction(o.period.id), "Anggaran bulan lalu disalin (dengan rollover)")}>
            <Icon name="copy" size={18} /> Salin dari bulan lalu
          </Button>
          {templates.map((t) => (
            <Button key={t.id} variant="secondary" block loading={pending} onClick={() => act(() => applyBudgetTemplateAction(o.period.id, t.id), `Template "${t.name}" diterapkan`)}>
              <Icon name="file-text" size={18} /> Terapkan: {t.name}
            </Button>
          ))}
          <div className="flex gap-2 pt-2">
            <Input placeholder="Nama template" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <Button variant="secondary" disabled={!tplName.trim()} onClick={() => act(() => saveBudgetTemplateAction(o.period.id, tplName), "Template disimpan")}>
              Simpan
            </Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "sinking"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Sinking fund baru"
        footer={<Button block loading={pending} onClick={() => act(() => saveSinkingAction(null, sf), "Sinking fund ditambahkan")}>Simpan</Button>}
      >
        <Field label="Nama"><Input value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} placeholder="mis. Pajak motor" /></Field>
        <Field label="Kategori">
          <Select value={sf.categoryId || ""} onChange={(e) => setSf({ ...sf, categoryId: Number(e.target.value) })}>
            <option value="">Pilih</option>
            {expenseParents.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.id}>{p.name}</option>
                {d.categories.filter((c) => c.parentId === p.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Nominal per tahun"><MoneyInput value={sf.annualAmount} onChange={(v) => setSf({ ...sf, annualAmount: v })} /></Field>
        <Field label="Bulan jatuh tempo">
          <Select value={sf.dueMonth} onChange={(e) => setSf({ ...sf, dueMonth: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        {sf.annualAmount > 0 && <p className="text-caption text-muted">Disisihkan {formatRp(Math.ceil(sf.annualAmount / 12))} per bulan.</p>}
      </BottomSheet>
    </>
  );
}
