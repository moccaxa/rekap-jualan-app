import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GitMerge, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import BuyerModal from '../components/BuyerModal';
import PeriodFilter from '../components/PeriodFilter';
import { BuyerStatusBadge, Empty, Modal, StatusBadge, toast } from '../components/ui';
import { errMsg } from '../lib/api';
import { useBuyerStats, usePeriod } from '../lib/buyerStats';
import { durLabel, rupiah, tgl } from '../lib/format';
import { waLink } from '../lib/phone';
import { buyerStore, useBuyers, useSettings, useTransactions } from '../lib/store';
import { inRange } from '../../shared/buyers';
import { daysLeft, getStatus } from '../../shared/status';
import { profitOf } from '../../shared/finance';
import type { Transaction } from '../../shared/types';

const Card = ({ label, value }: { label: string; value: string | number }) => <div className="card"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 break-words text-lg font-semibold text-brand-900">{value}</div></div>;

export default function BuyerDetail() {
  const { id } = useParams(), nav = useNavigate(), buyers = useBuyers(), txs = useTransactions(), { warnDays } = useSettings(), pr = usePeriod('all');
  const { stats, today } = useBuyerStats(pr.range), s = stats.find(x => x.buyer.id === id), buyer = buyers.find(b => b.id === id);
  const [edit, setEdit] = useState(false), [del, setDel] = useState(false), [merge, setMerge] = useState(''), [confirmMerge, setConfirmMerge] = useState(false);
  const mine = useMemo(() => txs.filter(t => t.buyerId === id).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id.localeCompare(a.id)), [txs, id]);
  const history = mine.filter(t => inRange(t.orderDate, pr.range)), running = mine.filter(t => !t.cancelled && ['Aktif', 'Akan Habis', 'Habis Hari Ini'].includes(getStatus(t, today, warnDays))).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  if (!buyer || !s) return <div className="space-y-3"><Link to="/buyer" className="btn-g"><ArrowLeft size={16} />Data Buyer</Link><div className="card text-sm text-slate-600">Buyer tidak ditemukan.</div></div>;
  const others = buyers.filter(b => b.id !== buyer.id);
  const row = (t: Transaction) => (
    <tr key={t.id} className="border-t align-top"><td className="px-3 py-2 font-mono text-xs">{t.id}</td><td className="px-3 py-2"><div>{t.product}</div><div className="text-xs text-slate-500">{t.plan}{t.variation && ` · ${t.variation}`}</div></td>
      <td className="whitespace-nowrap px-3 py-2">{tgl(t.orderDate)}</td><td className="whitespace-nowrap px-3 py-2">{tgl(t.expiryDate)}</td><td className="whitespace-nowrap px-3 py-2">{rupiah(t.sellPrice)}{t.quantity > 1 && ` ×${t.quantity}`}</td>
      <td className="whitespace-nowrap px-3 py-2 font-medium">{t.cancelled ? '-' : rupiah(profitOf(t))}</td><td className="px-3 py-2"><StatusBadge s={getStatus(t, today, warnDays)} /></td><td className="px-3 py-2"><Link className="btn-g px-2" to={`/edit/${t.id}`} title="Edit transaksi"><Pencil size={14} /></Link></td></tr>);
  return (
    <div className="space-y-4">
      <Link to="/buyer" className="inline-flex items-center gap-1 text-sm text-brand-600"><ArrowLeft size={14} />Data Buyer</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold" data-testid="buyer-name">{buyer.name}</h1><BuyerStatusBadge s={s.status} /></div><div className="text-sm text-slate-600">{buyer.whatsapp} · <span className="font-mono text-xs">{buyer.id}</span></div></div>
        <div className="flex flex-wrap gap-2"><a className="btn-g" href={waLink(buyer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a>
          <button className="btn-g" onClick={() => setEdit(true)}><Pencil size={16} />Edit</button><Link className="btn-p" to={`/tambah?buyer=${buyer.id}`}><Plus size={16} />Tambah transaksi</Link></div></div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-slate-500">Periode:</span><PeriodFilter value={pr.period} onChange={pr.setPeriod} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="detail-cards">
        <Card label="Tanggal pertama order" value={tgl(s.firstOrder ?? '')} /><Card label="Tanggal terakhir order" value={tgl(s.lastOrder ?? '')} /><Card label="Total order" value={s.orders} /><Card label="Total omzet" value={rupiah(s.revenue)} />
        <Card label="Total modal" value={rupiah(s.cost)} /><Card label="Total keuntungan" value={rupiah(s.profit)} /><Card label="Produk paling sering dibeli" value={s.topProduct ?? '-'} /><Card label="Plan paling sering dipilih" value={s.topPlan ?? '-'} /></div>
      <div className="card"><div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-medium">Catatan internal</h2><button className="text-xs text-brand-600 underline" onClick={() => setEdit(true)}>Ubah</button></div>
        <p className="whitespace-pre-wrap text-sm text-slate-600">{buyer.notes || 'Belum ada catatan.'}</p></div>

      <div className="card" data-testid="running"><h2 className="mb-2 text-sm font-medium">Masa aktif transaksi yang masih berjalan</h2>
        {running.length === 0 ? <Empty text="Tidak ada transaksi yang sedang berjalan." /> : <ul className="divide-y text-sm">{running.map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{t.product} · {t.plan} <span className="text-xs text-slate-500">({durLabel(t.durationValue, t.durationUnit)})</span></span>
          <span className="flex items-center gap-2 text-xs text-slate-500">habis {tgl(t.expiryDate)} · sisa {daysLeft(t.expiryDate, today)} hari <StatusBadge s={getStatus(t, today, warnDays)} /></span></li>)}</ul>}</div>

      <div className="card overflow-x-auto p-0" data-testid="history"><h2 className="px-4 pt-3 text-sm font-medium">Riwayat transaksi ({history.length})</h2>
        {history.length === 0 ? <Empty text="Tidak ada transaksi pada periode ini." /> : <>
          <div className="divide-y md:hidden">{history.map(t => <div key={t.id} className="space-y-1 p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{t.product}</div><div className="text-xs text-slate-500">{t.plan} · {t.id}</div></div><StatusBadge s={getStatus(t, today, warnDays)} /></div>
            <div className="grid grid-cols-2 gap-1 text-xs text-slate-600"><span>Order: {tgl(t.orderDate)}</span><span>Habis: {tgl(t.expiryDate)}</span><span>Jual: {rupiah(t.sellPrice)}</span><span>Untung: {t.cancelled ? '-' : rupiah(profitOf(t))}</span></div>
            <Link className="btn-g px-2 text-xs" to={`/edit/${t.id}`}>Edit</Link></div>)}</div>
          <table className="hidden w-full text-left text-sm md:table"><thead className="text-xs text-slate-500"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Order</th><th className="px-3 py-2">Habis</th><th className="px-3 py-2">Jual</th><th className="px-3 py-2">Untung</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"><span className="sr-only">Aksi</span></th></tr></thead><tbody>{history.map(row)}</tbody></table></>}</div>

      <div className="card space-y-2"><h2 className="text-sm font-medium">Kelola buyer</h2>
        {others.length > 0 && <div className="flex flex-wrap items-center gap-2"><select className="inp w-auto max-w-full" aria-label="Gabungkan ke buyer" value={merge} onChange={e => setMerge(e.target.value)}><option value="">Gabungkan ke buyer lain…</option>{others.map(b => <option key={b.id} value={b.id}>{b.name} ({b.whatsapp})</option>)}</select>
          <button className="btn-g" disabled={!merge} onClick={() => setConfirmMerge(true)}><GitMerge size={16} />Gabungkan</button></div>}
        <p className="text-xs text-slate-500">Gabungkan dipakai untuk membereskan buyer ganda: semua transaksi {buyer.name} dipindahkan ke buyer tujuan, lalu buyer ini dihapus.</p>
        <button className="btn-g text-red-600" disabled={mine.length > 0} title={mine.length ? 'Buyer masih memiliki transaksi' : ''} onClick={() => setDel(true)}><Trash2 size={16} />Hapus buyer</button></div>

      {edit && <BuyerModal initial={buyer} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      {del && <Modal title="Hapus buyer?" onClose={() => setDel(false)}><p className="text-sm">Buyer <b>{buyer.name}</b> akan dihapus.</p><div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setDel(false)}>Batal</button>
        <button className="btn bg-red-600 text-white" onClick={async () => { try { await buyerStore.remove(buyer.id); toast('Buyer dihapus'); nav('/buyer'); } catch (e) { toast(errMsg(e), 'err'); setDel(false); } }}>Hapus</button></div></Modal>}
      {confirmMerge && <Modal title="Gabungkan buyer?" onClose={() => setConfirmMerge(false)}><p className="text-sm">{mine.length} transaksi milik <b>{buyer.name}</b> akan dipindahkan ke <b>{buyers.find(b => b.id === merge)?.name}</b>, lalu <b>{buyer.name}</b> dihapus. Catatan digabung.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setConfirmMerge(false)}>Batal</button>
          <button className="btn-p" onClick={async () => { try { await buyerStore.merge(buyer.id, merge); toast('Buyer digabungkan'); nav(`/buyer/${merge}`); } catch (e) { toast(errMsg(e), 'err'); setConfirmMerge(false); } }}>Gabungkan</button></div></Modal>}
    </div>
  );
}
