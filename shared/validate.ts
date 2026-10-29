import { PLANS, type Plan, type Transaction } from './types';
import { isValidDate } from './dates';

/** Bentuk data yang disimpan di server/Sheets: password hanya dalam bentuk terenkripsi. */
export type Stored = Omit<Transaction, 'accountPassword' | 'hasPassword'> & { accountPasswordEnc: string };
export type Validated = { ok: true; v: Stored } | { ok: false; error: string };

export function toPublic(s: Stored): Transaction {
  const { accountPasswordEnc, ...rest } = s;
  return { ...rest, hasPassword: accountPasswordEnc !== '' };
}

export function validateStored(x: unknown): Validated {
  const bad = (error: string): Validated => ({ ok: false, error });
  if (!x || typeof x !== 'object') return bad('Data tidak valid');
  const o = x as Record<string, unknown>;
  const str = (k: string, max: number, req = false): string | null => {
    const v = o[k]; if (v === undefined || v === null) return req ? null : '';
    if (typeof v !== 'string' || v.length > max) return null;
    const t = v.trim(); return req && !t ? null : t;
  };
  const int = (k: string, min: number, max: number): number | null => { const v = o[k]; return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null; };
  const bool = (k: string): boolean | null => (typeof o[k] === 'boolean' ? (o[k] as boolean) : null);

  const id = str('id', 40, true); if (id === null || !/^[\w-]{3,40}$/.test(id)) return bad('ID transaksi tidak valid');
  const buyerId = str('buyerId', 40, true); if (buyerId === null || !/^[\w-]{3,40}$/.test(buyerId)) return bad('ID buyer tidak valid');
  const buyerName = str('buyerName', 120, true); if (buyerName === null) return bad('Nama buyer wajib diisi');
  const whatsapp = str('whatsapp', 20, true); if (whatsapp === null || !/^\d{8,15}$/.test(whatsapp)) return bad('Nomor WhatsApp tidak valid');
  const product = str('product', 120, true); if (product === null) return bad('Produk wajib diisi');
  if (!PLANS.includes(o.plan as Plan)) return bad('Plan tidak valid');
  const variation = str('variation', 120); if (variation === null) return bad('Variasi terlalu panjang');
  const durationValue = int('durationValue', 1, 3650); if (durationValue === null) return bad('Durasi tidak valid');
  if (o.durationUnit !== 'month' && o.durationUnit !== 'day') return bad('Satuan durasi tidak valid');
  const d = (k: string) => (typeof o[k] === 'string' && isValidDate(o[k] as string) ? (o[k] as string) : null);
  const orderDate = d('orderDate'), startDate = d('startDate'), expiryDate = d('expiryDate');
  if (!orderDate) return bad('Tanggal order tidak valid'); if (!startDate) return bad('Tanggal mulai tidak valid'); if (!expiryDate) return bad('Tanggal habis tidak valid');
  if (expiryDate < startDate) return bad('Tanggal habis tidak boleh sebelum tanggal mulai');
  const accountEmail = str('accountEmail', 200); if (accountEmail === null) return bad('Email akun terlalu panjang');
  const accountPasswordEnc = str('accountPasswordEnc', 2000); if (accountPasswordEnc === null) return bad('Password terlalu panjang');
  const sellPrice = int('sellPrice', 0, 1e10), costPrice = int('costPrice', 0, 1e10);
  if (sellPrice === null || costPrice === null) return bad('Harga harus bilangan bulat ≥ 0');
  const quantity = int('quantity', 1, 10000); if (quantity === null) return bad('Kuantitas minimal 1');
  const supplier = str('supplier', 120); if (supplier === null) return bad('FH terlalu panjang');
  const notes = str('notes', 2000); if (notes === null) return bad('Catatan terlalu panjang');
  const expiryManual = bool('expiryManual'), cancelled = bool('cancelled'), reminderEnabled = bool('reminderEnabled'), followedUp = bool('followedUp');
  if (expiryManual === null || cancelled === null || reminderEnabled === null || followedUp === null) return bad('Field boolean tidak valid');
  const offs = o.reminderOffsets;
  if (!Array.isArray(offs) || offs.length > 20 || !offs.every(n => Number.isInteger(n) && n >= 0 && n <= 3650)) return bad('Jadwal reminder tidak valid');
  const createdAt = str('createdAt', 40, true), updatedAt = str('updatedAt', 40, true);
  if (createdAt === null || updatedAt === null) return bad('Timestamp tidak valid');
  const version = int('version', 1, 1e9); if (version === null) return bad('Versi tidak valid');
  const deletedAt = o.deletedAt === undefined || o.deletedAt === null || o.deletedAt === '' ? undefined : typeof o.deletedAt === 'string' ? o.deletedAt : null;
  if (deletedAt === null) return bad('deletedAt tidak valid');
  const v: Stored = { id, buyerId, buyerName, whatsapp, product, plan: o.plan as Plan, variation, durationValue, durationUnit: o.durationUnit, orderDate, startDate, expiryDate, expiryManual,
    accountEmail, accountPasswordEnc, sellPrice, costPrice, quantity, supplier, notes, cancelled, reminderEnabled, reminderOffsets: [...new Set(offs as number[])].sort((a, b) => b - a),
    followedUp, createdAt, updatedAt, version, ...(deletedAt ? { deletedAt } : {}) };
  return { ok: true, v };
}
