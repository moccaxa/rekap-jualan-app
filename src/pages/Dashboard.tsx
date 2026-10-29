import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSettings, useTransactions } from '../lib/store';
import { addDays, todayJakarta } from '../../shared/dates';
import { costOf, profitOf, revenueOf, summarize } from '../../shared/finance';
import { getStatus } from '../../shared/status';
import { rupiah, tgl } from '../lib/format';
import { Empty } from '../components/ui';
import { Link } from 'react-router-dom';
import BuyerInsights from '../components/BuyerInsights';
import PeriodFilter from '../components/PeriodFilter';
import { usePeriod } from '../lib/buyerStats';

type Range = 'today' | '7d' | 'month' | 'custom';
const Card = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) =>
  <div className="card"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-brand-900">{value}</div>{sub && <div className="text-xs text-slate-400">{sub}</div>}</div>;

export default function Dashboard() {
  const list = useTransactions(), { warnDays } = useSettings(), bp = usePeriod('all');
  const today = todayJakarta();
  const [range, setRange] = useState<Range>('month');
  const [cf, setCf] = useState(today), [ct, setCt] = useState(today);
  const [from, to] = range === 'today' ? [today, today] : range === '7d' ? [addDays(today, -6), today]
    : range === 'month' ? [today.slice(0, 8) + '01', today] : [cf, ct];

  const inRange = useMemo(() => list.filter(t => t.orderDate >= from && t.orderDate <= to), [list, from, to]);
  const s = summarize(inRange);
  const valid = list.filter(t => !t.cancelled);
  const st = (x: string) => valid.filter(t => getStatus(t, today, warnDays) === x).length;
  const aktif = valid.filter(t => getStatus(t, today, warnDays) !== 'Sudah Habis').length;
  const bulanIni = valid.filter(t => t.orderDate.startsWith(today.slice(0, 7))).length;

  const byDate = useMemo(() => {
    const m = new Map<string, { tanggal: string; omzet: number; untung: number }>();
    inRange.filter(t => !t.cancelled).forEach(t => {
      const r = m.get(t.orderDate) ?? { tanggal: t.orderDate.slice(5), omzet: 0, untung: 0 };
      r.omzet += revenueOf(t); r.untung += profitOf(t); m.set(t.orderDate, r);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [inRange]);
  const byProduct = useMemo(() => {
    const m = new Map<string, number>();
    inRange.filter(t => !t.cancelled).forEach(t => { const k = `${t.product} (${t.plan})`; m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([produk, transaksi]) => ({ produk, transaksi })).sort((a, b) => b.transaksi - a.transaksi).slice(0, 8);
  }, [inRange]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          {([['today', 'Hari ini'], ['7d', '7 hari'], ['month', 'Bulan ini'], ['custom', 'Kustom']] as const).map(([k, l]) =>
            <button key={k} onClick={() => setRange(k)} className={range === k ? 'btn-p' : 'btn-g'}>{l}</button>)}
          {range === 'custom' && <><input type="date" className="inp w-auto" value={cf} onChange={e => setCf(e.target.value)} />
            <input type="date" className="inp w-auto" value={ct} onChange={e => setCt(e.target.value)} /></>}
        </div>
      </div>
      <p className="text-xs text-slate-500">Periode: {tgl(from)} – {tgl(to)} (berdasarkan tanggal order). Kartu status masa aktif menghitung semua transaksi.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label="Total transaksi" value={s.count} sub="pada periode" />
        <Card label="Total omzet" value={rupiah(s.revenue)} />
        <Card label="Total modal" value={rupiah(s.cost)} />
        <Card label="Total keuntungan" value={rupiah(s.profit)} sub={`Margin ${s.margin.toFixed(1)}%`} />
        <Card label="Transaksi bulan ini" value={bulanIni} />
        <Card label="Transaksi aktif" value={aktif} sub="belum habis" />
        <Card label={`Akan habis (≤${warnDays} hari)`} value={st('Akan Habis')} />
        <Card label="Habis hari ini" value={st('Habis Hari Ini')} />
        <Card label="Sudah habis" value={st('Sudah Habis')} />
      </div>
      {byDate.length === 0 ? <div className="card"><Empty text="Belum ada transaksi pada periode ini." /></div> : <>
        <div className="card"><h2 className="mb-2 text-sm font-medium">Omzet & keuntungan per tanggal</h2>
          <div className="h-64"><ResponsiveContainer><LineChart data={byDate}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="tanggal" fontSize={11} /><YAxis fontSize={11} tickFormatter={v => `${v / 1000}k`} />
            <Tooltip formatter={(v: number) => rupiah(v)} /><Legend /><Line dataKey="omzet" stroke="#6d28d9" isAnimationActive={false} /><Line dataKey="untung" stroke="#10b981" isAnimationActive={false} /></LineChart></ResponsiveContainer></div></div>
        <div className="card"><h2 className="mb-2 text-sm font-medium">Transaksi per produk / plan</h2>
          <div className="h-64"><ResponsiveContainer><BarChart data={byProduct}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="produk" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} />
            <Tooltip /><Bar dataKey="transaksi" fill="#7c3aed" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div></>}
      <section className="space-y-3 pt-2" data-testid="buyer-section">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Analisis Buyer</h2>
          <div className="flex flex-wrap items-center gap-2"><PeriodFilter value={bp.period} onChange={bp.setPeriod} /><Link to="/buyer" className="text-sm text-brand-600 underline">Data Buyer</Link></div></div>
        <BuyerInsights range={bp.range} />
      </section>
    </div>
  );
}
