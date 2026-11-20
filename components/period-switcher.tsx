import Link from "next/link";
import { Icon } from "./ui/icon";
import { formatRange } from "@/lib/finance/date";

/** Chip periode siklus ("25 Nov – 24 Des"), bisa geser ke bulan lain. */
export function PeriodSwitcher({ period, offset, basePath, extra }: { period: { start: string; end: string }; offset: number; basePath: string; extra?: Record<string, string> }) {
  const href = (o: number) => {
    const p = new URLSearchParams(extra);
    if (o !== 0) p.set("p", String(o));
    const q = p.toString();
    return `${basePath}${q ? `?${q}` : ""}`;
  };
  return (
    <div className="flex items-center justify-center gap-1">
      <Link href={href(offset - 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-full text-muted" aria-label="Siklus sebelumnya">
        <Icon name="chevron-left" />
      </Link>
      <Link href={href(0)} className="pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-[13px] font-semibold shadow-card">
        <Icon name="calendar" size={16} className="text-primary" />
        {formatRange(period.start, period.end)}
        {offset !== 0 && <span className="text-[11px] text-primary">· kembali</span>}
      </Link>
      <Link href={href(offset + 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-full text-muted" aria-label="Siklus berikutnya">
        <Icon name="chevron-right" />
      </Link>
    </div>
  );
}
