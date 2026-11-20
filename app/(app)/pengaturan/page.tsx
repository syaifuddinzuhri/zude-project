import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { getSettings, periodOf } from "@/lib/server/settings";
import { formatRange } from "@/lib/finance/date";
import { AppHeader, Page } from "@/components/app-header";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  const user = await requireUser();
  const s = await getSettings();
  const templates = await db.allocationTemplate.findMany({ orderBy: { id: "asc" } });
  return (
    <>
      <AppHeader title="Pengaturan" back="/lainnya" />
      <Page>
        <SettingsForm
          profile={{ name: user.name, theme: user.theme, quietStart: user.quietStart, quietEnd: user.quietEnd, hideAmountInPush: user.hideAmountInPush, dailyReminderTime: user.dailyReminderTime }}
          household={{
            cycleMode: s.cycleMode,
            cycleStartDay: s.cycleStartDay,
            husbandPayday: s.husbandPayday,
            wifePayday: s.wifePayday,
            husbandSalary: n(s.husbandSalary),
            wifeSalary: n(s.wifeSalary),
            husbandSalaryAccountId: s.husbandSalaryAccountId,
            wifeSalaryAccountId: s.wifeSalaryAccountId,
            husbandTemplateId: s.husbandTemplateId,
            wifeTemplateId: s.wifeTemplateId,
            paydayWeekendRule: s.paydayWeekendRule,
            bigExpenseThreshold: n(s.bigExpenseThreshold),
            emergencyMonths: s.emergencyMonths,
            ratioNeeds: s.ratioNeeds,
            ratioWants: s.ratioWants,
            ratioSavings: s.ratioSavings,
          }}
          names={{ husbandName: s.husbandName, wifeName: s.wifeName }}
          currentPeriod={formatRange(periodOf(s).start, periodOf(s).end)}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        />
      </Page>
    </>
  );
}
