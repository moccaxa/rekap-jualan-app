# Rekap Jualan

Aplikasi web pribadi untuk mencatat penjualan produk digital / akun berlangganan, memantau masa aktif, dan mengirim reminder otomatis ke Telegram,
dengan cadangan dua arah ke Google Sheets. Di-host di Netlify (frontend + Functions), tanpa server sendiri.

## Arsitektur

```
Browser (React + Vite + TS + Tailwind)
   │  cookie sesi HttpOnly
   ▼
Netlify Functions (/api/*)  ──►  Netlify Blobs   (sumber data utama: transaksi, pengaturan, log reminder, backup)
   │        │
   │        ├──► Google Sheets API (service account)  cermin & backup dua arah
   │        └──► Telegram Bot API                      reminder
   ▲
Netlify Scheduled Function `reminder-cron` (tiap jam)   [opsional: pemicu eksternal /api/reminder-trigger]
```

- **Database utama = Netlify Blobs**, bukan Google Sheets: Sheets lambat, tidak punya transaksi, dan dibatasi kuota, sehingga kurang cocok sebagai sumber data untuk scheduler. Sheets dipakai sebagai cermin yang bisa dibaca/diedit dan sebagai backup di luar Netlify.
- **Biaya:** semuanya muat di free tier untuk pemakaian pribadi (Netlify, Google Sheets API, Telegram Bot API).
- **LocalStorage tidak dipakai** untuk data. Browser hanya menyimpan data di memori selama tab terbuka.

## Fitur

Dashboard (9 kartu, filter periode, 2 grafik, **Analisis Buyer** + Top Buyer) · **Data Buyer** (database, ranking, analisis, detail & riwayat, impor/ekspor CSV) · Data Penjualan (cari, filter, urut, pagination, detail, edit, hapus + konfirmasi, CSV impor/ekspor, kartu di HP) ·
Form transaksi (durasi bulan kalender/hari, tanggal mulai aktif berbeda, tanggal habis otomatis/manual, kuantitas, hitung untung & margin langsung) ·
Reminder (banyak jadwal per transaksi, status, riwayat, tandai ditindaklanjuti, tes kirim) · Produk & Durasi (opsi durasi bisa diubah) ·
Google Sheets (sinkron dua arah, kirim/ambil, backup & restore) · Telegram (hubungkan, deteksi chat ID, jam kirim, riwayat) · Pengaturan (ambang "Akan Habis", pemeriksaan konfigurasi) · Login admin.

Rumus: omzet = harga jual × kuantitas; modal = harga modal × kuantitas; untung = omzet − modal; margin = untung ÷ omzet. Harga adalah **per unit**. Transaksi dibatalkan/dihapus tidak dihitung.
Status dihitung saat ditampilkan dari tanggal habis (zona Asia/Jakarta): Aktif, Akan Habis (≤ N hari, default 7), Habis Hari Ini, Sudah Habis, Dibatalkan.

## Data Buyer & ranking

