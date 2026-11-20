"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface L { id: number; who: string; entity: string; entityId: string | null; action: string; reason: string | null; at: string; before: unknown; after: unknown }

const ACTION: Record<string, string> = { create: "membuat", update: "mengubah", delete: "menghapus", restore: "memulihkan", lock: "menutup & mengunci", login: "masuk", archive: "mengarsipkan", download: "mengunduh" };

function diff(before: unknown, after: unknown) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !["updatedAt", "createdAt", "updatedById"].includes(k));
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]) && a[k] !== undefined).map((k) => ({ k, b: b[k], a: a[k] }));
}
const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function LogList({ logs, more }: { logs: L[]; more: number | null }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted">Semua perubahan data tercatat: kapan, apa, dan data sebelum/sesudah.</p>
      <Card className="divide-y divide-border/70 py-1">
        {logs.map((l) => {
          const d = diff(l.before, l.after);
          return (
            <div key={l.id} className="py-2">
              <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex w-full items-start gap-3 text-left">
                <Avatar name={l.who} label="bersama" size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px]">
                    <b>{l.who}</b> {ACTION[l.action] ?? l.action} <span className="font-semibold">{l.entity}</span>
                    {l.entityId && <span className="text-muted"> #{l.entityId}</span>}
                  </div>
                  <div className="text-caption text-muted">{new Date(l.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</div>
                  {l.reason && <div className="mt-0.5 text-caption text-warning">Alasan: {l.reason}</div>}
                </div>
                {(l.before != null || l.after != null) && <Icon name="chevron-down" size={16} className={`mt-1 text-muted ${open === l.id ? "rotate-180" : ""}`} />}
              </button>
              {open === l.id && (
                <div className="ml-10 mt-2 overflow-x-auto rounded-btn bg-bg p-2 text-[12px]">
                  {d && d.length > 0 ? (
                    <table className="w-full">
                      <tbody>
                        {d.map((x) => (
                          <tr key={x.k} className="align-top">
                            <td className="pr-2 font-semibold">{x.k}</td>
                            <td className="pr-2 text-expense line-through">{show(x.b)}</td>
                            <td className="text-income">{show(x.a)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(l.after ?? l.before, null, 1)}</pre>
                  )}
                  {l.entity === "Transaksi" && l.entityId && <Link href={`/transaksi/${l.entityId}`} className="mt-1 inline-block font-semibold text-primary">Buka transaksi →</Link>}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      {more && <Link href={`/log?n=${more}`} className="flex h-12 items-center justify-center rounded-btn bg-surface font-semibold text-primary shadow-card">Muat lebih banyak</Link>}
    </div>
  );
}
