# Requirements — ZuDe
### Website Keuangan Rumah Tangga (Suami & Istri)

> Versi 1.0 · 20 November 2026
> Dokumen ini adalah spesifikasi untuk dibangun dengan Claude Code. Semua bagian bertanda **[WAJIB]** masuk Fase 1 (MVP).

---

## 1. Ringkasan

Website pribadi (bukan SaaS) untuk satu rumah tangga yang dikelola berdua oleh **suami dan istri**. Dipakai untuk:

- Mencatat **pemasukan** dari dua orang (gaji, bonus, THR, usaha sampingan, trading, dll).
- Mencatat dan mengendalikan **pengeluaran** dengan anggaran bulanan.
- Mengelola **tabungan & tujuan keuangan** (dana darurat, pendidikan, rumah, liburan, dll).
- Mengelola **hutang & cicilan** (KPR, kendaraan, kartu kredit, paylater, pinjaman keluarga) beserta jadwal dan sisa pokok.
- **Tutup buku bulanan**: melihat posisi keuangan tiap akhir bulan dan merencanakan bulan berikutnya.

Bentuknya **website PWA**: dibuka lewat browser dan bisa **Add to Home Screen** di Android maupun iOS sehingga terasa seperti aplikasi. Tampilannya **selalu versi mobile**, termasuk saat dibuka dari desktop: konten berada di kolom selebar layar HP di tengah layar. Mata uang utama **IDR**.

### 1.1 Masalah yang diselesaikan

| Masalah | Solusi di website |
| --- | --- |
| Uang tersebar di banyak rekening & e-wallet milik dua orang | Modul Akun/Dompet dengan saldo terpadu |
| Tidak jelas uang bersama vs uang pribadi | Kepemilikan akun + kategori "uang jajan pribadi" |
| Tagihan & cicilan sering lupa | Transaksi berulang + pengingat jatuh tempo |
| Hutang banyak, tidak tahu kapan lunas | Modul hutang dengan amortisasi & simulasi pelunasan |
| Gaji habis tanpa tahu ke mana | Anggaran per kategori (metode amplop / zero-based) |
| Tidak pernah evaluasi | Tutup buku bulanan + laporan tren |

### 1.2 Di luar lingkup (Fase 1)

- Multi-keluarga / langganan berbayar.
- Sinkronisasi otomatis dengan mutasi bank.
- **Upload file dalam bentuk apa pun** (foto struk, bukti bayar, gambar, impor CSV/Excel). Semua data diinput lewat form.
- Perhitungan pajak lengkap (SPT).

---

## 2. Pengguna & Peran

- **[WAJIB]** Hanya **2 pengguna**: suami (**Zuhri**) dan istri (**Devi**). **Tidak ada peran Owner, admin, atau Viewer** — keduanya setara dan punya hak yang sama atas semua fitur & pengaturan.
- Akun pengguna dibuat sekali saat setup awal (seed / halaman setup pertama kali). Setelah 2 pengguna terdaftar, pendaftaran ditutup.
- Setiap pengguna diberi label `suami` atau `istri`; label ini dipakai untuk kepemilikan akun, gaji, dan laporan per orang.

Aturan privasi:

- **[WAJIB]** Setiap akun/dompet punya pemilik: `suami`, `istri`, atau `bersama`.
- **[WAJIB]** Akun bisa ditandai **privat**: pasangan hanya melihat saldo total & total pengeluaran, bukan detail transaksi (untuk uang jajan pribadi / kejutan hadiah). Default: tidak privat.
- Pengeluaran besar di atas ambang (mis. ≥ Rp2.000.000, dapat diatur) dari akun bersama memunculkan **notifikasi** ke pasangan. Tidak ada alur persetujuan; transaksi langsung tersimpan.

---

## 3. Kebutuhan Fungsional

### 3.1 Akun & Dompet **[WAJIB]**

- Jenis akun: Rekening bank, E-wallet, Tunai, Kartu kredit, Paylater, Investasi, Piutang.
- Field: nama, jenis, pemilik (suami/istri/bersama), saldo awal, tanggal saldo awal, warna/ikon, privat (ya/tidak), arsip (ya/tidak), termasuk dalam net worth (ya/tidak).
- Saldo dihitung dari saldo awal + seluruh transaksi (tidak disimpan manual).
- **Penyesuaian saldo**: jika saldo di website ≠ saldo nyata, buat transaksi "Penyesuaian" otomatis dengan selisihnya.
- Kartu kredit: limit, tanggal cetak tagihan, tanggal jatuh tempo; tampilkan tagihan berjalan & sisa limit.

### 3.2 Transaksi **[WAJIB]**

Jenis transaksi:

| Jenis | Efek |
| --- | --- |
| Pemasukan | Menambah saldo akun |
| Pengeluaran | Mengurangi saldo akun |
| Transfer | Pindah antar akun (termasuk antar suami ↔ istri); bukan pemasukan/pengeluaran |
| Bayar hutang | Mengurangi saldo akun & sisa hutang (dipecah pokok + bunga/biaya) |
| Setor tabungan | Transfer ke akun/tujuan tabungan, tercatat sebagai progres tujuan |
| Penyesuaian | Koreksi saldo |

Field: tanggal & jam, jenis, nominal, akun, kategori, subkategori, dicatat oleh (otomatis), untuk siapa (suami/istri/anak/keluarga), catatan, tag, biaya admin transfer (opsional, tercatat sebagai pengeluaran kategori "Biaya Bank").

Kemampuan:

- **[WAJIB]** Input cepat di mobile: ≤ 3 ketukan setelah halaman terbuka (nominal → kategori → simpan), akun & tanggal default terakhir dipakai.
- **[WAJIB]** Split transaksi: satu struk dibagi ke beberapa kategori (mis. belanja supermarket = Dapur + Kebutuhan Bayi + Rumah Tangga).
- **[WAJIB]** Edit, duplikat, hapus (soft delete + bisa dipulihkan 30 hari).
- **[WAJIB]** Pencarian & filter: rentang tanggal, akun, kategori, pemilik, tag, nominal min/maks, teks catatan.
- Transaksi terjadwal masa depan (status *terencana* vs *terealisasi*).

### 3.3 Kategori **[WAJIB]**

Dua level (kategori → subkategori), bisa ditambah/ubah/arsip. Kategori bawaan:

**Pemasukan:** Gaji Suami, Gaji Istri, Bonus/Insentif, THR, Usaha Sampingan, **Hasil Trading** (profit trading dicatat sebagai pemasukan biasa, tidak ada akun/modul trading terpisah), Hasil Investasi, Hadiah, Pengembalian Dana, Lainnya.

**Pengeluaran:**

| Kelompok | Contoh subkategori |
| --- | --- |
| Kebutuhan Pokok | Belanja dapur, makan di luar, air galon, gas |
| Rumah | Listrik, air PDAM, internet, IPL/keamanan, perbaikan, ART |
| Transportasi | Bensin, tol, parkir, servis, ojek online |
| Anak | Sekolah/SPP, les, susu & popok, jajan, mainan |
| Kesehatan | BPJS, obat, dokter, asuransi |
| Komunikasi | Pulsa, paket data, langganan aplikasi |
| Sosial & Ibadah | Zakat, infak/sedekah, kondangan, arisan, kiriman orang tua |
| Pribadi Suami | Uang jajan, hobi, pakaian |
| Pribadi Istri | Uang jajan, perawatan, pakaian |
| Hiburan | Liburan, streaming, nongkrong |
| Biaya Keuangan | Bunga, denda, biaya admin, iuran kartu |
| Lain-lain | — |

