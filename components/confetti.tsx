"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["#14B8A6", "#6366F1", "#F59E0B", "#EC4899", "#0EA5E9", "#84CC16"];

/** Confetti singkat untuk merayakan tujuan tercapai / hutang lunas. */
export function Confetti({ fire }: { fire: boolean }) {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!fire || reduce) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 1600);
    return () => clearTimeout(t);
  }, [fire, reduce]);
  if (!on) return null;
  return (
    <div className="fixed-col pointer-events-none inset-y-0 z-[90] overflow-hidden" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => {
        const x = (i * 37) % 100;
        return (
          <motion.span
            key={i}
            className="absolute top-0 block h-2.5 w-1.5 rounded-sm"
            style={{ left: `${x}%`, background: COLORS[i % COLORS.length] }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{ y: 700 + (i % 5) * 60, rotate: 360 + i * 20, x: ((i % 7) - 3) * 18, opacity: 0 }}
            transition={{ duration: 1.4 + (i % 4) * 0.1, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