- **Identitas = ID Buyer** (`BY-xxxxxx`), bukan nama. Setiap transaksi menyimpan `buyerId`. Saat mencatat transaksi Anda memilih buyer terdaftar (cari nama/WhatsApp) atau menekan **Buyer baru**; nama dan nomor terisi otomatis.
- **Tidak ada buyer ganda:** nomor WhatsApp unik per buyer. Menambah buyer dengan nomor yang sudah ada ditolak dengan tawaran memakai buyer yang ada; nama yang sama dengan nomor berbeda hanya diberi peringatan. Transaksi baru dengan nomor yang sudah terdaftar otomatis masuk ke buyer yang sama. Buyer ganda yang sudah terlanjur ada bisa **digabungkan** (transaksi dipindahkan).
- **Mengubah nama/nomor buyer** otomatis memperbarui salinan nama/nomor pada semua transaksinya (hubungan tetap lewat ID), sehingga CSV, Sheets, dan pesan Telegram selalu memakai data terbaru.
- **Statistik tidak disimpan.** Total order, omzet, modal, untung, tanggal pertama/terakhir, dan status dihitung dari transaksi di satu modul (`shared/buyers.ts`) setiap kali ditampilkan atau ditulis ke Sheets. Menambah/mengedit/membatalkan/menghapus transaksi otomatis mengubah ranking.
- **Aturan hitung:** jumlah order = ID transaksi unik yang valid (tidak dibatalkan, tidak dihapus). Urutan Top Buyer: order terbanyak, lalu omzet tertinggi, lalu nama. **Repeat buyer** = ≥ 2 transaksi valid dalam periode; persentase repeat = repeat ÷ buyer yang order di periode. **Belum order kembali** = pernah order sebelum periode dimulai tetapi tidak order di periode (periode "Semua waktu": berstatus Tidak Aktif). **Buyer baru pada periode** = order pertamanya jatuh di periode.
- **Status buyer:** Baru (belum pernah order, atau order pertama ≤ 30 hari lalu), Aktif (order terakhir ≤ 90 hari lalu), Tidak Aktif (selain itu). Batas hari dapat diubah di Pengaturan.
- **Periode:** Semua waktu, Bulan ini, Bulan lalu, 3 bulan terakhir, Tahun ini, atau rentang khusus; berlaku untuk kartu, ranking, grafik, dan tabel.
- Data lama (sebelum fitur ini) dimigrasi otomatis: transaksi dikelompokkan per nomor WhatsApp menjadi buyer.

## Struktur proyek

```
shared/                 logika murni dipakai frontend & server: tanggal, keuangan, status, reminder, validasi, buyer & statistik, merge sinkronisasi, pesan
netlify/functions/      API: auth-*, transactions, buyers, settings, reminder-logs, sheets, telegram, config-check, reminder-cron, reminder-trigger
netlify/functions/_lib/ auth, crypto (AES-GCM), db (Blobs), google (Sheets), sheetmap, syncService, telegram, reminderEngine
src/                    React: pages/, components/, lib/ (api, store, csv, phone, auth)
scripts/                hash-password.mjs, gen-secrets.mjs
tests/                  tes otomatis (lihat bagian Pengujian)
docs/                   google-sheets.md, telegram.md
netlify.toml            build, redirect SPA, header keamanan (CSP, HSTS, dst.)
```

## 1. Menjalankan di komputer

Butuh Node.js 20+.

```bash
npm install
cp .env.example .env
npm run gen-secrets                       # salin DATA_ENC_KEY dan SESSION_SECRET ke .env
npm run hash-password -- "password-admin-anda-min-10-karakter"   # salin ADMIN_PASSWORD_HASH ke .env
npm run dev:netlify                       # buka http://localhost:8888
```

Gunakan `dev:netlify` (bukan `npm run dev`): API membutuhkan Netlify Functions dan Blobs lokal. Google & Telegram boleh dikosongkan dulu.
Catatan: di `http://localhost` cookie sesi tidak ber-flag Secure; di Netlify (HTTPS) selalu Secure.

## 2. Repository GitHub

1. Buat repository **privat** kosong di GitHub (mis. `rekap-jualan`).
2. Pastikan `.env` tidak ikut (sudah ada di `.gitignore`).
```bash
git init && git add . && git commit -m "Rekap Jualan"
git branch -M main
git remote add origin https://github.com/USERNAME/rekap-jualan.git
git push -u origin main
```

## 3. Hubungkan ke Netlify

1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → pilih repository.
2. Pengaturan build (sudah diisi `netlify.toml`, cukup dipastikan): **Build command** `npm run build`, **Publish directory** `dist`, **Functions directory** `netlify/functions`.
3. Sebelum deploy pertama, isi environment variables (bagian 4), lalu **Deploy**.

## 4. Environment variables (Site configuration → Environment variables)

