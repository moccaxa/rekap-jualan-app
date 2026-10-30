import { addDays, addMonths } from './dates';
import { buyerLabel, parseContact } from './contact';
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
type Linked = { buyerId: string; buyerName: string; whatsapp: string; telegram: string; version: number; updatedAt: string };
const bump = <T extends { version: number; updatedAt: string }>(x: T, now: string): T => ({ ...x, updatedAt: now, version: x.version + 1 });
/** Pencocokan identitas: nomor WhatsApp didahulukan, lalu username Telegram (keduanya hanya bila terisi). */
export function findByContact<T extends { whatsapp: string; telegram: string }>(list: T[], c: { whatsapp: string; telegram: string }, pred: (x: T) => boolean = () => true): T | undefined {
  return (c.whatsapp ? list.find(x => pred(x) && x.whatsapp === c.whatsapp) : undefined) ?? (c.telegram ? list.find(x => pred(x) && x.telegram === c.telegram) : undefined);
}

/** Transaksi tanpa buyer valid (data lama / baris baru dari Sheets/CSV) dihubungkan ke buyer dengan kontak yang sama, atau dibuatkan buyer baru. */
export function ensureBuyerLinks<T extends Linked>(txs: T[], buyers: Buyer[], now: string, genId: () => string) {
  const byId = new Map(buyers.map(b => [b.id, b])), out = [...buyers]; let changed = false;
  const live = () => out.filter(b => !b.deletedAt);
  const nt = txs.map(t => {
    if (t.buyerId && byId.has(t.buyerId)) return t;
    let b = findByContact(live(), t) ?? findByContact(out, t);
    if (!b) { const c = { whatsapp: t.whatsapp, telegram: t.telegram }; b = { id: genId(), name: buyerLabel(c), ...c, notes: '', createdAt: now, updatedAt: now, version: 1 }; out.push(b); byId.set(b.id, b); }
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
/** Menyelaraskan salinan label/kontak pada transaksi dengan data buyer (buyer = sumber kebenaran). */
export function syncSnapshots<T extends Linked>(txs: T[], buyers: Buyer[], now: string): T[] {
  const by = new Map(buyers.map(b => [b.id, b])); let changed = false;
  const out = txs.map(t => { const b = by.get(t.buyerId); if (!b || (t.buyerName === b.name && t.whatsapp === b.whatsapp && t.telegram === b.telegram)) return t; changed = true; return bump({ ...t, buyerName: b.name, whatsapp: b.whatsapp, telegram: b.telegram }, now); });
  return changed ? out : txs;
}
/** Buyer aktif yang berbagi nomor WhatsApp atau username Telegram digabung ke yang paling lama; transaksi dialihkan. */
export function dedupeByContact<T extends Linked>(buyers: Buyer[], txs: T[], now: string) {
  let bs = buyers, ts = txs, merged = 0;
  for (const key of ['whatsapp', 'telegram'] as const) {
    const groups = new Map<string, Buyer[]>();
    for (const b of bs) if (!b.deletedAt && b[key]) (groups.get(b[key]) ?? groups.set(b[key], []).get(b[key])!).push(b);
    const redirect = new Map<string, Buyer>(), gone = new Set<string>(), notes = new Map<string, string[]>(), fill = new Map<string, Partial<Buyer>>();
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const [keep, ...rest] = [...g].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      for (const r of rest) {
        redirect.set(r.id, keep); gone.add(r.id); merged++;
        if (r.notes && r.notes !== keep.notes) notes.set(keep.id, [...(notes.get(keep.id) ?? []), r.notes]);
        const f = fill.get(keep.id) ?? {}; if (!keep.whatsapp && r.whatsapp && !f.whatsapp) f.whatsapp = r.whatsapp; if (!keep.telegram && r.telegram && !f.telegram) f.telegram = r.telegram; fill.set(keep.id, f);
      }
    }
    if (!redirect.size) continue;
    const next = bs.map(b => {
      if (gone.has(b.id)) return { ...bump(b, now), deletedAt: now };
      if (!notes.has(b.id) && !Object.keys(fill.get(b.id) ?? {}).length) return b;
      const m = { ...b, ...fill.get(b.id), notes: [b.notes, ...(notes.get(b.id) ?? [])].filter(Boolean).join('\n') }; return bump({ ...m, name: buyerLabel(m) }, now);
    });
    const byId = new Map(next.map(b => [b.id, b]));
    ts = ts.map(t => { const k = redirect.get(t.buyerId); if (!k) return t; const nb = byId.get(k.id)!; return bump({ ...t, buyerId: nb.id, buyerName: nb.name, whatsapp: nb.whatsapp, telegram: nb.telegram }, now); });
    bs = next;
  }
  return { buyers: bs, txs: ts, merged };
}
/** Migrasi satu kali: nama lama (isian pengguna) dipindahkan ke catatan; nama menjadi label otomatis dari kontak. */
export function applyLegacyNames(buyers: Buyer[], now: string): Buyer[] {
  return buyers.map(b => {
    const label = buyerLabel(b); if (b.name === label || !label) return b;
    const note = b.name && !b.notes.includes(b.name) ? [`Nama lama: ${b.name}`, b.notes].filter(Boolean).join('\n') : b.notes;
    return bump({ ...b, name: label, notes: note }, now);
  });
}

export type BuyerValidation = { ok: true; v: Buyer } | { ok: false; error: string };
/** Nama tidak diisi pengguna: dihitung dari kontak. Minimal salah satu: WhatsApp atau Telegram. */
export function validateBuyer(x: unknown): BuyerValidation {
  const bad = (error: string): BuyerValidation => ({ ok: false, error });
  if (!x || typeof x !== 'object') return bad('Data buyer tidak valid');
  const o = x as Record<string, unknown>, s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');
  if (!/^[\w-]{3,40}$/.test(s('id'))) return bad('ID buyer tidak valid');
  const c = parseContact(o); if (!c.ok) return bad(c.error);
  if (typeof o.notes === 'string' && o.notes.length > 2000) return bad('Catatan terlalu panjang');
  if (!s('createdAt') || !s('updatedAt') || !Number.isInteger(o.version) || (o.version as number) < 1) return bad('Metadata buyer tidak valid');
  return { ok: true, v: { id: s('id'), name: buyerLabel(c), whatsapp: c.whatsapp, telegram: c.telegram, notes: typeof o.notes === 'string' ? o.notes.trim() : '', createdAt: s('createdAt'), updatedAt: s('updatedAt'), version: o.version as number, ...(s('deletedAt') ? { deletedAt: s('deletedAt') } : {}) } };
}
