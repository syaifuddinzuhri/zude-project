"use client";
import { createContext, useContext } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/** True bila komponen berada di dalam bottom sheet (untuk sheet bertingkat). */
export const InSheetContext = createContext(false);
export const useInSheet = () => useContext(InSheetContext);

/**
 * Bottom sheet kaca (blur 24px, radius atas 28px). Ditutup dengan menarik pegangan,
 * mengetuk latar, atau Esc — isi sheet bebas di-scroll tanpa ikut tertutup.
 * Terkunci di lebar kolom 430px.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  full,
  footer,
  description,
  bare,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  full?: boolean;
  footer?: React.ReactNode;
  /** Isi mengatur scroll & footer sendiri (body tidak di-scroll, tanpa padding). */
  bare?: boolean;
}) {
  const nested = useInSheet();
  const Root = nested ? Drawer.NestedRoot : Drawer.Root;
  return (
    <Root open={open} onOpenChange={onOpenChange} repositionInputs={false} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)]" />
        <Drawer.Content
          className={cn(
            "fixed-col glass-24 bottom-0 z-[61] flex flex-col rounded-t-sheet border-t border-border-glass shadow-glass outline-none",
            // Tidak sampai ke atas: tinggi maks 88% layar (dan ≥ 56px dari notch); isinya di-scroll
            full ? "h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-56px))]" : "max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-64px))]",
          )}
          aria-describedby={undefined}
        >
          {/* Tarik pegangan ini untuk menutup (konten bebas di-scroll tanpa ikut menutup sheet) */}
          <Drawer.Handle className="mt-3 shrink-0 !h-1.5 !w-10 !bg-[var(--text-muted)] !opacity-40" />
          {title ? (
            <Drawer.Title className="px-5 pb-2 pt-3 text-h2">{title}</Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Lembar</Drawer.Title>
          )}
          {description && <Drawer.Description className="px-5 pb-2 text-caption text-muted">{description}</Drawer.Description>}
          <div className={cn("min-h-0 flex-1", bare ? "flex flex-col" : "sheet-scroll overflow-y-auto px-5 pb-4")}>
            <InSheetContext.Provider value={true}>{children}</InSheetContext.Provider>
          </div>
          {footer && <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2"><InSheetContext.Provider value={true}>{footer}</InSheetContext.Provider></div>}
          {!footer && !bare && <div className="pb-safe" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Root>
  );
}
