import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerStore, useBuyers } from '../lib/store';
import { errMsg } from '../lib/api';
import { parseContact } from '../../shared/contact';
import { findByContact } from '../../shared/buyers';
import type { Buyer } from '../../shared/types';
import { Modal, toast } from './ui';

/** Tambah/ubah buyer. Identitas = nomor WhatsApp dan/atau username Telegram (minimal salah satu); tidak ada kolom nama. Kontak yang sudah terdaftar diblokir dengan tawaran memakai buyer yang ada. */
export default function BuyerModal({ initial, prefill, onClose, onSaved, onUseExisting }: {
  initial?: Buyer; prefill?: { whatsapp?: string; telegram?: string }; onClose: () => void; onSaved: (b: Buyer) => void; onUseExisting?: (b: Buyer) => void;
}) {
  const buyers = useBuyers();
  const [wa, setWa] = useState(initial?.whatsapp ?? prefill?.whatsapp ?? ''), [tg, setTg] = useState(initial?.telegram ? '@' + initial.telegram : prefill?.telegram ?? ''), [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const c = useMemo(() => parseContact({ whatsapp: wa, telegram: tg }), [wa, tg]);
  const dup = c.ok ? findByContact(buyers, c, b => b.id !== initial?.id && !b.deletedAt) : undefined;

  async function save() {
    if (!c.ok) return setErr(c.error);
    if (dup) return;
    setBusy(true); setErr('');
    try { const b = initial ? await buyerStore.update({ ...initial, whatsapp: c.whatsapp, telegram: c.telegram, notes }) : await buyerStore.create({ whatsapp: c.whatsapp, telegram: c.telegram, notes }); toast(initial ? 'Buyer diperbarui' : 'Buyer ditambahkan'); onSaved(b); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title={initial ? `Edit buyer ${initial.id}` : 'Tambah buyer'} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Isi nomor WhatsApp, username Telegram, atau keduanya (minimal salah satu).</p>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Nomor WhatsApp</span><input className="inp" autoFocus inputMode="tel" placeholder="0812xxxxxxx" value={wa} onChange={e => setWa(e.target.value)} />
          {c.ok && c.whatsapp && <span className="text-xs text-slate-500">Tersimpan sebagai {c.whatsapp}</span>}</label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Username Telegram</span><input className="inp" placeholder="@username" autoCapitalize="none" value={tg} onChange={e => setTg(e.target.value)} />
          {c.ok && c.telegram && <span className="text-xs text-slate-500">Tersimpan sebagai @{c.telegram}</span>}</label>
        {dup && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Kontak ini sudah terdaftar sebagai <b>{dup.name}</b>{dup.whatsapp && dup.telegram ? ` (@${dup.telegram})` : ''}.
          <div className="mt-2 flex gap-2">{onUseExisting && <button type="button" className="btn-p" onClick={() => onUseExisting(dup)}>Pakai buyer ini</button>}<Link className="btn-g" to={`/buyer/${dup.id}`} onClick={onClose}>Lihat buyer</Link></div></div>}
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Catatan buyer</span><textarea rows={2} className="inp" value={notes} onChange={e => setNotes(e.target.value)} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-g" onClick={onClose}>Batal</button><button type="button" className="btn-p" disabled={busy || !!dup} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </div>
    </Modal>
  );
}
