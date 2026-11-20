import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { todayJakarta } from "@/lib/finance/date";

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const RETENTION_DAYS = 30;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "bigint" || typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Prisma.Decimal) return v.toString();
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? `'${iso.slice(0, 10)}'` : `'${iso.slice(0, 23).replace("T", " ")}'`;
  }
  if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\0/g, "\\0")}'`;
}

/** Dump SQL lengkap (struktur + data) yang bisa di-import lewat phpMyAdmin hPanel. */
export async function dumpSql(): Promise<string> {
  // Simpan tanggal/jam dalam UTC agar konsisten dengan Prisma
  const tables = (await db.$queryRawUnsafe<Record<string, string>[]>("SHOW TABLES")).map((r) => Object.values(r)[0]);
  const out: string[] = [
    `-- ZuDe backup ${new Date().toISOString()}`,
    "SET NAMES utf8mb4;",
    "SET time_zone = '+00:00';",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
  ];
  for (const t of tables) {
    const create = await db.$queryRawUnsafe<Record<string, string>[]>(`SHOW CREATE TABLE \`${t}\``);
    out.push(`DROP TABLE IF EXISTS \`${t}\`;`, `${create[0]["Create Table"]};`, "");
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${t}\``);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const cols = Object.keys(chunk[0]).map((c) => `\`${c}\``).join(", ");
      out.push(`INSERT INTO \`${t}\` (${cols}) VALUES\n${chunk.map((r) => `(${Object.values(r).map(esc).join(", ")})`).join(",\n")};`);
    }
    out.push("");
  }
  out.push("SET FOREIGN_KEY_CHECKS = 1;");
  return out.join("\n");
}

export async function writeDailyBackup() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `zude-${todayJakarta()}.sql.gz`);
  await fs.writeFile(file, gzipSync(await dumpSql()));
  // Retensi 30 hari
  const files = await fs.readdir(BACKUP_DIR);
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  let removed = 0;
  for (const f of files) {
    if (!/^zude-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f)) continue;
    const st = await fs.stat(path.join(BACKUP_DIR, f));
    if (st.mtimeMs < cutoff) {
      await fs.unlink(path.join(BACKUP_DIR, f));
      removed++;
    }
  }
  return { file: path.basename(file), removed };
}

export async function listBackups() {
  try {
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => /^zude-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f)).sort().reverse();
    return Promise.all(files.map(async (f) => ({ name: f, size: (await fs.stat(path.join(BACKUP_DIR, f))).size })));
  } catch {
    return [];
  }
}