Setiap kategori pengeluaran punya sifat: **wajib/tetap** (needs), **keinginan** (wants), atau **tabungan/hutang** — dipakai untuk laporan rasio 50/30/20.

### 3.4 Pemasukan & Rencana Gaji **[WAJIB]**

- Daftar sumber pemasukan rutin per orang: nama, nominal perkiraan, tanggal masuk, akun tujuan.
- **Tanggal gajian suami dan tanggal gajian istri diatur di halaman Pengaturan** (3.14).
- **Siklus bulan keuangan** juga diatur di Pengaturan: pilih mengikuti tanggal gajian suami, tanggal gajian istri, atau tanggal awal yang ditentukan sendiri (mis. 25 s.d. 24). Semua laporan & anggaran mengikuti siklus ini.
- Pengingat "Gaji masuk?" muncul di dashboard pada tanggal gajian masing-masing.
- Saat gaji masuk, tampilkan **wizard alokasi gaji**: pecah otomatis ke pos-pos (bayar cicilan, setor tabungan, isi amplop anggaran, transfer uang jajan masing-masing) sesuai template yang disimpan.
- Pemasukan tidak rutin (bonus, THR) bisa dialokasikan dengan template terpisah (mis. 50% pelunasan hutang, 30% tabungan, 20% bebas).

### 3.5 Anggaran Bulanan **[WAJIB]**

- Metode: **zero-based budgeting** — total pemasukan rencana dialokasikan habis ke kategori, tabungan, dan hutang sampai sisa "belum dialokasikan" = 0.
- Anggaran per kategori/subkategori per siklus bulan.
- Salin anggaran bulan lalu / dari template.
- **Rollover** opsional per kategori: sisa atau kelebihan dibawa ke bulan berikutnya.
- Indikator: hijau (< 80%), kuning (80–100%), merah (> 100%).
- Notifikasi saat kategori mencapai 80% dan 100%.
- Pengeluaran tahunan/musiman (pajak kendaraan, SPP tahunan, lebaran, asuransi tahunan) → fitur **sinking fund**: nominal tahunan dibagi rata per bulan dan disisihkan otomatis.

### 3.6 Tagihan & Transaksi Berulang **[WAJIB]**

- Pola: harian, mingguan, bulanan (tanggal tertentu / hari kerja terakhir), tahunan, setiap N bulan.
- Mode: otomatis tercatat, atau **menunggu konfirmasi** (nominal bisa diubah, mis. listrik yang berubah-ubah).
- Kalender tagihan bulan berjalan: status *belum dibayar / sudah / terlambat*.
- Pengingat H-3 dan H-0 (di website + email).

### 3.7 Tabungan & Tujuan Keuangan **[WAJIB]**

- Tujuan: nama, target nominal, target tanggal, akun penyimpanan, prioritas, pemilik (suami/istri/bersama), ikon.
- Contoh bawaan: Dana Darurat (target = N × pengeluaran wajib bulanan, N bisa diatur, default 6), Dana Pendidikan Anak, DP Rumah, Haji/Umrah, Liburan, Ganti Kendaraan.
- Hitung otomatis: **setoran per bulan yang dibutuhkan** agar target tercapai tepat waktu; status *on track / tertinggal*.
- Satu akun bisa menampung beberapa tujuan (alokasi virtual), total alokasi tidak boleh melebihi saldo akun.
- Riwayat setoran & penarikan per tujuan.

### 3.8 Hutang & Cicilan **[WAJIB]**

Jenis: KPR, Kendaraan (KKB), Kredit Tanpa Agunan, Kartu Kredit, Paylater, Pinjaman Online, Pinjaman Keluarga/Teman, Cicilan barang (0%), Lainnya.

Field: nama, pemberi pinjaman, jenis, peminjam (suami/istri/bersama), pokok awal, tanggal mulai, tenor (bulan), suku bunga & tipe bunga (**flat / efektif-anuitas / floating** dengan riwayat perubahan bunga / **0%**), cicilan per bulan, tanggal jatuh tempo, denda keterlambatan, akun pembayaran default, catatan.

Kemampuan:

- **[WAJIB]** Jadwal amortisasi otomatis (pokok, bunga, sisa pokok per periode); untuk KPR floating, jadwal dihitung ulang saat bunga berubah.
- **[WAJIB]** Pembayaran cicilan terhubung ke transaksi; sisa hutang berkurang otomatis.
- **[WAJIB]** Pelunasan sebagian (extra payment) dengan pilihan: kurangi tenor atau kurangi cicilan; tampilkan penghematan bunga.
- **[WAJIB]** Ringkasan: total hutang, total cicilan per bulan, **Debt Service Ratio** (total cicilan ÷ total pemasukan) dengan peringatan jika > 30%, perkiraan tanggal bebas hutang.
- Simulasi strategi pelunasan **Snowball** (saldo terkecil dulu) vs **Avalanche** (bunga tertinggi dulu) dengan dana ekstra X per bulan — bandingkan total bunga & tanggal lunas.
- **Piutang** (orang lain berhutang ke kita): nama peminjam, nominal, tanggal janji bayar, riwayat cicilan, pengingat.

### 3.9 Aset & Net Worth

- Aset non-kas: rumah, kendaraan, emas (gram + harga per gram manual), reksa dana, saham, kripto, BPJS TK/JHT.
- Nilai diperbarui manual dengan riwayat (tanggal + nilai).
- **Net worth** = total aset + saldo akun − total hutang; grafik bulanan.

### 3.10 Tutup Buku Bulanan **[WAJIB]**

Di akhir siklus, wizard 5 langkah:

1. Cocokkan saldo semua akun dengan saldo nyata (buat penyesuaian bila beda).
2. Konfirmasi tagihan berulang yang belum dibayar.
3. Ringkasan bulan: pemasukan, pengeluaran, tabungan, pembayaran hutang, sisa; anggaran vs realisasi per kategori.
4. Putuskan sisa uang: rollover ke anggaran, setor ke tujuan, atau pelunasan hutang ekstra.
5. Kunci bulan (transaksi bulan terkunci bisa diubah suami atau istri hanya dengan mengisi alasan, tercatat di log).

Hasil tutup buku disimpan sebagai **snapshot** (tidak berubah walau data lama diedit) dan bisa diekspor PDF.

### 3.11 Dashboard **[WAJIB]**

Kartu utama (siklus bulan berjalan):

- Pemasukan vs pengeluaran, sisa uang yang bisa dipakai sampai gajian berikutnya, **sisa per hari**.
- Anggaran per kategori (progress bar), 5 kategori terboros.
- Tagihan & cicilan 7 hari ke depan.
- Progres tujuan tabungan.
- Total hutang & DSR, net worth.
- Kontribusi suami vs istri ke pos bersama.
- Filter cepat: Bersama / Suami / Istri / Semua.

### 3.12 Laporan

