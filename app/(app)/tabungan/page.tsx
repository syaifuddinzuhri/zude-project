import { requireUser } from "@/lib/auth/current";
import { goalsOverview } from "@/lib/server/goals";
import { getSettings, periodOf } from "@/lib/server/settings";
import { AppHeader, Page } from "@/components/app-header";
import { GoalsGrid } from "./goals-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tabungan" };

export default async function TabunganPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  await requireUser();
  const s = await getSettings();
  const goals = await goalsOverview(periodOf(s), [periodOf(s, undefined, -1), periodOf(s, undefined, -2), periodOf(s, undefined, -3)]);
  return (
    <>
      <AppHeader title="Tabungan & tujuan" back="/lainnya" />
      <Page>
        <GoalsGrid goals={goals} openNew={(await searchParams).baru === "1"} />
      </Page>
    </>
  );
}
