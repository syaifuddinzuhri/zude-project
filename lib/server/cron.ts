import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** Lindungi endpoint cron dengan secret: header `x-cron-secret` atau `Authorization: Bearer`. */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
