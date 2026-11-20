"use client";
import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Perpindahan halaman: fade. (Geser 8px dilakukan di <Page> agar header `fixed`
 * tidak ikut ter-transform.)
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <motion.div key={path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

export { useReducedMotion };
