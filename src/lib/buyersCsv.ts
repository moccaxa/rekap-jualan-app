import { parseCSV } from './csv';
import { parseContact, contactLine } from '../../shared/contact';
import type { Buyer } from '../../shared/types';
import { findByContact, type BuyerStat } from '../../shared/buyers';

export const BUYER_HEADERS = ['ID Buyer', 'Buyer', 'Nomor WhatsApp', 'Telegram', 'Tanggal Pertama Order', 'Tanggal Terakhir Order', 'Total Order', 'Total Omzet', 'Total Modal', 'Total Keuntungan', 'Status Buyer', 'Catatan'];
const esc = (s: string) => { if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const unesc = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

/** Statistik pada CSV = hasil perhitungan dari transaksi (total mengikuti periode terpilih; tanggal pertama/terakhir selalu semua waktu). */
export function buyersToCSV(stats: BuyerStat[]): string {
  const line = (s: BuyerStat) => [s.buyer.id, esc(contactLine(s.buyer)), s.buyer.whatsapp, s.buyer.telegram, s.firstOrder ?? '', s.lastOrder ?? '', s.orders, s.revenue, s.cost, s.profit, s.status, esc(s.buyer.notes)].join(',');
  return '\uFEFF' + [BUYER_HEADERS.join(','), ...stats.map(line)].join('\r\n');
}
export interface BuyerImport { add: { id?: string; whatsapp: string; telegram: string; notes: string }[]; dupes: number; errors: { row: number; msg: string }[]; fatal?: string }
/** Hanya Nomor WhatsApp, Telegram, dan Catatan yang dibaca (minimal salah satu kontak); kolom nama/statistik diabaikan. Kontak yang sudah terdaftar dilewati. */
export function importBuyersCSV(text: string, existing: Buyer[]): BuyerImport {
  const res: BuyerImport = { add: [], dupes: 0, errors: [] }, rows = parseCSV(text);
  if (rows.length < 2) return { ...res, fatal: 'File kosong atau tidak memiliki baris data.' };
  const idx = new Map(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  if (!idx.has('nomor whatsapp') && !idx.has('whatsapp') && !idx.has('telegram')) return { ...res, fatal: 'Kolom "Nomor WhatsApp" atau "Telegram" tidak ditemukan.' };
  const get = (r: string[], ...hs: string[]) => { for (const h of hs) { const i = idx.get(h.toLowerCase()); if (i !== undefined) return unesc((r[i] ?? '').trim()); } return ''; };
  const ids = new Set(existing.map(b => b.id)), seen: { whatsapp: string; telegram: string }[] = existing.map(b => ({ whatsapp: b.whatsapp, telegram: b.telegram }));
  rows.slice(1).forEach((r, i) => {
    const row = i + 2, c = parseContact({ whatsapp: get(r, 'Nomor WhatsApp', 'WhatsApp'), telegram: get(r, 'Telegram') });
    if (!c.ok) return res.errors.push({ row, msg: c.error });
    if (findByContact(seen, c)) { res.dupes++; return; }
    seen.push(c); const id = get(r, 'ID Buyer');
    res.add.push({ ...(id && /^[\w-]{3,40}$/.test(id) && !ids.has(id) ? { id } : {}), whatsapp: c.whatsapp, telegram: c.telegram, notes: get(r, 'Catatan') });
  });
  return res;
}
