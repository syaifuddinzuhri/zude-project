import { NextResponse, type NextRequest } from "next/server";
import { householdUser } from "@/lib/auth/current";
import { cronAuthorized, unauthorized } from "@/lib/server/cron";
import { runAutoRules } from "@/lib/server/recurring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron harian: catat transaksi berulang mode otomatis yang jatuh tempo. */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorized();
  const user = await householdUser();
  const created = await runAutoRules(user);
  return NextResponse.json({ ok: true, created });
}

export const GET = handle;
export const POST = handle;
