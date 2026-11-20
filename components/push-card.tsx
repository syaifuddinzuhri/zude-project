"use client";
import { useEffect, useState } from "react";
import { useAppData } from "./app-data";
import { enablePush, getPushState, isIOS, type PushState } from "./pwa";
import { Icon } from "./ui/icon";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

/** Kartu "Aktifkan notifikasi" — izin hanya diminta dari ketukan pengguna. */
export function PushCard({ always }: { always?: boolean }) {
  const { vapidPublicKey } = useAppData();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
    try {
      setDismissed(localStorage.getItem("zude:push-card") === "1");
    } catch {}
  }, []);

  if (!state || state === "subscribed" || state === "unsupported" || !vapidPublicKey) return null;
  if (!always && dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("zude:push-card", "1");
    } catch {}
  };

  return (
    <div className="rounded-card border border-primary/20 bg-surface p-4 shadow-card">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="bell-ring" />
        </span>
        <div className="flex-1">
          <div className="font-semibold">Aktifkan notifikasi</div>
          {state === "needs-install" && <p className="text-caption text-muted">Di iPhone/iPad, pasang ZuDe ke Layar Utama dulu (Bagikan → Tambah ke Layar Utama), lalu buka dari ikonnya.</p>}
          {state === "denied" && (
            <p className="text-caption text-muted">
              Izin notifikasi ditolak. {isIOS() ? "Buka Pengaturan iPhone → Notifikasi → ZuDe → Izinkan." : "Buka pengaturan situs di browser → Notifikasi → Izinkan."}
            </p>
          )}
          {(state === "default" || state === "granted-unsubscribed") && <p className="text-caption text-muted">Pengingat tagihan, cicilan, dan anggaran langsung ke HP.</p>}
        </div>
        {!always && (
          <button onClick={dismiss} className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center text-muted" aria-label="Tutup">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      {(state === "default" || state === "granted-unsubscribed") && (
        <Button
          size="sm"
          className="mt-3"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const s = await enablePush(vapidPublicKey);
              setState(s);
              if (s === "subscribed") toast.success("Notifikasi aktif di perangkat ini");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi");
            } finally {
              setBusy(false);
            }
          }}
        >
          Aktifkan
        </Button>
      )}
    </div>
  );
}
