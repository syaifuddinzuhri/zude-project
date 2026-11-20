"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePinAction, logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

export function SecurityForm({ usingInitialPin }: { usingInitialPin: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const save = () => {
    if (pin.next !== pin.confirm) return toast.error("PIN baru tidak sama");
    start(async () => {
      const r = await changePinAction(pin.current, pin.next);
      if (!r.ok) return toast.error(r.error);
      toast.success("PIN diganti. Perangkat lain perlu masuk dengan PIN baru.");
      setPin({ current: "", next: "", confirm: "" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <section>
        <SectionTitle title="Ganti PIN" />
        <Card>
          <p className="mb-3 text-caption text-muted">
            {usingInitialPin
              ? "Saat ini masih memakai PIN awal dari server (APP_PIN). Sebaiknya ganti dengan PIN milik kalian."
              : "PIN diminta setiap ZuDe dibuka dan setelah 15 menit tidak aktif."}
          </p>
          <Field label="PIN saat ini"><Input type="password" inputMode="numeric" autoComplete="current-password" value={pin.current} onChange={(e) => setPin({ ...pin, current: digits(e.target.value) })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="PIN baru (4–6 angka)"><Input type="password" inputMode="numeric" autoComplete="new-password" value={pin.next} onChange={(e) => setPin({ ...pin, next: digits(e.target.value) })} /></Field>
            <Field label="Ulangi PIN baru"><Input type="password" inputMode="numeric" autoComplete="new-password" value={pin.confirm} onChange={(e) => setPin({ ...pin, confirm: digits(e.target.value) })} /></Field>
          </div>
          <Button block loading={pending} onClick={save} disabled={!pin.current || pin.next.length < 4}>Simpan PIN</Button>
        </Card>
      </section>
      <form action={logoutAction}>
        <Button variant="secondary" block><Icon name="lock" size={18} /> Kunci sekarang</Button>
      </form>
    </div>
  );
}
