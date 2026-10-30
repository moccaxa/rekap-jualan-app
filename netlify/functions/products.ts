import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
import { validateProduct } from '../../shared/products';
export const config = { path: '/api/products' };

const genProductId = () => `PR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
export default wrap(async req => {
  requireAuth(req);
  const url = new URL(req.url), now = new Date().toISOString(), all = await db.products();
  if (req.method === 'GET') return json({ items: all });
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id'); if (!all.some(p => p.id === id)) throw new HttpError(404, 'Produk tidak ditemukan');
    await db.setProducts(all.filter(p => p.id !== id)); return json({ ok: true });
  }
  if (req.method !== 'POST' && req.method !== 'PUT') throw new HttpError(405, 'Metode tidak diizinkan');
  const b = await readBody<Record<string, unknown> & { id?: string; baseVersion?: number }>(req), cur = req.method === 'PUT' ? all.find(p => p.id === b.id) : undefined;
  if (req.method === 'PUT') {
    if (!cur) throw new HttpError(404, 'Produk tidak ditemukan');
    if (b.baseVersion !== cur.version) throw new HttpError(409, 'Produk ini sudah diubah dari perangkat lain. Muat ulang lalu coba lagi.');
  }
  let id = cur?.id ?? genProductId(); while (!cur && all.some(p => p.id === id)) id = genProductId();
  const r = validateProduct({ ...b, id, createdAt: cur?.createdAt ?? now, updatedAt: now, version: cur ? cur.version + 1 : 1 });
  if (!r.ok) throw new HttpError(422, r.error);
  if (all.some(p => p.id !== r.v.id && p.name.toLowerCase() === r.v.name.toLowerCase())) throw new HttpError(409, `Produk "${r.v.name}" sudah ada.`);
  await db.setProducts(cur ? all.map(p => (p.id === cur.id ? r.v : p)) : [r.v, ...all]); return json({ item: r.v });
});
