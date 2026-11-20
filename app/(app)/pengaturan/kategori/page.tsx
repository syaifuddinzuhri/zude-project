import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AppHeader, Page } from "@/components/app-header";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kategori" };

export default async function KategoriPage() {
  await requireUser();
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <>
      <AppHeader title="Kategori" back="/pengaturan" />
      <Page>
        <CategoryManager cats={cats.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId, nature: c.nature, icon: c.icon, color: c.color, isArchived: c.isArchived, system: Boolean(c.systemKey) }))} />
      </Page>
    </>
  );
}
