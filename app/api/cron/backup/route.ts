import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, unauthorized } from "@/lib/server/cron";
import { writeDailyBackup } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

/** Cron harian: backup database (retensi 30 hari). */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorized();
  return NextResponse.json({ ok: true, ...(await writeDailyBackup()) });
}

export const GET = handle;
export const POST = handle;
