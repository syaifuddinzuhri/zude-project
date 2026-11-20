"use client";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./icon";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastApi {
  show: (message: string, opts?: { tone?: ToastItem["tone"]; action?: ToastItem["action"]; duration?: number }) => void;
  success: (message: string, action?: ToastItem["action"]) => void;
  error: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast di luar ToastProvider");
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback<ToastApi["show"]>(
    (message, opts = {}) => {
      const id = ++seq.current;
      const duration = opts.duration ?? (opts.action ? 5000 : 2800);
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts.tone ?? "info", action: opts.action, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const api: ToastApi = {
    show,
    success: (m, action) => show(m, { tone: "success", action }),
    error: (m) => show(m, { tone: "error", duration: 4000 }),
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed-col pointer-events-none top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="glass pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-glass"
              role="status"
            >
              <span className={t.tone === "error" ? "text-expense" : t.tone === "success" ? "text-income" : "text-info"}>
                <Icon name={t.tone === "error" ? "alert" : t.tone === "success" ? "circle-check" : "info"} />
              </span>
              <span className="flex-1 text-[14px] font-medium">{t.message}</span>
              {t.action && (
                <button
                  className="min-h-[44px] px-2 text-[14px] font-bold text-primary"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
