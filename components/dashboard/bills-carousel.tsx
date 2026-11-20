"use client";
import Link from "next/link";
import { Money } from "../ui/money";
import { Icon } from "../ui/icon";
import { formatShortDate, todayJakarta } from "@/lib/finance/date";
import { daysUntil } from "@/lib/finance/recurring";
import type { BillItem } from "@/lib/server/recurring";
import { cn } from "@/lib/utils";

export function BillsCarousel({ bills }: { bills: BillItem[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-h2">Tagihan 7 hari</h2>
        <Link href="/tagihan" className="text-[13px] font-semibold text-primary">Kalender</Link>
      </div>
      {bills.length === 0 ? (
        <div className="rounded-card bg-surface p-4 text-caption text-muted shadow-card">Tidak ada tagihan dalam 7 hari ke depan ✓</div>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {bills.map((b) => {
            const h = daysUntil(todayJakarta(), b.dueDate);
            const href = b.kind === "debt" ? `/hutang/${b.debtId}?bayar=${b.scheduleId}` : `/tagihan?bayar=${encodeURIComponent(b.key)}`;
            return (
              <Link key={b.key} href={href} className="w-[180px] shrink-0 snap-start rounded-card bg-surface p-3.5 shadow-card">
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", b.status === "late" ? "bg-expense/15 text-expense" : "bg-warning/15 text-warning")}>
                    <Icon name={b.kind === "debt" ? "landmark" : "receipt"} size={16} />
                  </span>
                  <span className={cn("text-[11px] font-bold", b.status === "late" ? "text-expense" : "text-warning")}>
                    {b.status === "late" ? "TERLAMBAT" : h <= 0 ? "HARI INI" : `H-${h}`}
                  </span>
                </div>
                <div className="truncate text-[14px] font-semibold">{b.name}</div>
                <Money value={b.amount} className="text-[15px] font-bold" />
                <div className="text-caption text-muted">{formatShortDate(b.dueDate)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
