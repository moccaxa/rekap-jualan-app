import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { BuyerStatus, Status } from '../../shared/types';

const colors: Record<Status, string> = {
  'Aktif': 'bg-emerald-100 text-emerald-700', 'Akan Habis': 'bg-amber-100 text-amber-700',
  'Habis Hari Ini': 'bg-orange-100 text-orange-700', 'Sudah Habis': 'bg-red-100 text-red-700', 'Dibatalkan': 'bg-slate-200 text-slate-600',
};
export const StatusBadge = ({ s }: { s: Status }) => <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[s]}`}>{s}</span>;

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></div>
        {children}
      </div>
    </div>, document.body
  );
}

let push: (m: string, t?: 'ok' | 'err') => void = () => {};
export const toast = (m: string, t: 'ok' | 'err' = 'ok') => push(m, t);
export function ToastHost() {
  const [items, set] = useState<{ id: number; m: string; t: string }[]>([]);
  useEffect(() => {
    push = (m, t = 'ok') => { const id = Math.random(); set(x => [...x, { id, m, t }]); setTimeout(() => set(x => x.filter(i => i.id !== id)), 3000); };
    return () => { push = () => {}; };
  }, []);
  return <div className="fixed bottom-4 right-4 z-[60] space-y-2">{items.map(i =>
    <div key={i.id} className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg ${i.t === 'err' ? 'bg-red-600' : 'bg-slate-800'}`}>{i.m}</div>)}</div>;
}

export const Empty = ({ text }: { text: string }) => <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
export const Soon = ({ title, tahap }: { title: string; tahap: string }) =>
  <div className="card"><h1 className="text-lg font-semibold">{title}</h1><p className="mt-2 text-sm text-slate-500">Halaman ini dikerjakan di {tahap}.</p></div>;

const bcolors: Record<BuyerStatus, string> = { 'Baru': 'bg-sky-100 text-sky-700', 'Aktif': 'bg-emerald-100 text-emerald-700', 'Tidak Aktif': 'bg-slate-200 text-slate-600' };
export const BuyerStatusBadge = ({ s }: { s: BuyerStatus }) => <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${bcolors[s]}`}>{s}</span>;
const rank = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];
export const RankBadge = ({ n }: { n: number }) => <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${rank[n - 1] ?? 'bg-slate-100 text-slate-500'}`} aria-label={`Peringkat ${n}`}>{n}</span>;
