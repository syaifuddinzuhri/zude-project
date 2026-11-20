import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = { suami: "#0EA5E9", istri: "#EC4899", bersama: "#14B8A6" };

export function Avatar({ name, label, size = 32, className }: { name: string; label: string; size?: number; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, background: COLORS[label] ?? "#94A3B8", fontSize: Math.round(size * 0.42) }}
      title={name}
    >
      {initial}
    </span>
  );
}

export function ownerColor(label: string) {
  return COLORS[label] ?? "#94A3B8";
}
