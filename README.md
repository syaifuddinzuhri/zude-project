# ZuDe — Kas Zuhri & Devi

Website PWA pribadi untuk keuangan rumah tangga suami & istri. Tidak ada halaman daftar/setup: **masuk cukup dengan PIN**. Keuangan suami, istri, dan bersama dipisahkan lewat pemilik akun/dompet, gaji, hutang, dan tujuan. Spesifikasi lengkap ada di [REQUIREMENTS.md](REQUIREMENTS.md).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + MySQL · Motion · Vaul · Recharts · Web Push (VAPID) · Vitest.

---

## Jalan di lokal

Syarat: Node.js 20+, MySQL 8 / MariaDB 10.6+.

```bash
npm install
cp .env.example .env          # isi DATABASE_URL, AUTH_SECRET, APP_PIN, CRON_SECRET, VAPID_*
npx web-push generate-vapid-keys   # salin ke VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY

# buat database (utf8mb4)
mysql -u root -p -e "CREATE DATABASE zude CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

npx prisma migrate deploy     # buat tabel
npm run db:seed               # kategori bawaan & pengaturan
npm run dev                   # http://localhost:3000
```

Buka aplikasi lalu masukkan PIN dari `APP_PIN`. Akun rumah tangga (nama default **Smart Money Management**, suami **Zuhri**, istri **Devi**) dibuat otomatis; semua nama bisa diubah di *Pengaturan → Profil*. Ganti PIN di *Pengaturan → Keamanan*.

**Lupa PIN?** Jalankan `UPDATE users SET pin_hash = NULL;` di phpMyAdmin, lalu masuk dengan `APP_PIN` dan atur PIN baru.

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
app/(auth)/login     masuk dengan PIN
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

## Deploy ke Vercel + MySQL Niagahoster (dipakai sekarang)

Paket shared Niagahoster tidak mendukung Node.js, jadi aplikasi dijalankan di **Vercel** (paket Hobby gratis, untuk pemakaian pribadi), sedangkan **database tetap MySQL Niagahoster**.

### 1. Siapkan database (Niagahoster)
1. Database & user MySQL sudah ada (`u123456_zude`). Pakai **password yang kuat** (min. 20 karakter acak, tanpa `@ : / # ? %` agar tidak perlu di-encode).
2. hPanel → *Databases → Remote MySQL* → tambahkan host **`%`** (semua IP) untuk database tersebut. Vercel tidak punya IP tetap, jadi akses harus dibuka untuk semua IP — keamanan bergantung pada password tadi.
3. `DATABASE_URL` memakai host/IP server MySQL (bukan `localhost`) dan pool kecil, karena shared hosting membatasi jumlah koneksi:
   ```
   mysql://u123456_USER:PASSWORD@HOST_MYSQL_NIAGAHOSTER:3306/u123456_zude?connection_limit=3&pool_timeout=20
   ```

### 2. Upload kode ke GitHub
Buat repo **privat** di GitHub lalu push proyek ini (`.env` tidak ikut karena sudah di-`.gitignore`).