- Arus kas bulanan & tahunan (bar chart pemasukan vs pengeluaran).
- Pengeluaran per kategori (donut) & tren per kategori 12 bulan.
- Anggaran vs realisasi.
- Rasio: needs / wants / tabungan+hutang (target 50/30/20, bisa diatur), savings rate, DSR, rasio dana darurat (bulan tertutup).
- Laporan per orang (suami/istri) & per penerima manfaat (anak).
- Ekspor CSV / Excel / PDF.

### 3.13 Notifikasi

| Pemicu | Kanal | Contoh isi push |
| --- | --- | --- |
| Tagihan/cicilan H-3 & H-0 | **Push**, di website, email | "Cicilan KPR Rp 4.250.000 jatuh tempo besok" |
| Anggaran kategori 80% / 100% | **Push**, di website | "Anggaran Makan di Luar sudah 82%" |
| Pengeluaran besar dari akun bersama | **Push** ke pasangan, di website | "Istri mencatat pengeluaran Rp 2.500.000 — Elektronik" |
| Pengingat tanggal gajian | **Push**, di website | "Hari ini gajian? Catat & alokasikan gaji" |
| Pengingat tutup buku | **Push**, di website, email | "Siklus bulan berakhir besok — saatnya tutup buku" |
| Tujuan tabungan tertinggal | Di website (push opsional) | "Dana Pendidikan tertinggal Rp 600.000 bulan ini" |
| Pengingat mencatat harian (opsional) | **Push** | "Sudah catat pengeluaran hari ini?" (jam bisa diatur, default 20:00) |

### 3.13.1 Push Notification (Android & iOS) **[WAJIB]**

- Memakai **Web Push** standar (Push API + Notification API + VAPID) lewat service worker PWA — tanpa Firebase/OneSignal dan tanpa biaya.
- **iOS/iPadOS 16.4+**: push hanya berfungsi jika website **sudah dipasang ke Layar Utama** dan dibuka dari ikon tersebut. Di Safari biasa, tombol aktifkan push diganti ajakan memasang PWA dulu (lihat 5.2).
- **Android (Chrome)**: berfungsi dari browser maupun setelah dipasang.
- **Izin diminta hanya dari ketukan pengguna** (wajib di iOS): kartu *"Aktifkan notifikasi"* di Beranda/Pengaturan → tombol → `Notification.requestPermission()`. Jangan minta izin otomatis saat halaman dibuka.
- Jika izin ditolak, tampilkan panduan cara mengaktifkan ulang (iOS: Pengaturan → Notifikasi → ZuDe).
- Satu pengguna bisa punya beberapa perangkat (HP + iPad + laptop); push dikirim ke semua langganan aktif milik pengguna itu.
- **Pengaturan per jenis notifikasi** (on/off) per pengguna, plus **jam tenang** (default 22:00–06:00; push yang jatuh di jam tenang ditunda ke 06:00, kecuali H-0 jatuh tempo).
- Ketuk notifikasi → membuka halaman terkait (detail tagihan, kategori anggaran, transaksi, wizard tutup buku) lewat `notificationclick` + `clients.openWindow(url)`.
- **Badge ikon** (`navigator.setAppBadge`) menampilkan jumlah tagihan yang jatuh tempo/terlambat; dibersihkan saat dibuka. Didukung PWA iOS 16.4+ dan Android.
- Isi push **tidak menampilkan saldo total**; cukup nominal tagihan/transaksi yang relevan. Opsi "sembunyikan nominal di notifikasi" di Pengaturan.
- Langganan yang gagal dengan status **404/410** otomatis dihapus.
- Tombol **"Kirim notifikasi uji"** di Pengaturan.
- Setiap push juga dicatat di tabel `notifications` supaya tetap terlihat di pusat notifikasi website (ikon lonceng).

Kanal dibuat sebagai interface `NotificationChannel` dengan implementasi `InAppChannel`, `WebPushChannel`, `EmailChannel`. Integrasi WhatsApp **ditunda** (belum masuk roadmap) dan nanti cukup menambah `WhatsAppChannel` tanpa mengubah logika pemicu.

### 3.14 Pengaturan

- Profil pengguna, PIN/biometrik untuk membuka website.
- **Gaji**: tanggal gajian suami, tanggal gajian istri, perkiraan nominal masing-masing, akun tujuan gaji, template alokasi gaji masing-masing.
- **Siklus bulan**: ikut gajian suami / ikut gajian istri / tanggal awal manual. Jika tanggal jatuh pada akhir pekan atau tanggal 29–31, ada opsi "maju ke hari kerja sebelumnya".
- Mata uang, format angka (Rp 1.234.567).
- Ambang pengeluaran besar, target rasio anggaran, kelipatan dana darurat.
- Kelola kategori, template alokasi gaji, template anggaran.
- **Backup**: backup database otomatis harian (lihat 5) + tombol **unduh** backup. Restore dilakukan lewat hPanel (phpMyAdmin / fitur backup database Hostinger), bukan lewat upload di website.

### 3.15 Log Aktivitas **[WAJIB]**

Semua create/update/delete tercatat: siapa, kapan, data sebelum & sesudah. Bisa dilihat kedua pasangan (transparansi).

---

## 4. User Stories (MoSCoW)

### Must
- Sebagai **istri**, saya ingin mencatat belanja dapur dalam < 10 detik dari HP agar tidak menunda pencatatan.
- Sebagai **suami**, saya ingin gaji saya dibagi otomatis ke cicilan, tabungan, dan amplop belanja saat masuk.
- Sebagai **pasangan**, kami ingin melihat sisa anggaran tiap kategori agar tahu masih boleh belanja atau tidak.
- Sebagai **pasangan**, kami ingin tahu total hutang, cicilan bulanan, dan kapan semua lunas.
- Sebagai **pasangan**, kami ingin diingatkan sebelum tagihan jatuh tempo agar tidak kena denda.
- Sebagai **pasangan**, kami ingin tutup buku tiap bulan dan melihat apakah bulan ini surplus atau defisit.
- Sebagai **istri**, saya ingin punya uang jajan pribadi yang detailnya tidak harus dilihat suami (dan sebaliknya).

### Should
- Simulasi snowball vs avalanche untuk mempercepat pelunasan.
- Sinking fund untuk pengeluaran tahunan.
- Laporan rasio 50/30/20 & savings rate.
- Notifikasi pengeluaran besar ke pasangan.

### Could
- Harga emas otomatis.

### Won't (sekarang)
- Multi-keluarga, langganan berbayar, integrasi API bank langsung.

---

## 5. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Bentuk | **Website PWA** — bisa dibuka di browser atau dipasang ke layar utama (Android & iOS); bukan aplikasi App Store/Play Store; tanpa mode offline — lihat 5.2 |
| Tampilan | **Selalu versi mobile** di semua perangkat — lihat 5.1 |
| Performa | Dashboard tampil < 2 detik di 4G; input transaksi tersimpan < 500 ms |
| Akurasi uang | Nominal disimpan sebagai **integer rupiah** (BIGINT) atau DECIMAL(18,2); tidak pernah float |
| Konsistensi | Operasi multi-baris (split, transfer, bayar hutang) dalam satu DB transaction |
| Keamanan | HTTPS, password hash argon2/bcrypt, 2FA (TOTP) opsional, session timeout, PIN untuk membuka website, rate limit login |
| Privasi | Akun privat ditegakkan di sisi server, bukan hanya disembunyikan di UI |
| Backup | Backup DB otomatis harian, retensi 30 hari, uji restore |
| Zona waktu | Asia/Jakarta, tanggal transaksi disimpan sebagai tanggal lokal |
| Bahasa | Bahasa Indonesia (struktur siap i18n) |
| Aksesibilitas | Kontras cukup, ukuran sentuh ≥ 44 px, dark mode |

