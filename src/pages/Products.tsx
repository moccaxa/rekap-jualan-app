import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { settingsStore, useSettings, useTransactions } from '../lib/store';
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/types';
import { profitOf, revenueOf } from '../../shared/finance';
import { rupiah } from '../lib/format';
import { Empty, toast } from '../components/ui';
import { errMsg } from '../lib/api';

function Options({ title, unit, k }: { title: string; unit: string; k: 'monthOptions' | 'dayOptions' }) {
  const s = useSettings(); const [v, setV] = useState('');
  const save = (list: number[]) => settingsStore.set({ ...s, [k]: [...new Set(list)].sort((a, b) => a - b) } as AppSettings).catch(e => toast(errMsg(e), 'err'));
  function add() { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 3650) return toast('Masukkan bilangan bulat 1–3650', 'err'); save([...s[k], n]); setV(''); }
  return (
    <div className="card"><h2 className="mb-2 text-sm font-medium">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-2">{s[k].map(n => <span key={n} className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">{n} {unit}
        <button aria-label={`Hapus ${n}`} onClick={() => s[k].length > 1 ? save(s[k].filter(x => x !== n)) : toast('Minimal satu opsi', 'err')}><X size={12} /></button></span>)}</div>
      <div className="flex gap-2"><input type="number" min={1} className="inp" placeholder={`Tambah opsi (${unit})`} value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /><button className="btn-p" onClick={add}>Tambah</button></div></div>
  );
}

export default function Products() {
  const list = useTransactions();
  const rows = useMemo(() => {
    const m = new Map<string, { produk: string; plan: string; n: number; omzet: number; untung: number }>();
    list.filter(t => !t.cancelled).forEach(t => { const k = `${t.product}|${t.plan}`; const r = m.get(k) ?? { produk: t.product, plan: t.plan, n: 0, omzet: 0, untung: 0 };
      r.n++; r.omzet += revenueOf(t); r.untung += profitOf(t); m.set(k, r); });
    return [...m.values()].sort((a, b) => b.untung - a.untung);
  }, [list]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">Produk & Durasi</h1>
        <button className="btn-g" onClick={() => settingsStore.set({ ...settingsStore.get(), monthOptions: DEFAULT_SETTINGS.monthOptions, dayOptions: DEFAULT_SETTINGS.dayOptions }).then(() => toast('Opsi durasi dikembalikan')).catch(e => toast(errMsg(e), 'err'))}>Reset opsi durasi</button></div>
      <div className="grid gap-3 md:grid-cols-2"><Options title="Opsi durasi bulanan" unit="bulan" k="monthOptions" /><Options title="Opsi durasi harian" unit="hari" k="dayOptions" /></div>
      <p className="text-xs text-slate-500">Opsi "Custom" selalu tersedia di form. Durasi bulanan dihitung berdasarkan bulan kalender.</p>
      <div className="card overflow-x-auto p-0"><h2 className="px-4 pt-3 text-sm font-medium">Ringkasan per produk & plan</h2>
        {rows.length === 0 ? <Empty text="Belum ada data produk." /> : <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr>
          <th className="px-4 py-2">Produk</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Transaksi</th><th className="px-4 py-2">Omzet</th><th className="px-4 py-2">Untung</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.produk + r.plan} className="border-t"><td className="px-4 py-2">{r.produk}</td><td className="px-4 py-2">{r.plan}</td><td className="px-4 py-2">{r.n}</td>
            <td className="px-4 py-2">{rupiah(r.omzet)}</td><td className="px-4 py-2">{rupiah(r.untung)}</td></tr>)}</tbody></table>}</div>
    </div>
  );
}
