"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { deleteAssetAction, saveAssetAction } from "@/lib/actions/finance";
import { formatShortDate, todayJakarta } from "@/lib/finance/date";
import { formatRp, formatRpShort } from "@/lib/finance/money";
import { ASSET_TYPE_LABEL } from "@/lib/utils";
import { useOwnerName } from "@/components/app-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money, useHideAmount } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltip } from "@/components/charts";
import { useToast } from "@/components/ui/toast";

interface A { id: number; name: string; type: string; owner: string; unit: string | null; quantity: number | null; value: number; history: { date: string; value: number }[] }

export function AssetsView({ nw, series, assets }: { nw: { accounts: number; assets: number; debts: number; total: number }; series: { label: string; value: number }[]; assets: A[] }) {
  const [edit, setEdit] = useState<(Partial<A> & { date: string; price?: number }) | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const { hidden } = useHideAmount();
  const { name, option } = useOwnerName();
  const isGold = edit?.type === "gold";

  return (
    <div className="space-y-3">
      <Card className="hero text-white">
        <div className="relative">
          <div className="text-[13px] text-white/80">Net worth</div>
          <Money value={nw.total} countUp className="text-display" />
          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div className="glass-sub rounded-xl p-2">Akun<br /><Money value={nw.accounts} short className="font-bold" /></div>
            <div className="glass-sub rounded-xl p-2">Aset<br /><Money value={nw.assets} short className="font-bold" /></div>
            <div className="glass-sub rounded-xl p-2">Hutang<br /><Money value={-nw.debts} short className="font-bold" /></div>
          </div>
        </div>
      </Card>
      {series.length > 1 && (
        <Card>
          <SectionTitle title="Tren net worth" />
          <div className="h-48 w-full">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} width={56} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={(v) => (hidden ? "•••" : formatRpShort(v).replace("Rp ", ""))} />
                <Tooltip trigger="click" content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" name="Net worth" stroke="var(--primary)" strokeWidth={2} fill="url(#nw)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Button block onClick={() => setEdit({ name: "", type: "gold", owner: "bersama", value: 0, date: todayJakarta(), unit: "gram", quantity: null })}><Icon name="plus" /> Tambah aset</Button>
      {assets.length === 0 ? (
        <EmptyState icon="gem" title="Catat rumah, kendaraan, emas, reksa dana, saham, kripto, atau BPJS TK/JHT." />
      ) : (
        <Card className="divide-y divide-border/70 py-1">
          {assets.map((a) => (
            <button key={a.id} onClick={() => setEdit({ ...a, date: todayJakarta(), price: a.quantity ? Math.round(a.value / a.quantity) : undefined })} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
              <Icon name={a.type === "gold" ? "gem" : a.type === "vehicle" ? "car" : a.type === "property" ? "house" : a.type === "crypto" ? "bitcoin" : "chart-line"} className="text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{a.name}</div>
                <div className="text-caption text-muted">{ASSET_TYPE_LABEL[a.type]} · {name(a.owner)}{a.quantity ? ` · ${a.quantity.toLocaleString("id-ID")} ${a.unit ?? ""}` : ""}{a.history[0] ? ` · per ${formatShortDate(a.history[0].date)}` : ""}</div>
              </div>
              <Money value={a.value} className="text-[15px] font-semibold" />
            </button>
          ))}
        </Card>
      )}

      <BottomSheet
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        title={edit?.id ? "Perbarui nilai aset" : "Aset baru"}
        footer={
          <Button
            block
            loading={pending}
            onClick={() =>
              start(async () => {
                const value = isGold && edit!.quantity && edit!.price ? Math.round(edit!.quantity * edit!.price) : edit!.value ?? 0;
                const r = await saveAssetAction(edit!.id ?? null, { ...edit, value });
                if (!r.ok) return toast.error(r.error);
                toast.success("Aset disimpan");
                setEdit(null);
                router.refresh();
              })
            }
          >
            Simpan
          </Button>
        }
      >
        {edit && (
          <>
            <Field label="Nama"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="mis. Emas Antam" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Jenis">
                <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value, unit: e.target.value === "gold" ? "gram" : edit.unit })}>
                  {Object.entries(ASSET_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Pemilik">
                <Select value={edit.owner} onChange={(e) => setEdit({ ...edit, owner: e.target.value })}>
                  <option value="bersama">Bersama</option><option value="suami">{option("suami")}</option><option value="istri">{option("istri")}</option>
                </Select>
              </Field>
            </div>
            {isGold ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Berat (gram)"><Input inputMode="decimal" value={edit.quantity ?? ""} onChange={(e) => setEdit({ ...edit, quantity: Number(e.target.value.replace(",", ".")) || null })} /></Field>
                <Field label="Harga per gram"><MoneyInput value={edit.price ?? 0} onChange={(v) => setEdit({ ...edit, price: v })} /></Field>
              </div>
            ) : (
              <Field label="Nilai saat ini"><MoneyInput value={edit.value ?? 0} onChange={(v) => setEdit({ ...edit, value: v })} /></Field>
            )}
            {isGold && edit.quantity && edit.price ? <p className="mb-2 text-caption text-muted">Nilai {formatRp(Math.round(edit.quantity * edit.price))}</p> : null}
            <Field label="Per tanggal"><Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            {edit.history && edit.history.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-caption text-muted">Riwayat nilai</div>
                {edit.history.map((h) => <div key={h.date} className="flex justify-between text-[13px]"><span>{formatShortDate(h.date)} {h.date.slice(0, 4)}</span><Money value={h.value} /></div>)}
              </div>
            )}
            {edit.id && <Button variant="ghost" block className="text-expense" onClick={() => window.confirm("Hapus aset ini beserta riwayat nilainya?") && start(async () => { const r = await deleteAssetAction(edit.id!); if (!r.ok) return toast.error(r.error); setEdit(null); router.refresh(); })}>Hapus aset</Button>}
          </>
        )}
      </BottomSheet>
    </div>
  );
}
