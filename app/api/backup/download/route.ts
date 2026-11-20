import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { BACKUP_DIR, dumpSql } from "@/lib/server/backup";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/db";
import { todayJakarta } from "@/lib/finance/date";

export const dynamic = "force-dynamic";

/** Unduh backup: `?file=zude-YYYY-MM-DD.sql.gz` (arsip harian) atau tanpa parameter = backup baru saat ini. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const file = req.nextUrl.searchParams.get("file");
  let body: Buffer;
  let name: string;
  if (file) {
    if (!/^zude-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(file)) return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
    body = await fs.readFile(path.join(BACKUP_DIR, file));
    name = file;
  } else {
    body = gzipSync(await dumpSql());
    name = `zude-${todayJakarta()}-manual.sql.gz`;
  }
  await audit(db, { userId: user.id, entity: "backup", entityId: name, action: "download" });
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
