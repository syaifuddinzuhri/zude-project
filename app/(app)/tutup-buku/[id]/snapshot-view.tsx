"use client";
import type { Snapshot } from "@/lib/server/closing";
import { formatDate, formatRange } from "@/lib/finance/date";
import { formatPercent, formatRp } from "@/lib/finance/money";
import { useOwnerName } from "@/components/app-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

/** Snapshot ditampilkan apa adanya (tanpa sembunyikan nominal) agar bisa diekspor PDF lewat dialog cetak. */
export function SnapshotView({ s, closedAt, closedBy }: { s: Snapshot; closedAt: string | null; closedBy: string | null }) {
  const { name } = useOwnerName();
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h2 className="text-h1">{formatRange(s.period.start, s.period.end)} {s.period.end.slice(0, 4)}</h2>
        <p className="text-caption text-muted">Ditutup {closedAt ? new Date(closedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-"}{closedBy ? ` oleh ${closedBy}` : ""}</p>
      </div>
      <Button variant="secondary" block className="no-print" onClick={() => window.print()}>
        <Icon name="download" size={18} /> Ekspor PDF
      </Button>
      <Card>
        <dl className="space-y-1.5 text-[14px]">
          <R l="Pemasukan" v={formatRp(s.totals.income)} />
          <R l="Pengeluaran" v={formatRp(s.totals.expense + s.totals.debtInterest)} />
          <R l="Tabungan" v={formatRp(s.totals.savings)} />
          <R l="Pembayaran hutang" v={formatRp(s.totals.debtPayment)} />
          <R l={s.leftover >= 0 ? "Surplus" : "Defisit"} v={formatRp(s.leftover)} strong />
          <R l="Savings rate" v={formatPercent(s.totals.income ? (s.totals.savings + s.totals.debtPrincipal) / s.totals.income : 0)} />
        </dl>
      </Card>
      <Card>
        <div className="mb-2 text-[14px] font-semibold">Anggaran vs realisasi</div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-caption text-muted"><tr><th className="py-1">Pos</th><th className="text-right">Anggaran</th><th className="text-right">Realisasi</th><th className="text-right">Sisa</th></tr></thead>
          <tbody>
            {s.budget.map((b) => (
              <tr key={b.name} className="border-t border-border/70">
                <td className="py-1.5">{b.name}</td>
                <td className="money text-right">{formatRp(b.budget + b.rollover)}</td>
                <td className="money text-right">{formatRp(b.spent)}</td>
                <td className={`money text-right ${b.remaining < 0 ? "text-expense" : ""}`}>{formatRp(b.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.unbudgeted.length > 0 && <p className="mt-2 text-caption text-muted">Tanpa anggaran: {s.unbudgeted.map((u) => `${u.name} ${formatRp(u.spent)}`).join(", ")}</p>}
      </Card>
      <Card>
        <div className="mb-2 text-[14px] font-semibold">Saldo akun</div>
        {s.accounts.map((a) => <R key={a.id} l={`${a.name} (${name(a.owner)})`} v={formatRp(a.balance)} />)}
      </Card>
      <Card>
        <div className="mb-2 text-[14px] font-semibold">Tujuan & hutang</div>
        {s.goals.map((g) => <R key={g.id} l={g.name} v={`${formatRp(g.saved)} / ${formatRp(g.target)}`} />)}
        <div className="mt-2 border-t border-border pt-2">
          <R l="Total hutang" v={formatRp(s.debts.total)} />
          <R l="Cicilan/bulan" v={formatRp(s.debts.monthly)} />
          <R l="DSR" v={formatPercent(s.debts.dsr)} />
          {s.debts.freeDate && <R l="Bebas hutang" v={formatDate(s.debts.freeDate)} />}
        </div>
      </Card>
    </div>
  );
}

function R({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-[14px]">
      <span className="text-muted">{l}</span>
      <span className={`money text-right ${strong ? "font-bold" : ""}`}>{v}</span>
    </div>
  );
}
