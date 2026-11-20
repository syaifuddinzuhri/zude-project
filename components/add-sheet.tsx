"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet } from "./ui/bottom-sheet";
import { TransactionForm } from "./transaction-form";
import { useAddSheet, type TxKind } from "./add-sheet-context";

export function AddSheet() {
  const { state, close, open } = useAddSheet();
  const [nonce, setNonce] = useState(0);
  const wasOpen = useRef(false);
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (state.open && !wasOpen.current) setNonce((n) => n + 1);
    wasOpen.current = state.open;
  }, [state.open]);

  // Deep link dari notifikasi: /?tambah=expense
  useEffect(() => {
    const t = params.get("tambah") as TxKind | null;
    if (t) {
      open({ type: t });
      const url = new URL(window.location.href);
      url.searchParams.delete("tambah");
      router.replace(url.pathname + url.search);
    }
  }, [params, open, router]);

  return (
    <BottomSheet open={state.open} onOpenChange={(v) => (v ? null : close())} full bare>
      {state.open && (
        <TransactionForm
          key={nonce}
          initial={{
            type: state.preset.type ?? "expense",
            debtId: state.preset.debtId,
            scheduleId: state.preset.scheduleId,
            goalId: state.preset.goalId,
            amount: state.preset.amount,
            accountId: state.preset.accountId,
          }}
          onDone={close}
        />
      )}
    </BottomSheet>
  );
}
