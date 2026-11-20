import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const subSchema = z.object({
  endpoint: z.string().url().max(512),
  keys: z.object({ p256dh: z.string().max(255), auth: z.string().max(255) }),
  deviceLabel: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Data langganan tidak valid" }, { status: 400 });
  const { endpoint, keys, deviceLabel } = parsed.data;
  const ua = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua, deviceLabel: deviceLabel ?? null },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua, failedCount: 0, deviceLabel: deviceLabel ?? undefined },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ error: "endpoint wajib" }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