| Variabel | Wajib | Isi |
|---|---|---|
| `ADMIN_PASSWORD_HASH` **atau** `ADMIN_PASSWORD` | ya (salah satu) | hash dari `npm run hash-password -- "..."` (disarankan); atau password biasa min. 12 karakter bila tanpa terminal |
| `SESSION_SECRET` | ya | keluaran `npm run gen-secrets` (≥ 32 karakter) |
| `DATA_ENC_KEY` | ya | keluaran `npm run gen-secrets` (32 byte base64). **Simpan salinannya**: tanpa kunci ini password akun tersimpan tidak bisa dibuka |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` | untuk Sheets | lihat `docs/google-sheets.md` |
| `TELEGRAM_BOT_TOKEN` | untuk Telegram | lihat `docs/telegram.md` |
| `TELEGRAM_CHAT_ID` | opsional | chat ID bawaan (bisa juga diisi di halaman Telegram) |
| `CRON_SECRET` | opsional | ≥ 24 karakter acak, mengaktifkan pemicu eksternal |

Tandai nilai rahasia sebagai **secret** (sensitive) bila tersedia. Setelah mengubah variabel, **deploy ulang**.

## 5. Google Sheets → `docs/google-sheets.md`
## 6. Telegram Bot → `docs/telegram.md`

## 7. Mengaktifkan scheduler

`reminder-cron` terdaftar otomatis lewat `export const config = { schedule: '0 * * * *' }`; tidak ada langkah tambahan selain **deploy produksi**.
Setelah deploy, cek di Netlify: **Logs → Functions → reminder-cron** (harus ada eksekusi tiap jam) dan di halaman Telegram bagian "Scheduler" (waktu pengecekan terakhir).

Keterbatasan yang perlu diketahui (periksa dokumentasi Netlify terbaru karena dapat berubah):
- Hanya berjalan pada **deploy produksi yang dipublikasikan**, bukan deploy preview/branch.
- Cron memakai UTC dan waktu eksekusi bisa meleset beberapa menit; karena itu jam kirim dibandingkan dengan jam Jakarta di dalam program, dan pesan dikirim bila jam sekarang **≥ jam kirim** (satu jalan yang terlewat tetap tertangkap di jam berikutnya pada hari yang sama).
- Batas waktu eksekusi singkat (± 30 detik); engine berhenti di 20 detik dan melanjutkan di jam berikutnya.
- Reminder yang tanggalnya terlewat seluruh harinya (mis. scheduler mati sehari penuh) **tidak** dikirim susulan.
- Alternatif/cadangan: isi `CRON_SECRET` lalu buat job di cron-job.org atau GitHub Actions: `POST /api/reminder-trigger` dengan header `X-Cron-Secret`.

## 8. Uji setelah deploy (daftar periksa)

1. Buka situs (HTTPS) → muncul form login saja. Login dengan password admin.
2. **Pengaturan → Pemeriksaan konfigurasi**: semua baris wajib hijau; "Koneksi memakai HTTPS".
3. Dari konsol browser pada halaman login: `fetch('/api/transactions').then(r=>r.status)` harus `401`.
4. Tambah transaksi → cek angka di Dashboard → edit → tampilkan password → hapus.
5. Halaman **Google Sheets** → *Hubungkan & siapkan sheet* → *Sinkronkan sekarang*; buka spreadsheet: ada 4 sheet; password tampil terenkripsi (`v1:...`). Ubah satu sel Catatan di Sheets → sinkronkan → muncul di website.
6. Halaman **Telegram** → *Hubungkan* → *Deteksi* → *Pakai* → aktifkan, simpan → *Kirim pesan tes*.
7. Halaman **Reminder** → ikon kirim pada satu jadwal → pesan "TES" masuk Telegram tanpa password.
8. Buat transaksi yang jadwal reminder-nya jatuh hari ini (atur offset), **tutup semua tab**, tunggu jam kirim berikutnya → pesan masuk sekali; cek riwayat.
9. Buka dari HP → *Tambahkan ke layar utama* bila diinginkan.

## Keamanan: apa yang ada dan apa batasnya

Ada: login admin (hash scrypt, sesi 7 hari, cookie HttpOnly + Secure + SameSite=Strict, header `X-Rekap` pada non-GET), batas 5 percobaan gagal/15 menit per IP, semua endpoint data wajib login,
validasi input di server, password akun jualan dienkripsi AES-256-GCM (juga di Sheets dan backup), password tidak ada di daftar/CSV/Telegram/log, token Telegram dan kredensial Google hanya di environment variables,
CSP + HSTS + X-Frame-Options + nosniff, `noindex`.

Batas yang harus Anda pahami sebelum memakai data asli:
- Satu admin, satu password. Tidak ada 2FA di aplikasi. Mencuri cookie sesi = akses penuh selama 7 hari (ganti `SESSION_SECRET` untuk mengeluarkan semua sesi).
- Nama, WhatsApp, dan email buyer **tidak** dienkripsi per kolom di Blobs/Sheets. Keamanannya mengikuti akun Netlify dan Google Anda: aktifkan 2FA di keduanya, dan jangan bagikan spreadsheet ke siapa pun selain service account.
- Siapa pun yang memegang `DATA_ENC_KEY` **dan** akses ke data dapat membaca password akun. Hilangnya kunci = password tidak dapat dipulihkan.
- Password yang Anda ketik di kolom password Sheets (polos) dienkripsi saat sinkronisasi, tetapi sempat ada polos di riwayat versi Google Sheets. Sebaiknya jangan lakukan itu.
- Aplikasi ini bukan pengganti password manager untuk kredensial yang sangat sensitif.
- Belum ada audit keamanan independen.

## Pengujian

Otomatis (`npm test`): logika tanggal/keuangan/status, CSV, backend (enkripsi, auth, validasi, merge, handler CRUD), klien & sinkronisasi Google Sheets (dengan Google palsu), Telegram & scheduler (dengan Telegram palsu).
UI (`npm run test:e2e`, lihat `tests/e2e/README.md`): Chromium headless melawan handler sungguhan, desktop dan HP 390px.

Belum pernah dijalankan terhadap layanan asli: Google Sheets API, Telegram Bot API, Netlify Blobs, Netlify Scheduled Functions, dan `netlify dev`. Gunakan daftar periksa bagian 8 untuk membuktikannya pada akun Anda.
Belum diuji: perangkat/browser nyata (hanya emulasi Chromium), Safari/Firefox, beban data besar (> ± 2.000 transaksi), dan skenario dua pengguna menulis di milidetik yang sama (penyimpanan berupa satu dokumen JSON; cocok untuk satu admin).

## Sinkronisasi & konflik

Setiap sinkronisasi membandingkan tiga hal: isi di website, isi di Sheets, dan isi saat sinkronisasi terakhir. Hanya satu sisi berubah → dipakai. Keduanya berubah → **website menang** dan versi Sheets dicatat di sheet "Konflik".
Baris tidak valid di Sheets membatalkan seluruh sinkronisasi tanpa mengubah apa pun. Penghapusan memakai hapus lunak. Backup otomatis dibuat sebelum sinkronisasi yang mengubah data website dan sebelum restore (10 terakhir disimpan).

## Pemecahan masalah

| Gejala | Penyebab / solusi |
|---|---|
| "API tidak ditemukan" saat lokal | Jalankan `npm run dev:netlify`, bukan `npm run dev` |
| Login selalu gagal | `ADMIN_PASSWORD_HASH` salah format (harus `scrypt$...$...`); buat ulang dengan `npm run hash-password` |
| "Akses ditolak" di Sheets | Bagikan spreadsheet ke email service account sebagai **Editor**; aktifkan Google Sheets API |
| "GOOGLE_PRIVATE_KEY tidak valid" | Salin seluruh `private_key` termasuk `-----BEGIN/END-----` |
| Telegram "Chat ID tidak ditemukan" | Tekan Start pada bot (atau kirim `/start@namabot` di grup) lalu *Deteksi* ulang |
| Reminder tidak terkirim | Telegram dinonaktifkan; jam kirim belum tercapai; offset tidak dipilih di global **dan** di jadwal transaksi; bukan deploy produksi |
| "Gagal mendekripsi password" | `DATA_ENC_KEY` berbeda dari yang dipakai saat menyimpan |

## Pengembangan lanjutan

2FA login, enkripsi per kolom untuk data buyer, penyimpanan per-transaksi (bukan satu dokumen), multi-pengguna, laporan bulanan, dan upgrade `@netlify/blobs` agar kunci pengiriman memakai tulis bersyarat.
