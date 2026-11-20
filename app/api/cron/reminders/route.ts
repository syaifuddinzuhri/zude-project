import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, unauthorized } from "@/lib/server/cron";
import { runReminders } from "@/lib/server/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron tiap 15 menit: pengingat tagihan, gajian, tutup buku, tujuan, harian + kirim push tertunda (jam tenang). */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorized();
  return NextResponse.json({ ok: true, ...(await runReminders()) });
}

export const GET = handle;
export const POST = handle;
