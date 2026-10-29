import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, CircleMinus, LogOut } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { logout } from '../lib/auth';
import { settingsStore, useSettings } from '../lib/store';
import { toast } from '../components/ui';

type Check = { id: string; label: string; ok: boolean; optional?: boolean };
export default function Settings() {
  const s = useSettings(); const [warn, setWarn] = useState(String(s.warnDays)), [bn, setBn] = useState(String(s.buyerNewDays)), [bi, setBi] = useState(String(s.buyerInactiveDays)), [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<{ https: boolean; checks: Check[] } | null>(null), [err, setErr] = useState('');
  useEffect(() => { api.configCheck().then(setCfg).catch(e => setErr(errMsg(e))); }, []);
  async function save() {
    const n = Number(warn); if (!Number.isInteger(n) || n < 1 || n > 60) return toast('Isi bilangan bulat 1–60', 'err');
    setBusy(true); try { await settingsStore.set({ ...s, warnDays: n }); toast('Pengaturan disimpan'); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengaturan</h1>
      <div className="card space-y-2"><h2 className="text-sm font-medium">Status "Akan Habis"</h2>
        <p className="text-xs text-slate-500">Transaksi ditandai "Akan Habis" bila sisa masa aktif tidak lebih dari jumlah hari ini.</p>
        <div className="flex gap-2"><input type="number" min={1} max={60} className="inp w-28" value={warn} onChange={e => setWarn(e.target.value)} /><span className="self-center text-sm">hari</span>
          <button className="btn-p" disabled={busy || Number(warn) === s.warnDays} onClick={save}>Simpan</button></div></div>
      <div className="card space-y-2"><h2 className="text-sm font-medium">Status buyer</h2>
        <p className="text-xs text-slate-500">Baru: order pertama ≤ N hari lalu (atau belum pernah order). Aktif: order terakhir ≤ M hari lalu. Selain itu Tidak Aktif.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">Baru ≤ <input type="number" aria-label="Hari buyer baru" min={1} max={365} className="inp w-24" value={bn} onChange={e => setBn(e.target.value)} /> hari · Aktif ≤ <input type="number" aria-label="Hari buyer aktif" min={7} max={730} className="inp w-24" value={bi} onChange={e => setBi(e.target.value)} /> hari
          <button className="btn-p" disabled={busy || (Number(bn) === s.buyerNewDays && Number(bi) === s.buyerInactiveDays)} onClick={async () => { const a = Number(bn), b = Number(bi); if (!Number.isInteger(a) || a < 1 || a > 365 || !Number.isInteger(b) || b < 7 || b > 730) return toast('Hari baru 1–365, hari aktif 7–730', 'err'); setBusy(true); try { await settingsStore.set({ ...s, buyerNewDays: a, buyerInactiveDays: b }); toast('Pengaturan disimpan'); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); } }}>Simpan</button></div></div>
      <div className="card space-y-2"><h2 className="text-sm font-medium">Pemeriksaan konfigurasi server</h2>
        {err && <p className="text-sm text-red-600">{err}</p>}{!cfg && !err && <p className="text-sm text-slate-500">Memeriksa…</p>}
        {cfg && <><ul className="space-y-1 text-sm">{cfg.checks.map(c => <li key={c.id} className="flex items-center gap-2">
          {c.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : c.optional ? <CircleMinus size={16} className="text-slate-400" /> : <CircleAlert size={16} className="text-red-600" />}
          <span>{c.label}{c.optional && !c.ok && <span className="text-xs text-slate-400"> (opsional / belum diaktifkan)</span>}</span></li>)}</ul>
          <p className={`text-xs ${cfg.https ? 'text-emerald-700' : 'text-amber-700'}`}>{cfg.https ? 'Koneksi memakai HTTPS.' : 'Koneksi TIDAK memakai HTTPS (wajar hanya di komputer lokal). Jangan memasukkan data asli tanpa HTTPS.'}</p></>}</div>
      <div className="card space-y-2 text-sm"><h2 className="text-sm font-medium">Keamanan data</h2>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Password akun jualan dienkripsi AES-256-GCM di server; salinan di Google Sheets dan backup juga terenkripsi. Kunci <code>DATA_ENC_KEY</code> hanya ada di environment variables.</li>
          <li>Password tidak masuk ke daftar data, CSV, maupun pesan Telegram; hanya tampil bila Anda menekan tombol tampilkan.</li>
          <li>Sesi login berlaku 7 hari. Untuk mengeluarkan semua perangkat, ganti <code>SESSION_SECRET</code> di Netlify lalu deploy ulang. Untuk mengganti password admin, buat hash baru dengan <code>npm run hash-password</code> dan perbarui <code>ADMIN_PASSWORD_HASH</code>.</li>
          <li>Data buyer (nama, WhatsApp, email) tersimpan tanpa enkripsi tingkat kolom di Netlify Blobs dan Google Sheets; keamanannya bergantung pada akun Netlify dan Google Anda. Aktifkan 2FA pada keduanya.</li></ul></div>
      <button className="btn-g" onClick={logout}><LogOut size={16} />Keluar</button>
    </div>
  );
}
