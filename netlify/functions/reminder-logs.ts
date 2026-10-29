import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
import { isValidDate } from '../../shared/dates';
import { dedupeKey } from '../../shared/reminders';
export const config = { path: '/api/reminder-logs' };

export default wrap(async req => {
  requireAuth(req);
  if (req.method === 'GET') return json({ items: await db.logs() });
  if (req.method === 'POST') { // hanya penandaan manual "Ditindaklanjuti"; log kirim ditulis oleh scheduler (Tahap 6)
    const b = await readBody<{ txId?: string; offset?: number; sendDate?: string }>(req);
    const tx = (await db.tx()).find(t => t.id === b.txId && !t.deletedAt);
    if (!tx || !Number.isInteger(b.offset) || b.offset! < 0 || typeof b.sendDate !== 'string' || !isValidDate(b.sendDate)) throw new HttpError(422, 'Data reminder tidak valid');
    const log = { key: dedupeKey(tx.id, b.offset!, b.sendDate), txId: tx.id, offset: b.offset!, sendDate: b.sendDate, status: 'Ditindaklanjuti' as const, at: new Date().toISOString(), channel: 'manual' as const };
    await db.setLogs([...(await db.logs()), log].slice(-500));
    if (!tx.followedUp) await db.setTx((await db.tx()).map(t => (t.id === tx.id ? { ...t, followedUp: true, updatedAt: log.at, version: t.version + 1 } : t)));
    return json({ item: log });
  }
  throw new HttpError(405, 'Metode tidak diizinkan');
});
