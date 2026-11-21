"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePinAction, logoutAction } from "@/lib/actions/auth";
import { resetAllDataAction } from "@/lib/actions/reset";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

export function SecurityForm({ usingInitialPin, resetEnabled }: { usingInitialPin: boolean; resetEnabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  const confirm = useConfirm();
  const [resetPin, setResetPin] = useState("");

  const reset = async () => {
    const ok = await confirm({
      title: "Hapus SEMUA data?",
      message: "Semua akun, transaksi, anggaran, tagihan, utang, tabungan, aset, dan riwayat akan dihapus permanen. Kategori, nama, dan PIN masuk tetap. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Ya, hapus semua",
      tone: "danger",
      icon: "alert",
    });
    if (!ok) return;
    start(async () => {
      const r = await resetAllDataAction(resetPin);
      if (!r.ok) return toast.error(r.error);
      setResetPin("");
      toast.success("Semua data sudah dihapus. Mulai dari awal ya!");
      router.push("/");
      router.refresh();
    });
  };

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

      <section>
        <SectionTitle title="Zona bahaya" />
        <Card className="border border-expense/40">
          <div className="mb-3 flex items-start gap-2 text-[14px]">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-expense" />
            <p>
              <b>Reset semua data</b> menghapus seluruh akun, transaksi, anggaran, tagihan, utang, tabungan, aset, dan riwayat. Kategori, nama suami/istri, dan PIN masuk tetap disimpan.
            </p>
          </div>
          <p className="mb-3 text-caption text-muted">
            Sarannya <Link href="/pengaturan/backup" className="font-medium text-primary">unduh backup</Link> dulu sebelum reset.
          </p>
          {resetEnabled ? (
            <>
              <Field label="PIN reset khusus">
                <Input type="password" inputMode="numeric" autoComplete="off" value={resetPin} onChange={(e) => setResetPin(e.target.value.replace(/\D/g, "").slice(0, 12))} />
              </Field>
              <Button variant="destructive" block loading={pending} disabled={resetPin.length < 4} onClick={reset}>
                <Icon name="trash" size={18} /> Reset semua data
              </Button>
            </>
          ) : (
            <p className="text-caption text-muted">Belum aktif. Atur variabel RESET_PIN di environment server (Vercel) untuk mengaktifkan.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
