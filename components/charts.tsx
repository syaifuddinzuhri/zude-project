"use client";
import { formatRp } from "@/lib/finance/money";
import { useHideAmount } from "./ui/money";

/** Tooltip grafik berbentuk kartu kaca kecil. */
export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[]; label?: string }) {
  const { hidden } = useHideAmount();
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-[12px] shadow-glass">
      {label && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name ?? p.payload?.name}</span>
          <span className="money ml-auto font-semibold">{hidden ? "Rp ••••••" : formatRp(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
