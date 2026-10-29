# Menyiapkan Telegram Bot

## 1. Buat bot lewat BotFather
1. Di Telegram cari **@BotFather** (centang biru) → kirim `/newbot`.
2. Isi nama bot (bebas) lalu username yang diakhiri `bot` (mis. `rekap_jualan_saya_bot`).
3. BotFather membalas **token** berbentuk `123456789:AA...`. Itu rahasia: siapa pun yang memilikinya bisa mengendalikan bot. Jangan menaruhnya di kode, chat, atau screenshot. Jika bocor, kirim `/revoke` ke BotFather.

## 2. Pasang token di Netlify
Site configuration → Environment variables → tambah `TELEGRAM_BOT_TOKEN` = token tadi. Setelah menambah/mengubah variabel, **deploy ulang** (Deploys → Trigger deploy). Untuk lokal, isi `.env` lalu jalankan `npm run dev:netlify`.

## 3. Dapatkan Chat ID
**Akun pribadi (disarankan):**
1. Buka bot Anda di Telegram → tekan **Start** (atau kirim pesan apa saja).
2. Di aplikasi: halaman **Integrasi Telegram → Hubungkan** (memastikan token benar) → **Deteksi Chat ID** → pilih chat Anda → **Pakai**.

**Grup:**
1. Tambahkan bot ke grup, lalu kirim `/start@username_bot` di grup (bot dalam mode privasi hanya melihat perintah/mention).
2. **Deteksi Chat ID** → pilih grup (ID grup diawali tanda minus, mis. `-1001234567890`) → **Pakai**.

Alternatif manual: Chat ID boleh juga diisi lewat variabel `TELEGRAM_CHAT_ID`; nilai yang disimpan di halaman Telegram didahulukan.

## 4. Uji
Halaman Telegram → **Kirim pesan tes**. Di halaman Reminder, ikon kirim pada tiap jadwal mengirim pesan tes berformat reminder lengkap (berawalan "TES", tidak mengganggu jadwal asli). Kegagalan tampil dengan penjelasan di Riwayat.

## 5. Scheduler (reminder otomatis saat website ditutup)
Fungsi `reminder-cron` berjalan di server Netlify tiap jam (`0 * * * *`, UTC). Di dalamnya jam dihitung ke Asia/Jakarta; reminder dikirim bila jam sekarang ≥ **jam kirim** yang Anda atur, sehingga satu jalan yang terlewat tetap tertangkap pada jam berikutnya di hari yang sama.

Batasan Netlify Scheduled Functions (periksa dokumentasi Netlify terbaru karena bisa berubah):
- Hanya berjalan pada **deploy produksi yang dipublikasikan**, bukan deploy preview/branch.
- Cron berbasis UTC; waktu eksekusi bisa meleset beberapa menit.
- Batas waktu eksekusi singkat (sekitar 30 detik); engine berhenti di 20 detik dan melanjutkan di jam berikutnya.
- Lihat daftar eksekusi di Netlify: Logs → Functions → `reminder-cron`.

**Alternatif / cadangan: scheduler eksternal.** Isi `CRON_SECRET` (acak, minimal 24 karakter) di Netlify, lalu buat job di cron-job.org atau GitHub Actions yang memanggil `POST https://NAMA-SITUS.netlify.app/api/reminder-trigger` tiap jam dengan header `X-Cron-Secret: <nilai CRON_SECRET>`. Tanpa `CRON_SECRET` endpoint ini mati (404). Aman dipakai bersamaan dengan scheduler Netlify; pesan yang sama tidak akan terkirim dua kali.

## Aturan pengiriman
- Pesan dikirim bila: Telegram diaktifkan, reminder transaksi aktif, transaksi tidak dibatalkan/dihapus, **dan** offset (mis. H-7) ada di daftar offset transaksi **serta** di daftar offset global Telegram.
- Satu jadwal (`ID|offset|tanggal`) hanya dikirim sekali. Gagal dari sisi Telegram dicoba ulang tiap jam maksimal 3 kali. Bila proses terhenti tepat saat mengirim (hasil tidak diketahui), pesan **tidak** dikirim ulang otomatis; riwayat menandainya agar Anda cek manual.
- Password dan email akun tidak pernah dimasukkan ke pesan.
