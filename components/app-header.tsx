"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./ui/icon";
import { useHideAmount } from "./ui/money";
import { useAppData } from "./app-data";
import { cn } from "@/lib/utils";

/** Header: transparan di atas, menjadi kaca (blur 16px) setelah scroll > 8px. */
export function AppHeader({ title, subtitle, back, actions, large }: { title: string; subtitle?: React.ReactNode; back?: string | boolean; actions?: React.ReactNode; large?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const { hidden, toggle } = useHideAmount();
  const { unread } = useAppData();
  const router = useRouter();
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <header
      className={cn(
        "fixed-col no-print top-0 z-40 pt-safe transition-[background,box-shadow,border-color] duration-200",
        scrolled ? "glass-16 border-b border-border/60" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="flex min-h-[56px] items-center gap-2 px-4">
        {back && (
          <button
            onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
            className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full"
            aria-label="Kembali"
          >
            <Icon name="chevron-left" size={24} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {subtitle && <div className="truncate text-caption text-muted">{subtitle}</div>}
          <h1 className={cn("truncate", large ? "text-h1" : "text-h2")}>{title}</h1>
        </div>
        {actions}
        <button onClick={toggle} className="pressable flex h-11 w-11 items-center justify-center rounded-full" aria-label={hidden ? "Tampilkan nominal" : "Sembunyikan nominal"}>
          <Icon name={hidden ? "eye-off" : "eye"} />
        </button>
        <Link href="/notifikasi" className="pressable relative flex h-11 w-11 items-center justify-center rounded-full" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}>
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-expense px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/** Kontainer konten: padding atas = tinggi header, bawah = tinggi nav + 24px. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.main
      initial={{ y: reduce ? 0 : 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("px-4 pb-[calc(env(safe-area-inset-bottom)+120px)] pt-[calc(env(safe-area-inset-top)+68px)]", className)}
    >
      {children}
    </motion.main>
  );
}
