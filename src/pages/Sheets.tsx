import { useEffect, useState } from 'react';
import { DatabaseBackup, ExternalLink, RefreshCw, Upload, Download, Link2 } from 'lucide-react';
import { api, errMsg, type SheetsStatus } from '../lib/api';
import { loadAll } from '../lib/store';
import { Modal, toast } from '../components/ui';

type Act = 'connect' | 'sync' | 'push' | 'pull' | 'backup' | 'restore';
const wib = (s?: string) => (s ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'Belum pernah');

export default function Sheets() {
  const [s, setS] = useState<SheetsStatus | null>(null), [busy, setBusy] = useState<Act | null>(null), [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<{ act: 'pull' | 'restore'; key?: string; text: string } | null>(null);
  useEffect(() => { api.sheetsStatus().then(setS).catch(e => setErr(errMsg(e))); }, []);

  async function run(act: Act, key?: string) {
    setBusy(act); setErr('');
    try { setS(await api.sheetsAction(act, key)); if (act !== 'backup' && act !== 'connect') await loadAll(); toast('Berhasil'); }
    catch (e) { setErr(errMsg(e)); toast('Gagal — lihat pesan error', 'err'); api.sheetsStatus().then(setS).catch(() => {}); }
    finally { setBusy(null); }
  }
  const m = s?.meta;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Integrasi Google Sheets</h1>
      {!s && !err && <div className="card text-sm text-slate-500">Memuat…</div>}
      {err && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{err}</div>}
      {s && !s.configured && <div className="card text-sm"><b>Belum dikonfigurasi.</b> Isi <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_PRIVATE_KEY</code>, dan <code>GOOGLE_SHEET_ID</code> di environment variables Netlify, lalu deploy ulang. Panduan: <code>docs/google-sheets.md</code>.</div>}
      {s?.configured && <>
        <div className="card space-y-1 text-sm">
          <div>Service account: <code>{s.serviceEmail}</code></div>
          <div>Sinkronisasi terakhir: <b>{wib(m?.lastSyncAt)}</b>{m?.lastAction && <span className="text-slate-500"> ({m.lastAction})</span>}</div>
          {m?.stats && <div className="text-slate-600">Ke Sheets {m.stats.toSheet} · ke website {m.stats.toWeb} · tidak berubah {m.stats.unchanged} · konflik {m.stats.conflicts}</div>}
          <div>Status: {m?.lastStatus === 'error' ? <span className="font-medium text-red-600">Gagal — {m.lastError}</span> : m?.lastStatus === 'ok' ? <span className="font-medium text-emerald-600">Berhasil</span> : <span className="text-slate-500">Belum ada</span>}</div>
          {s.spreadsheetUrl && <a className="inline-flex items-center gap-1 text-brand-600 underline" href={s.spreadsheetUrl} target="_blank" rel="noreferrer">Buka spreadsheet <ExternalLink size={12} /></a>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-g" disabled={!!busy} onClick={() => run('connect')}><Link2 size={16} />{busy === 'connect' ? 'Menyiapkan…' : 'Hubungkan & siapkan sheet'}</button>
          <button className="btn-p" disabled={!!busy} onClick={() => run('sync')}><RefreshCw size={16} className={busy === 'sync' ? 'animate-spin' : ''} />{busy === 'sync' ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}</button>
          <button className="btn-g" disabled={!!busy} onClick={() => run('push')}><Upload size={16} />{busy === 'push' ? 'Mengirim…' : 'Kirim ke Sheets (timpa)'}</button>
          <button className="btn-g" disabled={!!busy} onClick={() => setConfirm({ act: 'pull', text: 'Data di website akan DIGANTI dengan isi spreadsheet. Backup otomatis dibuat lebih dulu.' })}><Download size={16} />Ambil dari Sheets (ganti)</button>
        </div>
        <div className="card text-xs text-slate-600 space-y-1">
          <b>Cara konflik ditangani.</b>
          <p>Setiap sinkronisasi membandingkan isi transaksi di website, di Sheets, dan versi saat sinkronisasi terakhir. Jika hanya satu sisi yang berubah, perubahan itu dipakai. Jika <u>kedua sisi</u> berubah, versi website dipakai dan versi Sheets disimpan di sheet "Konflik" agar bisa dipulihkan manual.</p>
          <p>Jika ada baris tidak valid di Sheets, sinkronisasi dibatalkan tanpa mengubah data apa pun.</p>
          <p>Sheet "Buyers": nama, WhatsApp, dan catatan buyer bisa diedit di Sheets (nama baru ikut ke semua transaksi buyer itu). Kolom total order/omzet/modal/untung dan tanggal pertama/terakhir diisi otomatis dari transaksi pada setiap sinkronisasi. Baris dengan nomor yang sudah terdaftar digabung otomatis, bukan dibuat ganda.</p>
        </div>
      </>}
      <div className="card space-y-2"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Backup & restore</h2>
        <button className="btn-g" disabled={!!busy} onClick={() => run('backup')}><DatabaseBackup size={16} />Buat backup</button></div>
        <p className="text-xs text-slate-500">Backup disimpan di server (10 terakhir). Password tetap terenkripsi. Backup otomatis dibuat sebelum sinkronisasi yang mengubah data website dan sebelum restore.</p>
        {s?.backups.length ? <ul className="divide-y text-sm">{s.backups.map(b => <li key={b.key} className="flex items-center justify-between gap-2 py-2">
          <span>{wib(b.at)} <span className="text-xs text-slate-500">· {b.label} · {b.count} transaksi</span></span>
          <button className="btn-g" disabled={!!busy} onClick={() => setConfirm({ act: 'restore', key: b.key, text: `Semua data website akan diganti dengan backup ${wib(b.at)} (${b.count} transaksi). Backup pengaman dibuat lebih dulu. Jalankan sinkronisasi setelahnya agar Sheets ikut.` })}>Pulihkan</button></li>)}</ul>
          : <p className="text-sm text-slate-500">Belum ada backup.</p>}</div>
      {confirm && <Modal title="Konfirmasi" onClose={() => setConfirm(null)}><p className="text-sm">{confirm.text}</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setConfirm(null)}>Batal</button>
          <button className="btn bg-red-600 text-white" onClick={() => { const c = confirm; setConfirm(null); run(c.act, c.key); }}>Lanjutkan</button></div></Modal>}
    </div>
  );
}