### 5.1 Tampilan mobile di semua perangkat **[WAJIB]**

- Seluruh website memakai **satu layout mobile**. Tidak ada layout tablet/desktop, tidak ada sidebar, tidak ada breakpoint yang mengubah susunan halaman.
- Konten dibungkus kontainer dengan **lebar maksimum 430 px**, rata tengah (`mx-auto`), tinggi minimal satu layar.
- Di layar lebar (desktop), area di kiri-kanan kontainer diberi latar polos/netral, sehingga tampak seperti layar HP di tengah browser.
- Bottom nav, tombol (+), header, toast, modal, dan bottom sheet ikut terkunci di lebar kontainer (bukan selebar jendela browser).
- Lebar minimum yang didukung 360 px; di bawah 430 px kontainer mengisi penuh lebar layar.
- Tabel lebar (jadwal amortisasi, laporan) ditampilkan sebagai daftar kartu atau tabel yang bisa digeser horizontal di dalam kontainer.
- Grafik menyesuaikan lebar kontainer, bukan lebar jendela.
- Di desktop, input tetap nyaman dengan mouse & keyboard (Enter untuk simpan, Esc untuk tutup modal), tanpa mengubah layout.
- Implementasi Tailwind: jangan pakai prefix `md:`/`lg:`/`xl:` untuk mengubah tata letak; bungkus root layout dengan `<div class="mx-auto min-h-dvh w-full max-w-[430px] bg-background shadow">`.

### 5.2 PWA — Add to Home Screen (Android & iOS) **[WAJIB]**

Website dibuat sebagai **PWA** supaya bisa dipasang di layar utama HP dan dibuka seperti aplikasi (tanpa address bar), termasuk di **iPhone/iPad**. Tetap satu website yang sama; tidak lewat App Store / Play Store.

**Manifest (`app/manifest.ts` → `/manifest.webmanifest`)**
- `name`: "ZuDe — Kas Zuhri & Devi", `short_name`: "ZuDe".
- `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `orientation: "portrait"`, `lang: "id"`.
- `theme_color` & `background_color` sesuai tema (dukung light/dark).
- Ikon PNG 192×192, 512×512, dan 512×512 `purpose: "maskable"`.

**Khusus iOS (Safari)**
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` ukuran **180×180**, tanpa transparansi (iOS tidak memakai ikon dari manifest).
- Meta: `apple-mobile-web-app-capable = yes`, `mobile-web-app-capable = yes`, `apple-mobile-web-app-title = ZuDe`, `apple-mobile-web-app-status-bar-style = default` (atau `black-translucent` + padding safe area).
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.
- **Safe area**: header, bottom nav, dan tombol (+) memakai `env(safe-area-inset-top/bottom)` agar tidak tertutup notch / home indicator.
- Gunakan `min-h-dvh` (bukan `100vh`) supaya tinggi layar benar saat standalone.
- Input angka memakai `inputmode="decimal"` / `numeric` dan font input ≥ 16 px agar Safari tidak auto-zoom.
- Nonaktifkan pull-to-refresh/overscroll yang mengganggu (`overscroll-behavior: none` pada body), tapi sediakan tombol/gesture refresh di halaman daftar.
- Splash: cukup warna `background_color` + ikon; startup image iOS opsional.

**Panduan pemasangan di dalam website**
- iOS tidak punya tombol install otomatis, jadi tampilkan **banner panduan** sekali (bisa ditutup, diingat di localStorage) saat dibuka di Safari iOS dan belum standalone: *"Ketuk tombol Bagikan → Tambah ke Layar Utama"* dengan ilustrasi ikon.
- Android/Chrome: tangkap event `beforeinstallprompt` dan tampilkan tombol **"Pasang di HP"** di menu Lainnya.
- Deteksi mode standalone (`display-mode: standalone` atau `navigator.standalone`) untuk menyembunyikan banner.

**Service worker**
- Pakai **Serwist** (`@serwist/next`) atau service worker manual minimal.
- Cache **aset statis saja** (JS, CSS, font, ikon) agar cepat dibuka.
- **Data keuangan tidak di-cache dan tidak ada mode offline**: halaman/API data selalu `network-only`. Jika tidak ada koneksi, tampilkan halaman *"Tidak ada koneksi internet"* dengan tombol coba lagi.
- Saat ada versi baru, tampilkan toast *"Versi baru tersedia — Muat ulang"*.

**Login di mode standalone**
- Sesi login bertahan lama (cookie `httpOnly`, `secure`, `sameSite=lax`, masa berlaku mis. 30 hari) agar tidak perlu login ulang tiap membuka dari home screen; PIN tetap diminta saat dibuka (3.14).
- Catatan iOS: PWA di home screen punya penyimpanan/cookie terpisah dari Safari, jadi pengguna login sekali lagi setelah memasang.

**Push notification**: service worker juga menangani event `push` & `notificationclick` (lihat 3.13.1). Di iOS push hanya aktif setelah PWA dipasang, jadi banner panduan pemasangan juga menyebut manfaat ini: *"Pasang ke Layar Utama untuk menerima pengingat tagihan"*.

---

## 6. Model Data (Entitas Utama)

```
users            (id, name, email, password_hash, spouse_label[suami|istri] UNIQUE, pin_hash, totp_secret, created_at)
household_settings (id, cycle_mode[husband_payday|wife_payday|manual], cycle_start_day, husband_payday, wife_payday, payday_weekend_rule, currency, big_expense_threshold, emergency_months, ratio_needs, ratio_wants, ratio_savings)

accounts         (id, name, type[bank|ewallet|cash|credit_card|paylater|investment|receivable],
                  owner[suami|istri|bersama], opening_balance, opening_date, is_private, is_archived,
                  include_in_networth, credit_limit, statement_day, due_day, color, icon)

categories       (id, parent_id, name, kind[income|expense], nature[needs|wants|savings_debt], icon, is_archived, sort_order)

transactions     (id, date, type[income|expense|transfer|debt_payment|saving_deposit|adjustment],
                  account_id, to_account_id, amount, fee_amount, note, beneficiary[suami|istri|anak|keluarga],
                  status[planned|realized], recurring_id, debt_id, goal_id, created_by, updated_by,
                  deleted_at, created_at, updated_at)
transaction_splits (id, transaction_id, category_id, amount, note)    -- min. 1 baris per income/expense
transaction_tags (transaction_id, tag_id)
tags             (id, name)

recurring_rules  (id, template_json, frequency, interval, day_of_month, month_of_year, next_run_date,
                  mode[auto|confirm], end_date, is_active)

budget_periods   (id, period_start, period_end, status[open|closed|locked], closed_at, snapshot_json)
budgets          (id, period_id, category_id, amount, rollover_enabled, rollover_amount)
sinking_funds    (id, name, category_id, annual_amount, due_month, account_id)
allocation_templates (id, name, trigger[salary|bonus|manual], items_json)   -- [{target_type, target_id, amount|percent}]

goals            (id, name, target_amount, target_date, account_id, owner, priority, icon, is_achieved)
goal_allocations (id, goal_id, transaction_id, amount)

debts            (id, name, lender, type, borrower[suami|istri|bersama], principal, start_date, tenor_months,
                  interest_type[flat|annuity|floating|zero], interest_rate, installment_amount, due_day,
                  late_fee, default_account_id, status[active|paid_off], note)
debt_rate_changes (id, debt_id, effective_date, interest_rate)
debt_schedule    (id, debt_id, period_no, due_date, principal_part, interest_part, total, remaining_principal,
                  status[unpaid|paid|late], payment_transaction_id)

receivables      (id, debtor_name, amount, date, promised_date, status, note)

assets           (id, name, type[property|vehicle|gold|mutual_fund|stock|crypto|pension|other], owner, unit, quantity)
asset_valuations (id, asset_id, date, value)

notifications    (id, user_id, type, payload_json, url, read_at, pushed_at, created_at)
push_subscriptions (id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, device_label, created_at, last_success_at, failed_count)
notification_prefs (user_id, type, push_enabled, inapp_enabled, email_enabled)  -- + quiet_start, quiet_end, hide_amount, daily_reminder_time di household/user settings
audit_logs       (id, user_id, entity, entity_id, action, before_json, after_json, reason, created_at)
```

