import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Send } from 'lucide-react';
import { logStore, txStore, useLogs, useTransactions } from '../lib/store';
import { addDays, diffDays, todayJakarta } from '../../shared/dates';
import { DEFAULT_OFFSETS, dedupeKey, reminderSchedule } from '../../shared/reminders';
import type { ReminderLog, Transaction } from '../../shared/types';
import { tgl } from '../lib/format';
import { Empty, Modal, toast } from '../components/ui';
import { api, errMsg } from '../lib/api';

type F = 'today' | 'tomorrow' | '3d' | '7d' | 'failed' | 'all';
const FILTERS: [F, string][] = [['today', 'Hari ini'], ['tomorrow', 'Besok'], ['3d', '3 hari'], ['7d', '7 hari'], ['failed', 'Gagal'], ['all', 'Semua']];
const label = (o: number) => (o === 0 ? 'Hari H' : `H-${o}`);
const color: Record<string, string> = { Terjadwal: 'bg-blue-100 text-blue-700', Terkirim: 'bg-emerald-100 text-emerald-700', Gagal: 'bg-red-100 text-red-700',
  Ditindaklanjuti: 'bg-violet-100 text-violet-700', Terlewat: 'bg-slate-200 text-slate-600', Nonaktif: 'bg-slate-100 text-slate-400' };

