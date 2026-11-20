import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { PinPad } from "./pin-pad";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terkunci" };

export default async function LockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { next } = await searchParams;
  if (!user.pinHash) redirect(next ?? "/");
  return <PinPad name={user.name} next={next} />;
}
