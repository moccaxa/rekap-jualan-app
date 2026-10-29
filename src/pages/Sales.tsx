import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, MessageCircle, Pencil, Plus, Search, Trash2, Info } from 'lucide-react';
import { txStore, useSettings, useTransactions } from '../lib/store';
import { todayJakarta } from '../../shared/dates';
import { getStatus } from '../../shared/status';
import { profitOf } from '../../shared/finance';
import { PLANS, type Status, type Transaction } from '../../shared/types';
import { durLabel, rupiah, tgl } from '../lib/format';
import { waLink } from '../lib/phone';
import CsvTools from '../components/CsvTools';
import { Empty, Modal, StatusBadge, toast } from '../components/ui';
import { api, errMsg } from '../lib/api';

const STATUSES: Status[] = ['Aktif', 'Akan Habis', 'Habis Hari Ini', 'Sudah Habis', 'Dibatalkan'];
type SortKey = 'orderDate' | 'expiryDate' | 'buyerName' | 'profit';

export default function Sales() {
  const list = useTransactions(), { warnDays } = useSettings(); const today = todayJakarta();
  const [q, setQ] = useState(''), [plan, setPlan] = useState(''), [status, setStatus] = useState(''), [product, setProduct] = useState('');
  const [od, setOd] = useState(['', '']), [ed, setEd] = useState(['', '']);
  const [sort, setSort] = useState<SortKey>('orderDate'), [dir, setDir] = useState<1 | -1>(-1);
  const [size, setSize] = useState(10), [page, setPage] = useState(1);
  const [reveals, setReveals] = useState<Record<string, string>>({});
  const [del, setDel] = useState<Transaction | null>(null), [detail, setDetail] = useState<Transaction | null>(null);
  const products = useMemo(() => [...new Set(list.map(t => t.product))].sort(), [list]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = list.filter(t =>
      (!s || [t.buyerName, t.whatsapp, t.product, t.accountEmail, t.supplier].some(x => x.toLowerCase().includes(s))) &&
      (!plan || t.plan === plan) && (!product || t.product === product) && (!status || getStatus(t, today, warnDays) === status) &&
      (!od[0] || t.orderDate >= od[0]) && (!od[1] || t.orderDate <= od[1]) && (!ed[0] || t.expiryDate >= ed[0]) && (!ed[1] || t.expiryDate <= ed[1]));
    const val = (t: Transaction) => sort === 'profit' ? profitOf(t) : t[sort];
    return r.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  }, [list, q, plan, product, status, od, ed, sort, dir, today, warnDays]);

  const pages = Math.max(1, Math.ceil(rows.length / size)), cur = Math.min(page, pages);
  const view = rows.slice((cur - 1) * size, cur * size);
  const th = (k: SortKey, l: string) => <th className="cursor-pointer px-3 py-2" onClick={() => { k === sort ? setDir(d => (d === 1 ? -1 : 1)) : (setSort(k), setDir(-1)); }}>{l}{sort === k ? (dir === 1 ? ' ↑' : ' ↓') : ''}</th>;
  const pw = (t: Transaction) => !t.hasPassword ? '-' : reveals[t.id] !== undefined ? reveals[t.id] : '••••••';
  const toggle = async (id: string) => {
    if (reveals[id] !== undefined) return setReveals(p => { const n = { ...p }; delete n[id]; return n; });
    try { const r = await api.reveal(id); setReveals(p => ({ ...p, [id]: r.password || '(kosong)' })); } catch (e) { toast(errMsg(e), 'err'); }
  };
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  const actions = (t: Transaction) => (<div className="flex gap-1">
                <button title="Detail" className="btn-g px-2" onClick={() => setDetail(t)}><Info size={14} /></button>
                <a title="WhatsApp" className="btn-g px-2" href={waLink(t.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a>
                <Link title="Edit" className="btn-g px-2" to={`/edit/${t.id}`}><Pencil size={14} /></Link>
                <button title="Hapus" className="btn-g px-2 text-red-600" onClick={() => setDel(t)}><Trash2 size={14} /></button></div>);
  const card = (t: Transaction) => (
    <div key={t.id} className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link to={`/buyer/${t.buyerId}`} className="font-medium text-brand-700 hover:underline">{t.buyerName}</Link>
        <div className="text-xs text-slate-500">{t.product} · {t.plan}{t.variation && ` · ${t.variation}`}</div></div><StatusBadge s={getStatus(t, today, warnDays)} /></div>
      <div className="grid grid-cols-2 gap-1 text-xs text-slate-600"><span>Order: {tgl(t.orderDate)}</span><span>Habis: {tgl(t.expiryDate)}</span>
        <span>Jual: {rupiah(t.sellPrice)}</span><span>Untung: {t.cancelled ? '-' : rupiah(profitOf(t))}</span></div>
      {actions(t)}
    </div>);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="w-full text-xl font-semibold sm:w-auto">Data Penjualan</h1>
        <div className="flex flex-wrap gap-2"><CsvTools rows={rows} /><Link to="/tambah" className="btn-p"><Plus size={16} />Tambah</Link></div></div>
      <div className="card space-y-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="inp pl-9" placeholder="Cari buyer, WhatsApp, produk, email akun, FH…" value={q} onChange={e => reset(setQ)(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <select className="inp" value={product} onChange={e => reset(setProduct)(e.target.value)}><option value="">Semua produk</option>{products.map(p => <option key={p}>{p}</option>)}</select>
          <select className="inp" value={plan} onChange={e => reset(setPlan)(e.target.value)}><option value="">Semua plan</option>{PLANS.map(p => <option key={p}>{p}</option>)}</select>
          <select className="inp" value={status} onChange={e => reset(setStatus)(e.target.value)}><option value="">Semua status</option>{STATUSES.map(p => <option key={p}>{p}</option>)}</select>
          <select className="inp" value={size} onChange={e => reset(setSize)(Number(e.target.value))}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} baris</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-4">
          <label>Order dari<input type="date" className="inp" value={od[0]} onChange={e => reset(setOd)([e.target.value, od[1]])} /></label>
          <label>Order sampai<input type="date" className="inp" value={od[1]} onChange={e => reset(setOd)([od[0], e.target.value])} /></label>
          <label>Habis dari<input type="date" className="inp" value={ed[0]} onChange={e => reset(setEd)([e.target.value, ed[1]])} /></label>
          <label>Habis sampai<input type="date" className="inp" value={ed[1]} onChange={e => reset(setEd)([ed[0], e.target.value])} /></label>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        {view.length === 0 ? <Empty text={list.length ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada transaksi. Klik Tambah untuk mulai.'} /> :
        <><div className="divide-y md:hidden">{view.map(card)}</div><table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>
            <th className="px-3 py-2">ID</th>{th('buyerName', 'Buyer')}<th className="px-3 py-2">Produk</th><th className="px-3 py-2">Durasi</th>
            {th('orderDate', 'Order')}{th('expiryDate', 'Habis')}<th className="px-3 py-2">Email / Password</th>
            <th className="px-3 py-2">Jual</th><th className="px-3 py-2">Modal</th>{th('profit', 'Untung')}<th className="px-3 py-2">FH</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr></thead>
          <tbody>{view.map(t => (
            <tr key={t.id} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
              <td className="px-3 py-2"><Link to={`/buyer/${t.buyerId}`} className="font-medium text-brand-700 hover:underline">{t.buyerName}</Link><div className="text-xs text-slate-500">{t.whatsapp}</div></td>
              <td className="px-3 py-2"><div>{t.product}</div><div className="text-xs text-slate-500">{t.plan}{t.variation && ` · ${t.variation}`}</div></td>
              <td className="px-3 py-2 whitespace-nowrap">{durLabel(t.durationValue, t.durationUnit)}{t.quantity > 1 && ` ×${t.quantity}`}</td>
              <td className="px-3 py-2 whitespace-nowrap">{tgl(t.orderDate)}</td><td className="px-3 py-2 whitespace-nowrap">{tgl(t.expiryDate)}</td>
              <td className="px-3 py-2 text-xs"><div>{t.accountEmail || '-'}</div><button className="flex items-center gap-1 text-slate-500" onClick={() => toggle(t.id)}>{reveals[t.id] !== undefined ? <EyeOff size={12} /> : <Eye size={12} />}{pw(t)}</button></td>
              <td className="px-3 py-2 whitespace-nowrap">{rupiah(t.sellPrice)}</td><td className="px-3 py-2 whitespace-nowrap">{rupiah(t.costPrice)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-medium">{t.cancelled ? '-' : rupiah(profitOf(t))}</td>
              <td className="px-3 py-2">{t.supplier || '-'}</td><td className="px-3 py-2"><StatusBadge s={getStatus(t, today, warnDays)} /></td>
              <td className="px-3 py-2">{actions(t)}</td>
            </tr>))}</tbody></table></>}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{rows.length} transaksi</span>
        <div className="flex items-center gap-2"><button className="btn-g" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button><span>{cur} / {pages}</span>
          <button className="btn-g" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>›</button></div></div>

      {del && <Modal title="Hapus transaksi?" onClose={() => setDel(null)}>
        <p className="text-sm">Transaksi <b>{del.id}</b> milik <b>{del.buyerName}</b> akan dihapus.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setDel(null)}>Batal</button>
          <button className="btn bg-red-600 text-white" onClick={async () => { try { await txStore.remove(del.id); toast('Transaksi dihapus'); } catch (e) { toast(errMsg(e), 'err'); } setDel(null); }}>Hapus</button></div></Modal>}
      {detail && <Modal title={`Detail ${detail.id}`} onClose={() => setDetail(null)}>
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-sm">
          {([['Buyer', detail.buyerName], ['WhatsApp', detail.whatsapp], ['Produk', detail.product], ['Plan', detail.plan], ['Variasi', detail.variation || '-'],
            ['Durasi', durLabel(detail.durationValue, detail.durationUnit)], ['Tanggal order', tgl(detail.orderDate)], ['Mulai aktif', tgl(detail.startDate)],
            ['Tanggal habis', tgl(detail.expiryDate) + (detail.expiryManual ? ' (manual)' : '')], ['Email akun', detail.accountEmail || '-'], ['Password', pw(detail)],
            ['Harga jual', rupiah(detail.sellPrice)], ['Harga modal', rupiah(detail.costPrice)], ['Kuantitas', String(detail.quantity)],
            ['Keuntungan', rupiah(profitOf(detail))], ['FH', detail.supplier || '-'], ['Catatan', detail.notes || '-'], ['Status', getStatus(detail, today, warnDays)]] as [string, string][])
            .map(([k, v]) => <><dt key={k} className="text-slate-500">{k}</dt><dd key={k + 'v'} className="break-words">{v}</dd></>)}
        </dl>
        <button className="btn-g mt-3" onClick={() => toggle(detail.id)}>{reveals[detail.id] !== undefined ? 'Sembunyikan' : 'Tampilkan'} password</button></Modal>}
    </div>
  );
}
