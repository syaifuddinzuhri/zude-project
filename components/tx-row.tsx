"use client";
import Link from "next/link";
import { CategoryIcon } from "./ui/icon";
import { TxAmount } from "./ui/money";
import { Avatar } from "./ui/avatar";
import type { TxView } from "@/lib/server/tx-list";
import { cn } from "@/lib/utils";

export function TxRow({ t, className }: { t: TxView; className?: string }) {
  return (
    <Link href={`/transaksi/${t.id}`} className={cn("flex min-h-[64px] items-center gap-3 py-2", className)}>
      <CategoryIcon icon={t.icon} color={t.color} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">
          {t.title}
          {t.planned && <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">TERENCANA</span>}
        </div>
        <div className="flex items-center gap-1.5 truncate text-caption text-muted">
          <Avatar name={t.by} label={t.byLabel} size={16} className="ring-0" />
          <span className="truncate">
            {t.toAccount ? `${t.account} → ${t.toAccount}` : t.account}
            {t.note ? ` · ${t.note}` : ""}
          </span>
        </div>
      </div>
      <TxAmount amount={t.amount} direction={t.direction} className="text-[15px]" />
    </Link>
  );
}
