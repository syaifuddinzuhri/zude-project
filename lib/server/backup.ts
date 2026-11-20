import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
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

/** Serverless (Vercel) tidak punya disk permanen → backup dikirim lewat email. */
export const DISK_BACKUP = !process.env.VERCEL;

async function emailBackup(name: string, gz: Buffer) {
  const to = (process.env.NOTIFY_EMAIL ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!process.env.SMTP_HOST || to.length === 0) throw new Error("Backup email butuh SMTP_HOST & NOTIFY_EMAIL");
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `ZuDe — backup database ${todayJakarta()}`,
    text: "Backup harian database ZuDe terlampir (.sql.gz). Restore: ekstrak lalu Import di phpMyAdmin.",
    attachments: [{ filename: name, content: gz, contentType: "application/gzip" }],
  });
}

export async function writeDailyBackup() {
  const name = `zude-${todayJakarta()}.sql.gz`;
  const gz = gzipSync(await dumpSql());
  if (!DISK_BACKUP) {
    await emailBackup(name, gz);
    return { file: name, via: "email", size: gz.length };
  }
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.writeFile(path.join(BACKUP_DIR, name), gz);
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
  if (process.env.SMTP_HOST && process.env.NOTIFY_EMAIL && process.env.BACKUP_EMAIL === "1") await emailBackup(name, gz);
  return { file: name, via: "disk", removed };
}

export async function listBackups() {
  if (!DISK_BACKUP) return [];
  try {
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => /^zude-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f)).sort().reverse();
    return Promise.all(files.map(async (f) => ({ name: f, size: (await fs.stat(path.join(BACKUP_DIR, f))).size })));
  } catch {
    return [];
  }
}
