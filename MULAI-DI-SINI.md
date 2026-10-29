# Rekap Jualan — pasang ke Netlify (tanpa terminal)

Aplikasi ini harus di-**build** oleh Netlify dari GitHub; tidak bisa sekadar di-drag ke Netlify Drop (ada Functions dan reminder terjadwal).
Semuanya bisa dilakukan lewat browser, gratis.

## 1. Taruh kode di GitHub (±5 menit)
1. Ekstrak file zip ini.
2. Di https://github.com → **New repository** → nama `rekap-jualan` → pilih **Private** → Create.
3. Di halaman repository: **uploading an existing file** → seret **isi** folder hasil ekstrak (semua berkas dan folder di dalamnya, bukan folder induknya) → **Commit changes**.
   (Proyek ini 89 berkas, di bawah batas 100 berkas per unggahan web GitHub. Folder `tests` boleh tidak diunggah.)

## 2. Buat kunci rahasia
Buka `tools/generator-rahasia.html` dengan klik ganda (jalan offline di browser). Salin `DATA_ENC_KEY` dan `SESSION_SECRET`. **Simpan `DATA_ENC_KEY` di tempat aman.**
Tentukan juga password admin (min. 12 karakter).

## 3. Hubungkan ke Netlify
1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → pilih `rekap-jualan`.
2. Build command `npm run build`, Publish directory `dist` (sudah terisi otomatis dari `netlify.toml`).
3. Klik **Add environment variables** (atau sesudahnya: Site configuration → Environment variables) dan isi:

| Nama | Nilai |
|---|---|
| `ADMIN_PASSWORD` | password admin Anda (min. 12 karakter) |
| `SESSION_SECRET` | dari generator |
| `DATA_ENC_KEY` | dari generator |

4. **Deploy site**. Tunggu 1–3 menit sampai "Published".

## 4. Pakai
Buka alamat `https://nama-situs.netlify.app` → login dengan password admin → buka **Pengaturan**: semua baris wajib harus hijau dan tertulis "Koneksi memakai HTTPS".
Ubah nama situs di Site configuration → Site details jika perlu. Setelah menambah/mengubah variabel, lakukan **Deploys → Trigger deploy → Deploy site**.

## 5. Opsional (kapan saja)
- Google Sheets (backup & cermin): `docs/google-sheets.md`
- Reminder Telegram otomatis: `docs/telegram.md`
- Penjelasan lengkap, keamanan, dan pemecahan masalah: `README.md`

> Keamanan: `ADMIN_PASSWORD` memakai password biasa di environment variable agar mudah. Untuk keamanan lebih baik, pakai `ADMIN_PASSWORD_HASH` (lihat README).
> Data asli baru dimasukkan setelah daftar periksa di README bagian 8 terpenuhi.