Aturan penting:

- Jumlah `transaction_splits.amount` = `transactions.amount`.
- Saldo akun = `opening_balance` + Σ efek transaksi *realized* dan tidak terhapus.
- Transaksi di periode `locked` bisa diubah oleh kedua pengguna dengan `reason` wajib.
- Transfer tidak masuk laporan pemasukan/pengeluaran.
- `debt_payment` memecah nominal menjadi pokok (mengurangi hutang) dan bunga/biaya (dicatat sebagai pengeluaran kategori Biaya Keuangan).

---

## 7. Halaman & Navigasi

Satu tata letak saja: **mobile**, di semua perangkat (lihat 5.1).

**Bottom nav (selalu tampil):** Beranda · Transaksi · **(+) Tambah** · Anggaran · Lainnya

Halaman lain dibuka dari menu **Lainnya** (daftar menu ala aplikasi mobile):

| Halaman | Isi |
| --- | --- |
| Dashboard | Kartu ringkasan (3.11) |
| Transaksi | Daftar + filter + pencarian, tambah/edit, split |
| Anggaran | Alokasi zero-based, progress per kategori, sinking fund |
| Tagihan | Kalender & daftar tagihan berulang |
| Tabungan | Daftar tujuan, progres, setor/tarik |
| Hutang | Daftar hutang, detail + jadwal amortisasi, simulasi pelunasan, piutang |
| Akun | Daftar akun & saldo, penyesuaian saldo |
| Aset & Net Worth | Daftar aset, riwayat nilai, grafik net worth |
| Laporan | Semua laporan 3.12 + ekspor |
| Tutup Buku | Wizard 3.10 + arsip snapshot |
| Pengaturan | 3.14, pengguna, kategori, template |
| Log Aktivitas | 3.15 |

Alur kunci yang harus mulus:

1. **Catat pengeluaran**: tombol + → keypad nominal → pilih kategori (grid ikon, 8 paling sering di atas) → simpan.
2. **Gajian**: notifikasi/tombol "Gaji masuk" → konfirmasi nominal → wizard alokasi → semua transfer & setoran tercatat sekaligus.
3. **Bayar cicilan**: dari kalender tagihan → "Bayar" → transaksi debt_payment terisi otomatis (pokok/bunga dari jadwal).
4. **Tutup buku**: wizard 5 langkah.

---

## 8. Desain UI / UX **[WAJIB]**

Gaya visual: **modern fintech, bersih, dan tenang**. Dasarnya kartu-kartu lembut dengan sudut membulat, aksen **glassmorphism** pada elemen yang melayang (bottom nav, header, bottom sheet, kartu saldo utama), latar dengan gradasi halus, dan animasi mikro yang cepat. Prinsip: angka uang selalu jadi fokus utama, warna dipakai untuk makna (masuk/keluar/peringatan), bukan sekadar hiasan.

### 8.0 Identitas: Nama & Logo

- **Nama:** **ZuDe** — gabungan **Zu**hri + **De**vi. Tagline: *"Kas Zuhri & Devi"*.
- **Logo:** monogram **ZD** dalam satu garis putih tebal ujung membulat: garis atas & diagonal membentuk huruf **Z**, lengkungan di kanan menutupnya menjadi huruf **D** — dua nama yang menyatu dalam satu simbol. Latar kotak bergradasi `#14B8A6 → #0F766E → #4338CA`.
- **Wordmark:** "Zu" warna `--text` + "De" warna `--primary`, Plus Jakarta Sans 800; tagline di bawahnya warna `--text-muted`.
- File aset (taruh di `public/`; `favicon.ico` & `icon.svg` bisa di `app/` Next.js):

| File | Ukuran | Pemakaian |
| --- | --- | --- |
| `favicon.ico` | 16, 32, 48 | Tab browser |
| `icon.svg` | vektor | Favicon modern (`<link rel="icon" type="image/svg+xml">`) |
| `apple-touch-icon.png` | 180×180, tanpa transparansi | Ikon Layar Utama iOS |
| `icon-192.png`, `icon-512.png` | 192, 512 | Manifest `purpose: "any"` |
| `icon-maskable-512.png` | 512, simbol di zona aman 80% | Manifest `purpose: "maskable"` (Android) |
| `logo-horizontal.svg/.png` | — | Halaman login & header (light) |
| `logo-horizontal-dark.svg/.png` | — | Halaman login & header (dark) |

### 8.1 Palet Warna (design tokens)

Semua warna didefinisikan sebagai CSS variables di `globals.css` dan dipetakan ke Tailwind (`bg-surface`, `text-income`, dst). Light dan dark mode wajib; default mengikuti pengaturan HP, bisa diubah di Pengaturan.

**Light mode**

| Token | Hex | Pemakaian |
| --- | --- | --- |
| `--bg` | `#F4F6FB` | Latar halaman |
| `--bg-gradient` | `radial-gradient` dari `#CCFBF1` (pojok kiri atas, opacity 60%) + `#E0E7FF` (pojok kanan bawah, opacity 60%) di atas `--bg` | Latar dekoratif di belakang kartu kaca |
| `--surface` | `#FFFFFF` | Kartu biasa |
| `--surface-glass` | `rgba(255,255,255,0.65)` | Kartu/nav kaca |
| `--border` | `#E2E8F0` | Garis kartu & pemisah |
| `--border-glass` | `rgba(255,255,255,0.7)` | Garis tepi kaca (efek kilau) |
| `--text` | `#0F172A` | Teks utama |
| `--text-muted` | `#475569` | Teks sekunder, label |
| `--primary` | `#0F766E` | Tombol utama, link, tab aktif (teks putih di atasnya) |
| `--primary-soft` | `#CCFBF1` | Latar chip/ikon aktif |
| `--accent` | `#4338CA` | Aksen sekunder, ujung gradasi |
| `--income` | `#047857` | Nominal pemasukan, status baik |
| `--expense` | `#DC2626` | Nominal pengeluaran, melebihi anggaran |
| `--warning` | `#B45309` | Anggaran 80–100%, jatuh tempo dekat |
| `--info` | `#2563EB` | Informasi, transfer |

