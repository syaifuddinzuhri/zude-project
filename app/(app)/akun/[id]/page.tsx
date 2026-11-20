import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { accountsWithBalance } from "@/lib/server/balances";
import { listTransactions } from "@/lib/server/tx-list";
import { AppHeader, Page } from "@/components/app-header";
import { AccountDetail } from "./account-detail";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const accounts = await accountsWithBalance(user, { includeArchived: true });
  const a = accounts.find((x) => x.id === id);
  if (!a) notFound();
  const { items } = await listTransactions(user, { accountId: id }, 150);
  return (
    <>
      <AppHeader title={a.name} back="/akun" />
      <Page>
        <AccountDetail a={a} txs={items} />
      </Page>
    </>
  );
}
