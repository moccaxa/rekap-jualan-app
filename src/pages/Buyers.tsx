import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History, MessageCircle, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import BuyerInsights from '../components/BuyerInsights';
import BuyerModal from '../components/BuyerModal';
import PeriodFilter from '../components/PeriodFilter';
import { Empty, Modal, BuyerStatusBadge, toast } from '../components/ui';
import { errMsg } from '../lib/api';
import { buyersToCSV, importBuyersCSV, type BuyerImport } from '../lib/buyersCsv';
import { usePeriod, useBuyerStats } from '../lib/buyerStats';
import { rupiah, tgl } from '../lib/format';
import { waLink } from '../lib/phone';
import { buyerStore, useBuyers } from '../lib/store';
import type { BuyerStat } from '../../shared/buyers';
import type { Buyer, BuyerStatus } from '../../shared/types';

type SortKey = 'name' | 'orders' | 'revenue' | 'profit' | 'last';
const PAGE = 10;

export default function Buyers() {
  const buyers = useBuyers(), pr = usePeriod('all'), { stats } = useBuyerStats(pr.range), file = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(''), [status, setStatus] = useState<'' | BuyerStatus>(''), [sort, setSort] = useState<SortKey>('name'), [dir, setDir] = useState<1 | -1>(1), [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ edit?: Buyer } | null>(null), [del, setDel] = useState<Buyer | null>(null), [imp, setImp] = useState<BuyerImport | null>(null), [busy, setBusy] = useState(false);
  const periodOn = !!(pr.range.from || pr.range.to);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, ''), dp = d.startsWith('0') ? '62' + d.slice(1) : d;
    const r = stats.filter(x => (!periodOn || x.orders > 0) && (!status || x.status === status) && (!s || x.buyer.name.toLowerCase().includes(s) || (d.length >= 3 && x.buyer.whatsapp.includes(dp))));
    const val = (x: BuyerStat): string | number => sort === 'name' ? x.buyer.name.toLowerCase() : sort === 'last' ? x.lastOrder ?? '' : x[sort];
    return r.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir || a.buyer.id.localeCompare(b.buyer.id));
  }, [stats, q, status, sort, dir, periodOn]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)), cur = Math.min(page, pages), view = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const th = (k: SortKey, l: string) => <th className="cursor-pointer px-2 py-2" onClick={() => { k === sort ? setDir(d => (d === 1 ? -1 : 1)) : (setSort(k), setDir(k === 'name' ? 1 : -1)); }}>{l}{sort === k ? (dir === 1 ? ' ↑' : ' ↓') : ''}</th>;
  const suffix = periodOn ? ' (periode)' : '';

  const actions = (b: Buyer) => (
    <div className="flex gap-1"><Link title="Detail & riwayat transaksi" aria-label="Riwayat transaksi" className="btn-g px-2" to={`/buyer/${b.id}`}><History size={14} /></Link>
      <a title="WhatsApp" className="btn-g px-2" href={waLink(b.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a>
      <button title="Edit buyer" className="btn-g px-2" onClick={() => setModal({ edit: b })}><Pencil size={14} /></button>
      <button title="Hapus buyer" className="btn-g px-2 text-red-600" onClick={() => setDel(b)}><Trash2 size={14} /></button></div>);

  function download() {
    const blob = new Blob([buyersToCSV(rows)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `data-buyer-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href); toast(`${rows.length} buyer diekspor`);
  }
  async function doImport() {
    if (!imp) return; setBusy(true);
    try { const r = await buyerStore.addMany(imp.add); toast(`${r.added} buyer diimpor`); setImp(null); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="w-full text-xl font-semibold sm:w-auto">Data Buyer</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-g" onClick={download}><Download size={16} />Ekspor CSV</button>
          <button className="btn-g" onClick={() => file.current?.click()}><Upload size={16} />Impor CSV</button>
          <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImp(importBuyersCSV(await f.text(), buyers)); }} />
          <button className="btn-p" onClick={() => setModal({})}><Plus size={16} />Tambah buyer</button></div></div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-slate-500">Periode transaksi:</span><PeriodFilter value={pr.period} onChange={pr.setPeriod} /></div>
      <BuyerInsights range={pr.range} />

      <div className="card space-y-3">
        <h2 className="text-sm font-medium">Database buyer</h2>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="inp pl-9" placeholder="Cari nama atau nomor WhatsApp" aria-label="Cari buyer" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
          <select className="inp w-auto" aria-label="Status buyer" value={status} onChange={e => { setStatus(e.target.value as BuyerStatus | ''); setPage(1); }}><option value="">Semua status</option><option>Baru</option><option>Aktif</option><option>Tidak Aktif</option></select></div>
        {periodOn && <p className="text-xs text-slate-500">Menampilkan buyer yang bertransaksi pada periode terpilih. Total order, omzet, modal, dan untung dihitung pada periode tersebut; tanggal pertama/terakhir order selalu semua waktu.</p>}
      </div>

      <div className="card overflow-x-auto p-0" data-testid="buyer-table">
        {view.length === 0 ? <Empty text={buyers.length ? 'Tidak ada buyer yang cocok.' : 'Belum ada buyer. Tambahkan buyer atau buat transaksi baru.'} /> : <>
          <div className="divide-y md:hidden">{view.map(s => (
            <div key={s.buyer.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link to={`/buyer/${s.buyer.id}`} className="font-medium text-brand-700 hover:underline">{s.buyer.name}</Link>
              <div className="text-xs text-slate-500">{s.buyer.whatsapp} · {s.buyer.id}</div></div><BuyerStatusBadge s={s.status} /></div>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-600"><span>Order{suffix}: {s.orders}</span><span>Terakhir: {tgl(s.lastOrder ?? '')}</span><span>Omzet: {rupiah(s.revenue)}</span><span>Untung: {rupiah(s.profit)}</span></div>
              {s.buyer.notes && <p className="truncate text-xs text-slate-500">Catatan: {s.buyer.notes}</p>}{actions(s.buyer)}</div>))}</div>
          <table className="hidden w-full text-left text-[13px] md:table"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-2 py-2">ID Buyer</th>{th('name', 'Nama / WhatsApp')}{th('last', 'Order pertama / terakhir')}
            {th('orders', 'Order' + suffix)}{th('revenue', 'Omzet' + suffix)}<th className="px-2 py-2">Modal{suffix}</th>{th('profit', 'Untung' + suffix)}<th className="px-2 py-2">Status</th><th className="px-2 py-2">Catatan</th><th className="px-2 py-2">Aksi</th></tr></thead>
            <tbody>{view.map(s => <tr key={s.buyer.id} className="border-t align-top"><td className="px-2 py-2 font-mono text-[11px]">{s.buyer.id}</td>
              <td className="px-2 py-2"><Link to={`/buyer/${s.buyer.id}`} className="font-medium text-brand-700 hover:underline">{s.buyer.name}</Link><div className="text-xs text-slate-500">{s.buyer.whatsapp}</div></td>
              <td className="whitespace-nowrap px-2 py-2 text-xs"><div>{tgl(s.firstOrder ?? '')}</div><div className="text-slate-500">{tgl(s.lastOrder ?? '')}</div></td><td className="px-2 py-2 font-medium">{s.orders}</td>
              <td className="whitespace-nowrap px-2 py-2">{rupiah(s.revenue)}</td><td className="whitespace-nowrap px-2 py-2">{rupiah(s.cost)}</td><td className="whitespace-nowrap px-2 py-2 font-medium">{rupiah(s.profit)}</td>
              <td className="px-2 py-2"><BuyerStatusBadge s={s.status} /></td><td className="max-w-[120px] truncate px-2 py-2 text-xs text-slate-500" title={s.buyer.notes}>{s.buyer.notes || '-'}</td><td className="px-2 py-2">{actions(s.buyer)}</td></tr>)}</tbody></table></>}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600"><span>{rows.length} buyer</span>
        <div className="flex items-center gap-2"><button className="btn-g" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button><span>{cur} / {pages}</span><button className="btn-g" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>›</button></div></div>

      {modal && <BuyerModal initial={modal.edit} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {del && <Modal title="Hapus buyer?" onClose={() => setDel(null)}><p className="text-sm">Buyer <b>{del.name}</b> ({del.id}) akan dihapus. Buyer yang masih memiliki transaksi tidak dapat dihapus; gunakan fitur gabungkan di halaman detailnya.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setDel(null)}>Batal</button>
          <button className="btn bg-red-600 text-white" onClick={async () => { try { await buyerStore.remove(del.id); toast('Buyer dihapus'); } catch (e) { toast(errMsg(e), 'err'); } setDel(null); }}>Hapus</button></div></Modal>}
      {imp && <Modal title="Hasil validasi impor buyer" onClose={() => setImp(null)}>
        {imp.fatal ? <p className="text-sm text-red-600">{imp.fatal}</p> : <><ul className="space-y-1 text-sm"><li>Siap diimpor: <b>{imp.add.length}</b></li><li>Nomor sudah terdaftar (dilewati): <b>{imp.dupes}</b></li><li>Baris bermasalah: <b>{imp.errors.length}</b></li></ul>
          <p className="mt-2 text-xs text-slate-500">Kolom statistik di file diabaikan; statistik selalu dihitung dari transaksi.</p>
          {imp.errors.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">{imp.errors.slice(0, 50).map(x => <div key={x.row}>Baris {x.row}: {x.msg}</div>)}</div>}</>}
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setImp(null)}>Tutup</button>{!imp.fatal && imp.add.length > 0 && <button className="btn-p" disabled={busy} onClick={doImport}>{busy ? 'Mengimpor…' : `Impor ${imp.add.length} buyer`}</button>}</div></Modal>}
    </div>
  );
}
