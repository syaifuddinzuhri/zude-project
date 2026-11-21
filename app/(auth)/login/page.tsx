import { redirect } from "next/navigation";
import { getCurrentUser, householdUser } from "@/lib/auth/current";
import { getSettings, ownerNames } from "@/lib/server/settings";
import { PinPad } from "./pin-pad";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const [user, settings] = await Promise.all([householdUser(), getSettings()]);
  const names = ownerNames(settings);
  const { next } = await searchParams;
  // PIN tersimpan (hash) → panjang dari kolom pin_length; belum pernah diganti → panjang APP_PIN
  const initial = process.env.APP_PIN;
  const pinLength = user.pinHash ? user.pinLength : initial && /^\d{4,6}$/.test(initial) ? initial.length : null;
  return <PinPad title={user.name} subtitle={`${names.suami} & ${names.istri}`} next={next} pinLength={pinLength} />;
}
