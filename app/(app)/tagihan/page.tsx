import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { billsBetween, templateSchema } from "@/lib/server/recurring";
import { getSettings, periodOf } from "@/lib/server/settings";
import { fromDate } from "@/lib/finance/date";
import { AppHeader, Page } from "@/components/app-header";
import { PeriodSwitcher } from "@/components/period-switcher";
import { BillsView } from "./bills-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tagihan" };

export default async function TagihanPage({ searchParams }: { searchParams: Promise<{ p?: string; bayar?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const offset = Math.max(-24, Math.min(12, parseInt(sp.p ?? "0", 10) || 0));
  const period = periodOf(await getSettings(), undefined, offset);
  const [bills, rules] = await Promise.all([billsBetween(user, period.start, period.end), db.recurringRule.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })]);
  return (
    <>
      <AppHeader title="Tagihan" back="/lainnya" />
      <Page className="space-y-3">
        <PeriodSwitcher period={period} offset={offset} basePath="/tagihan" />
        <BillsView
          period={period}
          bills={bills}
          payKey={sp.bayar}
          rules={rules.map((r) => {
            const t = templateSchema.safeParse(r.templateJson);
            return {
              id: r.id,
              name: r.name,
              frequency: r.frequency,
              interval: r.interval,
              dayOfMonth: r.dayOfMonth,
              dayOfWeek: r.dayOfWeek,
              monthOfYear: r.monthOfYear,
              startDate: fromDate(r.startDate),
              endDate: r.endDate ? fromDate(r.endDate) : null,
              nextRunDate: fromDate(r.nextRunDate),
              mode: r.mode,
              template: t.success ? t.data : null,
            };
          })}
        />
      </Page>
    </>
  );
}
