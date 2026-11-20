"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setThemeAction } from "@/lib/actions/auth";
import { saveHouseholdAction, saveNamesAction, saveProfileAction } from "@/lib/actions/settings";
import { useAppData } from "@/components/app-data";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Switch } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

type Household = {
  cycleMode: "husband_payday" | "wife_payday" | "manual";
  cycleStartDay: number;
  husbandPayday: number;
  wifePayday: number;
  husbandSalary: number;
  wifeSalary: number;
  husbandSalaryAccountId: number | null;
  wifeSalaryAccountId: number | null;
  husbandTemplateId: number | null;
  wifeTemplateId: number | null;
  paydayWeekendRule: boolean;
  bigExpenseThreshold: number;
  emergencyMonths: number;
  ratioNeeds: number;
  ratioWants: number;
  ratioSavings: number;
};

const LINKS = [
  { href: "/pengaturan/notifikasi", icon: "bell-ring", label: "Notifikasi & perangkat" },
  { href: "/pengaturan/keamanan", icon: "shield-check", label: "Keamanan (PIN, password, 2FA)" },
  { href: "/pengaturan/kategori", icon: "tag", label: "Kategori" },
  { href: "/pengaturan/template", icon: "file-text", label: "Template alokasi gaji" },
  { href: "/pengaturan/backup", icon: "download", label: "Backup database" },
];

