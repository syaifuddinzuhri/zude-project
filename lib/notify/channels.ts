import "server-only";
import webpush from "web-push";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import type { Delivery, NotificationChannel } from "./types";
import { inQuietHours, quietEndAt } from "./quiet";
import { nowTimeJakarta } from "@/lib/finance/date";

let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";
  vapidReady = Boolean(pub && priv);
  if (vapidReady) webpush.setVapidDetails(subject, pub!, priv!);
  return vapidReady;
}

/** Notifikasi di website (ikon lonceng). Baris dibuat oleh dispatcher; kanal ini tidak perlu kerja tambahan. */
export class InAppChannel implements NotificationChannel {
  readonly name = "inapp";
  async send() {}
}

export class WebPushChannel implements NotificationChannel {
  readonly name = "push";

  async send({ notificationId, recipient, message }: Delivery) {
    if (!ensureVapid()) return;
    if (!message.urgent && inQuietHours(nowTimeJakarta(), recipient.quietStart, recipient.quietEnd)) {
      await db.notification.update({ where: { id: notificationId }, data: { pushAfter: quietEndAt(recipient.quietEnd) } });
      return;
    }
    await deliverPush(notificationId);
  }
}

/** Kirim push untuk satu baris notifikasi ke semua perangkat pemiliknya. */
export async function deliverPush(notificationId: number) {
  if (!ensureVapid()) return;
  const notif = await db.notification.findUnique({ where: { id: notificationId }, include: { user: true } });
  if (!notif || notif.pushedAt) return;
  const subs = await db.pushSubscription.findMany({ where: { userId: notif.userId } });
  const payloadData = (notif.payloadJson ?? {}) as { bodyNoAmount?: string; badge?: number };
  const body = notif.user.hideAmountInPush && payloadData.bodyNoAmount ? payloadData.bodyNoAmount : notif.body;
  const payload = JSON.stringify({
    title: notif.title,
    body,
    url: notif.url ?? "/",
    tag: notif.dedupeKey ?? `n${notif.id}`,
    badge: payloadData.badge,
  });
  let delivered = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      delivered = true;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date(), failedCount: 0 } });
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        await db.pushSubscription.update({ where: { id: s.id }, data: { failedCount: { increment: 1 } } }).catch(() => {});
      }
    }
  }
  await db.notification.update({ where: { id: notificationId }, data: { pushedAt: delivered || subs.length === 0 ? new Date() : null, pushAfter: null } });
}

let transporter: Transporter | null | undefined;
function mailer() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_SECURE ?? "true") === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;
  return transporter;
}

export class EmailChannel implements NotificationChannel {
  readonly name = "email";
  async send({ recipient, message }: Delivery) {
    const t = mailer();
    if (!t) return;
    const base = process.env.APP_URL || "";
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject: `ZuDe — ${message.title}`,
      text: `${message.body}\n\nBuka: ${base}${message.url}`,
      html: `<div style="font-family:sans-serif;font-size:15px;color:#0F172A"><p><strong>${message.title}</strong></p><p>${message.body}</p><p><a href="${base}${message.url}" style="color:#0F766E">Buka ZuDe</a></p></div>`,
    });
  }
}
