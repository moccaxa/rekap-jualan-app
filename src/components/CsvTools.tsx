import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { importCSV, toCSV, type ImportResult } from '../lib/csv';
import { txStore, useTransactions } from '../lib/store';
import { errMsg } from '../lib/api';
import { todayJakarta } from '../../shared/dates';
import type { Transaction } from '../../shared/types';
import { Modal, toast } from './ui';

export default function CsvTools({ rows }: { rows: Transaction[] }) {
  const all = useTransactions(); const file = useRef<HTMLInputElement>(null);
  const [exp, setExp] = useState(false), [res, setRes] = useState<ImportResult | null>(null), [busy, setBusy] = useState(false);
  function download() {
    const today = todayJakarta();
    const blob = new Blob([toCSV(rows, today)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rekap-jualan-${today}.csv`; a.click(); URL.revokeObjectURL(a.href);
    setExp(false); toast(`${rows.length} transaksi diekspor`);
  }
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setRes(importCSV(await f.text(), all));
  }
  async function doImport() {
    if (!res) return; setBusy(true);
    try { const n = await txStore.addMany(res.add); toast(`${n} transaksi diimpor`); setRes(null); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  }
  return (<>
    <button className="btn-g" onClick={() => setExp(true)}><Download size={16} />Ekspor CSV</button>
    <button className="btn-g" onClick={() => file.current?.click()}><Upload size={16} />Impor CSV</button>
    <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={pick} />
    {exp && <Modal title="Ekspor CSV" onClose={() => setExp(false)}>
      <p className="text-sm">{rows.length} transaksi (sesuai filter saat ini) akan diekspor.</p>
      <p className="mt-2 text-xs text-slate-500">Password akun tidak pernah disertakan dalam CSV. Gunakan backup di halaman Google Sheets untuk salinan lengkap (terenkripsi).</p>
      <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setExp(false)}>Batal</button><button className="btn-p" onClick={download}>Unduh</button></div></Modal>}
    {res && <Modal title="Hasil validasi impor" onClose={() => setRes(null)}>
      {res.fatal ? <p className="text-sm text-red-600">{res.fatal}</p> : <>
        <ul className="space-y-1 text-sm"><li>Siap diimpor: <b>{res.add.length}</b></li><li>Duplikat dilewati: <b>{res.dupes}</b></li><li>Baris bermasalah: <b>{res.errors.length}</b></li></ul>
        {res.errors.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">{res.errors.slice(0, 50).map(x => <div key={x.row}>Baris {x.row}: {x.msg}</div>)}</div>}</>}
      <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setRes(null)}>Tutup</button>
        {!res.fatal && res.add.length > 0 && <button className="btn-p" disabled={busy} onClick={doImport}>{busy ? 'Mengimpor…' : `Impor ${res.add.length} transaksi`}</button>}</div></Modal>}
  </>);
}
