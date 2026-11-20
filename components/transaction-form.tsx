"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createTxAction, updateTxAction } from "@/lib/actions/transactions";
import { formatRp } from "@/lib/finance/money";
import { todayJakarta } from "@/lib/finance/date";
import { unsplitRemainder } from "@/lib/finance/splits";
import { cn } from "@/lib/utils";
import { useAppData } from "./app-data";
import type { TxKind } from "./add-sheet-context";
import { Button } from "./ui/button";
import { CategoryIcon, Icon } from "./ui/icon";
import { Keypad, evaluate, hasOperator } from "./ui/keypad";
import { Input, Select } from "./ui/field";
import { useToast } from "./ui/toast";
import { useHideAmount } from "./ui/money";

const TYPES: { value: TxKind; label: string }[] = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
  { value: "debt_payment", label: "Bayar Cicilan" },
  { value: "saving_deposit", label: "Setor Tabungan" },
];

export interface TxFormInitial {
  id?: number;
  type?: TxKind;
  amount?: number;
  accountId?: number | null;
  toAccountId?: number | null;
  splits?: { categoryId: number; amount: number; note?: string | null }[];
  date?: string;
  time?: string;
  note?: string | null;
  beneficiary?: string | null;
  tags?: string[];
  feeAmount?: number;
  status?: "planned" | "realized";
  debtId?: number | null;
  scheduleId?: number | null;
  goalId?: number | null;
}

