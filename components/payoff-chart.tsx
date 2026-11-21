"use client";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { payoffCountdown, type PayoffPoint } from "@/lib/finance/payoff";
import { formatMonthShort } from "@/lib/finance/date";
import { formatRpShort } from "@/lib/finance/money";
import { ChartTooltip } from "./charts";
import { useHideAmount } from "./ui/money";

const axis = { axisLine: false, tickLine: false, tick: { fill: "var(--text-muted)", fontSize: 12 } } as const;

/** Sisa pokok per bulan: garis tegas = sudah terjadi, garis putus-putus = proyeksi jadwal. */
export function PayoffChart({ points, height = 176 }: { points: PayoffPoint[]; height?: number }) {
  const { hidden } = useHideAmount();
  if (points.length < 2) return null;
  const data = points.map((p) => ({ ...p, label: formatMonthShort(p.month) }));
  const now = data.find((p) => p.actual !== null && p.projected !== null)?.label;
  const gap = Math.max(0, Math.ceil(data.length / 6) - 1);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="payoff-actual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} interval={gap} />
          <YAxis {...axis} width={48} tickFormatter={(v: number) => (hidden ? "•••" : formatRpShort(v).replace("Rp ", ""))} />
          <Tooltip trigger="click" content={<ChartTooltip />} />
          {now && <ReferenceLine x={now} stroke="var(--text-muted)" strokeDasharray="2 3" label={{ value: "Sekarang", position: "insideTopRight", fill: "var(--text-muted)", fontSize: 11 }} />}
          <Area type="monotone" dataKey="actual" name="Sisa pokok" stroke="var(--primary)" strokeWidth={2} fill="url(#payoff-actual)" connectNulls={false} />
          <Area type="monotone" dataKey="projected" name="Proyeksi" stroke="var(--income)" strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountdownChip({ endDate, today }: { endDate: string; today: string }) {
  const c = payoffCountdown(endDate, today);
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${c.late ? "bg-expense/15 text-expense" : "bg-income/15 text-income"}`}>{c.label}</span>;
}
