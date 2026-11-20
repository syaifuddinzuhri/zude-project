import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AppHeader, Page } from "@/components/app-header";
import { NotifList } from "./notif-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifikasi" };

export default async function NotifikasiPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { id: "desc" }, take: 100 });
  return (
    <>
      <AppHeader title="Notifikasi" back />
      <Page>
        <NotifList items={items.map((x) => ({ id: x.id, title: x.title, body: x.body, url: x.url, type: x.type, read: Boolean(x.readAt), at: x.createdAt.toISOString() }))} />
      </Page>
    </>
  );
}
