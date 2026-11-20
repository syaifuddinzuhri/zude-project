import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Satu akun rumah tangga; dibuat otomatis bila belum ada (tanpa halaman setup). */
export async function householdUser() {
  return (await db.user.findFirst({ orderBy: { id: "asc" } })) ?? (await db.user.create({ data: {} }));
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.uid } });
  if (!user || user.sessionVersion !== claims.sv) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Untuk server action: lempar error, bukan redirect. */
export async function actionUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Terkunci, masukkan PIN lagi");
  return user;
}
