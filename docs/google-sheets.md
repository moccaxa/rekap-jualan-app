# Menyiapkan Google Sheets (service account)

1. Buka https://console.cloud.google.com, buat project baru (mis. "rekap-jualan").
2. **APIs & Services → Library** → cari **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**. Beri nama, lalu selesai (peran tidak perlu diisi).
4. Buka service account tadi → tab **Keys → Add key → Create new key → JSON**. File JSON terunduh. **Simpan rapat, jangan di-commit atau dibagikan.**
5. Dari file JSON ambil `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `private_key` → `GOOGLE_PRIVATE_KEY`.
6. Buat Google Spreadsheet baru (kosong). ID ada di URL: `https://docs.google.com/spreadsheets/d/<ID>/edit` → `GOOGLE_SHEET_ID`.
7. Klik **Bagikan** pada spreadsheet, tambahkan `client_email` sebagai **Editor**. Biarkan spreadsheet **tidak publik** (Restricted).
8. Isi ketiga variabel di Netlify (atau `.env` lokal), deploy ulang, lalu buka halaman **Google Sheets** di aplikasi → **Hubungkan & siapkan sheet**.

## Sheet "Buyers"
Kolom: ID Buyer, Nama Buyer, Nomor WhatsApp, Tanggal Pertama Order, Tanggal Terakhir Order, Total Order, Total Omzet, Total Modal, Total Keuntungan, Catatan (+ Dibuat, Diubah, Versi, Dihapus).
- Yang boleh diedit: **Nama Buyer, Nomor WhatsApp, Catatan** (nama baru ikut ke semua transaksi buyer itu). Kolom tanggal pertama/terakhir dan total diisi ulang otomatis dari transaksi setiap sinkronisasi; jika Anda mengubahnya, nilainya akan ditimpa.
- Baris buyer baru: isi nama dan nomor; ID boleh kosong. Jika nomornya sudah terdaftar, baris itu **digabung** ke buyer yang ada (tidak dibuat ganda).
- Baris buyer yang dihapus dari sheet atau diberi tanggal di kolom "Dihapus" tidak akan terhapus selama buyer itu masih punya transaksi.
- Di sheet Transaksi, kolom "ID Buyer" boleh dikosongkan pada baris baru: transaksi dihubungkan ke buyer dengan nomor WhatsApp yang sama (atau dibuatkan buyer baru). Nama/nomor pada transaksi selalu mengikuti data buyer.

## Aturan mengedit langsung di Sheets
- Ketik tanggal sebagai `YYYY-MM-DD` (kolom sudah berformat teks).
- Jangan ubah baris header dan jangan hapus kolom.
- Baris baru: isi minimal Nama Buyer, WhatsApp, Produk, Tanggal Order, Durasi (angka), Satuan Durasi (bulan/hari), Tanggal Habis. ID boleh dikosongkan.
- Password: kolom "Password (terenkripsi)" berisi data terenkripsi. Jika Anda mengetik password polos di sana, server mengenkripsinya saat sinkronisasi.
- Menghapus transaksi: isi kolom "Dihapus" dengan tanggal apa pun, atau hapus barisnya (hanya berlaku jika transaksi tidak diubah di website sejak sinkronisasi terakhir).
- Jika ada baris tidak valid, sinkronisasi dibatalkan tanpa mengubah data apa pun dan pesan error menyebut nomor barisnya.
