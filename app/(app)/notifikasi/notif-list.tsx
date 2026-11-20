"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markNotificationsReadAction } from "@/lib/actions/settings";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const ICON: Record<string, string> = { bill_due: "calendar-clock", budget_threshold: "chart-pie", big_expense: "alert", payday: "banknote", close_book: "book-check", goal_behind: "piggy-bank", daily_reminder: "pencil", test: "bell-ring" };

export function NotifList({ items }: { items: { id: number; title: string; body: string; url: string | null; type: string; read: boolean; at: string }[] }) {
  const router = useRouter();
  useEffect(() => {
    if (items.some((i) => !i.read)) markNotificationsReadAction().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (items.length === 0) return <EmptyState icon="bell" title="Belum ada notifikasi." />;
  return (
    <Card className="divide-y divide-border/70 py-1">
      {items.map((n) => (
        <Link key={n.id} href={n.url ?? "/"} className={cn("flex min-h-[64px] gap-3 py-2.5", !n.read && "font-semibold")}>
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", n.read ? "bg-bg text-muted" : "bg-primary-soft text-primary")}>
            <Icon name={ICON[n.type] ?? "bell"} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px]">{n.title}</div>
            <div className="text-caption font-normal text-muted">{n.body}</div>
            <div className="text-[11px] font-normal text-muted">{new Date(n.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</div>
          </div>
          {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-primary" aria-label="Belum dibaca" />}
        </Link>
      ))}
    </Card>
  );
}
