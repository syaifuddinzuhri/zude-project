# ZuDe — Kas Zuhri & Devi

Website PWA keuangan rumah tangga suami & istri dengan **satu akun login** yang dipakai berdua. Keuangan suami, istri, dan bersama dipisahkan lewat pemilik akun/dompet, gaji, hutang, dan tujuan. Spesifikasi lengkap ada di [REQUIREMENTS.md](REQUIREMENTS.md).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + MySQL · Motion · Vaul · Recharts · Web Push (VAPID) · Vitest.

---

## Jalan di lokal

Syarat: Node.js 20+, MySQL 8 / MariaDB 10.6+.

```bash
npm install
cp .env.example .env          # isi DATABASE_URL, AUTH_SECRET, SETUP_TOKEN, CRON_SECRET, VAPID_*
npx web-push generate-vapid-keys   # salin ke VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY

# buat database (utf8mb4)
mysql -u root -p -e "CREATE DATABASE zude CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

npx prisma migrate deploy     # buat tabel
npm run db:seed               # kategori bawaan & pengaturan
npm run dev                   # http://localhost:3000
```

Buka `/setup`, masukkan `SETUP_TOKEN`, lalu buat **satu akun login** rumah tangga. Setelah itu pendaftaran tertutup otomatis. Login yang sama bisa dipakai di HP suami dan istri (push dikirim ke semua perangkat yang mengaktifkannya).

Perintah lain:

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Unit test logika keuangan (`lib/finance/`) |
| `npm run typecheck` / `npm run lint` | Pemeriksaan tipe & lint |
| `npm run build` / `npm start` | Build & jalankan production (port dari `PORT`) |
| `npm run db:migrate` | Buat migrasi baru saat skema berubah (dev) |

> Service worker hanya didaftarkan di mode production. Untuk mengujinya saat `npm run dev`, set `NEXT_PUBLIC_SW_DEV=1`.

---

## Struktur

```
app/(auth)/          login, setup, kunci (PIN)
app/(app)/           semua halaman (beranda, transaksi, anggaran, tagihan, tabungan, hutang, …)
app/api/cron/*       endpoint terjadwal (dipanggil Cron Jobs hPanel)
app/api/push/*       langganan Web Push
lib/finance/         fungsi murni + unit test: saldo, split, siklus, amortisasi, anggaran, tujuan, strategi
lib/server/          layanan server: transaksi, hutang, anggaran, tutup buku, privasi, notifikasi, backup
lib/actions/         server actions
lib/notify/          NotificationChannel: InAppChannel, WebPushChannel, EmailChannel
components/          komponen UI (Button, Card, BottomSheet, Keypad, ProgressBar, Ring, Toast, …)
public/sw.js         service worker (cache aset statis saja, push, notificationclick)
prisma/              skema, migrasi, seed
```

Aturan penting yang ditegakkan di server:

- Semua nominal **BIGINT rupiah**; tanggal transaksi **DATE** (Asia/Jakarta).
- Saldo = saldo awal + Σ transaksi *terealisasi* & tidak terhapus (tidak disimpan).
- Operasi multi-baris (split, transfer + biaya admin, bayar cicilan, wizard gaji) dalam satu DB transaction.
- **Bulan terkunci** (setelah tutup buku): perubahan wajib diberi alasan dan tercatat di log aktivitas.
- Tidak ada upload file di mana pun; ekspor hanya unduhan.

---

## Deploy ke Hostinger hPanel (Web App Node.js)

> Fitur Web App (Node.js) hanya ada di paket **Business Web Hosting** atau **Cloud** (Startup ke atas).

1. **Database** — hPanel → *Databases → MySQL Databases*: buat database + user. Catat nama DB, user, password. Host biasanya `localhost`.
2. **Repo** — push proyek ini ke repo GitHub **privat** (file `.env` sudah di-`.gitignore`).
3. **Web App** — hPanel → *Websites → Add website → Node.js Web App* → hubungkan GitHub repo.
   - Node version: **20** atau lebih baru
   - Build command: `npm ci && npx prisma migrate deploy && npm run build`
   - Start command: `npm start`
4. **Environment variables** — isi semua variabel dari `.env.example` di pengaturan Web App (`DATABASE_URL`, `AUTH_SECRET`, `SETUP_TOKEN`, `APP_URL`, `CRON_SECRET`, `VAPID_*`, `SMTP_*`, `BACKUP_DIR`).
   `DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/NAMA_DB"`
5. **Deploy**, lalu sekali saja jalankan seed (Terminal/SSH hPanel di folder aplikasi): `npm run db:seed`.
6. **SSL** — aktifkan SSL gratis di hPanel. HTTPS wajib untuk PWA, cookie sesi, dan push.
7. Buka `https://domain-anda/setup`, buat satu akun login. Setelah itu ganti/hapus `SETUP_TOKEN`.

