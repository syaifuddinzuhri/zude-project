import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "zude_session";
export const UNLOCK_COOKIE = "zude_unlock";
export const SESSION_DAYS = 30;
/** Kunci otomatis setelah tidak aktif (menit). */
export const IDLE_MINUTES = 15;

export interface SessionClaims {
  uid: number;
  sv: number;
  pin: boolean;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET belum diisi (min. 32 karakter)");
  return new TextEncoder().encode(s);
}

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ ...c, t: "s" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.t !== "s") return null;
    return { uid: Number(payload.uid), sv: Number(payload.sv), pin: Boolean(payload.pin) };
  } catch {
    return null;
  }
}

export async function signUnlock(uid: number): Promise<string> {
  return new SignJWT({ uid, t: "u" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());
}

export async function verifyUnlock(token: string | undefined, uid: number): Promise<{ iat: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.t !== "u" || Number(payload.uid) !== uid) return null;
    return { iat: Number(payload.iat) };
  } catch {
    return null;
  }
}

/** Token 2 langkah: password benar, menunggu kode TOTP. */
export async function signPending(uid: number): Promise<string> {
  return new SignJWT({ uid, t: "p" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(secret());
}

export async function verifyPending(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.t === "p" ? Number(payload.uid) : null;
  } catch {
    return null;
  }
}

export const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
