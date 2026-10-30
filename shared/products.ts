import type { Product } from './types';
export type ProductValidation = { ok: true; v: Product } | { ok: false; error: string };
const money = (v: unknown, def: number | null = null): number | null => (v === undefined || v === null || v === '' ? def : typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e10 ? v : null);

export function validateProduct(x: unknown): ProductValidation {
  const bad = (error: string): ProductValidation => ({ ok: false, error });
  if (!x || typeof x !== 'object') return bad('Data produk tidak valid');
  const o = x as Record<string, unknown>, str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (!/^[\w-]{3,40}$/.test(str(o.id))) return bad('ID produk tidak valid');
  const name = str(o.name); if (!name || name.length > 120) return bad('Nama produk wajib diisi (maks 120 karakter)');
  const sellPrice = money(o.sellPrice, 0), costPrice = money(o.costPrice, 0); if (sellPrice === null || costPrice === null) return bad('Harga harus bilangan bulat ≥ 0');
  const vs = Array.isArray(o.variations) ? o.variations : o.variations === undefined ? [] : null; if (!vs || vs.length > 50) return bad('Variasi tidak valid (maks 50)');
  const seen = new Set<string>(), variations: Product['variations'] = [];
  for (const raw of vs) {
    const r = (raw ?? {}) as Record<string, unknown>, vn = str(r.name); if (!vn || vn.length > 120) return bad('Nama variasi wajib diisi (maks 120 karakter)');
    if (seen.has(vn.toLowerCase())) return bad(`Variasi "${vn}" muncul lebih dari sekali`); seen.add(vn.toLowerCase());
    const sp = money(r.sellPrice, sellPrice), cp = money(r.costPrice, 0); if (sp === null || cp === null) return bad(`Harga variasi "${vn}" tidak valid`);
    variations.push({ name: vn, sellPrice: sp, costPrice: cp });
  }
  if (!str(o.createdAt) || !str(o.updatedAt) || !Number.isInteger(o.version) || (o.version as number) < 1) return bad('Metadata produk tidak valid');
  return { ok: true, v: { id: str(o.id), name, sellPrice, costPrice, variations, createdAt: str(o.createdAt), updatedAt: str(o.updatedAt), version: o.version as number } };
}
