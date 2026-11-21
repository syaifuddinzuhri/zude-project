"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markNotificationsReadAction } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const ICON: Record<string, string> = { bill_due: "calendar-clock", budget_threshold: "chart-pie", big_expense: "alert", payday: "banknote", close_book: "book-check", goal_behind: "piggy-bank", daily_reminder: "pencil", test: "bell-ring" };

function clearAppBadge() {
  try {
    (navigator as unknown as { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
  } catch {}
}

export function NotifList({ items }: { items: { id: number; title: string; body: string; url: string | null; type: string; read: boolean; at: string }[] }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState(() => new Set(items.filter((i) => i.read).map((i) => i.id)));
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !readIds.has(i.id)).length;

  // Ketuk satu notifikasi = tandai yang itu saja
  const markOne = (id: number) => {
    if (readIds.has(id)) return;
    setReadIds((s) => new Set(s).add(id));
    if (unread === 1) clearAppBadge();
    markNotificationsReadAction([id]).catch(() => {});
  };

  const markAll = () =>
    start(async () => {
      await markNotificationsReadAction();
      setReadIds(new Set(items.map((i) => i.id)));
      clearAppBadge();
      router.refresh();
    });

  if (items.length === 0) return <EmptyState icon="bell" title="Belum ada notifikasi." />;
  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption text-muted">{unread} belum dibaca</span>
          <Button size="sm" variant="secondary" loading={pending} onClick={markAll}>
            <Icon name="check" size={16} /> Tandai semua dibaca
          </Button>
        </div>
      )}
      <Card className="divide-y divide-border/70 py-1">
        {items.map((n) => {
          const read = readIds.has(n.id);
          return (
            <Link key={n.id} href={n.url ?? "/"} onClick={() => markOne(n.id)} className={cn("flex min-h-[64px] gap-3 py-2.5", !read && "font-semibold")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", read ? "bg-bg text-muted" : "bg-primary-soft text-primary")}>
                <Icon name={ICON[n.type] ?? "bell"} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px]">{n.title}</div>
                <div className="text-caption font-normal text-muted">{n.body}</div>
                <div className="text-[11px] font-normal text-muted">{new Date(n.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</div>
              </div>
              {!read && <span className="mt-2 h-2 w-2 rounded-full bg-primary" aria-label="Belum dibaca" />}
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
