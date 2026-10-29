import { useEffect, useState } from 'react';
import { Bot, PlayCircle, Search, Send } from 'lucide-react';
import { api, errMsg, type TgChat, type TgStatus } from '../lib/api';
import { useTransactions } from '../lib/store';
import type { TelegramSettings } from '../../shared/types';
import { Empty, toast } from '../components/ui';

const OFFS = [14, 7, 3, 1, 0], label = (o: number) => (o === 0 ? 'Hari H' : `H-${o}`);
const wib = (s: string) => new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

export default function Telegram() {
  const txs = useTransactions();
  const [s, setS] = useState<TgStatus | null>(null), [f, setF] = useState<TelegramSettings | null>(null);
  const [busy, setBusy] = useState(''), [err, setErr] = useState(''), [bot, setBot] = useState(''), [chats, setChats] = useState<TgChat[] | null>(null);
  const apply = (x: TgStatus) => { setS(x); setF(p => p ?? x.settings); };
  useEffect(() => { api.tgStatus().then(apply).catch(e => setErr(errMsg(e))); }, []);

  async function act(name: string, fn: () => Promise<void>, ok?: string) {
    setBusy(name); setErr('');
    try { await fn(); if (ok) toast(ok); } catch (e) { setErr(errMsg(e)); toast('Gagal — lihat pesan error', 'err'); api.tgStatus().then(x => setS(x)).catch(() => {}); }
    finally { setBusy(''); }
  }
  const dirty = s && f && JSON.stringify(s.settings) !== JSON.stringify({ ...f, offsets: [...f.offsets].sort((a, b) => b - a) });
  const name = (id: string) => (id === 'TES' ? '(tes koneksi)' : txs.find(t => t.id === id)?.buyerName ?? id);

  if (!s || !f) return <div className="space-y-3"><h1 className="text-xl font-semibold">Integrasi Telegram</h1>{err ? <div className="card border-red-200 bg-red-50 text-sm text-red-700">{err}</div> : <div className="card text-sm text-slate-500">Memuat…</div>}</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Integrasi Telegram</h1>
      {err && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{err}</div>}
      {!s.tokenConfigured && <div className="card text-sm"><b>Bot token belum diatur.</b> Buat bot lewat @BotFather lalu isi <code>TELEGRAM_BOT_TOKEN</code> di environment variables Netlify dan deploy ulang. Panduan: <code>docs/telegram.md</code>. Token tidak pernah disimpan atau ditampilkan di aplikasi.</div>}

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-g" disabled={!!busy || !s.tokenConfigured} onClick={() => act('connect', async () => { const r = await api.tgAction<TgStatus & { bot: { username: string } }>('connect'); setBot(r.bot.username); setS(r); })}><Bot size={16} />{busy === 'connect' ? 'Menghubungkan…' : 'Hubungkan Telegram'}</button>
          {bot && <span className="text-sm text-emerald-700">Terhubung ke @{bot}. Buka bot ini di Telegram dan tekan Start.</span>}
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Chat ID penerima {s.envChatId && !f.chatId && <span className="text-slate-400">(kosong = memakai TELEGRAM_CHAT_ID dari server)</span>}</span>
          <div className="flex gap-2"><input className="inp" placeholder="mis. 123456789 atau -1001234567890 (grup)" value={f.chatId} onChange={e => setF({ ...f, chatId: e.target.value })} />
            <button className="btn-g shrink-0" disabled={!!busy || !s.tokenConfigured} onClick={() => act('detect', async () => setChats((await api.tgAction<{ chats: TgChat[] }>('detect')).chats))}><Search size={16} />{busy === 'detect' ? 'Mencari…' : 'Deteksi'}</button></div></label>
        {chats && (chats.length === 0 ? <p className="text-xs text-amber-700">Belum ada chat terdeteksi. Kirim /start ke bot (atau pesan di grup), lalu coba lagi.</p> :
          <ul className="divide-y rounded-lg border text-sm">{chats.map(c => <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2"><span>{c.name} <span className="text-xs text-slate-500">· {c.type} · {c.id}</span></span>
            <button className="btn-g" onClick={() => { setF({ ...f, chatId: String(c.id) }); setChats(null); }}>Pakai</button></li>)}</ul>)}
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-medium">Pengaturan reminder (global)</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} />Aktifkan pengiriman reminder otomatis ke Telegram</label>
        <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Jam pengiriman (WIB)</span>
          <select className="inp w-auto" value={f.sendHour} onChange={e => setF({ ...f, sendHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
        <div><span className="mb-1 block text-xs font-medium text-slate-600">Reminder yang dikirim ke Telegram</span>
          <div className="flex flex-wrap gap-3">{[...new Set([...OFFS, ...f.offsets])].sort((a, b) => b - a).map(o => <label key={o} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.offsets.includes(o)} onChange={e => setF({ ...f, offsets: e.target.checked ? [...f.offsets, o] : f.offsets.filter(x => x !== o) })} />{label(o)}</label>)}</div></div>
        <p className="text-xs text-slate-500">Pesan dikirim bila offset ada di daftar ini <b>dan</b> di jadwal transaksi itu (diatur di halaman Reminder). Jam dicek tiap jam oleh server; jika jam kirim sudah lewat, pesan tetap terkirim pada jalan berikutnya di hari yang sama.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-p" disabled={!!busy || !dirty} onClick={() => act('save', async () => { const r = await api.tgSave(f); setS(r); setF(r.settings); }, 'Pengaturan disimpan')}>{busy === 'save' ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
          <button className="btn-g" disabled={!!busy || !s.tokenConfigured || !!dirty} title={dirty ? 'Simpan pengaturan dulu' : ''} onClick={() => act('test', async () => setS(await api.tgAction('test')), 'Pesan tes terkirim')}><Send size={16} />{busy === 'test' ? 'Mengirim…' : 'Kirim pesan tes'}</button>
          <button className="btn-g" disabled={!!busy || !s.tokenConfigured || !!dirty} title="Jalankan pengecekan yang sama dengan scheduler" onClick={() => act('run', async () => { const r = await api.tgAction<TgStatus & { run: { sent: number; failed: number } }>('run'); setS(r); toast(`Terkirim ${r.run.sent}, gagal ${r.run.failed}`); })}><PlayCircle size={16} />{busy === 'run' ? 'Memeriksa…' : 'Jalankan pengecekan sekarang'}</button>
        </div>
      </div>

      <div className="card space-y-1 text-sm"><h2 className="text-sm font-medium">Scheduler</h2>
        {s.lastRun ? <>
          <div>Pengecekan terakhir: <b>{wib(s.lastRun.at)} WIB</b> — terkirim {s.lastRun.sent}, gagal {s.lastRun.failed}, dilewati {s.lastRun.skipped}</div>
          {s.lastRun.error && <div className="text-red-600">{s.lastRun.error}</div>}{s.lastRun.notes.map((n, i) => <div key={i} className="text-xs text-slate-500">{n}</div>)}</>
          : <div className="text-slate-500">Belum pernah berjalan. Scheduler aktif setelah deploy produksi (lihat docs/telegram.md).</div>}</div>

      <div className="card"><h2 className="mb-2 text-sm font-medium">Riwayat pesan</h2>
        {s.history.length === 0 ? <Empty text="Belum ada pesan." /> : <ul className="divide-y text-sm">{s.history.map((l, i) => <li key={i} className="py-2">
          <div className="flex justify-between gap-2"><span>{name(l.txId)}{l.offset > 0 || l.txId !== 'TES' ? <span className="text-slate-500"> · {label(l.offset)}</span> : null}</span>
            <span className={l.status === 'Gagal' ? 'font-medium text-red-600' : 'font-medium text-emerald-600'}>{l.status}</span></div>
          <div className="text-xs text-slate-500">{wib(l.at)}{l.detail ? ` · ${l.detail}` : ''}</div></li>)}</ul>}</div>
    </div>
  );
}
