export type NotificationType =
  | "bill_due"
  | "budget_threshold"
  | "big_expense"
  | "payday"
  | "close_book"
  | "goal_behind"
  | "daily_reminder"
  | "test";

export const NOTIFICATION_TYPES: { type: NotificationType; label: string; email: boolean; push: boolean }[] = [
  { type: "bill_due", label: "Tagihan & cicilan jatuh tempo (H-3 & H-0)", email: true, push: true },
  { type: "budget_threshold", label: "Anggaran kategori 80% / 100%", email: false, push: true },
  { type: "big_expense", label: "Pengeluaran besar dari akun bersama", email: false, push: true },
  { type: "payday", label: "Pengingat tanggal gajian", email: false, push: true },
  { type: "close_book", label: "Pengingat tutup buku", email: true, push: true },
  { type: "goal_behind", label: "Tujuan tabungan tertinggal", email: false, push: false },
  { type: "daily_reminder", label: "Pengingat mencatat harian", email: false, push: false },
];

export interface NotificationMessage {
  type: NotificationType;
  title: string;
  /** Isi lengkap (dengan nominal). */
  body: string;
  /** Isi tanpa nominal, dipakai bila "sembunyikan nominal di notifikasi" aktif. */
  bodyNoAmount?: string;
  url: string;
  /** Kunci unik agar pengingat yang sama tidak terkirim dua kali. */
  dedupeKey?: string;
  /** Lewati jam tenang (mis. H-0 jatuh tempo). */
  urgent?: boolean;
  badge?: number;
}

export interface Recipient {
  id: number;
  name: string;
  quietStart: string;
  quietEnd: string;
  hideAmountInPush: boolean;
}

export interface Delivery {
  notificationId: number;
  recipient: Recipient;
  message: NotificationMessage;
}

/**
 * Kanal pengiriman. Menambah kanal baru (mis. WhatsAppChannel) cukup
 * dengan mengimplementasikan interface ini & mendaftarkannya di `channels`.
 */
export interface NotificationChannel {
  readonly name: "inapp" | "push" | "email" | string;
  send(d: Delivery): Promise<void>;
}
