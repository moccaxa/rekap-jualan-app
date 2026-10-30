import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { productStore, settingsStore, useProducts, useSettings, useTransactions } from '../lib/store';
import { DEFAULT_SETTINGS, type AppSettings, type Product } from '../../shared/types';
import { profitOf, revenueOf } from '../../shared/finance';
import { rupiah } from '../lib/format';
import { Empty, Modal, toast } from '../components/ui';
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

type VarRow = { name: string; sell: string; cost: string };
function ProductModal({ initial, onClose }: { initial?: Product; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? ''), [sell, setSell] = useState(initial?.sellPrice ? String(initial.sellPrice) : ''), [cost, setCost] = useState(initial?.costPrice ? String(initial.costPrice) : '');
  const [vars, setVars] = useState<VarRow[]>(initial?.variations.map(v => ({ name: v.name, sell: String(v.sellPrice), cost: v.costPrice ? String(v.costPrice) : '' })) ?? []);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const setVar = (i: number, k: keyof VarRow, v: string) => setVars(p => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  async function save() {
    if (!name.trim()) return setErr('Nama produk wajib diisi');
    if (vars.some(v => !v.name.trim())) return setErr('Nama variasi tidak boleh kosong (hapus barisnya bila tidak dipakai)');
    setBusy(true); setErr('');
    try {
      await productStore.save({ ...(initial ? { id: initial.id } : {}), name: name.trim(), sellPrice: Number(sell) || 0, costPrice: Number(cost) || 0,
        variations: vars.map(v => ({ name: v.name.trim(), sellPrice: v.sell === '' ? Number(sell) || 0 : Number(v.sell), costPrice: Number(v.cost) || 0 })) }, initial?.version);
      toast(initial ? 'Produk diperbarui' : 'Produk ditambahkan'); onClose();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title={initial ? `Edit produk` : 'Tambah produk'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Nama produk *</span><input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Harga jual (Rp)</span><input type="number" min={0} inputMode="numeric" className="inp" aria-label="Harga jual produk" value={sell} onChange={e => setSell(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Harga modal (Rp, opsional)</span><input type="number" min={0} inputMode="numeric" className="inp" aria-label="Harga modal produk" value={cost} onChange={e => setCost(e.target.value)} /></label></div>
        <div><div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-slate-600">Variasi (opsional)</span><button type="button" className="text-xs text-brand-600 underline" onClick={() => setVars(p => [...p, { name: '', sell: '', cost: '' }])}>+ Tambah variasi</button></div>
          <div className="space-y-2">{vars.map((v, i) => <div key={i} className="grid grid-cols-[1fr_90px_90px_auto] items-center gap-1"><input className="inp" placeholder="mis. 3 bulan" aria-label={`Nama variasi ${i + 1}`} value={v.name} onChange={e => setVar(i, 'name', e.target.value)} />
            <input type="number" min={0} className="inp" placeholder="Jual" aria-label={`Harga jual variasi ${i + 1}`} value={v.sell} onChange={e => setVar(i, 'sell', e.target.value)} /><input type="number" min={0} className="inp" placeholder="Modal" aria-label={`Harga modal variasi ${i + 1}`} value={v.cost} onChange={e => setVar(i, 'cost', e.target.value)} />
            <button type="button" aria-label={`Hapus variasi ${i + 1}`} onClick={() => setVars(p => p.filter((_, j) => j !== i))}><X size={16} /></button></div>)}</div>
          {vars.length > 0 && <p className="mt-1 text-xs text-slate-500">Harga jual variasi dikosongkan = memakai harga jual produk.</p>}</div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-g" onClick={onClose}>Batal</button><button type="button" className="btn-p" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </div>
    </Modal>
  );
}
function ProductCatalog() {
  const products = useProducts(); const [edit, setEdit] = useState<Product | 'new' | null>(null), [del, setDel] = useState<Product | null>(null);
  return (
    <div className="card space-y-3" data-testid="catalog">
      <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Katalog produk</h2><button className="btn-p" onClick={() => setEdit('new')}><Plus size={16} />Tambah produk</button></div>
      <p className="text-xs text-slate-500">Isi produk, harga, dan variasinya (beserta harga tiap variasi) agar form transaksi terisi otomatis. Memilih dari katalog bersifat opsional: produk dan variasi tetap boleh diketik manual.</p>
      {products.length === 0 ? <Empty text="Belum ada produk di katalog." /> : <ul className="divide-y">{products.map(p => <li key={p.id} className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0"><div className="font-medium">{p.name} <span className="text-sm font-normal text-slate-500">{p.sellPrice ? `· ${rupiah(p.sellPrice)}` : ''}{p.costPrice ? ` (modal ${rupiah(p.costPrice)})` : ''}</span></div>
          {p.variations.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{p.variations.map(v => <span key={v.name} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">{v.name} · {rupiah(v.sellPrice)}</span>)}</div>}</div>
        <div className="flex shrink-0 gap-1"><button className="btn-g px-2" title="Edit produk" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Pencil size={14} /></button><button className="btn-g px-2 text-red-600" title="Hapus produk" aria-label={`Hapus ${p.name}`} onClick={() => setDel(p)}><Trash2 size={14} /></button></div></li>)}</ul>}
      {edit && <ProductModal initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {del && <Modal title="Hapus produk?" onClose={() => setDel(null)}><p className="text-sm">Produk <b>{del.name}</b> dihapus dari katalog. Transaksi yang sudah ada tidak terpengaruh.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={() => setDel(null)}>Batal</button><button className="btn bg-red-600 text-white" onClick={async () => { try { await productStore.remove(del.id); toast('Produk dihapus'); } catch (e) { toast(errMsg(e), 'err'); } setDel(null); }}>Hapus</button></div></Modal>}
    </div>
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
      <ProductCatalog />
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
