"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { logoutAction, unlockAction } from "@/lib/actions/auth";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function PinPad({ name, next }: { name: string; next?: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (value: string) =>
    start(async () => {
      const r = await unlockAction(value, next);
      if (!r.ok) {
        setError(r.error);
        setPin("");
        setShake((s) => s + 1);
        if (r.error.includes("password")) setTimeout(() => router.replace("/login"), 1200);
        return;
      }
      router.replace(r.next ?? "/");
      router.refresh();
    });

  const press = (k: string) => {
    if (pending) return;
    setError(null);
    if (k === "back") return setPin((p) => p.slice(0, -1));
    if (k === "ok") return pin.length >= 4 && submit(pin);
    if (pin.length >= 6) return;
    const v = pin + k;
    setPin(v);
    if (v.length === 6) submit(v);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="flex flex-col items-center">
      <img src="/icon-192.png" alt="" width={64} height={64} className="mb-4 h-16 w-16 rounded-2xl shadow-fab" />
      <h1 className="text-h1">Halo, {name}</h1>
      <p className="mb-6 text-caption text-muted">Masukkan PIN untuk membuka ZuDe</p>
      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.35 }} className="mb-3 flex h-6 gap-3" aria-label={`${pin.length} digit dimasukkan`}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={cn("h-3.5 w-3.5 rounded-full border-2 border-primary", i < pin.length && "bg-primary")} />
        ))}
      </motion.div>
      <p className="mb-4 min-h-[20px] text-[14px] font-medium text-expense" role="alert">{error}</p>
      <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"].map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={cn("pressable flex h-16 items-center justify-center rounded-full text-[24px] font-semibold", k === "ok" ? "bg-primary text-on-primary" : k === "back" ? "text-muted" : "bg-surface shadow-card")}
            aria-label={k === "back" ? "Hapus" : k === "ok" ? "Buka" : k}
          >
            {k === "back" ? <Icon name="delete" size={24} /> : k === "ok" ? <Icon name="check" size={26} /> : k}
          </button>
        ))}
      </div>
      <form action={logoutAction}>
        <button className="mt-8 min-h-[44px] text-[14px] font-semibold text-muted">Lupa PIN? Masuk dengan password</button>
      </form>
    </div>
  );
}
