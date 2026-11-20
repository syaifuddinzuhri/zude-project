"use client";
import { createContext, useContext } from "react";

export interface AppData {
  me: { id: number; name: string };
  /** Nama tampilan pemilik: suami, istri, bersama */
  names: { suami: string; istri: string; bersama: string };
  accounts: { id: number; name: string; type: string; owner: string; color: string; icon: string; balance: number }[];
  categories: { id: number; name: string; kind: "income" | "expense"; parentId: number | null; icon: string; color: string }[];
  frequent: { expense: number[]; income: number[] };
  goals: { id: number; name: string; icon: string; accountId: number | null }[];
  debts: { id: number; name: string; nextScheduleId: number | null; nextAmount: number; nextDue: string | null; defaultAccountId: number | null }[];
  lastAccountId: number | null;
  unread: number;
  badge: number;
  vapidPublicKey: string | null;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData di luar AppDataProvider");
  return v;
}


/** Nama tampilan pemilik (suami/istri/bersama) sesuai Pengaturan → Profil. */
export function useOwnerName() {
  const { names } = useAppData();
  const name = (o: string) => (o === "suami" || o === "istri" || o === "bersama" ? names[o] : o);
  /** Untuk pilihan dropdown: "Zuhri (suami)" */
  const option = (o: "suami" | "istri") => `${names[o]} (${o})`;
  return { name, option, names };
}
