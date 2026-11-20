"use client";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet kaca (blur 24px, radius atas 28px, handle), bisa di-drag untuk menutup.
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  full?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)]" />
        <Drawer.Content
          className={cn(
            "fixed-col glass-24 bottom-0 z-[61] flex flex-col rounded-t-sheet border-t border-border-glass shadow-glass outline-none",
            full ? "h-[calc(100dvh-env(safe-area-inset-top)-12px)]" : "max-h-[90dvh]",
          )}
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted/40" aria-hidden />
          {title ? (
            <Drawer.Title className="px-5 pb-2 pt-3 text-h2">{title}</Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Lembar</Drawer.Title>
          )}
          {description && <Drawer.Description className="px-5 pb-2 text-caption text-muted">{description}</Drawer.Description>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4" data-vaul-no-drag={full ? "" : undefined}>
            {children}
          </div>
          {footer && <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">{footer}</div>}
          {!footer && <div className="pb-safe" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
