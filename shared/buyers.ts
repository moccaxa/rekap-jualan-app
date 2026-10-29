import { addDays, addMonths } from './dates';
import { normalizePhone } from './phone';
import type { Buyer, BuyerStatus, Transaction } from './types';

/* Seluruh statistik buyer dihitung di sini dari transaksi. Tidak ada angka total yang disimpan sebagai data mandiri. */
type Tx = Pick<Transaction, 'id' | 'buyerId' | 'orderDate' | 'cancelled' | 'deletedAt' | 'sellPrice' | 'costPrice' | 'quantity' | 'product' | 'plan'>;
export interface Range { from?: string; to?: string }
export type Preset = 'all' | 'month' | 'lastMonth' | '3m' | 'year' | 'custom';
export const PRESETS: [Preset, string][] = [['all', 'Semua waktu'], ['month', 'Bulan ini'], ['lastMonth', 'Bulan lalu'], ['3m', '3 bulan terakhir'], ['year', 'Tahun ini'], ['custom', 'Rentang tanggal khusus']];

export function rangeFor(p: Preset, today: string, custom: Range = {}): Range {
  const first = today.slice(0, 8) + '01';
  switch (p) {
    case 'all': return {};
    case 'month': return { from: first, to: addDays(addMonths(first, 1), -1) };
    case 'lastMonth': return { from: addMonths(first, -1), to: addDays(first, -1) };
    case '3m': return { from: addMonths(today, -3), to: today };
    case 'year': return { from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31' };
    default: { const f = custom.from || undefined, t = custom.to || undefined; return f && t && f > t ? { from: t, to: f } : { from: f, to: t }; }
  }
}
export const inRange = (d: string, r: Range) => (!r.from || d >= r.from) && (!r.to || d <= r.to);
/** Transaksi valid = tidak dibatalkan dan tidak dihapus. */
export const isValidTx = (t: Pick<Tx, 'cancelled' | 'deletedAt'>) => !t.cancelled && !t.deletedAt;

export interface BuyerStat {
  buyer: Buyer; orders: number; revenue: number; cost: number; profit: number;
  firstOrder?: string; lastOrder?: string; // semua waktu
  status: BuyerStatus; topProduct?: string; topPlan?: string;
}
export interface BuyerCfg { newDays: number; inactiveDays: number }

function mostCommon(txs: Tx[], key: (t: Tx) => string): string | undefined {
  const m = new Map<string, { n: number; rev: number }>();
  for (const t of txs) { const k = key(t), r = m.get(k) ?? { n: 0, rev: 0 }; r.n++; r.rev += t.sellPrice * t.quantity; m.set(k, r); }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n || b[1].rev - a[1].rev || a[0].localeCompare(b[0]))[0]?.[0];
}
/** Baru: belum pernah order atau order pertama ≤ newDays hari lalu. Aktif: order terakhir ≤ inactiveDays hari lalu. Selain itu Tidak Aktif. */
export function buyerStatus(first: string | undefined, last: string | undefined, today: string, cfg: BuyerCfg): BuyerStatus {
  if (!first || !last) return 'Baru';
  if (first >= addDays(today, -cfg.newDays)) return 'Baru';
  return last >= addDays(today, -cfg.inactiveDays) ? 'Aktif' : 'Tidak Aktif';
}

