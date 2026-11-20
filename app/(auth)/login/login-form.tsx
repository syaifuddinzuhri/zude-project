"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction, totpLoginAction } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [step, setStep] = useState<"password" | "totp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = step === "password" ? await loginAction({ email, password, next }) : await totpLoginAction(code, next);
      if (!r.ok) return setError(r.error);
      if (r.step === "totp") return setStep("totp");
      router.replace(r.next ?? "/");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full">
      <div className="mb-10 flex justify-center">
        <Logo width={220} />
      </div>
      <div className="glass rounded-card p-5 shadow-glass">
        <h1 className="mb-1 text-h1">{step === "password" ? "Masuk" : "Verifikasi 2 langkah"}</h1>
        <p className="mb-5 text-caption text-muted">{step === "password" ? "Website keuangan rumah tangga kita berdua." : "Masukkan 6 digit kode dari aplikasi authenticator."}</p>
        {step === "password" ? (
          <>
            <Field label="Email">
              <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </>
        ) : (
          <Field label="Kode 2FA">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoFocus className="money text-center text-[22px] tracking-[0.4em]" />
          </Field>
        )}
        {error && <p className="mb-3 text-[14px] font-medium text-expense" role="alert">{error}</p>}
        <Button type="submit" block loading={pending}>
          {step === "password" ? "Masuk" : "Verifikasi"}
        </Button>
      </div>
      <p className="mt-6 text-center text-caption text-muted">Kas Zuhri &amp; Devi</p>
    </form>
  );
}
