import { requireAuth } from './_lib/auth';
import { decrypt, encrypt } from './_lib/crypto';
import { db } from './_lib/db';
import { loadData, makeIdGen, resolveBuyer } from './_lib/buyerService';
import { genId, HttpError, json, readBody, wrap } from './_lib/http';
import { toPublic, validateStored, type Stored } from '../../shared/validate';
import type { Buyer } from '../../shared/types';
export const config = { path: '/api/transactions' };

type Input = Record<string, unknown> & { id?: string; accountPassword?: string; baseVersion?: number };
const pwEnc = (input: Input, fallback: string) => {
  if (input.accountPassword === undefined) return fallback;
  if (typeof input.accountPassword !== 'string' || input.accountPassword.length > 500) throw new HttpError(400, 'Password akun tidak valid');
  return encrypt(input.accountPassword);
};

export default wrap(async req => {
  requireAuth(req);
  const url = new URL(req.url), now = new Date().toISOString();
  const { tx: all, buyers } = await loadData();

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) { // reveal password: hanya lewat permintaan eksplisit per transaksi
      const t = all.find(x => x.id === id && !x.deletedAt); if (!t) throw new HttpError(404, 'Transaksi tidak ditemukan');
      return json({ password: decrypt(t.accountPasswordEnc) });
    }
    return json({ items: all.filter(t => !t.deletedAt).map(toPublic) });
  }

  if (req.method === 'POST' && url.searchParams.get('action') === 'bulk') {
    const { items } = await readBody<{ items?: Input[] }>(req);
    if (!Array.isArray(items) || items.length > 2000) throw new HttpError(400, 'Maksimal 2000 baris per impor');
    const ids = new Set(all.map(t => t.id)), added: Stored[] = [], bl = [...buyers], created: Buyer[] = [], gen = makeIdGen(buyers);
    for (const [i, it] of items.entries()) {
      const id = typeof it.id === 'string' && /^[\w-]{3,40}$/.test(it.id) && !ids.has(it.id) ? it.id : genId();
      const { buyer, created: c } = resolveBuyer(bl, it, now, gen); if (c) { bl.push(c); created.push(c); }
      const r = validateStored({ ...it, id, buyerId: buyer.id, buyerName: buyer.name, whatsapp: buyer.whatsapp, accountPasswordEnc: pwEnc(it, ''), createdAt: now, updatedAt: now, version: 1, deletedAt: undefined });
      if (!r.ok) throw new HttpError(422, `Baris ${i + 1}: ${r.error}`);
      ids.add(id); added.push(r.v);
    }
    if (created.length) await db.setBuyers([...created, ...buyers]);
    await db.setTx([...added, ...all]);
    return json({ added: added.length, items: added.map(toPublic), buyers: created });
  }

  if (req.method === 'POST') {
    const input = await readBody<Input>(req);
    const cur = all.find(t => t.id === input.id);
    if (cur?.deletedAt) throw new HttpError(404, 'Transaksi sudah dihapus');
    if (cur && input.baseVersion !== cur.version) throw new HttpError(409, 'Transaksi ini sudah diubah dari perangkat lain atau Google Sheets. Muat ulang lalu coba lagi.');
    if (!cur && input.baseVersion !== undefined) throw new HttpError(404, 'Transaksi tidak ditemukan');
    const { buyer, created } = resolveBuyer(buyers, input, now, makeIdGen(buyers));
    const r = validateStored({ ...input, buyerId: buyer.id, buyerName: buyer.name, whatsapp: buyer.whatsapp, accountPasswordEnc: pwEnc(input, cur?.accountPasswordEnc ?? ''), createdAt: cur?.createdAt ?? now, updatedAt: now, version: cur ? cur.version + 1 : 1, deletedAt: undefined });
    if (!r.ok) throw new HttpError(422, r.error);
    if (created) await db.setBuyers([created, ...buyers]);
    await db.setTx(cur ? all.map(t => (t.id === r.v.id ? r.v : t)) : [r.v, ...all]);
    return json({ item: toPublic(r.v), buyer: created ?? null });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id'), cur = all.find(t => t.id === id && !t.deletedAt);
    if (!cur) throw new HttpError(404, 'Transaksi tidak ditemukan');
    await db.setTx(all.map(t => (t === cur ? { ...t, deletedAt: now, updatedAt: now, version: t.version + 1 } : t)));
    return json({ ok: true });
  }
  throw new HttpError(405, 'Metode tidak diizinkan');
});
