import { randomBytes } from 'node:crypto';
import { db } from './db';
import { sendMessage, TelegramError } from './telegram';
import { hourJakarta, todayJakarta } from '../../../shared/dates';
import { buildReminderMessage } from '../../../shared/message';
import { fullSchedule } from '../../../shared/reminders';
import type { ReminderLog, ReminderRunInfo } from '../../../shared/types';

const MAX_ATTEMPTS = 3, BUDGET_MS = 20_000;
const append = async (l: ReminderLog) => { await db.setLogs([...(await db.logs()), l].slice(-1000)); };

/**
 * Dipanggil scheduler tiap jam. Mengirim reminder yang jatuh TEMPO HARI INI (Asia/Jakarta) bila jam sekarang >= jam kirim.
 * Jaminan anti-ganda:
 *  1) kunci id|offset|tanggalKirim; Terkirim/Ditindaklanjuti tidak pernah dikirim lagi,
 *  2) catatan "mengirim" ditulis SEBELUM pesan dikirim; bila proses terhenti di tengah (hasil tidak diketahui) pesan TIDAK dikirim ulang otomatis,
 *  3) hanya kegagalan eksplisit dari Telegram yang dicoba ulang, maksimal 3 kali.
 */
export async function runReminders(opts: { now?: Date } = {}): Promise<ReminderRunInfo> {
  const now = opts.now ?? new Date(), today = todayJakarta(now), hour = hourJakarta(now);
  const info: ReminderRunInfo = { at: now.toISOString(), sent: 0, failed: 0, skipped: 0, notes: [] };
  const tg = await db.tg();
  if (!tg.enabled) { info.notes.push('Pengiriman Telegram sedang dinonaktifkan.'); return info; }
  const owner = randomBytes(8).toString('hex');
  if (!(await db.lock(owner))) { info.notes.push('Proses lain sedang berjalan; dilewati.'); return info; }
  try {
    const chat = tg.chatId || process.env.TELEGRAM_CHAT_ID || '';
    if (!chat) { info.error = 'Chat ID belum diatur.'; return info; }
    if (hour < tg.sendHour) { info.notes.push(`Belum jam kirim (${String(tg.sendHour).padStart(2, '0')}:00 WIB).`); return info; }

    const [txs, logs] = await Promise.all([db.tx(), db.logs()]);
    const latest = new Map<string, ReminderLog>(), fails = new Map<string, number>();
    for (const l of logs) { latest.set(l.key, l); if (l.status === 'Gagal') fails.set(l.key, (fails.get(l.key) ?? 0) + 1); }

    // satu pesan per transaksi per hari: bila sudah terkirim/ditindaklanjuti hari ini, jadwal lain di hari yang sama dilewati
    const sentToday = new Set(logs.filter(l => l.sendDate === today && (l.status === 'Terkirim' || l.status === 'Ditindaklanjuti') && !l.key.startsWith('test:')).map(l => l.txId));
    const due: { t: (typeof txs)[number]; offset: number; key: string }[] = [];
    for (const t of txs) {
      if (t.deletedAt || t.cancelled || !t.reminderEnabled) continue;
      // tanggal khusus pilihan pengguna selalu dikirim; jadwal H-n hanya bila offsetnya dipilih di pengaturan global Telegram
      const todays = fullSchedule(t).filter(i => i.date === today);
      const pick = todays.find(i => i.kind === 'date') ?? todays.find(i => tg.offsets.includes(i.offset));
      for (const s of pick ? [pick] : []) {
        if (sentToday.has(t.id)) { info.skipped++; continue; }
        const key = s.key, st = latest.get(key);
        if (st?.status === 'Terjadwal') { // sisa dari proses yang terhenti: hasil tidak diketahui → jangan kirim ulang
          await append({ key, txId: t.id, offset: s.offset, sendDate: s.date, status: 'Gagal', at: now.toISOString(), channel: 'telegram', detail: 'Tidak diketahui: proses sebelumnya terhenti saat mengirim. Cek Telegram; jika belum masuk, kirim manual lewat tombol "Kirim tes".' });
          info.failed++; continue;
        }
        if (st?.status === 'Gagal' && (st.detail?.startsWith('Tidak diketahui') || (fails.get(key) ?? 0) >= MAX_ATTEMPTS)) { info.skipped++; continue; }
        due.push({ t, offset: s.offset, key });
      }
    }

    const t0 = Date.now();
    for (const d of due) {
      if (Date.now() - t0 > BUDGET_MS) { info.notes.push('Batas waktu eksekusi hampir habis; sisanya dikirim pada jalannya berikutnya.'); break; }
      const base = { key: d.key, txId: d.t.id, offset: d.offset, sendDate: today, channel: 'telegram' as const };
      await append({ ...base, status: 'Terjadwal', at: new Date().toISOString(), detail: 'mengirim' }); // klaim SEBELUM kirim
      try {
        await sendMessage(chat, buildReminderMessage(d.t, today));
        await append({ ...base, status: 'Terkirim', at: new Date().toISOString() }); info.sent++;
      } catch (e) {
        const err = e instanceof TelegramError ? e : new TelegramError('Kesalahan tak terduga saat mengirim.', 0, 'other');
        await append({ ...base, status: 'Gagal', at: new Date().toISOString(), detail: err.message }); info.failed++;
        if (err.kind !== 'other' && err.kind !== 'network') { info.notes.push(`Dihentikan: ${err.message}`); break; } // token/chat/blokir/rate-limit: sisanya pasti gagal juga
      }
    }
    return info;
  } catch (e) { info.error = e instanceof Error ? e.message : 'Kesalahan tidak diketahui'; return info; }
  finally { await db.setRun(info); await db.unlock(owner); }
}
