"use client";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { deleteTxAction, duplicateTxAction, restoreTxAction } from "@/lib/actions/transactions";
import { formatLongDate } from "@/lib/finance/date";
import type { TxView } from "@/lib/server/tx-list";
import { TxRow } from "@/components/tx-row";
import { Money } from "@/components/ui/money";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { PullToRefresh } from "@/components/pull-refresh";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";

export function TxList({ items, mode = "normal" }: { items: TxView[]; mode?: "normal" | "trash" }) {
  const groups = useMemo(() => {
    const m = new Map<string, TxView[]>();
    for (const t of items) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [items]);

  if (items.length === 0) {
    return mode === "trash" ? (
      <EmptyState icon="trash" title="Tidak ada transaksi terhapus dalam 30 hari terakhir." />
    ) : (
      <EmptyState icon="receipt" title="Belum ada transaksi yang cocok." />
    );
  }

  return (
    <PullToRefresh>
      <div className="space-y-3">
        {groups.map(([date, txs]) => {
          const net = txs.reduce((s, t) => s + (t.planned ? 0 : t.direction === "in" ? t.amount : t.direction === "out" ? -Math.abs(t.amount) : 0), 0);
          return (
            <section key={date} className="[content-visibility:auto] [contain-intrinsic-size:auto_200px]">
              <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 -mx-4 flex items-center justify-between bg-[var(--bg)]/90 px-4 py-1.5 text-caption">
                <span className="font-semibold text-muted">{formatLongDate(date)}</span>
                <Money value={net} sign tone="auto" className="font-semibold" />
              </div>
              <div className="overflow-hidden rounded-card bg-surface shadow-card">
                {txs.map((t, i) => (
                  <SwipeRow key={t.id} t={t} last={i === txs.length - 1} mode={mode} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PullToRefresh>
  );
}

function SwipeRow({ t, last, mode }: { t: TxView; last: boolean; mode: "normal" | "trash" }) {
  const x = useMotionValue(0);
  const leftBg = useTransform(x, [-120, -40, 0], [1, 0.6, 0]);
  const rightBg = useTransform(x, [0, 40, 120], [0, 0.6, 1]);
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [, start] = useTransition();
  const [gone, setGone] = useState(false);
  const dragged = useRef(false);

  const del = () =>
    start(async () => {
      const reason = undefined;
      const r = await deleteTxAction(t.id, reason);
      if (!r.ok) {
        animate(x, 0);
        if (r.locked) {
          const why = await askReason(r.error);
          if (why) {
            const r2 = await deleteTxAction(t.id, why);
            if (!r2.ok) return toast.error(r2.error);
            setGone(true);
            router.refresh();
          }
          return;
        }
        return toast.error(r.error);
      }
      setGone(true);
      toast.success("Transaksi dihapus", {
        label: "Urungkan",
        onClick: async () => {
          const u = await restoreTxAction(t.id);
          if (!u.ok) return toast.error(u.error);
          setGone(false);
          router.refresh();
        },
      });
      router.refresh();
    });

  const dup = () =>
    start(async () => {
      animate(x, 0);
      const r = await duplicateTxAction(t.id);
      if (!r.ok) return toast.error(r.error);
      toast.success("Transaksi diduplikat ke hari ini");
      router.refresh();
    });

  const restore = () =>
    start(async () => {
      const r = await restoreTxAction(t.id);
      if (!r.ok) {
        if (r.locked) {
          const why = await askReason(r.error);
          if (why) {
            const r2 = await restoreTxAction(t.id, why);
            if (!r2.ok) return toast.error(r2.error);
            setGone(true);
            router.refresh();
          }
          return;
        }
        return toast.error(r.error);
      }
      setGone(true);
      toast.success("Transaksi dipulihkan");
      router.refresh();
    });

  const askReason = async (message: string) => {
    const v = await confirm({ title: "Bulan ini sudah dikunci", message, tone: "primary", icon: "lock", confirmLabel: "Lanjut", input: { label: "Alasan perubahan", placeholder: "mis. salah catat", required: true } });
    return typeof v === "string" ? v : null;
  };

  if (gone) return null;

  if (mode === "trash") {
    return (
      <div className={`flex items-center gap-2 px-4 ${last ? "" : "border-b border-border/70"}`}>
        <div className="min-w-0 flex-1 opacity-70">
          <TxRow t={t} />
        </div>
        <button onClick={restore} className="pressable h-11 rounded-btn bg-primary-soft px-3 text-[13px] font-semibold text-primary">
          Pulihkan
        </button>
      </div>
    );
  }

  const canSwipe = !t.isFee;
  return (
    <div className={`relative ${last ? "" : "border-b border-border/70"}`}>
      {canSwipe && (
        <>
          <motion.div style={{ opacity: rightBg }} className="absolute inset-0 flex items-center bg-info/15 pl-5 text-info">
            <Icon name="copy" /> <span className="ml-2 text-[13px] font-semibold">Duplikat</span>
          </motion.div>
          <motion.div style={{ opacity: leftBg }} className="absolute inset-0 flex items-center justify-end bg-expense/15 pr-5 text-expense">
            <span className="mr-2 text-[13px] font-semibold">Hapus</span> <Icon name="trash" />
          </motion.div>
        </>
      )}
      <motion.div
        drag={canSwipe ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        style={{ x }}
        onDragStart={() => (dragged.current = true)}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault();
            e.stopPropagation();
            dragged.current = false;
          }
        }}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 50);
          if (info.offset.x < -100) del();
          else if (info.offset.x > 100) dup();
        }}
        className="relative bg-surface px-4"
      >
        <TxRow t={t} />
      </motion.div>
    </div>
  );
}
