import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
import { runReminders } from './_lib/reminderEngine';
import { detectChats, getMe, sendMessage, TelegramError } from './_lib/telegram';
import { todayJakarta } from '../../shared/dates';
import { buildReminderMessage } from '../../shared/message';
import type { ReminderLog, TelegramSettings } from '../../shared/types';
export const config = { path: '/api/telegram' };

const status = async () => ({
  tokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN, envChatId: !!process.env.TELEGRAM_CHAT_ID, settings: await db.tg(), lastRun: await db.run(),
  history: (await db.logs()).filter(l => l.channel === 'telegram' && l.status !== 'Terjadwal').slice(-50).reverse(),
});
const tgGuard = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { if (e instanceof TelegramError) throw new HttpError(502, e.message); throw e; } };
const chatOf = async () => { const c = (await db.tg()).chatId || process.env.TELEGRAM_CHAT_ID || ''; if (!c) throw new HttpError(400, 'Chat ID belum diatur. Isi Chat ID atau TELEGRAM_CHAT_ID.'); return c; };
async function logTest(key: string, txId: string, offset: number, ok: boolean, detail: string) {
  const l: ReminderLog = { key, txId, offset, sendDate: todayJakarta(), status: ok ? 'Terkirim' : 'Gagal', at: new Date().toISOString(), channel: 'telegram', detail };
  await db.setLogs([...(await db.logs()), l].slice(-1000));
}

export default wrap(async req => {
  requireAuth(req);
  if (req.method === 'GET') return json(await status());
  if (req.method === 'PUT') {
    const s = await readBody<Partial<TelegramSettings>>(req);
    const okOffs = Array.isArray(s.offsets) && s.offsets.length <= 20 && s.offsets.every(n => Number.isInteger(n) && n >= 0 && n <= 3650);
    if (typeof s.enabled !== 'boolean' || typeof s.chatId !== 'string' || !/^(|-?\d{5,20}|@[A-Za-z0-9_]{5,32})$/.test(s.chatId.trim()) || !Number.isInteger(s.sendHour) || s.sendHour! < 0 || s.sendHour! > 23 || !okOffs)
      throw new HttpError(422, 'Pengaturan Telegram tidak valid. Chat ID berupa angka (grup diawali tanda minus) atau @namachannel.');
    await db.setTg({ enabled: s.enabled, chatId: s.chatId.trim(), sendHour: s.sendHour!, offsets: [...new Set(s.offsets!)].sort((a, b) => b - a) });
    return json(await status());
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Metode tidak diizinkan');
  const b = await readBody<{ action?: string; txId?: string; offset?: number }>(req);

  if (b.action === 'connect') { const me = await tgGuard(getMe); return json({ ...(await status()), bot: { username: me.username, name: me.first_name } }); }
  if (b.action === 'detect') return json({ chats: await tgGuard(detectChats) });
  if (b.action === 'run') { const r = await runReminders(); return json({ ...(await status()), run: r }); }
  if (b.action === 'test') {
    const chat = await chatOf(), key = `test:umum|${new Date().toISOString()}`;
    try { await sendMessage(chat, `✅ Tes koneksi Rekap Jualan berhasil.\nWaktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`); await logTest(key, 'TES', 0, true, 'Pesan tes koneksi'); }
    catch (e) { const m = e instanceof TelegramError ? e.message : 'Gagal mengirim'; await logTest(key, 'TES', 0, false, m); throw new HttpError(502, m); }
    return json(await status());
  }
  if (b.action === 'test-reminder') {
    const t = (await db.tx()).find(x => x.id === b.txId && !x.deletedAt);
    if (!t || !Number.isInteger(b.offset)) throw new HttpError(422, 'Transaksi tidak ditemukan');
    const chat = await chatOf(), key = `test:${t.id}|${b.offset}|${new Date().toISOString()}`;
    try { await sendMessage(chat, buildReminderMessage(t, todayJakarta(), '🧪 TES (bukan jadwal otomatis)\n\n')); await logTest(key, t.id, b.offset!, true, 'Pesan tes'); }
    catch (e) { const m = e instanceof TelegramError ? e.message : 'Gagal mengirim'; await logTest(key, t.id, b.offset!, false, m); throw new HttpError(502, m); }
    return json(await status());
  }
  throw new HttpError(400, 'Aksi tidak dikenal');
});
