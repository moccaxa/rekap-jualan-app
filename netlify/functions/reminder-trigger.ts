import { timingSafeEqual } from 'node:crypto';
import { runReminders } from './_lib/reminderEngine';
import { fail, HttpError, json, wrap } from './_lib/http';
export const config = { path: '/api/reminder-trigger' };

/* Opsional: pemicu untuk scheduler eksternal (cron-job.org, GitHub Actions) bila jadwal Netlify tidak mencukupi.
   Nonaktif (404) kecuali CRON_SECRET diisi. Rahasia dikirim lewat header X-Cron-Secret, bukan URL. */
export default wrap(async req => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return fail('Tidak ditemukan', 404);
  const got = Buffer.from(req.headers.get('x-cron-secret') ?? ''), want = Buffer.from(secret);
  if (req.method !== 'POST') throw new HttpError(405, 'Gunakan POST');
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Rahasia tidak cocok');
  const r = await runReminders(); return json({ sent: r.sent, failed: r.failed, skipped: r.skipped });
});
