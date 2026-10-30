import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Plus, Search, Send, X } from 'lucide-react';
import { useBuyers } from '../lib/store';
import { waLink } from '../lib/phone';
import { contactLine, telegramLink } from '../../shared/contact';
import BuyerModal from './BuyerModal';

const norm = (s: string) => s.trim().toLowerCase();
export default function BuyerPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const buyers = useBuyers(), [q, setQ] = useState(''), [modal, setModal] = useState(false), sel = buyers.find(b => b.id === value);
  if (sel) return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-brand-50 p-3" data-testid="buyer-selected">
      <div className="min-w-0"><Link to={`/buyer/${sel.id}`} className="font-medium text-brand-700 hover:underline">{sel.name}</Link><div className="text-xs text-slate-600">{contactLine(sel) === sel.name ? '' : contactLine(sel) + ' · '}{sel.id}</div></div>
      <div className="flex shrink-0 gap-1">{sel.whatsapp && <a className="btn-g px-2" href={waLink(sel.whatsapp)} target="_blank" rel="noreferrer" title="Buka WhatsApp"><MessageCircle size={14} /></a>}{sel.telegram && <a className="btn-g px-2" href={telegramLink(sel.telegram)} target="_blank" rel="noreferrer" title="Buka Telegram"><Send size={14} /></a>}
        <button type="button" className="btn-g px-2" title="Ganti buyer" onClick={() => onChange('')}><X size={14} /></button></div>
    </div>);
  const qd = q.replace(/\D/g, ''), qp = qd.startsWith('0') ? '62' + qd.slice(1) : qd;
  const qt = norm(q).replace(/^@/, ''), matches = q.trim() ? buyers.filter(b => (qt.length >= 2 && b.telegram.includes(qt)) || (qd.length >= 3 && b.whatsapp.includes(qp))).slice(0, 6) : [];
  const phoneLike = qd.length >= 8 && !/[a-z]/i.test(q), tgLike = !phoneLike && /^@?[a-z0-9_]{5,}$/i.test(q.trim());
  return (
    <div className="space-y-2">
      <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input className="inp pl-9" placeholder="Cari buyer terdaftar (WhatsApp atau @Telegram)" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari buyer" /></div>
      {matches.length > 0 && <ul className="divide-y rounded-lg border bg-white text-sm">{matches.map(b => <li key={b.id}>
        <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50" onClick={() => { onChange(b.id); setQ(''); }}>
          <span className="font-medium">{b.name}</span><span className="text-xs text-slate-500">{contactLine(b) === b.name ? '' : contactLine(b)}</span></button></li>)}</ul>}
      <button type="button" className="btn-g" onClick={() => setModal(true)}><Plus size={16} />Buyer baru{q.trim() && !matches.length ? ` “${q.trim()}”` : ''}</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {modal && <BuyerModal prefill={phoneLike ? { whatsapp: q } : tgLike ? { telegram: q.trim() } : {}} onClose={() => setModal(false)} onSaved={b => { setModal(false); setQ(''); onChange(b.id); }} onUseExisting={b => { setModal(false); setQ(''); onChange(b.id); }} />}
    </div>
  );
}
