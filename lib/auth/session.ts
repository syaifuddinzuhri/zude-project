import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "zude_session";
/**
 * Terkunci otomatis setelah tidak aktif (menit). Cookie sesi tanpa maxAge,
 * jadi juga hilang saat aplikasi/browser ditutup → PIN diminta lagi saat dibuka.
 */
export const IDLE_MINUTES = 15;

export interface SessionClaims {
  uid: number;
  sv: number;
  iat: number;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET belum diisi (min. 32 karakter)");
  return new TextEncoder().encode(s);
}

export async function signSession(c: { uid: number; sv: number }): Promise<string> {
  return new SignJWT({ uid: c.uid, sv: c.sv, t: "s" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.t !== "s") return null;
    return { uid: Number(payload.uid), sv: Number(payload.sv), iat: Number(payload.iat) };
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
