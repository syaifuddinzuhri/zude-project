"use client";
import { useMemo, useState } from "react";
import { compareStrategies, type StrategyDebt } from "@/lib/finance/strategy";
import { addMonths, formatMonthYear, todayJakarta } from "@/lib/finance/date";
import { formatRateBp } from "@/lib/finance/money";
import { Card } from "@/components/ui/card";
import { Field, MoneyInput } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function Simulator({ debts }: { debts: StrategyDebt[] }) {
  const [extra, setExtra] = useState(500_000);
  const r = useMemo(() => compareStrategies(debts, extra), [debts, extra]);
  if (debts.length === 0) return <EmptyState icon="landmark" title="Tidak ada hutang aktif untuk disimulasikan." />;
  const today = todayJakarta();
  const when = (m: number) => formatMonthYear(addMonths(today, m));
  const better = r.avalanche.totalInterest <= r.snowball.totalInterest ? "avalanche" : "snowball";
  const cols = [
    { key: "snowball" as const, title: "Snowball", desc: "Saldo terkecil dulu — cepat terasa menang", res: r.snowball },
    { key: "avalanche" as const, title: "Avalanche", desc: "Bunga tertinggi dulu — paling hemat bunga", res: r.avalanche },
  ];
  return (
    <div className="space-y-3">
      <Card>
        <Field label="Dana ekstra per bulan" hint="Di luar cicilan minimum semua hutang">
          <MoneyInput value={extra} onChange={setExtra} />
        </Field>
        <div className="text-caption text-muted">
          Tanpa dana ekstra: lunas {when(r.baseline.months)} · bunga <Money value={r.baseline.totalInterest} short />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {cols.map((c) => (
          <Card key={c.key} className={cn(c.key === better && "ring-2 ring-income")}>
            <div className="text-[15px] font-bold">{c.title}</div>
            <div className="mb-2 text-[11px] leading-tight text-muted">{c.desc}</div>
            <div className="text-caption text-muted">Total bunga</div>
            <Money value={c.res.totalInterest} short className="text-[16px] font-bold" />
            <div className="mt-1 text-caption text-muted">Lunas</div>
            <div className="text-[14px] font-semibold">{c.res.feasible ? when(c.res.months) : "> 50 tahun"}</div>
            <div className="text-caption text-income">hemat <Money value={r.baseline.totalInterest - c.res.totalInterest} short /> · {r.baseline.months - c.res.months} bln lebih cepat</div>
            {c.key === better && <div className="mt-1 text-[11px] font-bold text-income">✓ Paling hemat</div>}
          </Card>
        ))}
      </div>
      <Card>
        <div className="mb-2 text-[14px] font-semibold">Urutan pelunasan</div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          {cols.map((c) => (
            <ol key={c.key} className="space-y-1.5">
              <li className="text-caption font-semibold text-muted">{c.title}</li>
              {c.res.order.map((id, i) => {
                const d = debts.find((x) => x.id === id)!;
                return (
                  <li key={id}>
                    <b>{i + 1}.</b> {d.name}
                    <div className="text-[11px] text-muted">{formatRateBp(d.rateBp)} · lunas {when(c.res.payoffMonth[id] ?? 0)}</div>
                  </li>
                );
              })}
            </ol>
          ))}
        </div>
      </Card>
      <p className="text-caption text-muted">Simulasi bulanan: bunga dihitung dari saldo (efektif), cicilan minimum dibayar, lalu dana ekstra + cicilan dari hutang yang sudah lunas dialirkan ke target.</p>
    </div>
  );
}
