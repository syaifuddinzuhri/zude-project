import { requireUser } from "@/lib/auth/current";
import { listBackups } from "@/lib/server/backup";
import { AppHeader, Page } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backup" };

export default async function BackupPage() {
  await requireUser();
  const files = await listBackups();
  return (
    <>
      <AppHeader title="Backup database" back="/pengaturan" />
      <Page className="space-y-3">
        <Card>
          <p className="text-[14px]">Backup otomatis dibuat harian oleh Cron Jobs hPanel dan disimpan 30 hari. File berupa <b>.sql.gz</b> (struktur + data).</p>
          <a href="/api/backup/download" className="pressable mt-3 flex h-12 items-center justify-center gap-2 rounded-btn bg-primary font-semibold text-on-primary">
            <Icon name="download" size={18} /> Unduh backup sekarang
          </a>
          <p className="mt-3 text-caption text-muted">Restore dilakukan lewat hPanel → Databases → phpMyAdmin → Import (atau fitur backup database Hostinger), bukan lewat upload di website.</p>
        </Card>
        <h2 className="text-h2">Backup harian</h2>
        <Card className="divide-y divide-border/70 py-1">
          {files.length === 0 && <p className="py-3 text-caption text-muted">Belum ada backup harian. Pastikan cron /api/cron/backup sudah dijadwalkan.</p>}
          {files.map((f) => (
            <a key={f.name} href={`/api/backup/download?file=${f.name}`} className="flex min-h-[52px] items-center justify-between py-2">
              <span className="money text-[14px]">{f.name}</span>
              <span className="flex items-center gap-2 text-caption text-muted">{Math.ceil(f.size / 1024)} KB <Icon name="download" size={16} /></span>
            </a>
          ))}
        </Card>
      </Page>
    </>
  );
}
