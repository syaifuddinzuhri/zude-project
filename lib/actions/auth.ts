"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { checkLimit, recordFailure, resetLimit } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE, cookieBase, signSession } from "@/lib/auth/session";
import { actionUser, householdUser } from "@/lib/auth/current";
import { audit } from "@/lib/server/audit";
import { run } from "@/lib/server/action";

type Result = { ok: true; next: string } | { ok: false; error: string };

const PIN_RE = /^\d{4,6}$/;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

/**
 * Cocokkan PIN. Sumber PIN: PIN yang disimpan di Pengaturan (hash),
 * atau — bila belum pernah diganti — PIN awal dari env APP_PIN.
 */
async function pinMatches(pin: string, pinHash: string | null): Promise<boolean> {
  if (pinHash) return verifySecret(pin, pinHash);
  const initial = process.env.APP_PIN;
  if (!initial) throw new Error("APP_PIN belum diatur di environment server");
  return pin === initial;
}

/** Masuk dengan PIN. Dibatasi 5×/15 menit per IP dan 15×/15 menit secara global. */
export async function pinLoginAction(pin: string, next?: string): Promise<Result> {
  const ip = await clientIp();
  const ipKey = `pin:${ip}`.slice(0, 80);
  const [perIp, global] = await Promise.all([checkLimit(ipKey, 5), checkLimit("pin:global", 15)]);
  if (!perIp.ok || !global.ok) {
    const wait = Math.ceil(Math.max(perIp.retryAfterSec, global.retryAfterSec) / 60);
    return { ok: false, error: `Terlalu banyak percobaan. Coba lagi ${wait} menit lagi` };
  }
  if (!PIN_RE.test(pin)) return { ok: false, error: "PIN harus 4–6 angka" };
  try {
    const user = await householdUser();
    if (!(await pinMatches(pin, user.pinHash))) {
      await recordFailure(ipKey, "pin:global");
      return { ok: false, error: "PIN salah" };
    }
    await resetLimit(ipKey);
    (await cookies()).set(SESSION_COOKIE, await signSession({ uid: user.id, sv: user.sessionVersion }), cookieBase);
    await audit(db, { userId: user.id, entity: "user", entityId: user.id, action: "login" });
    return { ok: true, next: safeNext(next) };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error && e.message.includes("APP_PIN") ? e.message : "Gagal masuk, coba lagi" };
  }
}

/** Kunci sekarang (hapus sesi). */
export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Ganti PIN. Perangkat lain ikut terkunci. */
export async function changePinAction(currentPin: string, newPin: string) {
  return run(async (u) => {
    if (!(await pinMatches(currentPin, u.pinHash))) throw new Error("PIN saat ini salah");
    if (!PIN_RE.test(newPin)) throw new Error("PIN baru harus 4–6 angka");
    const updated = await db.user.update({ where: { id: u.id }, data: { pinHash: await hashSecret(newPin), sessionVersion: { increment: 1 } } });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: "change_pin" });
    (await cookies()).set(SESSION_COOKIE, await signSession({ uid: updated.id, sv: updated.sessionVersion }), cookieBase);
  });
}

export async function setThemeAction(theme: "system" | "light" | "dark") {
  const u = await actionUser();
  await db.user.update({ where: { id: u.id }, data: { theme } });
  (await cookies()).set("zude_theme", theme, { ...cookieBase, httpOnly: false, maxAge: 365 * 86400 });
  return { ok: true as const };
}
