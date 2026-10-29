import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { isConfigured } from './_lib/google';
import { json, wrap } from './_lib/http';
export const config = { path: '/api/config-check' };

/** Memeriksa kelengkapan konfigurasi server tanpa pernah menampilkan nilai rahasianya. */
export default wrap(async req => {
  requireAuth(req);
  const e = process.env;
  return json({
    https: new URL(req.url).protocol === 'https:',
    checks: [
      { id: 'admin', label: 'Password admin (ADMIN_PASSWORD_HASH atau ADMIN_PASSWORD)', ok: /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(e.ADMIN_PASSWORD_HASH ?? '') || (!e.ADMIN_PASSWORD_HASH && (e.ADMIN_PASSWORD?.length ?? 0) >= 12) },
      { id: 'session', label: 'Kunci sesi (SESSION_SECRET, min. 32 karakter)', ok: (e.SESSION_SECRET?.length ?? 0) >= 32 },
      { id: 'enc', label: 'Kunci enkripsi password akun (DATA_ENC_KEY, 32 byte)', ok: Buffer.from(e.DATA_ENC_KEY ?? '', 'base64').length === 32 },
      { id: 'storage', label: 'Penyimpanan data (Netlify Blobs)', ok: await db.ping() },
      { id: 'google', label: 'Google Sheets (service account)', ok: isConfigured(), optional: true },
      { id: 'telegram', label: 'Telegram bot token', ok: !!e.TELEGRAM_BOT_TOKEN, optional: true },
      { id: 'cron', label: 'Pemicu eksternal reminder (CRON_SECRET)', ok: (e.CRON_SECRET?.length ?? 0) >= 24, optional: true },
    ],
  });
});
