import { requireAuth } from './_lib/auth';
import { loadData, makeIdGen } from './_lib/buyerService';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
import { validateBuyer } from '../../shared/buyers';
import { normalizePhone } from '../../shared/phone';
import type { Buyer } from '../../shared/types';
export const config = { path: '/api/buyers' };

type In = { id?: string; name?: string; whatsapp?: string; notes?: string; baseVersion?: number };
const dupErr = (b: Buyer) => new HttpError(409, `Nomor WhatsApp ini sudah terdaftar atas nama ${b.name}.`, { duplicate: { id: b.id, name: b.name } });

export default wrap(async req => {
  requireAuth(req);
  const url = new URL(req.url), now = new Date().toISOString(), { tx, buyers } = await loadData(), live = buyers.filter(b => !b.deletedAt);
  const phoneOwner = (p: string, except?: string) => live.find(b => b.whatsapp === p && b.id !== except);

  if (req.method === 'GET') return json({ items: live });

  if (req.method === 'POST' && url.searchParams.get('action') === 'bulk') {
    const { items } = await readBody<{ items?: In[] }>(req);
    if (!Array.isArray(items) || items.length > 2000) throw new HttpError(400, 'Maksimal 2000 baris per impor');
    const gen = makeIdGen(buyers), added: Buyer[] = [], phones = new Set(live.map(b => b.whatsapp)); let skipped = 0;
    for (const [i, it] of items.entries()) {
      const phone = normalizePhone(String(it.whatsapp ?? ''));
      if (phone && phones.has(phone)) { skipped++; continue; }
      const id = typeof it.id === 'string' && /^[\w-]{3,40}$/.test(it.id) && !buyers.some(b => b.id === it.id) && !added.some(b => b.id === it.id) ? it.id : gen();
      const r = validateBuyer({ ...it, id, createdAt: now, updatedAt: now, version: 1 }); if (!r.ok) throw new HttpError(422, `Baris ${i + 1}: ${r.error}`);
      phones.add(r.v.whatsapp); added.push(r.v);
    }
    if (added.length) await db.setBuyers([...added, ...buyers]);
    return json({ added: added.length, skipped, items: added });
  }

  if (req.method === 'POST' && url.searchParams.get('action') === 'merge') {
    const { fromId, intoId } = await readBody<{ fromId?: string; intoId?: string }>(req);
    const from = live.find(b => b.id === fromId), into = live.find(b => b.id === intoId);
    if (!from || !into || from.id === into.id) throw new HttpError(422, 'Pilih dua buyer yang berbeda');
    const merged: Buyer = { ...into, notes: [into.notes, from.notes && from.notes !== into.notes ? from.notes : ''].filter(Boolean).join('\n'), updatedAt: now, version: into.version + 1 };
    await db.setBuyers(buyers.map(b => (b.id === into.id ? merged : b.id === from.id ? { ...b, deletedAt: now, updatedAt: now, version: b.version + 1 } : b)));
    await db.setTx(tx.map(t => (t.buyerId === from.id ? { ...t, buyerId: into.id, buyerName: into.name, whatsapp: into.whatsapp, updatedAt: now, version: t.version + 1 } : t)));
    return json({ item: merged });
  }

  if (req.method === 'POST') {
    const b = await readBody<In>(req), phone = normalizePhone(String(b.whatsapp ?? '')), dup = phone ? phoneOwner(phone) : undefined;
    if (dup) throw dupErr(dup);
    const r = validateBuyer({ ...b, id: makeIdGen(buyers)(), createdAt: now, updatedAt: now, version: 1 }); if (!r.ok) throw new HttpError(422, r.error);
    await db.setBuyers([r.v, ...buyers]); return json({ item: r.v });
  }

  if (req.method === 'PUT') {
    const b = await readBody<In>(req), cur = live.find(x => x.id === b.id);
    if (!cur) throw new HttpError(404, 'Buyer tidak ditemukan');
    if (b.baseVersion !== cur.version) throw new HttpError(409, 'Buyer ini sudah diubah dari perangkat lain atau Google Sheets. Muat ulang lalu coba lagi.');
    const r = validateBuyer({ ...b, id: cur.id, createdAt: cur.createdAt, updatedAt: now, version: cur.version + 1 }); if (!r.ok) throw new HttpError(422, r.error);
    const dup = phoneOwner(r.v.whatsapp, cur.id); if (dup) throw dupErr(dup);
    await db.setBuyers(buyers.map(x => (x.id === cur.id ? r.v : x)));
    // salinan nama/nomor pada SEMUA transaksi buyer ini diperbarui; hubungan tetap lewat ID
    const linked = tx.filter(t => t.buyerId === cur.id && (t.buyerName !== r.v.name || t.whatsapp !== r.v.whatsapp));
    if (linked.length) await db.setTx(tx.map(t => (t.buyerId === cur.id ? { ...t, buyerName: r.v.name, whatsapp: r.v.whatsapp, updatedAt: now, version: t.version + 1 } : t)));
    return json({ item: r.v, changed: linked.length });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id'), cur = live.find(b => b.id === id);
    if (!cur) throw new HttpError(404, 'Buyer tidak ditemukan');
    const n = tx.filter(t => t.buyerId === cur.id && !t.deletedAt).length;
    if (n) throw new HttpError(409, `Buyer ini masih memiliki ${n} transaksi. Hapus transaksinya lebih dulu, atau gabungkan buyer ke buyer lain.`);
    await db.setBuyers(buyers.map(b => (b.id === cur.id ? { ...b, deletedAt: now, updatedAt: now, version: b.version + 1 } : b)));
    return json({ ok: true });
  }
  throw new HttpError(405, 'Metode tidak diizinkan');
});
