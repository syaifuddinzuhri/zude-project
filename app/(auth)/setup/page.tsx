import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup awal" };

export default async function SetupPage() {
  if ((await db.user.count()) >= 1) redirect((await getCurrentUser()) ? "/" : "/login");
  return <SetupForm />;
}
