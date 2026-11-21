"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import type { ReportData } from "@/lib/server/reports";
import { formatPercent, formatRpShort } from "@/lib/finance/money";
import { BENEFICIARY_LABEL } from "@/lib/utils";
import { useOwnerName } from "@/components/app-data";
import { ChartTooltip } from "@/components/charts";
import { Card, SectionTitle } from "@/components/ui/card";
import { Money, useHideAmount } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

type Tab = "arus" | "kategori" | "rasio" | "orang";
const axis = { axisLine: false, tickLine: false, tick: { fill: "var(--text-muted)", fontSize: 12 } } as const;

export function ReportView({ d, tab }: { d: ReportData; tab: Tab }) {
  const router = useRouter();
  const params = useSearchParams();
  const { hidden } = useHideAmount();
  const { name, names } = useOwnerName();
  const fmt = (v: number) => (hidden ? "•••" : formatRpShort(v).replace("Rp ", ""));
  const go = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`/laporan?${p.toString()}`, { scroll: false });
  };

  return (
    <>
      <Segmented value={tab} onChange={(t) => go("tab", t === "arus" ? null : t)} options={[{ value: "arus", label: "Arus kas" }, { value: "kategori", label: "Kategori" }, { value: "rasio", label: "Rasio" }, { value: "orang", label: "Per orang" }]} size="sm" />

      {tab === "arus" && (
        <>
          <Card>
            <SectionTitle title="Pemasukan vs pengeluaran" />
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={d.cashflow} margin={{ left: 0, right: 4, top: 8 }} barGap={2}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} tickFormatter={fmt} />
                  <Tooltip trigger="click" cursor={{ fill: "var(--primary-soft)", opacity: 0.4 }} content={<ChartTooltip />} />
                  <Bar dataKey="income" name="Pemasukan" fill="var(--income)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="var(--expense)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Tren sisa (pemasukan − pengeluaran)" />
            <div className="h-40 w-full">
              <ResponsiveContainer>
                <AreaChart data={d.cashflow.map((c) => ({ ...c, net: c.income - c.expense }))} margin={{ left: 0, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="net" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} tickFormatter={fmt} />
                  <Tooltip trigger="click" content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="net" name="Sisa" stroke="var(--primary)" strokeWidth={2} fill="url(#net)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-caption text-muted">Masuk</div><Money value={d.totals.income} short className="font-bold text-income" /></div>
              <div><div className="text-caption text-muted">Keluar</div><Money value={d.totals.expense + d.totals.debtInterest} short className="font-bold text-expense" /></div>
              <div><div className="text-caption text-muted">Ditabung</div><Money value={d.totals.savings + d.totals.debtPrincipal} short className="font-bold" /></div>
            </div>
            <div className="mt-3 text-caption text-muted">Tahunan (12 siklus): masuk <Money value={d.cashflow.reduce((a, c) => a + c.income, 0)} short /> · keluar <Money value={d.cashflow.reduce((a, c) => a + c.expense, 0)} short /></div>
          </Card>
        </>
      )}

      {tab === "kategori" && (
        <>
          <Card>
            <SectionTitle title="Pengeluaran per kategori" />
            {d.donut.length === 0 ? (
              <p className="py-4 text-center text-caption text-muted">Belum ada pengeluaran.</p>
            ) : (
              <>
                <div className="relative h-56 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={d.donut} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none">
                        {d.donut.map((x, i) => <Cell key={i} fill={x.color} />)}
                      </Pie>
                      <Tooltip trigger="click" content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-caption text-muted">Total</span>
                    <Money value={d.donutTotal} short className="text-h2" />
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {d.donut.map((x) => (
                    <li key={x.name} className="flex items-center gap-2 text-[14px]">
                      <span className="h-3 w-3 rounded-full" style={{ background: x.color }} />
                      <span className="flex-1">{x.name}</span>
                      <span className="text-caption text-muted">{formatPercent(x.value / d.donutTotal)}</span>
                      <Money value={x.value} short className="w-24 text-right font-semibold" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <CompareCard c={d.compare} />
          <Card>
            <SectionTitle title="Tren 12 bulan" />
            <Select className="mb-2" value={d.trendCat ?? ""} onChange={(e) => go("cat", e.target.value)}>
              {d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="h-44 w-full">
              <ResponsiveContainer>
                <BarChart data={d.trend} margin={{ left: 0, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} tickFormatter={fmt} />
                  <Tooltip trigger="click" content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Pengeluaran" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {tab === "rasio" && (
        <>
          <Card className="space-y-3">
            <SectionTitle title="Rasio 50/30/20" />
            {([["needs", "Wajib (needs)", "var(--primary)"], ["wants", "Keinginan (wants)", "#F59E0B"], ["savings_debt", "Tabungan + hutang", "var(--accent)"]] as const).map(([k, l, c]) => (
              <div key={k}>
                <div className="flex justify-between text-[14px]">
                  <span className="font-semibold">{l}</span>
                  <span>
                    <b>{formatPercent(d.ratio[k])}</b> <span className="text-caption text-muted">/ target {formatPercent(d.ratio.target[k])}</span>
                  </span>
                </div>
                <ProgressBar className="mt-1" value={d.ratio[k]} color={c} />
                <div className="text-caption text-muted"><Money value={d.ratio.raw[k]} short /></div>
              </div>
            ))}
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 text-center"><div className="text-caption text-muted">Savings rate</div><div className="text-h2">{formatPercent(d.savingsRate)}</div></Card>
            <Card className="p-3 text-center"><div className="text-caption text-muted">DSR</div><div className={`text-h2 ${d.dsr > 0.3 ? "text-expense" : ""}`}>{formatPercent(d.dsr)}</div></Card>
            <Card className="p-3 text-center"><div className="text-caption text-muted">Dana darurat</div><div className="text-h2">{d.emergency.coverage.toLocaleString("id-ID", { maximumFractionDigits: 1 })} bln</div><div className="text-[11px] text-muted">target {d.emergency.months}</div></Card>
          </div>
          <p className="text-caption text-muted">Savings rate = (tabungan + pokok hutang) ÷ pemasukan. Dana darurat = saldo tujuan dana darurat ÷ rata-rata pengeluaran wajib 3 siklus terakhir (<Money value={d.emergency.needs} short />).</p>
        </>
      )}

      {tab === "orang" && (
        <>
          <Card>
            <SectionTitle title="Dicatat per orang" />
            <div className="h-44 w-full">
              <ResponsiveContainer>
                <BarChart data={d.perPerson} margin={{ left: 0, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} width={48} tickFormatter={fmt} />
                  <Tooltip trigger="click" content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Pemasukan" fill="var(--income)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="var(--expense)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Pengeluaran per pemilik akun" />
            {Object.entries(d.ownerTotals).map(([k, v]) => <div key={k} className="flex justify-between py-1 text-[14px]"><span>{name(k)}</span><Money value={v} /></div>)}
          </Card>
          <Card>
            <SectionTitle title="Per penerima manfaat" />
            {d.beneficiary.length === 0 ? <p className="text-caption text-muted">Isi &quot;Untuk siapa&quot; saat mencatat untuk melihat pengeluaran anak/keluarga.</p> : d.beneficiary.map((b) => <div key={b.name} className="flex justify-between py-1 text-[14px]"><span>{b.name === "suami" || b.name === "istri" ? names[b.name] : BENEFICIARY_LABEL[b.name]}</span><Money value={b.value} /></div>)}
          </Card>
        </>
      )}

      <Card className="no-print">
        <SectionTitle title="Ekspor" />
        <div className="grid grid-cols-2 gap-2">
          <a href={`/api/export/transactions?from=${d.period.start}&to=${d.period.end}`} className="pressable glass flex h-12 items-center justify-center gap-2 rounded-btn text-[14px] font-semibold"><Icon name="download" size={18} /> CSV / Excel</a>
          <button onClick={() => window.print()} className="pressable glass flex h-12 items-center justify-center gap-2 rounded-btn text-[14px] font-semibold"><Icon name="file-text" size={18} /> PDF</button>
        </div>
        <a href="/api/export/transactions" className="mt-2 block text-center text-caption font-semibold text-primary">Unduh semua transaksi (CSV)</a>
      </Card>
    </>
  );
}

/** Kategori: siklus ini vs siklus lalu vs rata-rata 3 siklus. Naik = merah, turun = hijau. */
function CompareCard({ c }: { c: ReportData["compare"] }) {
  const total = c.rows.reduce((a, r) => ({ current: a.current + r.current, previous: a.previous + r.previous, average: a.average + r.average }), { current: 0, previous: 0, average: 0 });
  const totalChange = total.average > 0 ? (total.current - total.average) / total.average : null;
  return (
    <Card>
      <SectionTitle title="Dibanding siklus sebelumnya" />
      {c.progress && (
        <p className="-mt-1 mb-2 rounded-btn bg-bg px-3 py-2 text-caption text-muted">
          Siklus berjalan hari ke-{c.progress.day} dari {c.progress.days}. Angka siklus ini belum final.
        </p>
      )}
      {c.rows.length === 0 ? (
        <p className="py-4 text-center text-caption text-muted">Belum ada pengeluaran untuk dibandingkan.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          <CompareRow name="Total" current={total.current} previous={total.previous} average={total.average} change={totalChange} bold />
          {c.rows.map((r) => <CompareRow key={r.id} name={r.name} color={r.color} current={r.current} previous={r.previous} average={r.average} change={r.change} />)}
        </ul>
      )}
      <p className="mt-2 text-caption text-muted">Persentase = siklus ini dibanding rata-rata 3 siklus sebelumnya.</p>
    </Card>
  );
}

function CompareRow({ name, color, current, previous, average, change, bold }: { name: string; color?: string | null; current: number; previous: number; average: number; change: number | null; bold?: boolean }) {
  const up = change !== null && change > 0.1;
  const down = change !== null && change < -0.1;
  return (
    <li className="py-2">
      <div className="flex items-center gap-2 text-[14px]">
        {color !== undefined && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color ?? "var(--text-muted)" }} />}
        <span className={`min-w-0 flex-1 truncate ${bold ? "font-bold" : ""}`}>{name}</span>
        <Money value={current} short className={bold ? "font-bold" : "font-semibold"} />
        <span className={`w-16 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${up ? "bg-expense/15 text-expense" : down ? "bg-income/15 text-income" : "bg-bg text-muted"}`}>
          {change === null ? "baru" : `${change > 0 ? "▲" : change < 0 ? "▼" : ""} ${formatPercent(Math.abs(change))}`}
        </span>
      </div>
      <div className={`text-caption text-muted ${color !== undefined ? "pl-5" : ""}`}>
        lalu <Money value={previous} short /> · rata² 3 siklus <Money value={average} short />
      </div>
    </li>
  );
}
