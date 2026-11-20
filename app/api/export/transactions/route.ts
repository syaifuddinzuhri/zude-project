import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate, toDate } from "@/lib/finance/date";
import { TX_TYPE_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const csv = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ekspor CSV (bisa dibuka di Excel). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const rows = await db.transaction.findMany({
    where: {
      deletedAt: null,
      ...(from && to ? { date: { gte: toDate(from), lte: toDate(to) } } : {}),
    },
    include: { account: true, toAccount: true, splits: { include: { category: { include: { parent: true } } } }, tags: { include: { tag: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  const header = ["Tanggal", "Jam", "Jenis", "Akun", "Pemilik akun", "Akun tujuan", "Kategori", "Nominal", "Catatan", "Untuk", "Tag", "Status"];
  const lines = [header.join(",")];
  for (const t of rows) {
    const parts = t.splits.length ? t.splits : [null];
    for (const s of parts) {
      lines.push(
        [
          fromDate(t.date),
          t.time,
          TX_TYPE_LABEL[t.type],
          t.account.name,
          t.account.owner,
          t.toAccount?.name ?? "",
          s ? (s.category.parent ? `${s.category.parent.name} › ${s.category.name}` : s.category.name) : "",
          s ? n(s.amount) : n(t.amount),
          s?.note ?? t.note ?? "",
          t.beneficiary ?? "",
          t.tags.map((x) => x.tag.name).join(" "),
          t.status === "planned" ? "terencana" : "terealisasi",
        ]
          .map(csv)
          .join(","),
      );
    }
  }
  const body = "﻿" + lines.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zude-transaksi${from ? `-${from}_${to}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
