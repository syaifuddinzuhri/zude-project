/**
 * Seed kategori bawaan (REQUIREMENTS 3.3) & pengaturan rumah tangga.
 * Aman dijalankan berulang (idempoten). Pengguna dibuat lewat halaman /setup.
 */
import { PrismaClient, type CategoryNature } from "@prisma/client";

const db = new PrismaClient();
const COLORS = ["#14B8A6", "#6366F1", "#F59E0B", "#EC4899", "#0EA5E9", "#84CC16", "#F97316", "#A855F7"];

type Sub = string | { name: string; key?: string; icon?: string };
interface Group {
  name: string;
  icon: string;
  nature?: CategoryNature;
  key?: string;
  subs?: Sub[];
}

const income: Group[] = [
  { name: "Gaji Suami", icon: "briefcase", key: "salary_suami" },
  { name: "Gaji Istri", icon: "briefcase", key: "salary_istri" },
  { name: "Bonus/Insentif", icon: "award", key: "bonus" },
  { name: "THR", icon: "gift", key: "thr" },
  { name: "Usaha Sampingan", icon: "store" },
  { name: "Hasil Trading", icon: "trending-up" },
  { name: "Hasil Investasi", icon: "chart-line" },
  { name: "Hadiah", icon: "gift" },
  { name: "Pengembalian Dana", icon: "undo-2" },
  { name: "Lainnya", icon: "circle-plus", key: "income_other" },
];

const expense: Group[] = [
  { name: "Kebutuhan Pokok", icon: "shopping-basket", nature: "needs", subs: ["Belanja dapur", "Makan di luar", "Air galon", "Gas"] },
  { name: "Rumah", icon: "house", nature: "needs", subs: ["Listrik", "Air PDAM", "Internet", "IPL/keamanan", "Perbaikan", "ART"] },
  { name: "Transportasi", icon: "car", nature: "needs", subs: ["Bensin", "Tol", "Parkir", "Servis", "Ojek online"] },
  { name: "Anak", icon: "baby", nature: "needs", subs: ["Sekolah/SPP", "Les", "Susu & popok", "Jajan", "Mainan"] },
  { name: "Kesehatan", icon: "heart-pulse", nature: "needs", subs: ["BPJS", "Obat", "Dokter", "Asuransi"] },
  { name: "Komunikasi", icon: "smartphone", nature: "needs", subs: ["Pulsa", "Paket data", "Langganan aplikasi"] },
  { name: "Sosial & Ibadah", icon: "hand-heart", nature: "needs", subs: ["Zakat", "Infak/sedekah", "Kondangan", "Arisan", "Kiriman orang tua"] },
  { name: "Pribadi Suami", icon: "user", nature: "wants", key: "personal_suami", subs: ["Uang jajan", "Hobi", "Pakaian"] },
  { name: "Pribadi Istri", icon: "user", nature: "wants", key: "personal_istri", subs: ["Uang jajan", "Perawatan", "Pakaian"] },
  { name: "Hiburan", icon: "popcorn", nature: "wants", subs: ["Liburan", "Streaming", "Nongkrong"] },
  {
    name: "Biaya Keuangan",
    icon: "landmark",
    nature: "savings_debt",
    subs: [{ name: "Bunga", key: "debt_interest" }, "Denda", { name: "Biaya Bank", key: "bank_fee" }, "Iuran kartu"],
  },
  { name: "Lain-lain", icon: "ellipsis", nature: "wants", key: "expense_other" },
];

async function upsertCategory(data: {
  name: string;
  kind: "income" | "expense";
  parentId: number | null;
  icon: string;
  color: string;
  nature: CategoryNature | null;
  sortOrder: number;
  systemKey?: string;
}) {
  if (data.systemKey) {
    const found = await db.category.findUnique({ where: { systemKey: data.systemKey } });
    if (found) return found;
  }
  const existing = await db.category.findFirst({ where: { name: data.name, kind: data.kind, parentId: data.parentId } });
  if (existing) {
    if (data.systemKey && !existing.systemKey) return db.category.update({ where: { id: existing.id }, data: { systemKey: data.systemKey } });
    return existing;
  }
  return db.category.create({ data: { ...data, systemKey: data.systemKey ?? null } });
}

async function main() {
  await db.householdSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  let order = 0;
  for (const [i, g] of income.entries()) {
    await upsertCategory({ name: g.name, kind: "income", parentId: null, icon: g.icon, color: COLORS[i % COLORS.length], nature: null, sortOrder: order++, systemKey: g.key });
  }
  for (const [i, g] of expense.entries()) {
    const color = COLORS[i % COLORS.length];
    const parent = await upsertCategory({ name: g.name, kind: "expense", parentId: null, icon: g.icon, color, nature: g.nature ?? null, sortOrder: order++, systemKey: g.key });
    for (const s of g.subs ?? []) {
      const sub = typeof s === "string" ? { name: s } : s;
      await upsertCategory({ name: sub.name, kind: "expense", parentId: parent.id, icon: sub.icon ?? g.icon, color, nature: null, sortOrder: order++, systemKey: sub.key });
    }
  }
  const count = await db.category.count();
  console.log(`Seed selesai: ${count} kategori.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
