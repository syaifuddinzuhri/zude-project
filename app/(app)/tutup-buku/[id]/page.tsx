import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import type { Snapshot } from "@/lib/server/closing";
import { AppHeader, Page } from "@/components/app-header";
import { SnapshotView } from "./snapshot-view";

export const dynamic = "force-dynamic";

export default async function SnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const bp = await db.budgetPeriod.findUnique({ where: { id: Number((await params).id) } });
  if (!bp?.snapshotJson) notFound();
  const closedBy = bp.closedById ? await db.user.findUnique({ where: { id: bp.closedById }, select: { name: true } }) : null;
  return (
    <>
      <AppHeader title="Snapshot tutup buku" back="/tutup-buku" />
      <Page>
        <SnapshotView s={bp.snapshotJson as unknown as Snapshot} closedAt={bp.closedAt?.toISOString() ?? null} closedBy={closedBy?.name ?? null} />
      </Page>
    </>
  );
}
