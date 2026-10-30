import { normalizePhone } from './phone';

/** Username Telegram: tanpa @, huruf kecil, 5–32 karakter (huruf/angka/_). Menerima "@user", "t.me/user", atau tautan lengkap. '' = kosong. */
export function normalizeTelegram(raw: string): string | null {
  let s = raw.trim(); if (!s) return '';
  s = s.replace(/^https?:\/\/(www\.)?t\.me\//i, '').replace(/^t\.me\//i, '').replace(/^@/, '').replace(/[/?].*$/, '').toLowerCase();
  return /^[a-z0-9_]{5,32}$/.test(s) ? s : null;
}
/** Label buyer otomatis: nomor WhatsApp; jika tidak ada, @username Telegram. */
export const buyerLabel = (b: { whatsapp: string; telegram: string }) => b.whatsapp || (b.telegram ? '@' + b.telegram : '');
export const contactLine = (b: { whatsapp: string; telegram: string }) => (b.whatsapp && b.telegram ? `${b.whatsapp} · @${b.telegram}` : buyerLabel(b));
export const telegramLink = (u: string) => `https://t.me/${u}`;

export type Contact = { ok: true; whatsapp: string; telegram: string } | { ok: false; error: string };
/** Kontak wajib: minimal salah satu dari WhatsApp atau Telegram. */
export function parseContact(x: { whatsapp?: unknown; telegram?: unknown }): Contact {
  const wa = typeof x.whatsapp === 'string' ? x.whatsapp.trim() : '', tg = typeof x.telegram === 'string' ? x.telegram.trim() : '';
  const whatsapp = wa ? normalizePhone(wa) : ''; if (whatsapp === null) return { ok: false, error: 'Nomor WhatsApp tidak valid (contoh: 0812xxxxxxx)' };
  const telegram = tg ? normalizeTelegram(tg) : ''; if (telegram === null) return { ok: false, error: 'Username Telegram tidak valid (5–32 karakter: huruf, angka, garis bawah)' };
  if (!whatsapp && !telegram) return { ok: false, error: 'Isi nomor WhatsApp atau username Telegram' };
  return { ok: true, whatsapp, telegram };
}
