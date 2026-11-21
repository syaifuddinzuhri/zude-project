"use server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { checkLimit, recordFailure, resetLimit } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/server/audit";
import { run } from "@/lib/server/action";

/**
 * Tabel yang dikosongkan saat reset. Yang DIPERTAHANKAN: users (PIN & profil), kategori,
 * nama suami/istri, langganan push & preferensi notifikasi, catatan percobaan login, migrasi.
 */
const WIPE_TABLES = [
  "transaction_tags",
  "transaction_splits",
  "debt_schedule",
  "goal_allocations",
  "transactions",
  "tags",
  "recurring_rules",
  "budgets",
  "budget_periods",
  "budget_templates",
  "sinking_funds",
  "allocation_templates",
  "debt_rate_changes",
  "debts",
  "goals",
  "receivables",
  "asset_valuations",
  "assets",
  "notifications",
  "accounts",
  "audit_logs",
] as const;

const LIMIT_KEY = "reset:global";

function resetPinMatches(pin: string): boolean {
  const secret = process.env.RESET_PIN;
  if (!secret) throw new Error("Fitur reset belum aktif: RESET_PIN belum diatur di environment server");
  const a = createHash("sha256").update(pin).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Hapus seluruh data keuangan. Butuh PIN reset khusus (env RESET_PIN). Maks 3 salah / 15 menit. */
export async function resetAllDataAction(pin: string) {
  return run(async (u) => {
    const limit = await checkLimit(LIMIT_KEY, 3);
    if (!limit.ok) throw new Error(`Terlalu banyak percobaan. Coba lagi ${Math.ceil(limit.retryAfterSec / 60)} menit lagi`);
    if (!resetPinMatches(pin.trim())) {
      await recordFailure(LIMIT_KEY);
      throw new Error("PIN reset salah");
    }
    await resetLimit(LIMIT_KEY);

    await db.$transaction(
      async (tx) => {
        // Satu koneksi selama transaksi → FOREIGN_KEY_CHECKS berlaku untuk semua DELETE di bawah
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
          for (const t of WIPE_TABLES) await tx.$executeRawUnsafe(`DELETE FROM \`${t}\``);
        } finally {
          await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
        }
        // Pengaturan rumah tangga kembali ke bawaan, kecuali nama suami/istri
        await tx.householdSettings.update({
          where: { id: 1 },
          data: {
            cycleMode: "manual",
            cycleStartDay: 1,
            husbandPayday: 25,
            wifePayday: 25,
            husbandSalary: 0n,
            wifeSalary: 0n,
            husbandSalaryAccountId: null,
            wifeSalaryAccountId: null,
            husbandTemplateId: null,
            wifeTemplateId: null,
            paydayWeekendRule: false,
            bigExpenseThreshold: 2_000_000n,
            emergencyMonths: 6,
            ratioNeeds: 50,
            ratioWants: 30,
            ratioSavings: 20,
          },
        });
        await tx.user.updateMany({ data: { lastAccountId: null } });
        await audit(tx, { userId: u.id, entity: "system", action: "reset_all", reason: "Reset seluruh data" });
      },
      { timeout: 60_000 },
    );
  });
}
