"use client";
import { createContext, useCallback, useContext, useState } from "react";

export type TxKind = "expense" | "income" | "transfer" | "debt_payment" | "saving_deposit";

export interface AddPreset {
  type?: TxKind;
  debtId?: number;
  scheduleId?: number;
  goalId?: number;
  amount?: number;
  accountId?: number;
}

const Ctx = createContext<{ open: (p?: AddPreset) => void; state: { open: boolean; preset: AddPreset }; close: () => void } | null>(null);

export function AddSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; preset: AddPreset }>({ open: false, preset: {} });
  const open = useCallback((preset: AddPreset = {}) => setState({ open: true, preset }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return <Ctx.Provider value={{ open, state, close }}>{children}</Ctx.Provider>;
}

export function useAddSheet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAddSheet di luar provider");
  return v;
}
