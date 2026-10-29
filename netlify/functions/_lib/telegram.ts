export type TgKind = 'token' | 'chat' | 'blocked' | 'rate' | 'network' | 'other';
export class TelegramError extends Error { constructor(msg: string, public status: number, public kind: TgKind) { super(msg); } }
export interface TgChat { id: number; type: string; name: string }

/** Token hanya dibaca dari environment variable dan tidak pernah masuk ke pesan error, log, maupun respons. */
async function call<T>(method: string, body: object = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError('TELEGRAM_BOT_TOKEN belum diatur di environment variables Netlify.', 0, 'token');
  let res: Response;
  try { res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new TelegramError('Tidak dapat terhubung ke Telegram (jaringan bermasalah atau timeout). Akan dicoba lagi pada jadwal berikutnya.', 0, 'network'); }
  const j = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } } | null;
  if (res.ok && j?.ok) return j.result as T;
  const d = (j?.description ?? '').toLowerCase();
  if (res.status === 401) throw new TelegramError('Bot token ditolak Telegram. Periksa TELEGRAM_BOT_TOKEN (salin ulang dari BotFather).', 401, 'token');
  if (res.status === 403) throw new TelegramError('Bot diblokir atau dikeluarkan dari chat. Buka bot di Telegram lalu tekan Start (atau tambahkan kembali ke grup).', 403, 'blocked');
  if (res.status === 429) throw new TelegramError(`Terlalu banyak permintaan ke Telegram. Coba lagi setelah ${j?.parameters?.retry_after ?? 'beberapa'} detik.`, 429, 'rate');
  if (res.status === 400 && d.includes('chat not found')) throw new TelegramError('Chat ID tidak ditemukan. Pastikan Chat ID benar dan Anda sudah menekan Start pada bot (atau bot sudah ada di grup).', 400, 'chat');
  if (res.status === 409) throw new TelegramError('Bot sedang memakai webhook sehingga chat tidak bisa dideteksi otomatis. Isi Chat ID secara manual.', 409, 'other');
  throw new TelegramError(`Telegram menolak permintaan (${res.status})${j?.description ? ': ' + j.description : ''}.`, res.status, 'other');
}
export const sendMessage = (chatId: string, text: string) => call<{ message_id: number }>('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
export const getMe = () => call<{ username: string; first_name: string }>('getMe');
export async function detectChats(): Promise<TgChat[]> {
  type C = { id: number; type: string; title?: string; first_name?: string; username?: string };
  const ups = await call<{ message?: { chat: C }; my_chat_member?: { chat: C } }[]>('getUpdates', { limit: 100, allowed_updates: ['message', 'my_chat_member'] });
  const m = new Map<number, TgChat>();
  for (const u of ups) { const c = u.message?.chat ?? u.my_chat_member?.chat; if (c) m.set(c.id, { id: c.id, type: c.type, name: c.title ?? ([c.first_name, c.username && '@' + c.username].filter(Boolean).join(' ') || String(c.id)) }); }
  return [...m.values()];
}