Setiap push ke branch utama akan di-redeploy; migrasi baru dijalankan otomatis oleh `prisma migrate deploy` di build command.

---

## Cron Jobs hPanel

hPanel → *Advanced → Cron Jobs* → tipe **Custom**. Semua endpoint butuh header secret.

| Jadwal | Perintah |
| --- | --- |
| Setiap 15 menit (`*/15 * * * *`) | `curl -fsS -H "x-cron-secret: CRON_SECRET_ANDA" https://domain-anda/api/cron/reminders` |
| Harian 00:10 (`10 0 * * *`) | `curl -fsS -H "x-cron-secret: CRON_SECRET_ANDA" https://domain-anda/api/cron/recurring` |
| Harian 02:00 (`0 2 * * *`) | `curl -fsS -H "x-cron-secret: CRON_SECRET_ANDA" https://domain-anda/api/cron/backup` |

- `reminders` — tagihan/cicilan H-3, H-1, H-0, pengingat gajian, tutup buku, tujuan tertinggal, pengingat harian; mengirim push yang tertunda karena jam tenang; menandai cicilan terlambat.
- `recurring` — mencatat transaksi berulang mode *otomatis* yang sudah jatuh tempo.
- `backup` — dump SQL (struktur + data, gzip) ke `BACKUP_DIR`, retensi 30 hari.

Catatan: jadwal cron hPanel memakai zona waktu server; aplikasi selalu menghitung tanggal dalam Asia/Jakarta.

---

## Backup & restore

- **Otomatis:** cron `backup` harian → `BACKUP_DIR/zude-YYYY-MM-DD.sql.gz` (30 hari). Arahkan `BACKUP_DIR` ke folder di luar `public_html`.
- **Manual:** *Pengaturan → Backup database → Unduh backup sekarang* (dump terbaru) atau unduh arsip harian.
- Hostinger juga punya backup database otomatis di hPanel.

**Restore** (tidak lewat website):

1. Ekstrak: `gunzip zude-YYYY-MM-DD.sql.gz` → `zude-YYYY-MM-DD.sql`.
2. hPanel → *Databases → phpMyAdmin* → pilih database → **Import** → pilih file `.sql` → Go.
   File berisi `DROP TABLE IF EXISTS` + `CREATE TABLE` + data, jadi database kembali identik dengan saat backup.
3. Atau pakai fitur *Restore* di backup database Hostinger.

**Uji restore** (disarankan tiap beberapa bulan): import ke database kosong terpisah, arahkan salinan aplikasi ke sana, cek saldo akun sama.

---

## PWA & push notification

### Memasang di HP
- **iPhone/iPad (Safari):** buka website → tombol **Bagikan** → **Tambah ke Layar Utama**. Banner panduan muncul otomatis sekali. Login sekali lagi setelah dipasang (PWA iOS punya cookie terpisah dari Safari).
- **Android (Chrome):** menu *Lainnya* → **Pasang di HP**, atau menu Chrome → *Instal aplikasi*.

### Langkah uji push di iPhone (iOS/iPadOS 16.4+)
1. Pastikan website di HTTPS dan `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` terisi.
2. Di Safari: Bagikan → **Tambah ke Layar Utama**.
3. **Tutup Safari**, buka ZuDe dari **ikon di Layar Utama** (push tidak bisa dari tab Safari biasa).
4. Login, lalu di Beranda (atau *Pengaturan → Notifikasi & perangkat*) ketuk **Aktifkan** → pilih **Izinkan**.
5. *Pengaturan → Notifikasi & perangkat* → **Kirim notifikasi uji**. Notifikasi muncul walau aplikasi ditutup.
6. Ketuk notifikasinya → aplikasi terbuka di halaman terkait.
7. Uji pengingat tagihan: buat cicilan/tagihan yang jatuh tempo besok, jalankan
   `curl -H "x-cron-secret: …" https://domain-anda/api/cron/reminders`, kunci HP → push "… jatuh tempo besok" diterima; mengetuknya membuka detail tagihan. Badge ikon menampilkan jumlah tagihan jatuh tempo dan hilang saat aplikasi dibuka.
8. Bila izin pernah ditolak: iPhone *Pengaturan → Notifikasi → ZuDe → Izinkan Notifikasi*.

Push di jam tenang (default 22:00–06:00) ditunda sampai jam tenang berakhir, kecuali jatuh tempo hari ini. Opsi "sembunyikan nominal di notifikasi" ada di pengaturan notifikasi.

---

## Keamanan

- Password & PIN di-hash bcrypt (12 rounds); rate limit login, PIN (5× salah → keluar), dan 2FA.
- Sesi: cookie `httpOnly`, `secure`, `sameSite=lax`, 30 hari. PIN diminta setiap aplikasi dibuka dan setelah 15 menit tidak aktif.
- 2FA (TOTP) opsional di *Pengaturan → Keamanan*.
- Endpoint cron dilindungi `CRON_SECRET` (perbandingan constant-time).
