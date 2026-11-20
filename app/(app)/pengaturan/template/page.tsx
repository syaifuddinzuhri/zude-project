import { requireUser } from "@/lib/auth/current";
import { templatesFor } from "@/lib/server/allocation";
import { AppHeader, Page } from "@/components/app-header";
import { TemplateManager } from "./template-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Template alokasi" };

export default async function TemplatePage() {
  await requireUser();
  return (
    <>
      <AppHeader title="Template alokasi" back="/pengaturan" />
      <Page>
        <TemplateManager templates={await templatesFor()} />
      </Page>
    </>
  );
}
