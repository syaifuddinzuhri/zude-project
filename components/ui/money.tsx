"use client";
import { animate, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { HIDDEN, formatRp, formatRpShort } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

const HideCtx = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

export function HideAmountProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("zude:hide") === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setHidden((h) => {
      try {
        localStorage.setItem("zude:hide", h ? "0" : "1");
      } catch {}
      return !h;
    });
  return <HideCtx.Provider value={{ hidden, toggle }}>{children}</HideCtx.Provider>;
}

export const useHideAmount = () => useContext(HideCtx);

type Tone = "income" | "expense" | "auto" | "none";

export function Money({
  value,
  short,
  sign,
  tone = "none",
  className,
  countUp,
}: {
  value: number;
  short?: boolean;
  sign?: boolean;
  tone?: Tone;
  className?: string;
  countUp?: boolean;
}) {
  const { hidden } = useHideAmount();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (!countUp || reduce) {
      setShown(value);
      prev.current = value;
      return;
    }
    const from = prev.current === value ? 0 : prev.current;
    const c = animate(from, value, { duration: 0.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value, countUp, reduce]);

  const toneClass =
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : tone === "auto" ? (value < 0 ? "text-expense" : value > 0 ? "text-income" : "") : "";
  const text = hidden ? HIDDEN : short ? formatRpShort(shown) : formatRp(shown, { sign });
  return <span className={cn("money whitespace-nowrap", toneClass, className)}>{text}</span>;
}

/** Nominal transaksi dengan tanda +/− dan warna sesuai arah. */
export function TxAmount({ amount, direction, className }: { amount: number; direction: "in" | "out" | "neutral"; className?: string }) {
  const { hidden } = useHideAmount();
  if (hidden) return <span className={cn("money font-semibold", className)}>{HIDDEN}</span>;
  const abs = formatRp(Math.abs(amount)).replace("−", "");
  return (
    <span className={cn("money whitespace-nowrap font-semibold", direction === "in" ? "text-income" : direction === "out" ? "text-expense" : "text-info", className)}>
      {direction === "in" ? "+" : direction === "out" ? "−" : ""}
      {abs}
    </span>
  );
}
