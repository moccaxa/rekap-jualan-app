import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
import type { AppSettings } from '../../shared/types';
export const config = { path: '/api/settings' };

const opts = (v: unknown) => Array.isArray(v) && v.length >= 1 && v.length <= 30 && v.every(n => Number.isInteger(n) && n >= 1 && n <= 3650);
export default wrap(async req => {
  requireAuth(req);
  if (req.method === 'GET') return json({ settings: await db.settings() });
  if (req.method === 'PUT') {
    const s = await readBody<Partial<AppSettings>>(req), cur = await db.settings();
    const nd = s.buyerNewDays ?? cur.buyerNewDays, id = s.buyerInactiveDays ?? cur.buyerInactiveDays;
    if (!Number.isInteger(nd) || nd < 1 || nd > 365 || !Number.isInteger(id) || id < 7 || id > 730) throw new HttpError(422, 'Batas hari buyer tidak valid');
    if (!opts(s.monthOptions) || !opts(s.dayOptions) || !Number.isInteger(s.warnDays) || s.warnDays! < 1 || s.warnDays! > 60) throw new HttpError(422, 'Pengaturan tidak valid');
    const clean: AppSettings = { monthOptions: [...new Set(s.monthOptions)].sort((a, b) => a - b), dayOptions: [...new Set(s.dayOptions)].sort((a, b) => a - b), warnDays: s.warnDays!, buyerNewDays: nd, buyerInactiveDays: id };
    await db.setSettings(clean); return json({ settings: clean });
  }
  throw new HttpError(405, 'Metode tidak diizinkan');
});
