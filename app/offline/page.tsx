export const dynamic = "force-static";
export const metadata = { title: "Tidak ada koneksi" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <img src="/icon-192.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl" />
      <h1 className="text-h1">Tidak ada koneksi internet</h1>
      <p className="text-muted">Data keuangan tidak disimpan di perangkat. Sambungkan internet lalu coba lagi.</p>
      {/* Reload penuh (bukan navigasi klien) karena halaman ini disajikan service worker saat offline */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="pressable inline-flex h-12 items-center rounded-btn bg-primary px-6 font-semibold text-on-primary">
        Coba lagi
      </a>
    </main>
  );
}
