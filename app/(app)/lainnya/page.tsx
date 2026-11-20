import { AppHeader, Page } from "@/components/app-header";
import { MoreMenu } from "./more-menu";

export const metadata = { title: "Lainnya" };

export default function Lainnya() {
  return (
    <>
      <AppHeader title="Lainnya" large />
      <Page>
        <MoreMenu />
      </Page>
    </>
  );
}