**Dark mode**

| Token | Hex | Pemakaian |
| --- | --- | --- |
| `--bg` | `#0B1120` | Latar halaman |
| `--bg-gradient` | `radial-gradient` `#134E4A` (opacity 50%) + `#312E81` (opacity 45%) | Latar dekoratif |
| `--surface` | `#172033` | Kartu biasa |
| `--surface-glass` | `rgba(23,32,51,0.55)` | Kartu/nav kaca |
| `--border` | `#26324A` | Garis kartu |
| `--border-glass` | `rgba(255,255,255,0.08)` | Garis tepi kaca |
| `--text` | `#E2E8F0` | Teks utama |
| `--text-muted` | `#94A3B8` | Teks sekunder |
| `--primary` | `#2DD4BF` | Tombol utama (teks `#042F2E` di atasnya) |
| `--accent` | `#818CF8` | Aksen sekunder |
| `--income` | `#34D399` | Pemasukan |
| `--expense` | `#F87171` | Pengeluaran |
| `--warning` | `#FBBF24` | Peringatan |
| `--info` | `#60A5FA` | Informasi |

**Gradasi kartu saldo utama (hero):** `linear-gradient(135deg, #0F766E 0%, #4338CA 100%)`, teks putih, ditambah 2 lingkaran blur dekoratif (opacity 30%) di dalamnya.

**Warna kategori untuk grafik (urutan tetap):** `#14B8A6`, `#6366F1`, `#F59E0B`, `#EC4899`, `#0EA5E9`, `#84CC16`, `#F97316`, `#A855F7`; sisanya digabung jadi "Lainnya" `#94A3B8`. Tiap kategori menyimpan warnanya sendiri agar konsisten di semua grafik.

**Aturan:**
- Kontras teks memenuhi WCAG AA (≥ 4,5 : 1). Pasangan di atas sudah dicek (mis. teks putih di `--primary` 5,5 : 1; `--income` di putih 5,5 : 1; `--expense` di putih 4,8 : 1).
- Makna tidak hanya lewat warna: pemasukan diberi tanda `+` dan ikon panah turun-masuk, pengeluaran tanda `−` dan ikon panah keluar.
- Teks di atas kaca harus tetap terbaca: jika latar di belakang terlalu ramai, naikkan opacity `--surface-glass`.

### 8.2 Glassmorphism

Dipakai **hanya** pada elemen yang melayang di atas konten, supaya efeknya terasa dan tidak berat:

| Elemen | Spesifikasi |
| --- | --- |
| Bottom nav | `background: var(--surface-glass)`; `backdrop-filter: blur(20px) saturate(180%)`; `-webkit-backdrop-filter` sama (wajib untuk Safari iOS); `border: 1px solid var(--border-glass)`; radius 24 px; melayang 12 px dari bawah + safe area; bayangan `0 8px 32px rgba(15,23,42,0.12)` |
| Header (saat di-scroll) | Transparan di posisi atas; setelah scroll > 8 px berubah jadi kaca `blur(16px)` + garis bawah tipis |
| Bottom sheet & modal | Kaca `blur(24px)`, radius atas 28 px, *handle* abu di atas; latar belakang diredupkan `rgba(2,6,23,0.4)` |
| Kartu saldo utama | Gradasi hero + lapisan kaca tipis untuk sub-kartu di dalamnya (Pemasukan / Pengeluaran bulan ini) |
| Toast | Kaca kecil, muncul dari atas |

Kartu konten biasa (daftar transaksi, anggaran) memakai `--surface` solid + bayangan halus `0 1px 2px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)` agar tetap tajam dan cepat dirender.

**Fallback:** jika `@supports not (backdrop-filter: blur(1px))` atau pengguna mengaktifkan *Kurangi Transparansi*, pakai warna solid `--surface` dengan opacity 95%.

### 8.3 Tipografi

- Font: **Plus Jakarta Sans** (via `next/font`, self-hosted, subset latin), bobot 400/500/600/700.
- Angka nominal memakai `font-variant-numeric: tabular-nums` agar digit sejajar di daftar.

| Gaya | Ukuran / tinggi baris / bobot | Pemakaian |
| --- | --- | --- |
| Display | 32 / 40 / 700 | Saldo utama di dashboard |
| H1 | 22 / 28 / 700 | Judul halaman |
| H2 | 18 / 24 / 600 | Judul kartu/seksi |
| Body | 15 / 22 / 400 | Teks umum |
| Body-strong | 15 / 22 / 600 | Nominal di daftar |
| Caption | 12 / 16 / 500 | Label, tanggal, keterangan |
| Input | 16 / 24 / 500 | Semua input (≥ 16 px agar iOS tidak zoom) |

- Nominal ditulis `Rp 1.250.000`; untuk ringkasan di kartu kecil boleh disingkat `Rp 1,25 jt`.
- Tombol **sembunyikan nominal** (ikon mata) di dashboard: mengganti semua angka dengan `Rp ••••••` — berguna saat membuka website di tempat umum.

### 8.4 Bentuk, Jarak, Bayangan

- Skala jarak 4 px: 4, 8, 12, 16, 20, 24, 32. Padding halaman 16 px; jarak antar kartu 12 px.
- Radius: chip 999 px (pill), input & tombol 14 px, kartu 20 px, bottom sheet 28 px, bottom nav 24 px.
- Ikon: **Lucide**, stroke 1,75 px, ukuran 20 px (nav 24 px). Ikon kategori ditaruh dalam lingkaran 40 px berlatar warna kategori opacity 15%.
- Area sentuh minimal 44 × 44 px.

### 8.5 Layout & Menu

**Struktur setiap halaman (dalam kolom 430 px):**

```
┌──────────────────────────────┐
│ Header: judul / sapaan  [🔔][👁]│  ← transparan → kaca saat scroll
├──────────────────────────────┤
│                              │
│   Konten (kartu-kartu)       │  ← scroll; padding bawah = tinggi nav + 24 px
│                              │
├──────────────────────────────┤
│ ╭──────────────────────────╮ │
│ │ 🏠   📋   (＋)   📊   ☰  │ │  ← bottom nav kaca melayang
│ ╰──────────────────────────╯ │
└──────────────────────────────┘
```

**Bottom nav:** Beranda · Transaksi · **(+)** · Anggaran · Lainnya
- Tombol **(+)** di tengah: lingkaran 56 px, gradasi hero, sedikit menonjol ke atas nav, bayangan berwarna `0 8px 24px rgba(15,118,110,0.35)`. Ditekan → bottom sheet pilihan: **Pengeluaran · Pemasukan · Transfer · Bayar Cicilan · Setor Tabungan**.
- Item aktif: ikon berganti versi terisi, warna `--primary`, ada *pill* latar `--primary-soft` yang bergeser halus antar item (animasi layout).
- Label teks kecil di bawah ikon selalu tampil (bukan ikon saja).

