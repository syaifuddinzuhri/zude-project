"use client";
import { Money } from "../ui/money";
import { Icon } from "../ui/icon";
import { formatShortDate } from "@/lib/finance/date";

export function HeroCard(p: { available: number; left: number; perDay: number; daysLeft: number; income: number; expense: number; nextPayday: string; isCurrent: boolean }) {
  return (
    <section className="hero rounded-card p-5 shadow-fab">
      <div className="relative">
        <div className="text-[13px] font-medium text-white/80">Saldo tersedia</div>
        <Money value={p.available} countUp className="text-display" />
        <div className="mt-1 text-[13px] text-white/85">
          {p.isCurrent ? (
            <>
              Sisa <Money value={p.left} short className="font-semibold text-white" /> sampai gajian ({formatShortDate(p.nextPayday)}) ·{" "}
              <Money value={p.perDay} short className="font-semibold text-white" />/hari · {p.daysLeft} hari lagi
            </>
          ) : (
            <>Sisa siklus ini <Money value={p.left} short className="font-semibold text-white" /></>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="glass-sub rounded-2xl p-3">
            <div className="flex items-center gap-1 text-[12px] text-white/85">
              <Icon name="arrow-down-left" size={14} /> Masuk bulan ini
            </div>
            <Money value={p.income} short className="text-[16px] font-bold" />
          </div>
          <div className="glass-sub rounded-2xl p-3">
            <div className="flex items-center gap-1 text-[12px] text-white/85">
              <Icon name="arrow-up-right" size={14} /> Keluar bulan ini
            </div>
            <Money value={p.expense} short className="text-[16px] font-bold" />
          </div>
        </div>
      </div>
    </section>
  );
}