export function computeStats(buyers: Buyer[], txs: Tx[], range: Range, today: string, cfg: BuyerCfg): BuyerStat[] {
  const by = new Map<string, Tx[]>(), seen = new Set<string>();
  for (const t of txs) { if (!isValidTx(t) || seen.has(t.id)) continue; seen.add(t.id); (by.get(t.buyerId) ?? by.set(t.buyerId, []).get(t.buyerId)!).push(t); } // ID transaksi unik
  return buyers.filter(b => !b.deletedAt).map(buyer => {
    const all = by.get(buyer.id) ?? [], inr = all.filter(t => inRange(t.orderDate, range));
    const dates = all.map(t => t.orderDate).sort(), revenue = inr.reduce((a, t) => a + t.sellPrice * t.quantity, 0), cost = inr.reduce((a, t) => a + t.costPrice * t.quantity, 0);
    const firstOrder = dates[0], lastOrder = dates.at(-1);
    return { buyer, orders: inr.length, revenue, cost, profit: revenue - cost, firstOrder, lastOrder, status: buyerStatus(firstOrder, lastOrder, today, cfg),
      topProduct: mostCommon(inr, t => t.product), topPlan: mostCommon(inr, t => t.plan) };
  });
}
const byName = (a: BuyerStat, b: BuyerStat) => a.buyer.name.localeCompare(b.buyer.name) || a.buyer.id.localeCompare(b.buyer.id);
/** Order terbanyak; sama → omzet tertinggi; sama → nama. */
export const rankByOrders = (s: BuyerStat[]) => s.filter(x => x.orders > 0).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue || byName(a, b));
export const rankByRevenue = (s: BuyerStat[]) => s.filter(x => x.orders > 0).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || byName(a, b));
export const rankByProfit = (s: BuyerStat[]) => s.filter(x => x.orders > 0).sort((a, b) => b.profit - a.profit || b.orders - a.orders || byName(a, b));

export interface Analytics { totalBuyers: number; ordered: number; newBuyers: number; repeat: number; repeatPct: number; lapsed: number; topRevenue?: BuyerStat; topProfit?: BuyerStat }
/** repeat = ≥2 transaksi valid dalam periode. lapsed = pernah order sebelum periode dimulai, tetapi tidak order dalam periode (periode "semua waktu": berstatus Tidak Aktif). */
export function analytics(stats: BuyerStat[], range: Range): Analytics {
  const ordered = stats.filter(s => s.orders > 0), repeat = ordered.filter(s => s.orders >= 2);
  return {
    totalBuyers: stats.length, ordered: ordered.length, repeat: repeat.length, repeatPct: ordered.length ? (repeat.length / ordered.length) * 100 : 0,
    newBuyers: stats.filter(s => s.firstOrder && inRange(s.firstOrder, range)).length,
    lapsed: range.from ? stats.filter(s => s.orders === 0 && s.firstOrder && s.firstOrder < range.from!).length : stats.filter(s => s.firstOrder && s.status === 'Tidak Aktif').length,
    topRevenue: rankByRevenue([...stats])[0], topProfit: rankByProfit([...stats])[0],
  };
}

// ---------- konsistensi buyer <-> transaksi (dipakai server) ----------
type Linked = { buyerId: string; buyerName: string; whatsapp: string; version: number; updatedAt: string };
const bump = <T extends { version: number; updatedAt: string }>(x: T, now: string): T => ({ ...x, updatedAt: now, version: x.version + 1 });

