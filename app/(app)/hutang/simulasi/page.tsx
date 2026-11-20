import { requireUser } from "@/lib/auth/current";
import { debtSummary } from "@/lib/server/debts";
import { AppHeader, Page } from "@/components/app-header";
import { Simulator } from "./simulator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulasi pelunasan" };

export default async function SimulasiPage() {
  await requireUser();
  const s = await debtSummary(0);
  return (
    <>
      <AppHeader title="Snowball vs Avalanche" back="/hutang" />
      <Page>
        <Simulator debts={s.items.map((d) => ({ id: d.id, name: d.name, balance: d.remaining, rateBp: d.rateBp, minPayment: d.nextAmount }))} />
      </Page>
    </>
  );
}