export function SettingsForm({ profile, household, names: initialNames, currentPeriod, templates }: { profile: { name: string; theme: string; quietStart: string; quietEnd: string; hideAmountInPush: boolean; dailyReminderTime: string }; household: Household; names: { husbandName: string; wifeName: string }; currentPeriod: string; templates: { id: number; name: string }[] }) {
  const d = useAppData();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [p, setP] = useState(profile);
  const [h, setH] = useState(household);
  const [names, setNames] = useState(initialNames);
  const [theme, setTheme] = useState(profile.theme as "system" | "light" | "dark");

  const applyTheme = (t: "system" | "light" | "dark") => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    setThemeAction(t);
  };
  const save = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error((r as { error: string }).error);
      toast.success("Pengaturan disimpan");
      router.refresh();
    });
  const num = (v: string, max = 31) => Math.min(max, Math.max(1, Number(v.replace(/\D/g, "")) || 1));

  return (
    <div className="space-y-4">
      <Card className="divide-y divide-border/70 py-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-[52px] items-center gap-3 py-2">
            <Icon name={l.icon} className="text-primary" />
            <span className="flex-1 text-[15px] font-medium">{l.label}</span>
            <Icon name="chevron-right" className="text-muted" />
          </Link>
        ))}
      </Card>

      <section>
        <SectionTitle title="Profil & tampilan" />
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nama suami"><Input value={names.husbandName} maxLength={40} onChange={(e) => setNames({ ...names, husbandName: e.target.value })} /></Field>
            <Field label="Nama istri"><Input value={names.wifeName} maxLength={40} onChange={(e) => setNames({ ...names, wifeName: e.target.value })} /></Field>
          </div>
          <p className="-mt-1 mb-3 text-caption text-muted">Dipakai di seluruh aplikasi menggantikan label &quot;Suami&quot;/&quot;Istri&quot;.</p>
          <Field label="Nama tampilan akun"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label="Tema">
            <Segmented value={theme} onChange={applyTheme} options={[{ value: "system", label: "Ikuti HP" }, { value: "light", label: "Terang" }, { value: "dark", label: "Gelap" }]} />
          </Field>
          <Button
            block
            loading={pending}
            onClick={() =>
              save(async () => {
                const r = await saveNamesAction(names);
                return r.ok ? saveProfileAction(p) : r;
              })
            }
          >
            Simpan profil
          </Button>
        </Card>
      </section>

      <section>
        <SectionTitle title="Gaji & siklus bulan" />
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tgl gajian suami"><Input inputMode="numeric" value={h.husbandPayday} onChange={(e) => setH({ ...h, husbandPayday: num(e.target.value) })} /></Field>
            <Field label="Tgl gajian istri"><Input inputMode="numeric" value={h.wifePayday} onChange={(e) => setH({ ...h, wifePayday: num(e.target.value) })} /></Field>
            <Field label="Perkiraan gaji suami"><MoneyInput value={h.husbandSalary} onChange={(v) => setH({ ...h, husbandSalary: v })} /></Field>
            <Field label="Perkiraan gaji istri"><MoneyInput value={h.wifeSalary} onChange={(v) => setH({ ...h, wifeSalary: v })} /></Field>
            <Field label="Akun gaji suami">
              <Select value={h.husbandSalaryAccountId ?? ""} onChange={(e) => setH({ ...h, husbandSalaryAccountId: Number(e.target.value) || null })}>
                <option value="">—</option>
                {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Akun gaji istri">
              <Select value={h.wifeSalaryAccountId ?? ""} onChange={(e) => setH({ ...h, wifeSalaryAccountId: Number(e.target.value) || null })}>
                <option value="">—</option>
                {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Template gaji suami">
              <Select value={h.husbandTemplateId ?? ""} onChange={(e) => setH({ ...h, husbandTemplateId: Number(e.target.value) || null })}>
                <option value="">—</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Template gaji istri">
              <Select value={h.wifeTemplateId ?? ""} onChange={(e) => setH({ ...h, wifeTemplateId: Number(e.target.value) || null })}>
                <option value="">—</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Siklus bulan keuangan" hint={`Siklus berjalan: ${currentPeriod}. Semua laporan & anggaran mengikuti siklus ini.`}>
            <Select value={h.cycleMode} onChange={(e) => setH({ ...h, cycleMode: e.target.value as Household["cycleMode"] })}>
              <option value="husband_payday">Ikut gajian suami (tgl {h.husbandPayday})</option>
              <option value="wife_payday">Ikut gajian istri (tgl {h.wifePayday})</option>
              <option value="manual">Tanggal awal manual</option>
            </Select>
          </Field>
          {h.cycleMode === "manual" && (
            <Field label="Tanggal awal siklus" hint="mis. 25 → 25 s.d. 24 bulan berikutnya">
              <Input inputMode="numeric" value={h.cycleStartDay} onChange={(e) => setH({ ...h, cycleStartDay: num(e.target.value) })} />
            </Field>
          )}
          <Switch checked={h.paydayWeekendRule} onChange={(v) => setH({ ...h, paydayWeekendRule: v })} label="Maju ke hari kerja sebelumnya" description="Bila tanggal jatuh di akhir pekan (tgl 29–31 otomatis ke akhir bulan)" />
        </Card>
      </section>

      <section>
        <SectionTitle title="Ambang & target" />
        <Card>
          <Field label="Ambang pengeluaran besar (akun bersama)" hint="Pasangan mendapat notifikasi bila pengeluaran ≥ nominal ini">
            <MoneyInput value={h.bigExpenseThreshold} onChange={(v) => setH({ ...h, bigExpenseThreshold: v })} />
          </Field>
          <Field label="Kelipatan dana darurat (bulan)"><Input inputMode="numeric" value={h.emergencyMonths} onChange={(e) => setH({ ...h, emergencyMonths: num(e.target.value, 36) })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Wajib %"><Input inputMode="numeric" value={h.ratioNeeds} onChange={(e) => setH({ ...h, ratioNeeds: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Keinginan %"><Input inputMode="numeric" value={h.ratioWants} onChange={(e) => setH({ ...h, ratioWants: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Tabungan %"><Input inputMode="numeric" value={h.ratioSavings} onChange={(e) => setH({ ...h, ratioSavings: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
          </div>
          <p className="mb-3 text-caption text-muted">Mata uang IDR · format Rp 1.234.567</p>
          <Button block loading={pending} onClick={() => save(() => saveHouseholdAction(h))}>Simpan pengaturan rumah tangga</Button>
        </Card>
      </section>
    </div>
  );
}
