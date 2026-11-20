import { requireUser } from "@/lib/auth/current";
import { listTransactions } from "@/lib/server/tx-list";
import { AppHeader, Page } from "@/components/app-header";
import { TxList } from "../tx-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terhapus" };

export default async function Sampah() {
  const user = await requireUser();
  const { items } = await listTransactions(user, { deleted: true }, 300);
  return (
    <>
      <AppHeader title="Transaksi terhapus" back="/transaksi" />
      <Page>
        <p className="mb-3 text-caption text-muted">Transaksi yang dihapus bisa dipulihkan dalam 30 hari.</p>
        <TxList items={items} mode="trash" />
      </Page>
    </>
  );
}