**Menu "Lainnya":** grid ikon 3 kolom berbentuk kartu (Tagihan, Tabungan, Hutang, Akun, Aset, Laporan, Tutup Buku, Log, Pengaturan), di atasnya kartu profil berdua (avatar suami & istri) dan tombol "Pasang di HP" bila belum terpasang.

**Susunan halaman utama:**

| Halaman | Susunan dari atas |
| --- | --- |
| **Beranda** | Sapaan + periode siklus (chip "25 Nov – 24 Des", bisa geser ke bulan lain) → **kartu hero** saldo tersedia + sisa per hari + 2 sub-kartu kaca (masuk / keluar bulan ini) → filter segmented *Bersama · Suami · Istri* → carousel horizontal **Tagihan 7 hari** → kartu **Anggaran** (5 kategori terbesar, progress bar) → kartu **Tujuan tabungan** (cincin progres) → kartu **Hutang** (total + DSR gauge) → 5 transaksi terakhir |
| **Transaksi** | Search bar + chip filter (jenis, akun, kategori, orang) → daftar dikelompokkan per tanggal dengan header *sticky* berisi total harian → item: ikon kategori · nama/catatan · akun & pencatat (avatar kecil) · nominal berwarna di kanan. Geser kiri = hapus, geser kanan = duplikat |
| **Tambah transaksi** (bottom sheet penuh) | Toggle jenis di atas → **nominal besar** di tengah dengan **keypad angka custom** (tombol 000, backspace, kalkulator sederhana + − × ÷) → grid kategori (8 tersering dulu) → baris akun · tanggal · catatan (bisa dibuka) → tombol **Simpan** lebar penuh menempel di bawah |
| **Anggaran** | Ringkasan "Belum dialokasikan Rp …" (harus 0, tampil hijau bila sudah) → daftar kategori dengan progress bar berwarna (hijau/kuning/merah) + sisa nominal → ketuk kategori = detail & riwayat |
| **Hutang** | Kartu total hutang + tanggal bebas hutang → daftar kartu per hutang dengan progress pelunasan → detail: timeline jadwal cicilan (lunas ✓, berikutnya disorot) + tombol "Bayar" & "Simulasi" |
| **Tabungan** | Grid 2 kolom kartu tujuan dengan ikon/emoji, cincin progres, "Rp x / Rp y", status *on track* |
| **Laporan** | Segmented tab (Arus kas · Kategori · Rasio · Per orang) → grafik → ringkasan angka di bawahnya |

### 8.6 Komponen

- **Tombol:** Primary (isi `--primary`), Secondary (outline/kaca), Ghost, Destructive (`--expense`). Tinggi 48 px; state *pressed* mengecil ke `scale(0.97)`.
- **Input:** label di atas, latar `--surface`, fokus = ring 2 px `--primary` + glow tipis. Nominal selalu pakai keypad custom, bukan keyboard sistem.
- **Chip & segmented control** berbentuk pill dengan indikator yang bergeser.
- **Progress bar** tebal 8 px, ujung membulat, warna sesuai status; **cincin progres** untuk tujuan tabungan; **gauge** setengah lingkaran untuk DSR.
- **Bottom sheet** (bukan modal tengah) untuk semua form & pilihan; bisa di-*drag* untuk menutup.
- **Toast** untuk konfirmasi, dengan tombol **Urungkan** 5 detik setelah hapus.
- **Skeleton loader** berbentuk kartu (efek *shimmer*) saat memuat; tidak memakai spinner di tengah layar.
- **Empty state** dengan ilustrasi sederhana + 1 tombol aksi (mis. "Belum ada tagihan — Tambah tagihan").
- **Avatar** suami & istri (inisial + warna) untuk menandai pencatat transaksi.

### 8.7 Animasi & Interaksi Mikro

