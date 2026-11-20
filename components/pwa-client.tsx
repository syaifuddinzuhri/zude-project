"use client";
import { useEffect } from "react";
import { useToast } from "./ui/toast";

/** Daftarkan service worker, tawarkan muat ulang saat ada versi baru, bersihkan badge saat dibuka. */
export function PwaClient() {
  const toast = useToast();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SW_DEV) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      const offer = (w: ServiceWorker) =>
        toast.show("Versi baru tersedia", { action: { label: "Muat ulang", onClick: () => w.postMessage("SKIP_WAITING") }, duration: 15000 });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
        });
      });
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const clear = () => {
      try {
        (navigator as unknown as { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
      } catch {}
    };
    clear();
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && clear());
  }, []);
  return null;
}
