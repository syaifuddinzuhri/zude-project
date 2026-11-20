"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeDeviceAction, saveProfileAction, sendTestNotificationAction, setNotificationPrefAction } from "@/lib/actions/settings";
import { PushCard } from "@/components/push-card";
import { disablePush } from "@/components/pwa";

async function isThisDevice(endpoint: string) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint === endpoint;
  } catch {
    return false;
  }
}
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

interface T { type: string; label: string; supportsEmail: boolean; push: boolean; inapp: boolean; email: boolean }

export function NotifSettings({ types, profile, devices }: { types: T[]; profile: { name: string; quietStart: string; quietEnd: string; hideAmountInPush: boolean; dailyReminderTime: string }; devices: { id: number; endpoint: string; label: string; ua: string; created: string; last: string | null; failed: number }[] }) {
  const [rows, setRows] = useState(types);
  const [p, setP] = useState(profile);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const toggle = (type: string, ch: "push" | "inapp" | "email", v: boolean) => {
    setRows((xs) => xs.map((x) => (x.type === type ? { ...x, [ch]: v } : x)));
    setNotificationPrefAction(type, ch, v).then((r) => !r.ok && toast.error(r.error));
  };

  return (
    <div className="space-y-4">
      <PushCard always />
      <Button
        variant="secondary"
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestNotificationAction();
            if (!r.ok) return toast.error(r.error);
            toast.success(r.data > 0 ? `Notifikasi uji dikirim ke ${r.data} perangkat` : "Tercatat di lonceng. Aktifkan push untuk menerima di HP.");
            router.refresh();
          })
        }
      >
        <Icon name="send" size={18} /> Kirim notifikasi uji
      </Button>

      <section>
        <SectionTitle title="Jenis notifikasi" />
        <Card className="divide-y divide-border/70 py-1">
          {rows.map((t) => (
            <div key={t.type} className="py-2">
              <div className="mb-1 text-[14px] font-semibold">{t.label}</div>
              <div className="flex flex-wrap gap-x-4 text-[13px]">
                <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={t.push} onChange={(e) => toggle(t.type, "push", e.target.checked)} /> Push</label>
                <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={t.inapp} onChange={(e) => toggle(t.type, "inapp", e.target.checked)} /> Di website</label>
                {t.supportsEmail && <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={t.email} onChange={(e) => toggle(t.type, "email", e.target.checked)} /> Email</label>}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle title="Jam tenang & privasi" />
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Jam tenang mulai"><Input type="time" value={p.quietStart} onChange={(e) => setP({ ...p, quietStart: e.target.value })} /></Field>
            <Field label="Sampai"><Input type="time" value={p.quietEnd} onChange={(e) => setP({ ...p, quietEnd: e.target.value })} /></Field>
          </div>
          <p className="-mt-1 mb-2 text-caption text-muted">Push di jam tenang ditunda sampai jam selesai, kecuali jatuh tempo hari ini (H-0).</p>
          <Field label="Pengingat mencatat harian"><Input type="time" value={p.dailyReminderTime} onChange={(e) => setP({ ...p, dailyReminderTime: e.target.value })} /></Field>
          <Switch checked={p.hideAmountInPush} onChange={(v) => setP({ ...p, hideAmountInPush: v })} label="Sembunyikan nominal di notifikasi" />
          <Button block className="mt-2" loading={pending} onClick={() => start(async () => { const r = await saveProfileAction(p); if (!r.ok) return toast.error(r.error); toast.success("Disimpan"); })}>Simpan</Button>
        </Card>
      </section>

      <section>
        <SectionTitle title="Perangkat terdaftar" />
        <Card className="divide-y divide-border/70 py-1">
          {devices.length === 0 && <p className="py-3 text-caption text-muted">Belum ada perangkat yang menerima push.</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex min-h-[56px] items-center gap-3 py-2">
              <Icon name="smartphone" className="text-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{d.label}</div>
                <div className="truncate text-caption text-muted">{d.last ? `Terakhir terkirim ${new Date(d.last).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` : "Belum pernah terkirim"}{d.failed ? ` · gagal ${d.failed}×` : ""}</div>
              </div>
              <button
                className="min-h-[44px] px-2 text-[13px] font-semibold text-expense"
                onClick={() =>
                  start(async () => {
                    if (await isThisDevice(d.endpoint)) await disablePush().catch(() => {});
                    const r = await removeDeviceAction(d.id);
                    if (!r.ok) return toast.error(r.error);
                    router.refresh();
                  })
                }
              >
                Hapus
              </button>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