- Library: **Motion** (`motion/react`, dulu Framer Motion).
- Durasi 150–250 ms, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`; bottom sheet memakai spring.
- Perpindahan halaman: fade + geser 8 px; bottom sheet naik dari bawah; indikator nav bergeser (shared layout).
- **Angka saldo** beranimasi menghitung (count-up) saat berubah.
- Progress bar & cincin terisi dengan animasi saat pertama tampil.
- Simpan transaksi berhasil → centang animasi singkat + haptic (`navigator.vibrate(10)` di Android; iOS tidak mendukung, cukup animasi).
- Pull-to-refresh custom di halaman daftar.
- Hormati `prefers-reduced-motion`: matikan animasi geser/count-up, sisakan fade.

### 8.8 Grafik

- Recharts dengan gaya minimal: tanpa garis grid vertikal, grid horizontal putus-putus tipis, sumbu tanpa garis, label `--text-muted` 12 px.
- Area chart arus kas dengan isi gradasi (opacity 30% → 0%); bar dengan radius atas 6 px; donut kategori dengan lubang 70% dan total di tengah.
- Tooltip berbentuk kartu kaca kecil; ketuk (bukan hover) di mobile.
- Warna mengikuti token (`--income`, `--expense`, warna kategori).

### 8.9 UX Writing & Kenyamanan

- Bahasa Indonesia santai-sopan, singkat: "Simpan", "Urungkan", "Sisa Rp 350.000 sampai gajian".
- Pesan error menjelaskan solusi: "Nominal belum diisi" bukan "Validation error".
- Konfirmasi hanya untuk aksi yang tidak bisa diurungkan (hapus permanen, kunci bulan).
- Form mengingat pilihan terakhir (akun, kategori) per pengguna.
- Pencapaian kecil dirayakan secara halus: tujuan tabungan tercapai / hutang lunas → animasi confetti singkat.

### 8.10 Performa Efek

- `backdrop-filter` dibatasi maksimal **3 lapisan kaca** yang terlihat bersamaan; jangan dipakai pada item daftar yang di-scroll.
- Lingkaran blur dekoratif di latar memakai elemen `position: fixed` dengan `will-change: transform`, bukan gambar.
- Target: scroll tetap 60 fps di iPhone 11 / Android kelas menengah.

---

## 9. Teknologi (Rekomendasi)

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript** | Satu basis kode, server actions/API |
| UI | Tailwind CSS + shadcn/ui (dikustom sesuai token bagian 8) | Komponen siap pakai, dark mode |
| Animasi | Motion (`motion/react`) | Transisi halaman, bottom sheet, count-up |
| Ikon & font | Lucide + Plus Jakarta Sans (`next/font`) | |
| Bottom sheet | Vaul (drawer untuk shadcn) | Bisa di-drag untuk menutup |
| Grafik | Recharts | |
| PWA | Next.js Metadata API (manifest & meta iOS) + **Serwist** (service worker) | Add to Home Screen Android & iOS; cache aset statis saja |
| Database | **MySQL / MariaDB** (database dari hPanel) | InnoDB (ACID); hPanel shared/cloud tidak menyediakan PostgreSQL |
| ORM | Prisma (provider `mysql`) | Migrasi terkelola; jalankan `prisma migrate deploy` saat build |
| Auth | Auth.js (credentials + TOTP) | Hanya 2 pengguna |
| Validasi | Zod | Di client & server |
| Job terjadwal | **Cron Jobs hPanel** memanggil endpoint `/api/cron/*` yang dilindungi secret token | Proses Node bisa di-restart hosting, jadi jangan andalkan scheduler di dalam proses |
| Notifikasi | **Web Push** dengan library `web-push` (VAPID key di env) + notifikasi di website + email (SMTP email Hostinger) | Pengiriman push dipicu Cron Jobs hPanel & event transaksi |
| Deploy | **Hostinger hPanel → Websites → Web App (Node.js)**, deploy dari GitHub repo privat | SSL gratis dari hPanel; environment variable diisi di hPanel |
| Testing | Vitest (unit: amortisasi, saldo, anggaran) + Playwright (E2E alur kunci) | |

> **Syarat paket Hostinger:** fitur Web App (Node.js) hanya tersedia di paket **Business Web Hosting** dan paket **Cloud** (Startup ke atas). Jika paket saat ini Premium/Single, perlu upgrade — atau pilihan lain: bangun dengan Laravel (PHP) yang jalan di semua paket.

Wajib ada unit test untuk: perhitungan saldo, split, amortisasi flat/anuitas/floating, extra payment, snowball/avalanche, rollover anggaran, siklus bulan non-kalender.

---

## 10. Roadmap

| Fase | Isi | Selesai jika |
| --- | --- | --- |
| **1 — MVP** | Auth, akun, kategori, transaksi + split, anggaran zero-based, tagihan berulang, hutang + amortisasi + pembayaran, tujuan tabungan, dashboard, tutup buku, log, backup, **PWA installable + push notification (Android & iOS)** | Dipakai berdua 1 siklus bulan penuh tanpa kembali ke catatan lama |
| **2 — Kontrol** | Simulasi snowball/avalanche, sinking fund, aset & net worth, laporan lengkap + ekspor, notifikasi pengeluaran besar | Tutup buku 3 bulan berturut-turut |
| **3 — Otomasi** | Harga emas otomatis | — |
| Nanti | Integrasi WhatsApp gateway buatan sendiri | — |

---

## 11. Kriteria Penerimaan (contoh)

- Mencatat satu pengeluaran di mobile ≤ 10 detik, ≤ 3 ketukan.
- Saldo setiap akun di website sama dengan saldo nyata setelah tutup buku.
- Jadwal amortisasi KPR anuitas sama dengan simulasi bank (selisih ≤ Rp1 per periode karena pembulatan).
- Setelah bayar cicilan, sisa pokok, DSR, dan tanggal lunas langsung terbarui.
- Akun privat istri tidak bisa dibaca detail transaksinya oleh suami lewat UI maupun API (dan sebaliknya).
- Mengubah siklus bulan (mis. 25–24) membuat semua anggaran & laporan mengikuti siklus baru.
- Restore dari backup (via hPanel) menghasilkan data identik.
- Tidak ada satu pun input file/upload di seluruh website.
- Di iPhone (Safari): Bagikan → Tambah ke Layar Utama menghasilkan ikon yang benar; dibuka dari ikon tampil tanpa address bar, header & bottom nav tidak tertutup notch/home indicator.
- Di Android (Chrome): tombol "Pasang di HP" muncul dan berhasil memasang.
- Lighthouse: lolos kriteria installable PWA.
- iPhone iOS 16.4+ (PWA terpasang): setelah mengaktifkan notifikasi, push H-1 cicilan diterima saat website tertutup; mengetuknya membuka detail tagihan.
- Pengeluaran besar oleh istri memunculkan push di HP suami dalam ≤ 1 menit (dan sebaliknya).
- Badge ikon menampilkan jumlah tagihan jatuh tempo dan hilang setelah dibuka.
- Light & dark mode memakai token bagian 8.1; semua teks lolos kontras WCAG AA.
- Bottom nav & bottom sheet tampil dengan efek kaca di Safari iOS dan Chrome Android, dan jatuh ke warna solid bila *Kurangi Transparansi* aktif.
- Scroll daftar transaksi 500 item tetap mulus (60 fps) di HP kelas menengah.
- Dibuka di desktop 1920 px, semua halaman tampil sebagai kolom mobile ≤ 430 px di tengah layar; bottom nav & modal tidak melebar keluar kolom.

---

## 12. Keputusan

| Topik | Keputusan |
| --- | --- |
| Peran pengguna | Tidak ada Owner/Viewer; hanya suami & istri dengan hak setara |
| Tanggal gajian | Diatur di Pengaturan, terpisah untuk suami & istri; siklus bulan bisa mengikuti salah satunya |
| Pengeluaran besar | Cukup notifikasi ke pasangan, tanpa persetujuan |
| Hasil trading | Dicatat sebagai pemasukan kategori "Hasil Trading" |
| Hosting | Hostinger hPanel (Web App Node.js) + MySQL hPanel |
| WhatsApp gateway | Ditunda, nanti saja |

---

## 13. Instruksi untuk Claude Code

1. Mulai dari skema database (bagian 6) + migrasi + seed kategori bawaan (3.3).
2. Bangun modul sesuai urutan Fase 1; setiap modul selesai dengan unit test-nya.
3. Simpan semua nominal sebagai integer rupiah; buat helper format `Rp 1.234.567`.
4. Semua logika keuangan (saldo, amortisasi, anggaran, siklus bulan) di folder `lib/finance/` sebagai fungsi murni yang teruji.
5. Otorisasi (pemilik akun, akun privat, periode terkunci) ditegakkan di server.
6. Ikuti 5.1: satu layout mobile (max 430 px, rata tengah) di semua ukuran layar; jangan buat layout desktop.
7. Ikuti bagian 8 (UI/UX): buat design tokens di `globals.css` + `tailwind.config` lebih dulu, lalu komponen dasar (Button, Card, GlassCard, BottomNav, BottomSheet, Keypad, ProgressBar, Ring, Toast, Skeleton) sebelum halaman.
8. Ikuti 5.2: PWA installable (manifest, apple-touch-icon 180×180, meta iOS, safe area, banner panduan iOS, service worker cache aset statis saja); uji di Safari iOS dan Chrome Android.
9. Push notification (3.13.1): generate VAPID key (`npx web-push generate-vapid-keys`) → simpan di env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; endpoint `POST/DELETE /api/push/subscribe`; handler `push` & `notificationclick` di service worker; kirim push dari `/api/cron/reminders` dan dari event transaksi; tulis langkah uji push di iPhone pada README.
10. Target deploy **Hostinger hPanel Web App (Node.js)**: pakai `next build` + `next start` (atau output `standalone`), port dari `process.env.PORT`, tanpa Docker.
11. Database MySQL: gunakan tipe `BIGINT` untuk nominal, `DATE` untuk tanggal transaksi, `utf8mb4`.
12. Jangan buat fitur upload file apa pun (tidak ada `<input type="file">`, tidak ada penyimpanan file); ekspor laporan/backup hanya berupa unduhan.
13. Semua tugas terjadwal (transaksi berulang, pengingat, backup harian) dibuat sebagai endpoint `/api/cron/<nama>` dengan header secret, siap dipanggil Cron Jobs hPanel (contoh perintah `curl` ditulis di README).
14. Sediakan `.env.example` dan `README.md`: cara jalan lokal, cara deploy ke hPanel dari GitHub, cara membuat database & cron di hPanel, cara backup/restore.
