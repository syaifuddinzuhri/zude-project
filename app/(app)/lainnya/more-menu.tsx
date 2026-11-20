"use client";
import Link from "next/link";
import { useAppData } from "@/components/app-data";
import { useInstallPrompt } from "@/components/pwa";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";

const MENU = [
  { href: "/tagihan", label: "Tagihan", icon: "calendar-clock" },
  { href: "/tabungan", label: "Tabungan", icon: "piggy-bank" },
  { href: "/hutang", label: "Hutang", icon: "landmark" },
  { href: "/akun", label: "Akun", icon: "wallet" },
  { href: "/aset", label: "Aset", icon: "gem" },
  { href: "/laporan", label: "Laporan", icon: "chart-column" },
  { href: "/tutup-buku", label: "Tutup Buku", icon: "book-check" },
  { href: "/log", label: "Log", icon: "history" },
  { href: "/pengaturan", label: "Pengaturan", icon: "settings" },
];

export function MoreMenu() {
  const d = useAppData();
  const { canInstall, install } = useInstallPrompt();
  return (
    <div className="space-y-4">
      <div className="hero flex items-center gap-4 rounded-card p-4">
        <div className="relative flex -space-x-3">
          <Avatar name={d.names.suami} label="suami" size={48} className="ring-white/60" />
          <Avatar name={d.names.istri} label="istri" size={48} className="ring-white/60" />
        </div>
        <div className="relative">
          <div className="text-[17px] font-bold">{d.names.suami} &amp; {d.names.istri}</div>
          <div className="text-[13px] text-white/85">{d.me.name}</div>
        </div>
      </div>

      {canInstall && (
        <Button block variant="hero" onClick={() => install()}>
          <Icon name="smartphone" /> Pasang di HP
        </Button>
      )}

      <Link href="/gajian" className="pressable flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="banknote" />
        </span>
        <div className="flex-1">
          <div className="font-semibold">Gaji / bonus masuk</div>
          <div className="text-caption text-muted">Catat & alokasikan otomatis</div>
        </div>
        <Icon name="chevron-right" className="text-muted" />
      </Link>

      <div className="grid grid-cols-3 gap-3">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href} className="pressable flex aspect-square flex-col items-center justify-center gap-2 rounded-card bg-surface shadow-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Icon name={m.icon} size={22} />
            </span>
            <span className="text-[13px] font-semibold">{m.label}</span>
          </Link>
        ))}
      </div>

      <form action={logoutAction}>
        <Button variant="ghost" block className="text-expense">
          <Icon name="log-out" /> Keluar
        </Button>
      </form>
    </div>
  );
}
