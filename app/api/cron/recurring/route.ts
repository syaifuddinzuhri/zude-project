import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cronAuthorized, unauthorized } from "@/lib/server/cron";
import { runAutoRules } from "@/lib/server/recurring";

export const dynamic = "force-dynamic";

/** Cron harian: catat transaksi berulang mode otomatis yang jatuh tempo. */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorized();
  const user = await db.user.findFirst();
  if (!user) return NextResponse.json({ ok: true, created: 0, note: "belum ada pengguna" });
  const created = await runAutoRules(user);
  return NextResponse.json({ ok: true, created });
}

export const GET = handle;
export const POST = handle;