/** Transaksi tanpa buyer valid (data lama / baris baru dari Sheets/CSV) dihubungkan ke buyer dengan nomor WhatsApp yang sama, atau dibuatkan buyer baru. */
export function ensureBuyerLinks<T extends Linked>(txs: T[], buyers: Buyer[], now: string, genId: () => string) {
  const byId = new Map(buyers.map(b => [b.id, b])), byPhone = new Map<string, Buyer>(), out = [...buyers]; let changed = false;
  for (const b of buyers) if (!b.deletedAt) byPhone.set(b.whatsapp, byPhone.get(b.whatsapp) ?? b);
  for (const b of buyers) if (b.deletedAt && !byPhone.has(b.whatsapp)) byPhone.set(b.whatsapp, b);
  const nt = txs.map(t => {
    if (t.buyerId && byId.has(t.buyerId)) return t;
    let b = byPhone.get(t.whatsapp);
    if (!b) { b = { id: genId(), name: t.buyerName, whatsapp: t.whatsapp, notes: '', createdAt: now, updatedAt: now, version: 1 }; out.push(b); byPhone.set(b.whatsapp, b); byId.set(b.id, b); }
    changed = true; return bump({ ...t, buyerId: b.id }, now);
  });
  return { txs: changed ? nt : txs, buyers: out, changed };
}
/** Buyer yang terhapus tetapi masih dipakai transaksi aktif dihidupkan kembali (tidak boleh ada transaksi yatim). */
export function reviveReferenced(buyers: Buyer[], txs: (Linked & { deletedAt?: string })[], now: string): Buyer[] {
  const used = new Set(txs.filter(t => !t.deletedAt).map(t => t.buyerId));
  if (!buyers.some(b => b.deletedAt && used.has(b.id))) return buyers;
  return buyers.map(b => { if (!(b.deletedAt && used.has(b.id))) return b; const { deletedAt, ...rest } = b; void deletedAt; return bump(rest, now); });
}
/** Menyelaraskan salinan nama/nomor pada transaksi dengan data buyer (buyer = sumber kebenaran). */
export function syncSnapshots<T extends Linked>(txs: T[], buyers: Buyer[], now: string): T[] {
  const by = new Map(buyers.map(b => [b.id, b])); let changed = false;
  const out = txs.map(t => { const b = by.get(t.buyerId); if (!b || (t.buyerName === b.name && t.whatsapp === b.whatsapp)) return t; changed = true; return bump({ ...t, buyerName: b.name, whatsapp: b.whatsapp }, now); });
  return changed ? out : txs;
}
/** Buyer aktif dengan nomor sama digabung ke yang paling lama; transaksi dialihkan. */
export function dedupeByPhone<T extends Linked>(buyers: Buyer[], txs: T[], now: string) {
  const groups = new Map<string, Buyer[]>();
  for (const b of buyers) if (!b.deletedAt) (groups.get(b.whatsapp) ?? groups.set(b.whatsapp, []).get(b.whatsapp)!).push(b);
  const redirect = new Map<string, Buyer>(), gone = new Set<string>(), notes = new Map<string, string[]>(); let merged = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [keep, ...rest] = [...g].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    for (const r of rest) { redirect.set(r.id, keep); gone.add(r.id); merged++; if (r.notes && r.notes !== keep.notes) notes.set(keep.id, [...(notes.get(keep.id) ?? []), r.notes]); }
  }
  if (!merged) return { buyers, txs, merged };
  return {
    merged,
    buyers: buyers.map(b => gone.has(b.id) ? { ...bump(b, now), deletedAt: now } : notes.has(b.id) ? bump({ ...b, notes: [b.notes, ...notes.get(b.id)!].filter(Boolean).join('\n') }, now) : b),
    txs: txs.map(t => { const k = redirect.get(t.buyerId); return k ? bump({ ...t, buyerId: k.id, buyerName: k.name, whatsapp: k.whatsapp }, now) : t; }),
  };
}

export type BuyerValidation = { ok: true; v: Buyer } | { ok: false; error: string };
export function validateBuyer(x: unknown): BuyerValidation {
  const bad = (error: string): BuyerValidation => ({ ok: false, error });
  if (!x || typeof x !== 'object') return bad('Data buyer tidak valid');
  const o = x as Record<string, unknown>, s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');
  if (!/^[\w-]{3,40}$/.test(s('id'))) return bad('ID buyer tidak valid');
  if (!s('name') || s('name').length > 120) return bad('Nama buyer wajib diisi (maks 120 karakter)');
  const whatsapp = normalizePhone(s('whatsapp')); if (!whatsapp) return bad('Nomor WhatsApp tidak valid');
  if (typeof o.notes === 'string' && o.notes.length > 2000) return bad('Catatan terlalu panjang');
  if (!s('createdAt') || !s('updatedAt') || !Number.isInteger(o.version) || (o.version as number) < 1) return bad('Metadata buyer tidak valid');
  return { ok: true, v: { id: s('id'), name: s('name'), whatsapp, notes: typeof o.notes === 'string' ? o.notes.trim() : '', createdAt: s('createdAt'), updatedAt: s('updatedAt'), version: o.version as number, ...(s('deletedAt') ? { deletedAt: s('deletedAt') } : {}) } };
}
