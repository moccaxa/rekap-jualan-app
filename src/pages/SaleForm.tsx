import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { buyerStore, newId, txStore, useSettings } from '../lib/store';
import { PLANS, type DurationUnit, type Plan, type Transaction } from '../../shared/types';
import { calcExpiry, todayJakarta } from '../../shared/dates';
import { marginPct, profitOf, revenueOf } from '../../shared/finance';
import { DEFAULT_OFFSETS } from '../../shared/reminders';
import BuyerPicker from '../components/BuyerPicker';
import { rupiah, tgl } from '../lib/format';
import { toast } from '../components/ui';
import { api, errMsg } from '../lib/api';

const keyOf = (v: number, u: DurationUnit, m: number[], d: number[]) => (u === 'month' ? m : d).includes(v) ? `${u}:${v}` : 'custom';
const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}{error && <span className="text-xs text-red-600">{error}</span>}</label>;

export default function SaleForm() {
  const { id } = useParams(); const nav = useNavigate(), [qs] = useSearchParams();
  const old = id ? txStore.get(id) : undefined;
  const today = todayJakarta();
  const { monthOptions: MONTHS, dayOptions: DAYS } = useSettings();
  const [f, setF] = useState(() => ({
    buyerId: old?.buyerId ?? (buyerStore.get(qs.get('buyer') ?? '')?.id ?? ''), product: old?.product ?? '', plan: (old?.plan ?? 'Private') as Plan,
    variation: old?.variation ?? '', durKey: old ? keyOf(old.durationValue, old.durationUnit, MONTHS, DAYS) : 'month:1',
    customValue: String(old?.durationValue ?? 1), customUnit: (old?.durationUnit ?? 'month') as DurationUnit,
    orderDate: old?.orderDate ?? today, useStart: !!old && old.startDate !== old.orderDate, startDate: old?.startDate ?? today,
    manualExpiry: old?.expiryManual ?? false, expiryDate: old?.expiryDate ?? '',
    accountEmail: old?.accountEmail ?? '', accountPassword: '',
    sellPrice: String(old?.sellPrice ?? ''), costPrice: String(old?.costPrice ?? ''), quantity: String(old?.quantity ?? 1),
    supplier: old?.supplier ?? '', notes: old?.notes ?? '', cancelled: old?.cancelled ?? false,
  }));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false), [pwTouched, setPwTouched] = useState(false), [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const [dv, du]: [number, DurationUnit] = f.durKey === 'custom' ? [Math.max(1, Math.floor(Number(f.customValue) || 1)), f.customUnit]
    : [Number(f.durKey.split(':')[1]), f.durKey.split(':')[0] as DurationUnit];
  const start = f.useStart ? f.startDate : f.orderDate;
  const autoExpiry = start ? calcExpiry(start, dv, du) : '';
  const expiry = f.manualExpiry && f.expiryDate ? f.expiryDate : autoExpiry;
  const nums = { sellPrice: Number(f.sellPrice) || 0, costPrice: Number(f.costPrice) || 0, quantity: Number(f.quantity) || 0 };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    const buyer = buyerStore.get(f.buyerId); if (!buyer) er.buyerId = 'Pilih buyer terdaftar atau tambahkan buyer baru';
    if (!f.product.trim()) er.product = 'Wajib diisi';
    if (nums.quantity < 1 || !Number.isInteger(nums.quantity)) er.quantity = 'Minimal 1';
    if (nums.sellPrice < 0 || nums.costPrice < 0) er.sellPrice = 'Harga tidak boleh negatif';
    if (!f.orderDate) er.orderDate = 'Wajib diisi';
    if (expiry && start && expiry < start) er.expiryDate = 'Tanggal habis tidak boleh sebelum tanggal mulai';
    setErrs(er);
    if (Object.keys(er).length) return toast('Periksa kembali isian form', 'err');
    const now = new Date().toISOString();
    const t: Transaction = {
      id: old?.id ?? newId(), buyerId: buyer!.id, buyerName: buyer!.name, whatsapp: buyer!.whatsapp, product: f.product.trim(), plan: f.plan, variation: f.variation.trim(),
      durationValue: dv, durationUnit: du, orderDate: f.orderDate, startDate: start, expiryDate: expiry, expiryManual: f.manualExpiry && expiry !== autoExpiry,
      accountEmail: f.accountEmail.trim(), accountPassword: pwTouched ? f.accountPassword : undefined, ...nums, supplier: f.supplier.trim(), notes: f.notes.trim(),
      cancelled: f.cancelled, reminderEnabled: old?.reminderEnabled ?? true, reminderOffsets: old?.reminderOffsets ?? DEFAULT_OFFSETS,
      followedUp: old?.followedUp ?? false, createdAt: old?.createdAt ?? now, updatedAt: now, version: (old?.version ?? 0) + 1,
    };
    setSaving(true);
    try { await txStore.save(t); toast(old ? 'Transaksi diperbarui' : 'Transaksi ditambahkan'); nav('/penjualan'); }
    catch (x) { toast(errMsg(x), 'err'); setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{old ? `Edit ${old.id}` : 'Tambah Penjualan'}</h1>
      {id && !old && <div className="card text-sm text-red-600">Transaksi tidak ditemukan.</div>}
      <section className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Buyer *</span><BuyerPicker value={f.buyerId} onChange={v => set('buyerId', v)} error={errs.buyerId} /></div>
        <Field label="Nama Produk *" error={errs.product}><input className="inp" value={f.product} onChange={e => set('product', e.target.value)} /></Field>
        <Field label="Plan"><select className="inp" value={f.plan} onChange={e => set('plan', e.target.value as Plan)}>{PLANS.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Variasi Produk"><input className="inp" value={f.variation} onChange={e => set('variation', e.target.value)} /></Field>
        <Field label="FH / Beli di Siapa"><input className="inp" value={f.supplier} onChange={e => set('supplier', e.target.value)} /></Field>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <Field label="Durasi"><select className="inp" value={f.durKey} onChange={e => set('durKey', e.target.value)}>
          <optgroup label="Bulanan">{MONTHS.map(m => <option key={m} value={`month:${m}`}>{m} bulan</option>)}</optgroup>
          <optgroup label="Harian">{DAYS.map(d => <option key={d} value={`day:${d}`}>{d} hari</option>)}</optgroup>
          <option value="custom">Custom</option></select></Field>
        {f.durKey === 'custom' && <Field label="Durasi custom"><div className="flex gap-2">
          <input type="number" min={1} className="inp" value={f.customValue} onChange={e => set('customValue', e.target.value)} />
          <select className="inp" value={f.customUnit} onChange={e => set('customUnit', e.target.value as DurationUnit)}><option value="month">bulan</option><option value="day">hari</option></select></div></Field>}
        <Field label="Tanggal Order *" error={errs.orderDate}><input type="date" className="inp" value={f.orderDate} onChange={e => set('orderDate', e.target.value)} /></Field>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.useStart} onChange={e => set('useStart', e.target.checked)} />Tanggal mulai aktif berbeda dari tanggal order</label></div>
        {f.useStart && <Field label="Tanggal Mulai Aktif"><input type="date" className="inp" value={f.startDate} onChange={e => set('startDate', e.target.value)} /></Field>}
        <Field label={`Tanggal Habis ${f.manualExpiry ? '(manual)' : '(otomatis)'}`} error={errs.expiryDate}>
          <input type="date" className="inp" value={expiry} onChange={e => setF(p => ({ ...p, manualExpiry: true, expiryDate: e.target.value }))} />
          {f.manualExpiry && <button type="button" className="mt-1 text-xs text-brand-600 underline" onClick={() => set('manualExpiry', false)}>Hitung ulang otomatis ({tgl(autoExpiry)})</button>}</Field>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <Field label="Email Akun"><input type="email" className="inp" value={f.accountEmail} onChange={e => set('accountEmail', e.target.value)} /></Field>
        <Field label="Password Akun"><div className="flex gap-2"><input type={showPw ? 'text' : 'password'} autoComplete="off" className="inp" placeholder={old?.hasPassword && !pwTouched ? '•••••• (tersimpan, kosongkan jika tidak diubah)' : ''} value={f.accountPassword} onChange={e => { set('accountPassword', e.target.value); setPwTouched(true); }} />
          <button type="button" className="btn-g px-3" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {old?.hasPassword && !pwTouched && !f.accountPassword && <button type="button" className="mt-1 text-xs text-brand-600 underline" onClick={async () => { try { const r = await api.reveal(old.id); setF(p => ({ ...p, accountPassword: r.password })); setShowPw(true); } catch (x) { toast(errMsg(x), 'err'); } }}>Tampilkan password tersimpan</button>}</Field>
        <Field label="Harga Jual per unit (Rp)" error={errs.sellPrice}><input type="number" min={0} inputMode="numeric" className="inp" value={f.sellPrice} onChange={e => set('sellPrice', e.target.value)} /></Field>
        <Field label="Harga Modal per unit (Rp)"><input type="number" min={0} inputMode="numeric" className="inp" value={f.costPrice} onChange={e => set('costPrice', e.target.value)} /></Field>
        <Field label="Kuantitas (unit)" error={errs.quantity}><input type="number" min={1} className="inp" value={f.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
        <div className="rounded-lg bg-brand-50 p-3 text-sm">
          <div>Omzet: <b>{rupiah(revenueOf(nums))}</b></div>
          <div>Keuntungan: <b className={profitOf(nums) < 0 ? 'text-red-600' : 'text-emerald-700'}>{rupiah(profitOf(nums))}</b> · Margin {marginPct(nums).toFixed(1)}%</div></div>
        <div className="sm:col-span-2"><Field label="Catatan"><textarea rows={2} className="inp" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field></div>
        {old && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.cancelled} onChange={e => set('cancelled', e.target.checked)} />Transaksi dibatalkan</label>}
      </section>
      <p className="text-xs text-slate-500">Password akun dienkripsi di server sebelum disimpan dan tidak ikut dikirim ke Telegram maupun CSV.</p>
      <div className="flex gap-2"><button className="btn-p" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button><button type="button" className="btn-g" onClick={() => nav(-1)}>Batal</button></div>
    </form>
  );
}
