import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerStore, useBuyers } from '../lib/store';
import { errMsg } from '../lib/api';
import { normalizePhone } from '../lib/phone';
import type { Buyer } from '../../shared/types';
import { Modal, toast } from './ui';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
/** Tambah/ubah buyer. Mendeteksi nomor yang sama (diblokir, dengan tawaran memakai buyer yang ada) dan nama yang sama (peringatan saja). */
export default function BuyerModal({ initial, prefill, onClose, onSaved, onUseExisting }: {
  initial?: Buyer; prefill?: { name?: string; whatsapp?: string }; onClose: () => void; onSaved: (b: Buyer) => void; onUseExisting?: (b: Buyer) => void;
}) {
  const buyers = useBuyers();
  const [name, setName] = useState(initial?.name ?? prefill?.name ?? ''), [wa, setWa] = useState(initial?.whatsapp ?? prefill?.whatsapp ?? ''), [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const phone = useMemo(() => normalizePhone(wa), [wa]);
  const dupPhone = phone ? buyers.find(b => b.whatsapp === phone && b.id !== initial?.id) : undefined;
  const dupName = !dupPhone && name.trim() ? buyers.find(b => b.id !== initial?.id && norm(b.name) === norm(name)) : undefined;

  async function save() {
    if (!name.trim()) return setErr('Nama buyer wajib diisi');
    if (!phone) return setErr('Nomor WhatsApp tidak valid (contoh: 0812xxxxxxx)');
    if (dupPhone) return;
    setBusy(true); setErr('');
    try { const b = initial ? await buyerStore.update({ ...initial, name: name.trim(), whatsapp: phone, notes }) : await buyerStore.create({ name: name.trim(), whatsapp: phone, notes }); toast(initial ? 'Buyer diperbarui' : 'Buyer ditambahkan'); onSaved(b); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title={initial ? `Edit buyer ${initial.id}` : 'Tambah buyer'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Nama Buyer *</span><input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Nomor WhatsApp *</span><input className="inp" inputMode="tel" placeholder="0812xxxxxxx" value={wa} onChange={e => setWa(e.target.value)} />
          {phone && <span className="text-xs text-slate-500">Tersimpan sebagai {phone}</span>}</label>
        {dupPhone && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Nomor ini sudah terdaftar atas nama <b>{dupPhone.name}</b>.
          <div className="mt-2 flex gap-2">{onUseExisting && <button type="button" className="btn-p" onClick={() => onUseExisting(dupPhone)}>Pakai buyer ini</button>}<Link className="btn-g" to={`/buyer/${dupPhone.id}`} onClick={onClose}>Lihat buyer</Link></div></div>}
        {dupName && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Sudah ada buyer bernama <b>{dupName.name}</b> ({dupName.whatsapp}). Pastikan ini orang yang berbeda; jika sama, pakai buyer yang ada agar tidak terjadi duplikat.
          {onUseExisting && <div className="mt-2"><button type="button" className="btn-g" onClick={() => onUseExisting(dupName)}>Pakai buyer yang ada</button></div>}</div>}
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Catatan buyer</span><textarea rows={2} className="inp" value={notes} onChange={e => setNotes(e.target.value)} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-g" onClick={onClose}>Batal</button><button type="button" className="btn-p" disabled={busy || !!dupPhone} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </div>
    </Modal>
  );
}
