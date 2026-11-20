"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "./ui/icon";

/** Pull-to-refresh custom (overscroll bawaan dimatikan di body). */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [pending, startTransition] = useTransition();
  const TH = 70;
  return (
    <div
      onTouchStart={(e) => {
        start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (start.current == null) return;
        const d = e.touches[0].clientY - start.current;
        setPull(d > 0 ? Math.min(110, d * 0.5) : 0);
      }}
      onTouchEnd={() => {
        if (pull >= TH) startTransition(() => router.refresh());
        start.current = null;
        setPull(0);
      }}
    >
      <div className="flex items-center justify-center overflow-hidden text-muted transition-[height] duration-150" style={{ height: pending ? 40 : pull }} aria-hidden={!pending}>
        <Icon name="refresh-cw" size={20} className={pending ? "animate-spin" : ""} />
        <span className="ml-2 text-caption">{pending ? "Memuat…" : pull >= TH ? "Lepas untuk memuat ulang" : "Tarik untuk memuat ulang"}</span>
      </div>
      {children}
    </div>
  );
}
