import { db } from './db';
import { genBuyerId, HttpError } from './http';
import { ensureBuyerLinks, reviveReferenced } from '../../../shared/buyers';
import { normalizePhone } from '../../../shared/phone';
import type { Buyer } from '../../../shared/types';

export const makeIdGen = (buyers: Buyer[]) => { const ids = new Set(buyers.map(b => b.id)); return () => { let id = genBuyerId(); while (ids.has(id)) id = genBuyerId(); ids.add(id); return id; }; };

/** Memuat transaksi + buyer dan memastikan keduanya konsisten (migrasi data lama, transaksi yatim). Idempoten. */
export async function loadData() {
  const [tx, buyers] = await Promise.all([db.tx(), db.buyers()]), now = new Date().toISOString();
  const r = ensureBuyerLinks(tx, buyers, now, makeIdGen(buyers));
  const revived = reviveReferenced(r.buyers, r.txs, now);
  if (r.changed || revived !== r.buyers) { await db.setBuyers(revived); await db.setTx(r.txs); }
  return { tx: r.txs, buyers: revived };
}

/** Menentukan buyer untuk transaksi: pakai buyerId, atau cari/buat berdasarkan nomor WhatsApp (tidak pernah membuat buyer ganda untuk nomor yang sama). */
export function resolveBuyer(buyers: Buyer[], input: Record<string, unknown>, now: string, gen: () => string): { buyer: Buyer; created?: Buyer } {
  if (typeof input.buyerId === 'string' && input.buyerId) {
    const b = buyers.find(x => x.id === input.buyerId && !x.deletedAt);
    if (!b) throw new HttpError(422, 'Buyer tidak ditemukan');
    return { buyer: b };
  }
  const phone = normalizePhone(String(input.whatsapp ?? '')), name = String(input.buyerName ?? '').trim();
  if (!phone || !name || name.length > 120) throw new HttpError(422, 'Pilih buyer, atau isi nama buyer dan nomor WhatsApp yang valid');
  const found = buyers.find(x => x.whatsapp === phone && !x.deletedAt);
  if (found) return { buyer: found };
  const nb: Buyer = { id: gen(), name, whatsapp: phone, notes: '', createdAt: now, updatedAt: now, version: 1 };
  return { buyer: nb, created: nb };
}
