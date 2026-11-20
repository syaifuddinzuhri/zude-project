import { requireUser } from "@/lib/auth/current";
import { db, n } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import { templatesFor } from "@/lib/server/allocation";
import { AppHeader, Page } from "@/components/app-header";
import { IncomeWizard } from "./income-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gaji masuk" };

export default async function GajianPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  await requireUser();
  const who = (await searchParams).who === "istri" ? "istri" : "suami";
  const [s, templates, cats] = await Promise.all([
    getSettings(),
    templatesFor(),
    db.category.findMany({ where: { systemKey: { in: ["salary_suami", "salary_istri", "bonus", "thr"] } } }),
  ]);
  const key = (k: string) => cats.find((c) => c.systemKey === k)?.id ?? null;
  return (
    <>
      <AppHeader title="Gaji / bonus masuk" back />
      <Page>
        <IncomeWizard
          who={who}
          settings={{
            suami: { amount: n(s.husbandSalary), accountId: s.husbandSalaryAccountId, templateId: s.husbandTemplateId },
            istri: { amount: n(s.wifeSalary), accountId: s.wifeSalaryAccountId, templateId: s.wifeTemplateId },
          }}
          categories={{ salary_suami: key("salary_suami"), salary_istri: key("salary_istri"), bonus: key("bonus"), thr: key("thr") }}
          templates={templates}
        />
      </Page>
    </>
  );
}