export function TransactionForm({ initial, onDone }: { initial: TxFormInitial; onDone: () => void }) {
  const d = useAppData();
  const toast = useToast();
  const router = useRouter();
  const { hidden } = useHideAmount();
  const editing = Boolean(initial.id);
  const [type, setType] = useState<TxKind>(initial.type ?? "expense");
  const [expr, setExpr] = useState(initial.amount ? String(initial.amount) : "");
  const amount = useMemo(() => evaluate(expr), [expr]);
  const defaultAccount = initial.accountId ?? d.lastAccountId ?? d.accounts[0]?.id ?? null;
  const [accountId, setAccountId] = useState<number | null>(defaultAccount);
  const [toAccountId, setToAccountId] = useState<number | null>(initial.toAccountId ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(initial.splits?.length === 1 ? initial.splits[0].categoryId : null);
  const [splitMode, setSplitMode] = useState((initial.splits?.length ?? 0) > 1);
  const [splits, setSplits] = useState<{ categoryId: number; amount: number }[]>(initial.splits && initial.splits.length > 1 ? initial.splits : []);
  const [date, setDate] = useState(initial.date ?? todayJakarta());
  const [time, setTime] = useState(initial.time ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [beneficiary, setBeneficiary] = useState<string | null>(initial.beneficiary ?? null);
  const [tags, setTags] = useState((initial.tags ?? []).join(" "));
  const [fee, setFee] = useState(initial.feeAmount ?? 0);
  const [planned, setPlanned] = useState(initial.status === "planned");
  const [debtId, setDebtId] = useState<number | null>(initial.debtId ?? null);
  const [goalId, setGoalId] = useState<number | null>(initial.goalId ?? null);
  const [showMore, setShowMore] = useState(Boolean(initial.note || initial.tags?.length || initial.beneficiary));
  const [showAllCats, setShowAllCats] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const kind = type === "income" ? "income" : "expense";
  const cats = d.categories.filter((c) => c.kind === kind);
  const frequent = (d.frequent[kind] ?? []).map((id) => cats.find((c) => c.id === id)).filter(Boolean) as typeof cats;
  const quick = [...frequent, ...cats.filter((c) => !frequent.includes(c) && c.parentId !== null)].slice(0, 8);
  const quickWithSelected = categoryId && !quick.some((c) => c.id === categoryId) ? [cats.find((c) => c.id === categoryId)!, ...quick.slice(0, 7)] : quick;
  const parents = cats.filter((c) => c.parentId === null);

  // Bayar cicilan: isi nominal & akun dari jadwal berikutnya
  useEffect(() => {
    if (type !== "debt_payment" || editing) return;
    const debt = d.debts.find((x) => x.id === debtId) ?? (debtId == null ? d.debts[0] : undefined);
    if (debt && debtId == null) setDebtId(debt.id);
    if (debt && !expr) setExpr(String(debt.nextAmount || ""));
    if (debt?.defaultAccountId && !initial.accountId) setAccountId(debt.defaultAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, debtId]);

  useEffect(() => {
    if (type === "saving_deposit" && goalId == null && d.goals[0]) setGoalId(d.goals[0].id);
  }, [type, goalId, d.goals]);

  const remainder = unsplitRemainder(amount, splits);

  const submit = (withReason?: string) => {
    if (!amount) return toast.error("Nominal belum diisi");
    if (!accountId) return toast.error("Akun belum dipilih");
    const debt = d.debts.find((x) => x.id === debtId);
    const payload: Record<string, unknown> = {
      type,
      amount,
      accountId,
      date,
      time: time || undefined,
      note: note || null,
      beneficiary,
      tags: tags.split(/[\s,]+/).filter(Boolean),
      status: planned ? "planned" : "realized",
      reason: withReason ?? reason ?? undefined,
    };
    if (type === "expense" || type === "income") {
      if (splitMode) {
        if (remainder !== 0) return toast.error(remainder > 0 ? `Masih ada ${formatRp(remainder)} yang belum dibagi` : `Pembagian kelebihan ${formatRp(-remainder)}`);
        payload.splits = splits;
      } else {
        if (!categoryId) return toast.error("Kategori belum dipilih");
        payload.splits = [{ categoryId, amount }];
      }
    }
    if (type === "transfer") {
      payload.toAccountId = toAccountId;
      payload.feeAmount = fee;
    }
    if (type === "debt_payment") {
      payload.debtId = debtId;
      payload.scheduleId = initial.scheduleId ?? (debt && amount >= debt.nextAmount ? debt.nextScheduleId : null) ?? debt?.nextScheduleId ?? null;
    }
    if (type === "saving_deposit") {
      payload.goalId = goalId;
      const g = d.goals.find((x) => x.id === goalId);
      payload.toAccountId = g?.accountId ?? accountId;
    }
    start(async () => {
      const res = editing ? await updateTxAction(initial.id!, payload) : await createTxAction(payload);
      if (!res.ok) {
        if (res.locked) {
          setReason("");
          toast.error(res.error);
          return;
        }
        return toast.error(res.error);
      }
      try {
        navigator.vibrate?.(10);
      } catch {}
      setSaved(true);
      setTimeout(() => {
        toast.success(editing ? "Perubahan disimpan" : "Transaksi tersimpan");
        onDone();
        router.refresh();
      }, 450);
    });
  };

  const accountOptions = d.accounts;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Isi form: area scroll sendiri, agar tombol Simpan tetap di bawah & tidak menimpa isian */}
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3">
      {/* Jenis transaksi */}
      <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={editing && (t.value === "debt_payment" || initial.type === "debt_payment")}
            onClick={() => {
              setType(t.value);
              setCategoryId(null);
              setSplitMode(false);
            }}
            className={cn(
              "pressable h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold disabled:opacity-40",
              type === t.value ? "bg-primary text-on-primary" : "bg-surface text-muted shadow-card",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Nominal besar */}
      <div className="mb-3 text-center">
        <div className={cn("money text-[40px] font-bold leading-[48px] tracking-tight", type === "income" ? "text-income" : type === "expense" ? "text-text" : "text-info")}>
          {hidden && amount ? "Rp ••••••" : formatRp(amount)}
        </div>
        {hasOperator(expr) && <div className="money text-caption text-muted">{expr.replace(/-/g, "−")}</div>}
      </div>

      <Keypad value={expr} onChange={setExpr} onEnter={() => submit()} compact />

      {/* Kategori */}
      {(type === "expense" || type === "income") && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-caption font-semibold text-muted">Kategori</span>
            <button
              type="button"
              onClick={() => {
                setSplitMode((s) => !s);
                if (!splitMode) setSplits(categoryId ? [{ categoryId, amount }] : []);
              }}
              className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-primary"
            >
              <Icon name="split" size={16} /> {splitMode ? "Satu kategori" : "Split"}
            </button>
          </div>
          {!splitMode ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {quickWithSelected.map((c) => (
                  <CategoryButton key={c.id} c={c} parent={cats.find((p) => p.id === c.parentId)?.name} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} />
                ))}
              </div>
              <button type="button" onClick={() => setShowAllCats((s) => !s)} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 text-[13px] font-semibold text-muted">
                {showAllCats ? "Tutup" : "Semua kategori"} <Icon name="chevron-down" size={16} className={showAllCats ? "rotate-180" : ""} />
              </button>
              <AnimatePresence>
                {showAllCats && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {parents.map((p) => {
                      const subs = cats.filter((c) => c.parentId === p.id);
                      return (
                        <div key={p.id} className="mb-3">
                          <div className="mb-1.5 text-caption text-muted">{p.name}</div>
                          <div className="grid grid-cols-4 gap-2">
                            {(subs.length ? [p, ...subs] : [p]).map((c) => (
                              <CategoryButton key={c.id} c={c} active={categoryId === c.id} onClick={() => { setCategoryId(c.id); setShowAllCats(false); }} label={c.id === p.id && subs.length ? "Umum" : undefined} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="space-y-2">
              {splits.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    value={s.categoryId || ""}
                    onChange={(e) => setSplits((xs) => xs.map((x, i) => (i === idx ? { ...x, categoryId: Number(e.target.value) } : x)))}
                    className="flex-1"
                    aria-label="Kategori split"
                  >
                    <option value="">Pilih kategori</option>
                    {parents.map((p) => (
                      <optgroup key={p.id} label={p.name}>
                        <option value={p.id}>{p.name}</option>
                        {cats.filter((c) => c.parentId === p.id).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <Input
                    inputMode="numeric"
                    className="money w-32 text-right"
                    value={s.amount ? s.amount.toLocaleString("id-ID") : ""}
                    placeholder="0"
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                      setSplits((xs) => xs.map((x, i) => (i === idx ? { ...x, amount: v } : x)));
                    }}
                    aria-label="Nominal split"
                  />
                  <button type="button" onClick={() => setSplits((xs) => xs.filter((_, i) => i !== idx))} className="flex h-11 w-9 items-center justify-center text-muted" aria-label="Hapus baris">
                    <Icon name="x" size={18} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setSplits((xs) => [...xs, { categoryId: 0, amount: Math.max(0, remainder) }])} className="flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-primary">
                  <Icon name="plus" size={16} /> Tambah baris
                </button>
                <span className={cn("money text-caption", remainder === 0 ? "text-income" : "text-warning")}>
                  {remainder === 0 ? "Pas ✓" : remainder > 0 ? `Sisa ${formatRp(remainder)}` : `Lebih ${formatRp(-remainder)}`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jenis khusus */}
      {type === "debt_payment" && (
        <div className="mt-4">
          <label className="mb-1.5 block text-caption text-muted">Hutang</label>
          {d.debts.length === 0 ? (
            <p className="text-caption text-muted">Belum ada hutang aktif. Tambahkan di menu Hutang.</p>
          ) : (
            <Select value={debtId ?? ""} onChange={(e) => { setDebtId(Number(e.target.value)); const db = d.debts.find((x) => x.id === Number(e.target.value)); if (db) setExpr(String(db.nextAmount || "")); }}>
              {d.debts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} {x.nextAmount ? `· ${formatRp(x.nextAmount)}` : ""}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {type === "saving_deposit" && (
        <div className="mt-4">
          <label className="mb-1.5 block text-caption text-muted">Tujuan tabungan</label>
          {d.goals.length === 0 ? (
            <p className="text-caption text-muted">Belum ada tujuan. Tambahkan di menu Tabungan.</p>
          ) : (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {d.goals.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoalId(g.id)} className={cn("pressable h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold", goalId === g.id ? "bg-primary text-on-primary" : "bg-surface shadow-card")}>
                  {g.icon} {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Akun · tanggal · catatan */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={type === "transfer" ? "col-span-1" : "col-span-1"}>
          <label className="mb-1.5 block text-caption text-muted">{type === "transfer" || type === "saving_deposit" ? "Dari akun" : "Akun"}</label>
          <Select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} aria-label="Akun">
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        {type === "transfer" ? (
          <div>
            <label className="mb-1.5 block text-caption text-muted">Ke akun</label>
            <Select value={toAccountId ?? ""} onChange={(e) => setToAccountId(Number(e.target.value))} aria-label="Akun tujuan">
              <option value="">Pilih</option>
              {d.accounts.filter((a) => a.id !== accountId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-caption text-muted">Tanggal</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal" />
          </div>
        )}
        {type === "transfer" && (
          <>
            <div>
              <label className="mb-1.5 block text-caption text-muted">Tanggal</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal" />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-muted">Biaya admin</label>
              <Input inputMode="numeric" className="money" placeholder="0" value={fee ? fee.toLocaleString("id-ID") : ""} onChange={(e) => setFee(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
            </div>
          </>
        )}
      </div>

      <button type="button" onClick={() => setShowMore((s) => !s)} className="mt-2 flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-muted">
        <Icon name="sliders" size={16} /> {showMore ? "Sembunyikan detail" : "Catatan, untuk siapa, tag, jam"}
      </button>
      {showMore && (
        <div className="space-y-3">
          <Input placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
          <div>
            <div className="mb-1.5 text-caption text-muted">Untuk siapa</div>
            <div className="flex flex-wrap gap-2">
              {(["suami", "istri", "anak", "keluarga"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBeneficiary(beneficiary === b ? null : b)} className={cn("pressable h-9 rounded-full px-3.5 text-[13px] font-semibold capitalize", beneficiary === b ? "bg-primary text-on-primary" : "bg-surface text-muted shadow-card")}>
                  {b === "suami" || b === "istri" ? d.names[b] : b}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Tag (pisah spasi)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Jam" />
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={planned} onChange={(e) => setPlanned(e.target.checked)} />
            Terencana (belum terjadi, tidak memengaruhi saldo)
          </label>
        </div>
      )}

      {reason !== null && (
        <div className="mt-3 rounded-btn border border-warning/40 bg-warning/10 p-3">
          <div className="mb-2 text-caption font-semibold text-warning">Bulan ini sudah dikunci — isi alasan perubahan</div>
          <Input autoFocus placeholder="Alasan perubahan" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}

      </div>

      <div className="shrink-0 border-t border-border/60 bg-[var(--surface-solid-95)] px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <Button block onClick={() => submit()} loading={pending} disabled={reason !== null && !reason.trim()}>
          Simpan
        </Button>
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface-solid-95)]">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="flex h-20 w-20 items-center justify-center rounded-full bg-income text-white">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 12l5 5L20 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1 }} />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryButton({ c, active, onClick, label, parent }: { c: { id: number; name: string; icon: string; color: string }; active: boolean; onClick: () => void; label?: string; parent?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("pressable flex min-h-[76px] flex-col items-center justify-start gap-1 rounded-2xl px-1 py-2 text-center", active ? "bg-primary-soft ring-2 ring-primary" : "bg-surface shadow-card")}
      aria-pressed={active}
      title={parent ? `${parent} › ${c.name}` : c.name}
    >
      <CategoryIcon icon={c.icon} color={c.color} size={36} />
      <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{label ?? c.name}</span>
    </button>
  );
}
