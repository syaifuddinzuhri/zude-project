import "server-only";
import { db, n } from "@/lib/db";
import { addDays, nowTimeJakarta, todayJakarta, toDate } from "@/lib/finance/date";
import { isPayday } from "@/lib/finance/cycle";
import { formatRp } from "@/lib/finance/money";
import { flushDeferredPushes, notify } from "@/lib/notify";
import { pruneAttempts } from "@/lib/auth/rate-limit";
import { billsBetween } from "./recurring";
import { getSettings, ownerNames, periodOf } from "./settings";
import { goalsOverview } from "./goals";

/** Jumlah tagihan jatuh tempo hari ini / terlambat (untuk badge ikon). */
export async function dueBadgeCount(user: Parameters<typeof billsBetween>[0], today = todayJakarta()) {
  const bills = await billsBetween(user, addDays(today, -60), today, today);
  return bills.filter((b) => b.status !== "paid").length;
}

export async function runReminders(now = new Date()) {
  const today = todayJakarta(now);
  const time = nowTimeJakarta(now);
  const users = await db.user.findMany();
  const settings = await getSettings();
  const stats = { bills: 0, payday: 0, close: 0, goals: 0, daily: 0, flushed: 0, late: 0 };

  // Tandai cicilan terlambat
  stats.late = (await db.debtSchedule.updateMany({ where: { status: "unpaid", dueDate: { lt: toDate(today) } }, data: { status: "late" } })).count;

  for (const u of users) {
    // ── Tagihan H-3, H-1, H-0 ──
    const bills = await billsBetween(u, today, addDays(today, 3), today);
    const badge = await dueBadgeCount(u, today);
    for (const b of bills) {
      if (b.status === "paid") continue;
      const h = b.dueDate === today ? 0 : b.dueDate === addDays(today, 1) ? 1 : b.dueDate === addDays(today, 3) ? 3 : null;
      if (h === null) continue;
      const when = h === 0 ? "hari ini" : h === 1 ? "besok" : "3 hari lagi";
      const label = b.kind === "debt" ? "Cicilan" : "Tagihan";
      await notify([u.id], {
        type: "bill_due",
        title: `${label} jatuh tempo ${when}`,
        body: `${label} ${b.name} ${formatRp(b.amount)} jatuh tempo ${when}`,
        bodyNoAmount: `${label} ${b.name} jatuh tempo ${when}`,
        url: b.kind === "debt" ? `/hutang/${b.debtId}?bayar=${b.scheduleId}` : `/tagihan?bayar=${encodeURIComponent(b.key)}`,
        dedupeKey: `bill:${b.key}:h${h}`,
        urgent: h === 0,
        badge,
      });
      stats.bills++;
    }

    // ── Gajian suami & istri ──
    for (const who of ["suami", "istri"] as const) {
      const payday = who === "suami" ? settings.husbandPayday : settings.wifePayday;
      if (time >= "07:00" && isPayday(today, payday, settings.paydayWeekendRule)) {
        await notify([u.id], {
          type: "payday",
          title: `Hari ini gajian ${ownerNames(settings)[who]}?`,
          body: `Catat & alokasikan gaji ${ownerNames(settings)[who]}`,
          url: `/gajian?who=${who}`,
          dedupeKey: `payday:${who}:${today}`,
        });
        stats.payday++;
      }
    }

    // ── Pengingat tutup buku (sehari sebelum siklus berakhir) ──
    const period = periodOf(settings, today);
    if (time >= "08:00" && addDays(today, 1) === period.end) {
      await notify([u.id], {
        type: "close_book",
        title: "Siklus bulan berakhir besok",
        body: "Siklus bulan berakhir besok — saatnya tutup buku",
        url: "/tutup-buku",
        dedupeKey: `close:${period.start}`,
      });
      stats.close++;
    }

    // ── Tujuan tertinggal (7 hari sebelum akhir siklus) ──
    if (time >= "09:00" && addDays(today, 7) === period.end) {
      const goals = await goalsOverview(period, []);
      for (const g of goals.filter((x) => !x.onTrack && x.shortfall > 0 && true)) {
        await notify([u.id], {
          type: "goal_behind",
          title: "Tujuan tabungan tertinggal",
          body: `${g.name} tertinggal ${formatRp(g.shortfall)} bulan ini`,
          bodyNoAmount: `${g.name} tertinggal bulan ini`,
          url: `/tabungan/${g.id}`,
          dedupeKey: `goal:${g.id}:${period.start}`,
        });
        stats.goals++;
      }
    }

    // ── Pengingat mencatat harian ──
    if (time >= u.dailyReminderTime) {
      const todayCount = await db.transaction.count({ where: { createdAt: { gte: new Date(`${today}T00:00:00+07:00`) } } });
      if (todayCount === 0) {
        await notify([u.id], {
          type: "daily_reminder",
          title: "Sudah catat pengeluaran hari ini?",
          body: "Sudah catat pengeluaran hari ini?",
          url: "/?tambah=expense",
          dedupeKey: `daily:${today}`,
        });
        stats.daily++;
      }
    }
  }
  stats.flushed = await flushDeferredPushes();
  await pruneAttempts();
  return stats;
}

export { n };
