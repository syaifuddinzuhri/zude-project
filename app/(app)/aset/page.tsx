import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { fromDate } from "@/lib/finance/date";
import { netWorth } from "@/lib/server/dashboard";
import type { Snapshot } from "@/lib/server/closing";
import { AppHeader, Page } from "@/components/app-header";
import { AssetsView } from "./assets-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aset & net worth" };

export default async function AsetPage() {
  const user = await requireUser();
  const [assets, nw, closed] = await Promise.all([
    db.asset.findMany({ include: { valuations: { orderBy: { date: "desc" } } }, orderBy: { id: "asc" } }),
    netWorth(user),
    db.budgetPeriod.findMany({ where: { status: "locked" }, orderBy: { periodStart: "asc" }, take: 24 }),
  ]);
  // Grafik bulanan: dari snapshot tutup buku (akun + aset pada tanggal itu − hutang) + titik saat ini
  const assetAt = (date: string) => assets.reduce((s, a) => s + n(a.valuations.find((v) => fromDate(v.date) <= date)?.value), 0);
  const series = closed
    .filter((p) => p.snapshotJson)
    .map((p) => {
      const s = p.snapshotJson as unknown as Snapshot;
      const acc = s.accounts.reduce((x, a) => x + a.balance, 0);
      return { label: fromDate(p.periodEnd).slice(0, 7), value: acc + assetAt(fromDate(p.periodEnd)) - s.debts.total };
    });
  series.push({ label: "Kini", value: nw.total });
  return (
    <>
      <AppHeader title="Aset & net worth" back="/lainnya" />
      <Page>
        <AssetsView
          nw={nw}
          series={series}
          assets={assets.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            owner: a.owner,
            unit: a.unit,
            quantity: a.quantity ? Number(a.quantity) : null,
            value: n(a.valuations[0]?.value),
            history: a.valuations.slice(0, 12).map((v) => ({ date: fromDate(v.date), value: n(v.value) })),
          }))}
        />
      </Page>
    </>
  );
}
