"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupAction } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function SetupForm() {
  const [form, setForm] = useState({ token: "", name: "Kas Zuhri & Devi", husbandName: "Zuhri", wifeName: "Devi", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await setupAction(form);
      if (!r.ok) return setError(r.error);
      router.replace(r.next ?? "/");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-8 flex justify-center">
        <Logo width={200} />
      </div>
      <div className="glass rounded-card p-5 shadow-glass">
        <h1 className="mb-1 text-h1">Setup awal</h1>
        <p className="mb-4 text-caption text-muted">
          Buat satu akun login untuk rumah tangga. Akun ini dipakai berdua; keuangan suami, istri, dan bersama tetap dipisahkan lewat pemilik akun/dompet. Setelah dibuat, pendaftaran ditutup.
        </p>
        <Field label="Token setup" hint="Nilai SETUP_TOKEN dari environment server">
          <Input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nama suami">
            <Input value={form.husbandName} maxLength={40} onChange={(e) => setForm({ ...form, husbandName: e.target.value })} required />
          </Field>
          <Field label="Nama istri">
            <Input value={form.wifeName} maxLength={40} onChange={(e) => setForm({ ...form, wifeName: e.target.value })} required />
          </Field>
        </div>
        <Field label="Nama tampilan akun">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <Input type="email" inputMode="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter">
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </Field>
        {error && <p className="mb-3 text-[14px] font-medium text-expense" role="alert">{error}</p>}
        <Button type="submit" block loading={pending}>
          Buat akun
        </Button>
      </div>
    </form>
  );
}
