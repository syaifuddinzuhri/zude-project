import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { fromDate, todayJakarta } from "@/lib/finance/date";
import { closingData } from "@/lib/server/closing";
import { ensurePeriod } from "@/lib/server/periods";
import { getSettings, periodOf } from "@/lib/server/settings";
import { accountsWithBalance } from "@/lib/server/balances";
import { AppHeader, Page } from "@/components/app-header";
import { CloseWizard } from "./close-wizard";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatRange } from "@/lib/finance/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tutup buku" };

export default async function TutupBukuPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await requireUser();
  const s = await getSettings();
  const sp = await searchParams;
  // Default: siklus lalu bila belum dikunci, selain itu siklus berjalan
  const prev = periodOf(s, todayJakarta(), -1);
  const prevBp = await ensurePeriod(prev);
  const offset = sp.p != null ? parseInt(sp.p, 10) || 0 : prevBp.status === "locked" ? 0 : -1;
  const period = periodOf(s, todayJakarta(), offset);
  const bp = await ensurePeriod(period);
  const [data, accounts, archive] = await Promise.all([
    closingData(user, period),
    accountsWithBalance(user),
    db.budgetPeriod.findMany({ where: { status: "locked" }, orderBy: { periodStart: "desc" }, take: 24 }),
  ]);
  return (
    <>
      <AppHeader title="Tutup buku" back="/lainnya" />
      <Page className="space-y-3">
        <div className="flex gap-2">
          {[-1, 0].map((o) => (
            <Link key={o} href={`/tutup-buku?p=${o}`} className={`pressable flex-1 rounded-full px-3 py-2 text-center text-[13px] font-semibold ${o === offset ? "bg-primary text-on-primary" : "bg-surface shadow-card"}`}>
              {formatRange(periodOf(s, todayJakarta(), o).start, periodOf(s, todayJakarta(), o).end)}
            </Link>
          ))}
        </div>
        {bp.status === "locked" ? (
          <Card className="text-center">
            <Icon name="lock" className="mx-auto mb-2 text-income" size={28} />
            <div className="font-semibold">Siklus ini sudah ditutup</div>
            <Link href={`/tutup-buku/${bp.id}`} className="mt-2 inline-block text-[14px] font-semibold text-primary">Lihat snapshot →</Link>
          </Card>
        ) : (
          <CloseWizard
            periodId={bp.id}
            period={period}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance, icon: a.icon, color: a.color }))}
            pending={data.pending}
            totals={data.totals}
            leftover={data.leftover}
            lines={data.overview.lines.map((l) => ({ name: l.name, budget: l.budget + l.rollover, spent: l.spent, status: l.status, kind: l.kind }))}
          />
        )}
        {archive.length > 0 && (
          <section>
            <h2 className="mb-2 text-h2">Arsip snapshot</h2>
            <Card className="divide-y divide-border/70 py-1">
              {archive.map((a) => (
                <Link key={a.id} href={`/tutup-buku/${a.id}`} className="flex min-h-[52px] items-center justify-between py-2">
                  <span className="text-[14px] font-semibold">{formatRange(fromDate(a.periodStart), fromDate(a.periodEnd))} {fromDate(a.periodEnd).slice(0, 4)}</span>
                  <Icon name="chevron-right" className="text-muted" />
                </Link>
              ))}
            </Card>
          </section>
        )}
      </Page>
    </>
  );
}