export default function Reminders() {
  const list = useTransactions(), logs = useLogs(), today = todayJakarta();
  useEffect(() => { logStore.refresh().catch(() => {}); }, []); // log baru dari scheduler
  const [f, setF] = useState<F>('7d'); const [edit, setEdit] = useState<Transaction | null>(null);
  const latest = useMemo(() => { const m = new Map<string, ReminderLog>(); logs.forEach(l => m.set(l.key, l)); return m; }, [logs]);

  const items = useMemo(() => list.filter(t => !t.cancelled).flatMap(t => reminderSchedule(t).map(s => {
    const key = dedupeKey(t.id, s.offset, s.date), status = !t.reminderEnabled ? 'Nonaktif' : latest.get(key)?.status ?? (s.date >= today ? 'Terjadwal' : 'Terlewat');
    return { t, ...s, key, status };
  })), [list, latest, today]);
  const shown = items.filter(i => f === 'all' ? true : f === 'failed' ? i.status === 'Gagal' : f === 'today' ? i.date === today : f === 'tomorrow' ? i.date === addDays(today, 1)
    : i.date >= today && i.date <= addDays(today, f === '3d' ? 3 : 7)).sort((a, b) => a.date.localeCompare(b.date) || a.t.buyerName.localeCompare(b.t.buyerName));

  const toggle = (t: Transaction) => run(() => txStore.save({ ...t, reminderEnabled: !t.reminderEnabled }));
  const done = (i: (typeof items)[number]) => run(() => logStore.add({ txId: i.t.id, offset: i.offset, sendDate: i.date }), 'Ditandai ditindaklanjuti');
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(errMsg(e), 'err'); } };
  const history = [...logs].reverse().slice(0, 30);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reminder</h1>
      <div className="flex flex-wrap gap-2">{FILTERS.map(([k, l]) => <button key={k} className={f === k ? 'btn-p' : 'btn-g'} onClick={() => setF(k)}>{l}</button>)}</div>
      <p className="text-xs text-slate-500">Pengiriman otomatis dilakukan server tiap jam sesuai pengaturan di halaman Integrasi Telegram, walau website ditutup. Tombol kirim hanya untuk pesan tes.</p>
      <div className="space-y-2">
        {shown.length === 0 ? <div className="card"><Empty text="Tidak ada reminder pada filter ini." /></div> : shown.map(i => (
          <div key={i.key} className={`card flex flex-wrap items-center justify-between gap-3 ${!i.t.reminderEnabled ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium">{i.t.buyerName}</span><span className={`rounded-full px-2 py-0.5 text-xs ${color[i.status]}`}>{i.status}</span></div>
              <div className="text-sm text-slate-600">{i.t.product} · {i.t.plan}</div>
              <div className="text-xs text-slate-500">Kirim {tgl(i.date)} ({label(i.offset)}) · Habis {tgl(i.t.expiryDate)} · sisa {diffDays(today, i.t.expiryDate)} hari</div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <label className="mr-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={i.t.reminderEnabled} onChange={() => toggle(i.t)} />Aktif</label>
              <button className="btn-g px-2" title="Atur jadwal" onClick={() => setEdit(i.t)}><CalendarClock size={14} /></button>
              <button className="btn-g px-2" title="Kirim pesan tes ke Telegram" onClick={() => run(async () => { await api.tgAction('test-reminder', { txId: i.t.id, offset: i.offset }); await logStore.refresh(); }, 'Pesan tes terkirim ke Telegram')}><Send size={14} /></button>
              <button className="btn-g px-2" title="Tandai ditindaklanjuti" onClick={() => done(i)}><Check size={14} /></button>
            </div>
          </div>))}
      </div>
      <div className="card"><h2 className="mb-2 text-sm font-medium">Riwayat reminder</h2>
        {history.length === 0 ? <Empty text="Belum ada riwayat." /> : <ul className="divide-y text-sm">{history.map((l, k) => {
          const t = list.find(x => x.id === l.txId);
          return <li key={k} className="flex justify-between gap-2 py-1.5"><span>{t?.buyerName ?? l.txId} · {label(l.offset)}</span>
            <span className="text-right text-xs text-slate-500">{l.status}{l.detail && l.status === 'Gagal' ? ` — ${l.detail}` : ''} · {new Date(l.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span></li>;
        })}</ul>}</div>
      {edit && <ScheduleModal t={edit} today={today} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ScheduleModal({ t, today, onClose }: { t: Transaction; today: string; onClose: () => void }) {
  const [offs, setOffs] = useState<number[]>(t.reminderOffsets);
  const [days, setDays] = useState(''), [date, setDate] = useState('');
  const add = (o: number) => setOffs(p => (p.includes(o) ? p : [...p, o]));
  const all = [...new Set([...DEFAULT_OFFSETS, ...offs])].sort((a, b) => b - a);
  function addDays_() { const n = Number(days); if (!Number.isInteger(n) || n < 0) return toast('Jumlah hari harus bilangan bulat ≥ 0', 'err'); add(n); setDays(''); }
  function addDate() { const n = diffDays(date, t.expiryDate); if (!date || n < 0) return toast('Tanggal harus sebelum atau sama dengan tanggal habis', 'err'); add(n); setDate(''); }
  async function save() { try { await txStore.save({ ...t, reminderOffsets: offs }); toast('Jadwal reminder disimpan'); onClose(); } catch (e) { toast(errMsg(e), 'err'); } }
  return (
    <Modal title={`Jadwal reminder — ${t.buyerName}`} onClose={onClose}>
      <p className="mb-2 text-xs text-slate-500">Tanggal habis {tgl(t.expiryDate)}. Jadwal dihitung dari tanggal habis, sehingga ikut bergeser jika tanggal habis diubah.</p>
      <div className="space-y-1">{all.map(o => <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offs.includes(o)} onChange={e => setOffs(p => e.target.checked ? [...p, o] : p.filter(x => x !== o))} />
        {label(o)} <span className="text-xs text-slate-500">→ {tgl(addDays(t.expiryDate, -o))}{addDays(t.expiryDate, -o) < today ? ' (sudah lewat)' : ''}</span></label>)}</div>
      <div className="mt-3 flex gap-2"><input type="number" min={0} className="inp" placeholder="Custom: N hari sebelum" value={days} onChange={e => setDays(e.target.value)} /><button className="btn-g" onClick={addDays_}>Tambah</button></div>
      <div className="mt-2 flex gap-2"><input type="date" className="inp" value={date} onChange={e => setDate(e.target.value)} /><button className="btn-g" onClick={addDate}>Tambah tanggal</button></div>
      <div className="mt-4 flex justify-end gap-2"><button className="btn-g" onClick={onClose}>Batal</button><button className="btn-p" onClick={save}>Simpan</button></div>
    </Modal>
  );
}
