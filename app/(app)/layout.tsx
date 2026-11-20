import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current";
import { loadAppData } from "@/lib/server/app-data";
import { AppDataProvider } from "@/components/app-data";
import { AddSheetProvider } from "@/components/add-sheet-context";
import { AddSheet } from "@/components/add-sheet";
import { BottomNav } from "@/components/bottom-nav";
import { HideAmountProvider } from "@/components/ui/money";
import { IosInstallBanner } from "@/components/install-banner";
import { PageTransition } from "@/components/page-transition";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const data = await loadAppData(user);
  return (
    <AppDataProvider value={data}>
      <HideAmountProvider>
        <AddSheetProvider>
          <PageTransition>{children}</PageTransition>
          <BottomNav />
          <Suspense>
            <AddSheet />
          </Suspense>
          <IosInstallBanner />
        </AddSheetProvider>
      </HideAmountProvider>
    </AppDataProvider>
  );
}
