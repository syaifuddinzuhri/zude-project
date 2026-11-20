"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePasswordAction, setPinAction, totpDisableAction, totpEnableAction, totpSetupAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function SecurityForm({ hasPin, totp }: { hasPin: boolean; totp: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState({ pin: "", confirm: "", password: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error((r as { error: string }).error);
      toast.success(msg);
      after?.();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section>
        <SectionTitle title="PIN pembuka" />
        <Card>
          <p className="mb-3 text-caption text-muted">{hasPin ? "PIN aktif. Diminta setiap ZuDe dibuka dan setelah 15 menit tidak aktif." : "Belum ada PIN. Disarankan untuk melindungi data saat HP dipinjam."}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="PIN baru (4–6 angka)"><Input type="password" inputMode="numeric" maxLength={6} value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Ulangi PIN"><Input type="password" inputMode="numeric" maxLength={6} value={pin.confirm} onChange={(e) => setPin({ ...pin, confirm: e.target.value.replace(/\D/g, "") })} /></Field>
          </div>
          <Field label="Password saat ini"><Input type="password" autoComplete="current-password" value={pin.password} onChange={(e) => setPin({ ...pin, password: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Button loading={pending} onClick={() => (pin.pin !== pin.confirm ? toast.error("PIN tidak sama") : run(() => setPinAction(pin.pin, pin.password), "PIN disimpan", () => setPin({ pin: "", confirm: "", password: "" })))}>Simpan PIN</Button>
            {hasPin && <Button variant="ghost" className="text-expense" onClick={() => run(() => setPinAction(null, pin.password), "PIN dimatikan")}>Matikan PIN</Button>}
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle title="Password" />
        <Card>
          <Field label="Password saat ini"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Password baru" hint="Minimal 8 karakter. Perangkat lain akan keluar."><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Button block loading={pending} onClick={() => run(() => changePasswordAction(pw.current, pw.next), "Password diganti", () => setPw({ current: "", next: "" }))}>Ganti password</Button>
        </Card>
      </section>

      <section>
        <SectionTitle title="Verifikasi 2 langkah (TOTP)" />
        <Card>
          {totp ? (
            <>
              <p className="mb-3 text-[14px] font-semibold text-income">2FA aktif ✓</p>
              <Field label="Password untuk mematikan"><Input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} /></Field>
              <Button variant="ghost" className="text-expense" onClick={() => run(() => totpDisableAction(disablePw), "2FA dimatikan")}>Matikan 2FA</Button>
            </>
          ) : setup ? (
            <>
              <p className="mb-2 text-caption text-muted">Pindai dengan Google Authenticator / Authy, lalu masukkan kodenya.</p>
              <img src={setup.qr} alt="QR code 2FA" width={220} height={220} className="mx-auto rounded-xl bg-white p-2" />
              <p className="money my-2 break-all text-center text-caption text-muted">{setup.secret}</p>
              <Field label="Kode 6 digit"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
              <Button block loading={pending} onClick={() => run(() => totpEnableAction(code), "2FA aktif", () => setSetup(null))}>Aktifkan</Button>
            </>
          ) : (
            <>
              <p className="mb-3 text-caption text-muted">Opsional: minta kode dari aplikasi authenticator saat login.</p>
              <Button variant="secondary" block loading={pending} onClick={() => start(async () => { const r = await totpSetupAction(); if (!r.ok) return toast.error(r.error); setSetup(r.data); })}>Atur 2FA</Button>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
