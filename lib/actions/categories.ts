"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { run } from "@/lib/server/action";
import { audit } from "@/lib/server/audit";

const schema = z.object({
  name: z.string().trim().min(1, "Nama kategori belum diisi").max(80),
  kind: z.enum(["income", "expense"]),
  parentId: z.coerce.number().int().positive().nullish(),
  nature: z.enum(["needs", "wants", "savings_debt"]).nullish(),
  icon: z.string().max(32).default("circle"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#94A3B8"),
  isArchived: z.coerce.boolean().default(false),
});

export async function saveCategoryAction(id: number | null, input: unknown) {
  return run(async (u) => {
    const i = schema.parse(input);
    if (i.parentId) {
      const parent = await db.category.findUniqueOrThrow({ where: { id: i.parentId } });
      if (parent.parentId) throw new Error("Kategori hanya dua level");
      if (parent.kind !== i.kind) throw new Error("Jenis subkategori harus sama dengan induknya");
    }
    const data = { ...i, parentId: i.parentId ?? null, nature: i.kind === "expense" && !i.parentId ? i.nature ?? "needs" : i.nature ?? null };
    return db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.category.findUniqueOrThrow({ where: { id } });
        if (id === data.parentId) throw new Error("Kategori tidak bisa jadi induk dirinya");
        const after = await tx.category.update({ where: { id }, data });
        await audit(tx, { userId: u.id, entity: "category", entityId: id, action: "update", before, after });
        return id;
      }
      const max = await tx.category.aggregate({ _max: { sortOrder: true } });
      const after = await tx.category.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit(tx, { userId: u.id, entity: "category", entityId: after.id, action: "create", after });
      return after.id;
    });
  });
}
