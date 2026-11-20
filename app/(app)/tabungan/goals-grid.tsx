"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GoalView } from "@/lib/server/goals";
import { formatDate } from "@/lib/finance/date";
import { GoalForm } from "@/components/goal-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { Ring } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";

export function GoalsGrid({ goals, openNew }: { goals: GoalView[]; openNew: boolean }) {
  const [open, setOpen] = useState(openNew);
  const router = useRouter();
  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  return (
    <div className="space-y-3">
      <Card className="hero text-white">
        <div className="relative">
          <div className="text-[13px] text-white/80">Total terkumpul</div>
          <Money value={saved} countUp className="text-display" />
          <div className="text-[13px] text-white/85">dari target <Money value={target} short /></div>
        </div>
      </Card>
      <Button block onClick={() => setOpen(true)}>
        <Icon name="plus" /> Tujuan baru
      </Button>
      {goals.length === 0 ? (
        <EmptyState icon="target" title="Belum ada tujuan tabungan. Mulai dari Dana Darurat." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {goals.map((g) => (
            <Link key={g.id} href={`/tabungan/${g.id}`} className="pressable flex flex-col items-center rounded-card bg-surface p-4 text-center shadow-card">
              <Ring value={g.progress} size={84} stroke={8} color={g.achieved ? "var(--income)" : g.onTrack ? "var(--primary)" : "var(--warning)"}>
                <span className="text-3xl">{g.icon}</span>
              </Ring>
              <div className="mt-2 line-clamp-1 text-[14px] font-semibold">{g.name}</div>
              <div className="text-caption text-muted">
                <Money value={g.saved} short /> / <Money value={g.target} short />
              </div>
              <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${g.achieved ? "bg-income/15 text-income" : g.onTrack ? "bg-primary-soft text-primary" : "bg-warning/15 text-warning"}`}>
                {g.achieved ? "Tercapai 🎉" : g.onTrack ? "On track" : "Tertinggal"}
              </span>
              {g.targetDate && <div className="mt-1 text-[11px] text-muted">{formatDate(g.targetDate)}</div>}
            </Link>
          ))}
        </div>
      )}
      <BottomSheet open={open} onOpenChange={setOpen} title="Tujuan baru">
        {open && <GoalForm onDone={(id) => { setOpen(false); router.push(`/tabungan/${id}`); }} />}
      </BottomSheet>
    </div>
  );
}
