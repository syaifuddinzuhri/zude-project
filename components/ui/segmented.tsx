"use client";
import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "md" | "sm";
}) {
  const id = useId();
  return (
    <div className={cn("flex rounded-full bg-border/60 p-1", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn("relative flex-1 rounded-full px-3 font-semibold transition-colors", size === "md" ? "h-10 text-[14px]" : "h-9 text-[13px]", active ? "text-text" : "text-muted")}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-surface shadow-card" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold",
        active ? "border-transparent bg-primary text-on-primary" : "border-border bg-surface text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
