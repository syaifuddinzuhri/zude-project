import { requireUser } from "@/lib/auth/current";
import { reportData } from "@/lib/server/reports";
import { AppHeader, Page } from "@/components/app-header";
import { PeriodSwitcher } from "@/components/period-switcher";
import { ReportView } from "./report-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan" };

export default async function LaporanPage({ searchParams }: { searchParams: Promise<{ p?: string; tab?: string; cat?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const offset = Math.max(-36, Math.min(0, parseInt(sp.p ?? "0", 10) || 0));
  const data = await reportData(offset, Number(sp.cat) || null);
  return (
    <>
      <AppHeader title="Laporan" back="/lainnya" />
      <Page className="space-y-3">
        <PeriodSwitcher period={data.period} offset={offset} basePath="/laporan" extra={sp.tab ? { tab: sp.tab } : undefined} />
        <ReportView d={data} tab={(sp.tab as "arus" | "kategori" | "rasio" | "orang") ?? "arus"} />
      </Page>
    </>
  );
}
