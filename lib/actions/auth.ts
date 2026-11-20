"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  UNLOCK_COOKIE,
  cookieBase,
  signPending,
  signSession,
  signUnlock,
  verifyPending,
} from "@/lib/auth/session";
import { actionUser, getCurrentUser } from "@/lib/auth/current";
import { audit } from "@/lib/server/audit";
import { run } from "@/lib/server/action";

type Result = { ok: true; next?: string; step?: "totp" } | { ok: false; error: string };

async function clientKey(prefix: string, extra = "") {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${prefix}:${ip}:${extra}`;
}

async function startSession(user: { id: number; sessionVersion: number; pinHash: string | null }) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: user.id, sv: user.sessionVersion, pin: Boolean(user.pinHash) }), {
    ...cookieBase,
    maxAge: SESSION_DAYS * 86400,
  });
  // Baru saja login dengan password → tidak perlu PIN lagi untuk sesi ini.
  jar.set(UNLOCK_COOKIE, await signUnlock(user.id), cookieBase);
  jar.delete("zude_pending");
}

const setupSchema = z.object({
  token: z.string().min(1, "Token setup belum diisi"),
  name: z.string().trim().min(1, "Nama belum diisi").max(80),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  husbandName: z.string().trim().min(1, "Nama suami belum diisi").max(40),
  wifeName: z.string().trim().min(1, "Nama istri belum diisi").max(40),
});

/** Setup awal: membuat satu akun login untuk rumah tangga (dipakai bersama suami & istri), dilindungi SETUP_TOKEN. */
export async function setupAction(input: unknown): Promise<Result> {
  try {
    const i = setupSchema.parse(input);
    const rl = rateLimit(await clientKey("setup"), 10);
    if (!rl.ok) return { ok: false, error: `Terlalu banyak percobaan, coba lagi ${Math.ceil(rl.retryAfterSec / 60)} menit lagi` };
    const expected = process.env.SETUP_TOKEN;
    if (!expected) return { ok: false, error: "SETUP_TOKEN belum diatur di environment" };
    if (i.token !== expected) return { ok: false, error: "Token setup salah" };
    if ((await db.user.count()) >= 1) return { ok: false, error: "Akun sudah dibuat, pendaftaran ditutup" };
    const user = await db.user.create({
      data: { name: i.name, email: i.email, passwordHash: await hashSecret(i.password) },
    });
    await db.householdSettings.upsert({ where: { id: 1 }, create: { id: 1, husbandName: i.husbandName, wifeName: i.wifeName }, update: { husbandName: i.husbandName, wifeName: i.wifeName } });
    await audit(db, { userId: user.id, entity: "user", entityId: user.id, action: "create", after: { name: user.name, email: user.email } });
    await startSession(user);
    return { ok: true, next: "/akun?baru=1" };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0].message };
    console.error(e);
    return { ok: false, error: "Gagal membuat pengguna" };
  }
}

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email tidak valid"), password: z.string().min(1, "Password belum diisi"), next: z.string().optional() });

export async function loginAction(input: unknown): Promise<Result> {
  try {
    const i = loginSchema.parse(input);
    const key = await clientKey("login", i.email);
    const rl = rateLimit(key, 5);
    if (!rl.ok) return { ok: false, error: `Terlalu banyak percobaan. Coba lagi ${Math.ceil(rl.retryAfterSec / 60)} menit lagi` };
    const user = await db.user.findUnique({ where: { email: i.email } });
    const ok = await verifySecret(i.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    if (!user || !ok) return { ok: false, error: "Email atau password salah" };
    resetRateLimit(key);
    if (user.totpEnabled && user.totpSecret) {
      (await cookies()).set("zude_pending", await signPending(user.id), { ...cookieBase, maxAge: 300 });
      return { ok: true, step: "totp" };
    }
    await startSession(user);
    await audit(db, { userId: user.id, entity: "user", entityId: user.id, action: "login" });
    return { ok: true, next: safeNext(i.next) };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0].message };
    console.error(e);
    return { ok: false, error: "Gagal masuk, coba lagi" };
  }
}

export async function totpLoginAction(code: string, next?: string): Promise<Result> {
  const uid = await verifyPending((await cookies()).get("zude_pending")?.value);
  if (!uid) return { ok: false, error: "Sesi verifikasi berakhir, masuk ulang" };
  const rl = rateLimit(`totp:${uid}`, 5);
  if (!rl.ok) return { ok: false, error: "Terlalu banyak percobaan kode" };
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user?.totpSecret) return { ok: false, error: "2FA tidak aktif" };
  const valid = verifySync({ secret: user.totpSecret, token: code.replace(/\s/g, ""), epochTolerance: 30 }).valid;
  if (!valid) return { ok: false, error: "Kode 2FA salah" };
  resetRateLimit(`totp:${uid}`);
  await startSession(user);
  await audit(db, { userId: user.id, entity: "user", entityId: user.id, action: "login" });
  return { ok: true, next: safeNext(next) };
}

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(UNLOCK_COOKIE);
  redirect("/login");
}

/** Buka kunci dengan PIN. 5 kali salah → keluar & harus login dengan password. */
export async function unlockAction(pin: string, next?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir" };
  const key = `pin:${user.id}`;
  const rl = rateLimit(key, 5);
  if (!rl.ok) {
    await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(UNLOCK_COOKIE);
    return { ok: false, error: "PIN salah 5 kali. Silakan masuk dengan password." };
  }
  if (!(await verifySecret(pin, user.pinHash))) return { ok: false, error: "PIN salah" };
  resetRateLimit(key);
  (await cookies()).set(UNLOCK_COOKIE, await signUnlock(user.id), cookieBase);
  return { ok: true, next: safeNext(next) };
}

export async function setPinAction(pin: string | null, currentPassword: string) {
  return run(async (u) => {
    if (!(await verifySecret(currentPassword, u.passwordHash))) throw new Error("Password saat ini salah");
    if (pin !== null && !/^\d{4,6}$/.test(pin)) throw new Error("PIN harus 4–6 angka");
    const updated = await db.user.update({ where: { id: u.id }, data: { pinHash: pin ? await hashSecret(pin) : null } });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: pin ? "set_pin" : "remove_pin" });
    await startSession(updated);
  });
}

export async function changePasswordAction(current: string, next: string) {
  return run(async (u) => {
    if (!(await verifySecret(current, u.passwordHash))) throw new Error("Password saat ini salah");
    if (next.length < 8) throw new Error("Password baru minimal 8 karakter");
    const updated = await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashSecret(next), sessionVersion: { increment: 1 } } });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: "change_password" });
    await startSession(updated);
  });
}

export async function totpSetupAction() {
  return run(async (u) => {
    const secret = generateSecret();
    await db.user.update({ where: { id: u.id }, data: { totpSecret: secret, totpEnabled: false } });
    const uri = generateURI({ issuer: "ZuDe", label: u.email, secret });
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  });
}

export async function totpEnableAction(code: string) {
  return run(async (u) => {
    const fresh = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!fresh.totpSecret) throw new Error("Mulai pengaturan 2FA dulu");
    if (!verifySync({ secret: fresh.totpSecret, token: code.replace(/\s/g, ""), epochTolerance: 30 }).valid) throw new Error("Kode salah, coba lagi");
    await db.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: "enable_2fa" });
  });
}

export async function totpDisableAction(password: string) {
  return run(async (u) => {
    if (!(await verifySecret(password, u.passwordHash))) throw new Error("Password salah");
    await db.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecret: null } });
    await audit(db, { userId: u.id, entity: "user", entityId: u.id, action: "disable_2fa" });
  });
}

export async function setThemeAction(theme: "system" | "light" | "dark") {
  const u = await actionUser();
  await db.user.update({ where: { id: u.id }, data: { theme } });
  (await cookies()).set("zude_theme", theme, { ...cookieBase, httpOnly: false, maxAge: 365 * 86400 });
  return { ok: true as const };
}
