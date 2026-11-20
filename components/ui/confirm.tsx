"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = tombol merah (hapus), primary = tombol utama */
  tone?: "danger" | "primary";
  icon?: string;
  /** Minta isian teks (mis. alasan perubahan bulan terkunci). Hasil confirm berupa string. */
  input?: { label: string; placeholder?: string; required?: boolean };
}

type Resolver = (v: boolean | string) => void;

const Ctx = createContext<((o: ConfirmOptions) => Promise<boolean | string>) | null>(null);

/**
 * Popup konfirmasi (pengganti window.confirm / window.prompt).
 * - `await confirm({...})` → `true`/`false`
 * - dengan `input` → string isian, atau `false` bila dibatalkan
 */
export function useConfirm() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConfirm di luar ConfirmProvider");
  return v;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const resolver = useRef<Resolver | null>(null);
  const reduce = useReducedMotion();

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    setText("");
    setOpen(true);
    return new Promise<boolean | string>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean | string) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  };

  const needsText = Boolean(opts?.input?.required);
  const canConfirm = !needsText || text.trim().length > 0;
  const submit = () => {
    if (!canConfirm) return;
    close(opts?.input ? text.trim() : true);
  };
  const danger = (opts?.tone ?? "danger") === "danger";

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog.Root open={open} onOpenChange={(v) => !v && close(false)}>
        <AnimatePresence>
          {open && opts && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[80] bg-[var(--overlay)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                />
              </Dialog.Overlay>
              <div className="fixed-col pointer-events-none inset-y-0 z-[81] flex items-center justify-center px-6">
                <Dialog.Content
                  asChild
                  forceMount
                  role="alertdialog"
                  aria-describedby={opts.message ? "confirm-desc" : undefined}
                  // Fokus ke tombol batal (aman), bukan ke isian — keyboard HP tidak terbuka otomatis
                  onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus({ preventScroll: true });
                  }}
                >
                  <motion.div
                    className="pointer-events-auto w-full max-w-[340px] rounded-card border border-border bg-[var(--surface-solid-95)] p-5 shadow-glass outline-none backdrop-blur-xl"
                    initial={{ opacity: 0, scale: reduce ? 1 : 0.94, y: reduce ? 0 : 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                    transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                      }}
                    >
                      <div className="mb-3 flex justify-center">
                        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", danger ? "bg-expense/15 text-expense" : "bg-primary-soft text-primary")}>
                          <Icon name={opts.icon ?? (danger ? "trash" : "info")} size={22} />
                        </span>
                      </div>
                      <Dialog.Title className="text-center text-h2">{opts.title}</Dialog.Title>
                      {opts.message && (
                        <Dialog.Description id="confirm-desc" className="mt-1.5 text-center text-[14px] leading-5 text-muted">
                          {opts.message}
                        </Dialog.Description>
                      )}
                      {opts.input && (
                        <label className="mt-4 block text-left">
                          <span className="mb-1.5 block text-caption text-muted">{opts.input.label}</span>
                          <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={opts.input.placeholder}
                            maxLength={255}
                            className="h-12 w-full min-w-0 rounded-btn border border-border bg-surface px-3.5 text-input text-text outline-none placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/40"
                          />
                        </label>
                      )}
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Button type="button" variant="secondary" data-cancel onClick={() => close(false)}>
                          {opts.cancelLabel ?? "Batal"}
                        </Button>
                        <Button type="submit" variant={danger ? "destructive" : "primary"} disabled={!canConfirm}>
                          {opts.confirmLabel ?? (danger ? "Hapus" : "Lanjut")}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                </Dialog.Content>
              </div>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
