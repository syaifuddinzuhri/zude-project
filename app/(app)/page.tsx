import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { dashboardData } from "@/lib/server/dashboard";
import { AppHeader, Page } from "@/components/app-header";
import { PeriodSwitcher } from "@/components/period-switcher";
import { HeroCard } from "@/components/dashboard/hero-card";
import { BillsCarousel } from "@/components/dashboard/bills-carousel";
import { PushCard } from "@/components/push-card";
import { Card, SectionTitle } from "@/components/ui/card";
import { ProgressBar, Ring, Gauge } from "@/components/ui/progress";
import { CategoryIcon, Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { TxRow } from "@/components/tx-row";
import { formatDate, formatShortDate } from "@/lib/finance/date";
import { formatPercent } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function Beranda({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const offset = Math.max(-24, Math.min(12, parseInt(sp.p ?? "0", 10) || 0));
  const d = await dashboardData(user, offset, "semua");

  return (
    <>
      <AppHeader title={`Halo, ${d.names.suami} & ${d.names.istri}`} large />
      <Page className="space-y-3">
        <PeriodSwitcher period={d.period} offset={offset} basePath="/" />

        {d.payday && (
          <Link href={`/gajian?who=${d.payday}`} className="pressable flex items-center gap-3 rounded-card border border-primary/30 bg-primary-soft p-4">
            <span className="text-2xl">💰</span>
            <div className="flex-1">
              <div className="font-semibold">Hari ini gajian {d.names[d.payday]}?</div>
              <div className="text-caption text-muted">Catat & alokasikan gaji sekaligus</div>
            </div>
            <Icon name="chevron-right" className="text-primary" />
          </Link>
        )}

        {!d.hasAccounts && <EmptyState icon="wallet" title="Mulai dengan menambahkan rekening, e-wallet, atau dompet tunai." action="Tambah akun" href="/akun?baru=1" />}

        <HeroCard available={d.available} left={d.left} perDay={d.perDay} daysLeft={d.daysLeft} income={d.totals.income} expense={d.totals.expense + d.totals.debtInterest} nextPayday={d.nextPayday} isCurrent={d.isCurrent} />

        <PushCard />

        {d.isCurrent && <BillsCarousel bills={d.bills} />}

        <Card>
          <SectionTitle title="Anggaran" action={<Link href="/anggaran" className="text-[13px] font-semibold text-primary">Lihat semua</Link>} />
          {d.topSpending.length === 0 ? (
            <p className="py-2 text-caption text-muted">Belum ada pengeluaran di siklus ini.</p>
          ) : (
            <ul className="space-y-3">
              {d.topSpending.map((c) => (
                <li key={c.id}>
                  <Link href={c.budgetId ? `/anggaran/${c.budgetId}` : `/transaksi?kategori=${c.id}`} className="flex items-center gap-3">
                    <CategoryIcon icon={c.icon} color={c.color} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold">{c.name}</span>
                        <span className="text-caption text-muted">
                          <Money value={c.spent} short />
                          {c.budget != null && (
                            <>
                              {" / "}
                              <Money value={c.budget} short />
                            </>
                          )}
                        </span>
                      </div>
                      {c.budget != null ? <ProgressBar value={c.budget > 0 ? c.spent / c.budget : 1} status={c.status ?? "green"} /> : <div className="text-caption text-muted">Belum ada anggaran</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!d.hasBudget && d.topSpending.length > 0 && (
            <Link href="/anggaran" className="mt-3 block text-[13px] font-semibold text-primary">
              Atur anggaran bulan ini →
            </Link>
          )}
        </Card>

        <Card>
          <SectionTitle title="Tujuan tabungan" action={<Link href="/tabungan" className="text-[13px] font-semibold text-primary">Lihat semua</Link>} />
          {d.goals.length === 0 ? (
            <p className="py-2 text-caption text-muted">Belum ada tujuan. <Link href="/tabungan?baru=1" className="font-semibold text-primary">Buat tujuan</Link></p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {d.goals.map((g) => (
                <Link key={g.id} href={`/tabungan/${g.id}`} className="flex items-center gap-3">
                  <Ring value={g.progress} size={52} stroke={6} color={g.onTrack ? "var(--income)" : "var(--warning)"}>
                    <span className="text-lg">{g.icon}</span>
                  </Ring>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{g.name}</div>
                    <div className="text-caption text-muted">{formatPercent(g.progress)}</div>
                    <div className={`text-[11px] font-semibold ${g.onTrack ? "text-income" : "text-warning"}`}>{g.onTrack ? "On track" : "Tertinggal"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Hutang" action={<Link href="/hutang" className="text-[13px] font-semibold text-primary">Detail</Link>} />
          {d.debts.count === 0 ? (
            <p className="py-2 text-caption text-muted">Tidak ada hutang aktif 🎉</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-caption text-muted">Total sisa hutang</div>
                <Money value={d.debts.total} className="text-h2" />
                <div className="mt-1 text-caption text-muted">
                  Cicilan/bulan <Money value={d.debts.monthly} short />
                </div>
                {d.debts.freeDate && <div className="text-caption text-muted">Bebas hutang {formatDate(d.debts.freeDate)}</div>}
              </div>
              <div className="flex flex-col items-center">
                <Gauge value={d.debts.dsr} size={110} />
                <div className={`-mt-1 text-[13px] font-bold ${d.debts.dsr > 0.3 ? "text-expense" : "text-income"}`}>DSR {formatPercent(d.debts.dsr)}</div>
              </div>
            </div>
          )}
          {d.debts.dsr > 0.3 && <p className="mt-2 rounded-btn bg-expense/10 px-3 py-2 text-caption text-expense">Cicilan melebihi 30% pemasukan. Pertimbangkan pelunasan dipercepat.</p>}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-caption text-muted">Net worth</div>
            <Money value={d.netWorth} short className="text-[17px] font-bold" tone="auto" />
            <Link href="/aset" className="mt-1 block text-[12px] font-semibold text-primary">Aset & net worth →</Link>
          </Card>
          <Card>
            <div className="mb-1 text-caption text-muted">Kontribusi ke pos bersama</div>
            <Contribution suami={d.contrib.suami} istri={d.contrib.istri} names={d.names} />
          </Card>
        </div>

        <Card>
          <SectionTitle title="Transaksi terakhir" action={<Link href="/transaksi" className="text-[13px] font-semibold text-primary">Semua</Link>} />
          {d.recent.length === 0 ? <p className="py-2 text-caption text-muted">Belum ada transaksi. Ketuk tombol + untuk mencatat.</p> : <div className="divide-y divide-border/70">{d.recent.map((t) => <TxRow key={t.id} t={t} />)}</div>}
        </Card>
        <p className="pt-1 text-center text-caption text-muted">Siklus {formatShortDate(d.period.start)} – {formatShortDate(d.period.end)}</p>
      </Page>
    </>
  );
}

function Contribution({ suami, istri, names }: { suami: number; istri: number; names: { suami: string; istri: string } }) {
  const total = suami + istri;
  const ps = total ? suami / total : 0.5;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-border">
        <div style={{ width: `${ps * 100}%`, background: "#0EA5E9" }} />
        <div style={{ width: `${(1 - ps) * 100}%`, background: "#EC4899" }} />
      </div>
      <div className="mt-1.5 space-y-0.5 text-[12px] font-semibold">
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />{names.suami} <Money value={suami} short className="ml-auto" /></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#EC4899]" />{names.istri} <Money value={istri} short className="ml-auto" /></div>
      </div>
    </div>
  );
}
