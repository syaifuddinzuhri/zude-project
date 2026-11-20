import { requireUser } from "@/lib/auth/current";
import { listTransactions, type TxFilters } from "@/lib/server/tx-list";
import { AppHeader, Page } from "@/components/app-header";
import { TxList } from "./tx-list";
import { TxFilterBar } from "./filter-bar";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transaksi" };

type SP = Record<string, string | undefined>;

export default async function TransaksiPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const num = (v?: string) => (v && /^\d+$/.test(v) ? parseInt(v, 10) : undefined);
  const filters: TxFilters = {
    q: sp.q?.trim() || undefined,
    from: sp.dari || undefined,
    to: sp.sampai || undefined,
    type: sp.jenis || undefined,
    accountId: num(sp.akun),
    categoryId: num(sp.kategori),
    owner: (["suami", "istri", "bersama"].includes(sp.pemilik ?? "") ? sp.pemilik : undefined) as TxFilters["owner"],
    tag: sp.tag || undefined,
    min: num(sp.min),
    max: num(sp.maks),
    debtId: num(sp.hutang),
    goalId: num(sp.tujuan),
  };
  const take = Math.min(2000, num(sp.n) ?? 100);
  const { items, hasMore } = await listTransactions(user, filters, take);
  const more = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  more.set("n", String(take + 100));
  return (
    <>
      <AppHeader
        title="Transaksi"
        large
        actions={
          <Link href="/transaksi/sampah" className="pressable flex h-11 w-11 items-center justify-center rounded-full" aria-label="Transaksi terhapus">
            <Icon name="trash" />
          </Link>
        }
      />
      <Page>
        <TxFilterBar />
        <TxList items={items} />
        {hasMore && (
          <Link href={`/transaksi?${more.toString()}`} scroll={false} className="mt-3 flex h-12 items-center justify-center rounded-btn bg-surface font-semibold text-primary shadow-card">
            Muat lebih banyak
          </Link>
        )}
      </Page>
    </>
  );
}