### 3. Buat proyek di Vercel
1. [vercel.com](https://vercel.com) → *Add New → Project* → impor repo tadi. Framework terdeteksi **Next.js**.
2. *Environment Variables* — isi semua dari `.env.example`:
   `DATABASE_URL`, `AUTH_SECRET`, `APP_PIN`, `APP_URL` (domain Vercel, mis. `https://zude.vercel.app`), `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NOTIFY_EMAIL`, `SMTP_*`.
3. **Deploy.** `vercel.json` sudah mengatur: region **Singapura (sin1)**, build menjalankan `prisma migrate deploy` lalu `next build`, dan dua cron harian.
4. Buka domain Vercel → masuk dengan `APP_PIN` → ganti PIN di *Pengaturan → Keamanan*.

Alternatif tanpa GitHub: `npx vercel` lalu `npx vercel --prod` dari folder proyek (login akun Vercel saat diminta), isi environment variable lewat dashboard.

### 4. Jadwal (cron)
| Tugas | Diatur di | Jadwal |
| --- | --- | --- |
| Transaksi berulang | `vercel.json` (otomatis) | harian 00:10 WIB |
| Backup database → email | `vercel.json` (otomatis) | harian 02:00 WIB |
| Pengingat tagihan, gajian, tutup buku, push tertunda | **[cron-job.org](https://cron-job.org)** (gratis) | setiap 15 menit |

Cron Vercel paket Hobby hanya boleh sekali sehari, jadi pengingat 15-menitan memakai cron-job.org:
*Create cronjob* → URL `https://DOMAIN-ANDA/api/cron/reminders` → *Every 15 minutes* → tab *Advanced* → *Headers*: `x-cron-secret` = nilai `CRON_SECRET`.
Cron Vercel otomatis mengirim header `Authorization: Bearer CRON_SECRET`, yang juga diterima aplikasi.

### 5. Backup
Vercel tidak punya disk permanen, jadi backup harian dikirim sebagai **lampiran email** (`.sql.gz`) ke `NOTIFY_EMAIL` — wajib isi `SMTP_*` (pakai akun email Niagahoster, host biasanya `smtp.hostinger.com`, port 465). Backup manual: *Pengaturan → Backup database → Unduh*. Niagahoster juga punya backup database bawaan di hPanel. Restore tetap lewat phpMyAdmin → Import.

---

## Alternatif: Hostinger/Niagahoster dengan paket Node.js

> Fitur Web App (Node.js) hanya ada di paket **Business Web Hosting** atau **Cloud** (Startup ke atas).

1. **Database** — hPanel → *Databases → MySQL Databases*: buat database + user. Catat nama DB, user, password. Host biasanya `localhost`.
2. **Repo** — push proyek ini ke repo GitHub **privat** (file `.env` sudah di-`.gitignore`).
3. **Web App** — hPanel → *Websites → Add website → Node.js Web App* → hubungkan GitHub repo.
   - Node version: **20** atau lebih baru
   - Build command: `npm ci && npx prisma migrate deploy && npm run build`
   - Start command: `npm start`
4. **Environment variables** — isi semua variabel dari `.env.example` di pengaturan Web App (`DATABASE_URL`, `AUTH_SECRET`, `APP_PIN`, `APP_URL`, `CRON_SECRET`, `VAPID_*`, `SMTP_*`, `BACKUP_DIR`).
   `DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/NAMA_DB"`
5. **Deploy**, lalu sekali saja jalankan seed (Terminal/SSH hPanel di folder aplikasi): `npm run db:seed`.
6. **SSL** — aktifkan SSL gratis di hPanel. HTTPS wajib untuk PWA, cookie sesi, dan push.
7. Buka `https://domain-anda`, masuk dengan `APP_PIN`, lalu ganti PIN di Pengaturan → Keamanan.

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
- **iPhone/iPad (Safari):** buka website → tombol **Bagikan** → **Tambah ke Layar Utama**. Banner panduan muncul otomatis sekali. Setelah dipasang, buka dari ikon dan masukkan PIN.
- **Android (Chrome):** menu *Lainnya* → **Pasang di HP**, atau menu Chrome → *Instal aplikasi*.

### Langkah uji push di iPhone (iOS/iPadOS 16.4+)
1. Pastikan website di HTTPS dan `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` terisi.
2. Di Safari: Bagikan → **Tambah ke Layar Utama**.
3. **Tutup Safari**, buka ZuDe dari **ikon di Layar Utama** (push tidak bisa dari tab Safari biasa).
4. Masukkan PIN, lalu di Beranda (atau *Pengaturan → Notifikasi & perangkat*) ketuk **Aktifkan** → pilih **Izinkan**.
5. *Pengaturan → Notifikasi & perangkat* → **Kirim notifikasi uji**. Notifikasi muncul walau aplikasi ditutup.
6. Ketuk notifikasinya → aplikasi terbuka di halaman terkait.
7. Uji pengingat tagihan: buat cicilan/tagihan yang jatuh tempo besok, jalankan
   `curl -H "x-cron-secret: …" https://domain-anda/api/cron/reminders`, kunci HP → push "… jatuh tempo besok" diterima; mengetuknya membuka detail tagihan. Badge ikon menampilkan jumlah tagihan jatuh tempo dan hilang saat aplikasi dibuka.
8. Bila izin pernah ditolak: iPhone *Pengaturan → Notifikasi → ZuDe → Izinkan Notifikasi*.

Push di jam tenang (default 22:00–06:00) ditunda sampai jam tenang berakhir, kecuali jatuh tempo hari ini. Opsi "sembunyikan nominal di notifikasi" ada di pengaturan notifikasi.

---

## Keamanan

- Masuk hanya dengan PIN (4–6 angka, disimpan sebagai hash bcrypt). PIN diminta setiap aplikasi dibuka dan setelah 15 menit tidak aktif.
- Salah PIN dibatasi 5×/15 menit per IP dan 15×/15 menit secara global (mencegah tebak PIN).
- Mengganti PIN membuat semua perangkat lain terkunci.
- Cookie sesi `httpOnly`, `secure`, `sameSite=lax`. Endpoint cron dilindungi `CRON_SECRET` (perbandingan constant-time).
- Email pengingat dikirim ke alamat di `NOTIFY_EMAIL`.
