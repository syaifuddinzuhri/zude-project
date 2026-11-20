import { requireUser } from "@/lib/auth/current";
import { accountsWithBalance } from "@/lib/server/balances";
import { AppHeader, Page } from "@/components/app-header";
import { AccountsView } from "./accounts-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Akun" };

export default async function AkunPage({ searchParams }: { searchParams: Promise<{ baru?: string; arsip?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const accounts = await accountsWithBalance(user, { includeArchived: sp.arsip === "1" });
  return (
    <>
      <AppHeader title="Akun & dompet" back="/lainnya" />
      <Page>
        <AccountsView accounts={accounts} openNew={sp.baru === "1"} showArchived={sp.arsip === "1"} />
      </Page>
    </>
  );
}
