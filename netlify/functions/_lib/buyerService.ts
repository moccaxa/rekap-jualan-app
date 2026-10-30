import { db } from './db';
import { genBuyerId, HttpError } from './http';
import { applyLegacyNames, ensureBuyerLinks, findByContact, reviveReferenced, syncSnapshots } from '../../../shared/buyers';
import { buyerLabel, parseContact } from '../../../shared/contact';
import type { Buyer } from '../../../shared/types';

export const makeIdGen = (buyers: Buyer[]) => { const ids = new Set(buyers.map(b => b.id)); return () => { let id = genBuyerId(); while (ids.has(id)) id = genBuyerId(); ids.add(id); return id; }; };

/** Memuat transaksi + buyer dan memastikan keduanya konsisten (migrasi data lama, transaksi yatim). Idempoten. */
export async function loadData() {
  let [tx, buyers] = await Promise.all([db.tx(), db.buyers()]); const now = new Date().toISOString(); let dirty = false;
  if (!(await db.flag('buyer-identity-v1'))) { // satu kali: nama buyer dihapus dari aplikasi → nama lama masuk catatan, label otomatis dari kontak
    const b2 = applyLegacyNames(buyers, now); if (b2 !== buyers && b2.some((b, i) => b !== buyers[i])) { buyers = b2; dirty = true; }
    await db.setFlag('buyer-identity-v1');
  }
  const r = ensureBuyerLinks(tx, buyers, now, makeIdGen(buyers));
  const revived = reviveReferenced(r.buyers, r.txs, now), synced = syncSnapshots(r.txs, revived, now);
  if (dirty || r.changed || revived !== r.buyers || synced !== r.txs) { await db.setBuyers(revived); await db.setTx(synced); }
  return { tx: synced, buyers: revived };
}

/** Menentukan buyer untuk transaksi: pakai buyerId, atau cari/buat berdasarkan kontak (WhatsApp/Telegram) tanpa membuat buyer ganda. */
export function resolveBuyer(buyers: Buyer[], input: Record<string, unknown>, now: string, gen: () => string): { buyer: Buyer; created?: Buyer } {
  if (typeof input.buyerId === 'string' && input.buyerId) {
    const b = buyers.find(x => x.id === input.buyerId && !x.deletedAt);
    if (!b) throw new HttpError(422, 'Buyer tidak ditemukan');
    return { buyer: b };
  }
  const c = parseContact(input); if (!c.ok) throw new HttpError(422, c.error);
  const found = findByContact(buyers, c, x => !x.deletedAt); if (found) return { buyer: found };
  const nb: Buyer = { id: gen(), name: buyerLabel(c), whatsapp: c.whatsapp, telegram: c.telegram, notes: '', createdAt: now, updatedAt: now, version: 1 };
  return { buyer: nb, created: nb };
}
