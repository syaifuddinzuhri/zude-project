import { requireUser } from "@/lib/auth/current";
import { AppHeader, Page } from "@/components/app-header";
import { SecurityForm } from "./security-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Keamanan" };

export default async function KeamananPage() {
  const u = await requireUser();
  return (
    <>
      <AppHeader title="Keamanan" back="/pengaturan" />
      <Page>
        <SecurityForm usingInitialPin={!u.pinHash} />
      </Page>
    </>
  );
}
