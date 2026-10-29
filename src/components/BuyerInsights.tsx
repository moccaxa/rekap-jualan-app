import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rankByOrders, rankByRevenue, type BuyerStat, type Range } from '../../shared/buyers';
import { useBuyerStats } from '../lib/buyerStats';
import { rupiah, tgl } from '../lib/format';
import { Empty, RankBadge } from './ui';

const Card = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) =>
  <div className="card"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 truncate text-xl font-semibold text-brand-900">{value}</div>{sub && <div className="text-xs leading-snug text-slate-400">{sub}</div>}</div>;

function Table({ title, rows, id, showWa }: { title: string; rows: BuyerStat[]; id: string; showWa: boolean }) {
  return (
    <div className="card overflow-x-auto p-0" data-testid={id}><h3 className="px-4 pt-3 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <Empty text="Belum ada order pada periode ini." /> :
        <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Buyer</th>{showWa && <th className="hidden px-3 py-2 md:table-cell">WhatsApp</th>}
          <th className="px-3 py-2">Order</th><th className="px-3 py-2">Omzet</th><th className="hidden px-3 py-2 sm:table-cell">Untung</th>{showWa && <th className="hidden px-3 py-2 lg:table-cell">Terakhir order</th>}<th className="px-3 py-2"><span className="sr-only">Detail</span></th></tr></thead>
          <tbody>{rows.map((s, i) => <tr key={s.buyer.id} className="border-t">
            <td className="px-3 py-2"><RankBadge n={i + 1} /></td>
            <td className="px-3 py-2"><Link to={`/buyer/${s.buyer.id}`} className="font-medium text-brand-700 hover:underline">{s.buyer.name}</Link></td>
            {showWa && <td className="hidden px-3 py-2 text-xs text-slate-600 md:table-cell">{s.buyer.whatsapp}</td>}
            <td className="px-3 py-2 font-medium">{s.orders}</td><td className="whitespace-nowrap px-3 py-2">{rupiah(s.revenue)}</td><td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">{rupiah(s.profit)}</td>
            {showWa && <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">{tgl(s.lastOrder ?? '')}</td>}
            <td className="px-3 py-2"><Link to={`/buyer/${s.buyer.id}`} className="btn-g px-2 py-1 text-xs">Detail</Link></td></tr>)}</tbody></table>}
    </div>
  );
}

/** Kartu statistik, Top Buyer (order terbanyak), Buyer Omzet Tertinggi, dan grafik: seluruhnya dihitung dari transaksi dalam `range`. */
export default function BuyerInsights({ range }: { range: Range }) {
  const { stats, an } = useBuyerStats(range), [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const top = rankByOrders([...stats]).slice(0, 10), topRev = rankByRevenue([...stats]).slice(0, 10), isAll = !range.from && !range.to;
  const chart = (metric === 'orders' ? top : topRev).map(s => ({ nama: s.buyer.name.length > 12 ? s.buyer.name.slice(0, 11) + '…' : s.buyer.name, order: s.orders, omzet: s.revenue }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="buyer-cards">
        <Card label="Total buyer terdaftar" value={an.totalBuyers} />
        <Card label={isAll ? 'Buyer baru (semua waktu)' : 'Buyer baru pada periode'} value={an.newBuyers} sub="order pertama di periode ini" />
        <Card label="Buyer repeat order" value={an.repeat} sub="≥ 2 transaksi valid" />
        <Card label="Persentase repeat order" value={`${an.repeatPct.toFixed(1)}%`} sub={`dari ${an.ordered} buyer yang order`} />
        <Card label="Belum order kembali" value={an.lapsed} sub={isAll ? 'berstatus Tidak Aktif' : 'order sebelum periode, tidak di periode'} />
        <Card label="Omzet tertinggi" value={an.topRevenue ? rupiah(an.topRevenue.revenue) : '-'} sub={an.topRevenue?.buyer.name} />
        <Card label="Keuntungan tertinggi" value={an.topProfit ? rupiah(an.topProfit.profit) : '-'} sub={an.topProfit?.buyer.name} />
      </div>
      <Table title="Top Buyer — Buyer Paling Aktif (order terbanyak)" rows={top} id="top-buyer" showWa />
      <Table title="Buyer dengan Omzet Tertinggi" rows={topRev} id="top-omzet" showWa={false} />
      {chart.length > 0 && <div className="card"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">Grafik 10 buyer teratas</h3>
        <div className="flex gap-1"><button className={metric === 'orders' ? 'btn-p px-3 py-1' : 'btn-g px-3 py-1'} onClick={() => setMetric('orders')}>Jumlah order</button><button className={metric === 'revenue' ? 'btn-p px-3 py-1' : 'btn-g px-3 py-1'} onClick={() => setMetric('revenue')}>Omzet</button></div></div>
        <div className="h-64"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nama" fontSize={10} interval={0} angle={-25} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} fontSize={11} tickFormatter={v => (metric === 'revenue' ? `${v / 1000}k` : String(v))} /><Tooltip formatter={(v: number) => (metric === 'revenue' ? rupiah(v) : v)} />
          <Bar dataKey={metric === 'orders' ? 'order' : 'omzet'} fill="#7c3aed" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>}
    </div>
  );
}
