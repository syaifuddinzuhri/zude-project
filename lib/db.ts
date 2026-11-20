import { PrismaClient, type Prisma } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const db = g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** BigInt → number (rupiah aman sampai ±9 kuadriliun). */
export const n = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));

/** Siapkan objek untuk kolom JSON (BigInt & Date → nilai JSON). */
export function toJson<T>(v: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val)));
}
