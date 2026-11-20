import "server-only";
import { db } from "@/lib/db";
import { EmailChannel, InAppChannel, WebPushChannel, deliverPush } from "./channels";
import { NOTIFICATION_TYPES, type NotificationChannel, type NotificationMessage, type Recipient } from "./types";

export * from "./types";

const inapp = new InAppChannel();
const push = new WebPushChannel();
const email = new EmailChannel();

/** Kirim notifikasi ke pengguna; hormati preferensi per jenis & dedupe. */
export async function notify(userIds: number[], message: NotificationMessage) {
  const users = await db.user.findMany({ where: { id: { in: userIds } }, include: { notificationPrefs: true } });
  const meta = NOTIFICATION_TYPES.find((t) => t.type === message.type);
  for (const u of users) {
    const pref = u.notificationPrefs.find((p) => p.type === message.type);
    const wantInapp = pref?.inappEnabled ?? true;
    const wantPush = pref?.pushEnabled ?? (meta?.push ?? true);
    const wantEmail = pref?.emailEnabled ?? (meta?.email ?? false);
    if (!wantInapp && !wantPush && !wantEmail && message.type !== "test") continue;

    let notificationId: number;
    try {
      const row = await db.notification.create({
        data: {
          userId: u.id,
          type: message.type,
          title: message.title,
          body: message.body,
          url: message.url,
          dedupeKey: message.dedupeKey ?? null,
          payloadJson: { bodyNoAmount: message.bodyNoAmount ?? null, badge: message.badge ?? null },
          // Tidak tampil di lonceng bila in-app dimatikan
          readAt: wantInapp ? null : new Date(),
        },
      });
      notificationId = row.id;
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") continue; // sudah pernah dikirim
      throw e;
    }

    const recipient: Recipient = {
      id: u.id,
      name: u.name,
      email: u.email,
      quietStart: u.quietStart,
      quietEnd: u.quietEnd,
      hideAmountInPush: u.hideAmountInPush,
    };
    const chans: NotificationChannel[] = [inapp];
    if (wantPush || message.type === "test") chans.push(push);
    if (wantEmail && meta?.email) chans.push(email);
    for (const c of chans) {
      try {
        await c.send({ notificationId, recipient, message });
      } catch (e) {
        console.error(`[notify:${c.name}]`, e);
      }
    }
  }
}

/** Kirim push yang tertunda karena jam tenang. */
export async function flushDeferredPushes() {
  const due = await db.notification.findMany({ where: { pushedAt: null, pushAfter: { lte: new Date() } }, select: { id: true } });
  for (const d of due) await deliverPush(d.id);
  return due.length;
}

export async function partnerOf(userId: number) {
  return db.user.findFirst({ where: { id: { not: userId } } });
}
