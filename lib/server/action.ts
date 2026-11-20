import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionUser, type CurrentUser } from "@/lib/auth/current";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; locked?: boolean };

/** Jalankan aksi: autentikasi, tangkap error jadi pesan ramah, revalidate semua halaman. */
export async function run<T>(fn: (user: CurrentUser) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const user = await actionUser();
    const data = await fn(user);
    revalidatePath("/", "layout");
    return { ok: true, data: (data ?? null) as T };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data belum lengkap" };
    const msg = e instanceof Error ? e.message : "Terjadi kesalahan, coba lagi";
    if (msg.startsWith("LOCKED:")) return { ok: false, error: msg.slice(7), locked: true };
    if ((e as { code?: string }).code === "P2003") return { ok: false, error: "Data masih dipakai di tempat lain" };
    console.error("[action]", e);
    return { ok: false, error: msg.length < 200 ? msg : "Terjadi kesalahan, coba lagi" };
  }
}
