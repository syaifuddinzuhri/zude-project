import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { NOTIFICATION_TYPES } from "@/lib/notify/types";
import { AppHeader, Page } from "@/components/app-header";
import { NotifSettings } from "./notif-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifikasi" };

export default async function NotifPage() {
  const user = await requireUser();
  const [prefs, devices] = await Promise.all([
    db.notificationPref.findMany({ where: { userId: user.id } }),
    db.pushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <AppHeader title="Notifikasi" back="/pengaturan" />
      <Page>
        <NotifSettings
          types={NOTIFICATION_TYPES.map((t) => {
            const p = prefs.find((x) => x.type === t.type);
            return { type: t.type, label: t.label, supportsEmail: t.email, push: p?.pushEnabled ?? t.push, inapp: p?.inappEnabled ?? true, email: p?.emailEnabled ?? t.email };
          })}
          profile={{ name: user.name, quietStart: user.quietStart, quietEnd: user.quietEnd, hideAmountInPush: user.hideAmountInPush, dailyReminderTime: user.dailyReminderTime }}
          devices={devices.map((d) => ({ id: d.id, endpoint: d.endpoint, label: d.deviceLabel ?? "Perangkat", ua: d.userAgent ?? "", created: d.createdAt.toISOString(), last: d.lastSuccessAt?.toISOString() ?? null, failed: d.failedCount }))}
        />
      </Page>
    </>
  );
}
