import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AppHeader, Page } from "@/components/app-header";
import { LogList } from "./log-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log aktivitas" };

const ENTITY: Record<string, string> = {
  transaction: "Transaksi", account: "Akun", category: "Kategori", budget: "Anggaran", budget_period: "Periode", budget_template: "Template anggaran",
  goal: "Tujuan", goal_allocation: "Tabungan", debt: "Hutang", recurring_rule: "Tagihan berulang", household_settings: "Pengaturan", user: "Pengguna",
  allocation_template: "Template alokasi", income_wizard: "Wizard gaji", receivable: "Piutang", asset: "Aset", sinking_fund: "Sinking fund", backup: "Backup",
};

export default async function LogPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  await requireUser();
  const take = Math.min(1000, Number((await searchParams).n) || 100);
  const logs = await db.auditLog.findMany({ orderBy: { id: "desc" }, take, include: { user: { select: { name: true } } } });
  return (
    <>
      <AppHeader title="Log aktivitas" back="/lainnya" />
      <Page>
        <LogList
          more={logs.length === take ? take + 100 : null}
          logs={logs.map((l) => ({
            id: l.id,
            who: l.user?.name ?? "Sistem",
            entity: ENTITY[l.entity] ?? l.entity,
            entityId: l.entityId,
            action: l.action,
            reason: l.reason,
            at: l.createdAt.toISOString(),
            before: l.beforeJson,
            after: l.afterJson,
          }))}
        />
      </Page>
    </>
  );
}
