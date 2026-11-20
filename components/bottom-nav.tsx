"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "./ui/icon";
import { useAddSheet } from "./add-sheet-context";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Beranda", icon: "house" },
  { href: "/transaksi", label: "Transaksi", icon: "receipt" },
  null,
  { href: "/anggaran", label: "Anggaran", icon: "chart-pie" },
  { href: "/lainnya", label: "Lainnya", icon: "layout-grid" },
] as const;

const MORE = ["/lainnya", "/tagihan", "/tabungan", "/hutang", "/akun", "/aset", "/laporan", "/tutup-buku", "/log", "/pengaturan", "/gajian", "/notifikasi"];

export function BottomNav() {
  const path = usePathname();
  const { open } = useAddSheet();
  const activeHref =
    path === "/" ? "/" : path.startsWith("/transaksi") ? "/transaksi" : path.startsWith("/anggaran") ? "/anggaran" : MORE.some((m) => path.startsWith(m)) ? "/lainnya" : "";
  return (
    <nav className="fixed-col no-print bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]" aria-label="Navigasi utama">
      <div className="glass relative flex h-[68px] items-stretch rounded-nav px-1 shadow-glass">
        {ITEMS.map((it) =>
          it === null ? (
            <div key="fab" className="flex flex-1 items-start justify-center">
              <button
                onClick={() => open({ type: "expense" })}
                className="pressable -mt-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-fab [background:var(--hero)]"
                aria-label="Tambah transaksi"
              >
                <Icon name="plus" size={28} strokeWidth={2.25} />
              </button>
            </div>
          ) : (
            <Link key={it.href} href={it.href} className="relative flex flex-1 flex-col items-center justify-center gap-0.5" aria-current={activeHref === it.href ? "page" : undefined}>
              {activeHref === it.href && (
                <motion.span layoutId="nav-pill" className="absolute inset-x-1.5 inset-y-2 rounded-2xl bg-primary-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className={cn("relative", activeHref === it.href ? "text-primary" : "text-muted")}>
                <Icon name={it.icon} size={24} strokeWidth={activeHref === it.href ? 2.25 : 1.75} fill={activeHref === it.href ? "currentColor" : "none"} fillOpacity={0.2} />
              </span>
              <span className={cn("relative text-[11px] font-semibold", activeHref === it.href ? "text-primary" : "text-muted")}>{it.label}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
