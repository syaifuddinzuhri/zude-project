"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const statusColor = { green: "var(--income)", yellow: "var(--warning)", red: "var(--expense)" } as const;

export function ProgressBar({ value, status, color, className }: { value: number; status?: keyof typeof statusColor; color?: string; className?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1)) * 100;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-border/70", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color ?? (status ? statusColor[status] : "var(--primary)") }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

/** Cincin progres untuk tujuan tabungan. */
export function Ring({ value, size = 64, stroke = 7, color = "var(--primary)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-caption">{children}</div>
    </div>
  );
}

/** Gauge setengah lingkaran untuk DSR (0–60%, garis aman 30%). */
export function Gauge({ value, size = 120, max = 0.6 }: { value: number; size?: number; max?: number }) {
  const reduce = useReducedMotion();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const half = Math.PI * r;
  const v = Math.max(0, Math.min(1, value / max));
  const color = value > 0.3 ? "var(--expense)" : value > 0.25 ? "var(--warning)" : "var(--income)";
  return (
    <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} aria-label={`DSR ${Math.round(value * 100)}%`}>
      <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} stroke="var(--border)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      <motion.path
        d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={half}
        initial={reduce ? false : { strokeDashoffset: half }}
        animate={{ strokeDashoffset: half * (1 - v) }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </svg>
  );
}
