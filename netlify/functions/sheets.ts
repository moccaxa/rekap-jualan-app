import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { isConfigured, serviceEmail, sheetUrl } from './_lib/google';
import { HttpError, json, readBody, wrap } from './_lib/http';
import { runSync, type SyncAction } from './_lib/syncService';
export const config = { path: '/api/sheets' };

const status = async () => ({ configured: isConfigured(), serviceEmail: serviceEmail(), spreadsheetUrl: sheetUrl(), meta: await db.meta(), backups: await db.backups() });
export default wrap(async req => {
  requireAuth(req);
  if (req.method === 'GET') return json(await status());
  if (req.method !== 'POST') throw new HttpError(405, 'Metode tidak diizinkan');
  const { action, key } = await readBody<{ action?: string; key?: string }>(req);
  if (action === 'backup') await db.backup('manual');
  else if (action === 'restore') { try { await db.restore(String(key)); } catch (e) { throw new HttpError(422, e instanceof Error ? e.message : 'Restore gagal'); } }
  else if (action === 'connect' || action === 'sync' || action === 'push' || action === 'pull') await runSync(action as SyncAction);
  else throw new HttpError(400, 'Aksi tidak dikenal');
  return json(await status());
});
