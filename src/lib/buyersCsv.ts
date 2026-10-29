import { parseCSV } from './csv';
import { normalizePhone } from './phone';
import type { Buyer } from '../../shared/types';
import type { BuyerStat } from '../../shared/buyers';

export const BUYER_HEADERS = ['ID Buyer', 'Nama Buyer', 'Nomor WhatsApp', 'Tanggal Pertama Order', 'Tanggal Terakhir Order', 'Total Order', 'Total Omzet', 'Total Modal', 'Total Keuntungan', 'Status Buyer', 'Catatan'];
const esc = (s: string) => { if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const unesc = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

/** Statistik pada CSV = hasil perhitungan dari transaksi (sesuai periode yang sedang dipilih untuk total; tanggal pertama/terakhir selalu semua waktu). */
export function buyersToCSV(stats: BuyerStat[]): string {
  const line = (s: BuyerStat) => [s.buyer.id, esc(s.buyer.name), s.buyer.whatsapp, s.firstOrder ?? '', s.lastOrder ?? '', s.orders, s.revenue, s.cost, s.profit, s.status, esc(s.buyer.notes)].join(',');
  return '\uFEFF' + [BUYER_HEADERS.join(','), ...stats.map(line)].join('\r\n');
}
export interface BuyerImport { add: { id?: string; name: string; whatsapp: string; notes: string }[]; dupes: number; errors: { row: number; msg: string }[]; fatal?: string }
/** Hanya Nama, WhatsApp, dan Catatan yang dibaca; kolom statistik diabaikan karena dihitung dari transaksi. Nomor yang sudah terdaftar dilewati. */
export function importBuyersCSV(text: string, existing: Buyer[]): BuyerImport {
  const res: BuyerImport = { add: [], dupes: 0, errors: [] }, rows = parseCSV(text);
  if (rows.length < 2) return { ...res, fatal: 'File kosong atau tidak memiliki baris data.' };
  const idx = new Map(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  const need = ['Nama Buyer', 'Nomor WhatsApp'].filter(h => !idx.has(h.toLowerCase()));
  if (need.length) return { ...res, fatal: `Kolom wajib tidak ditemukan: ${need.join(', ')}` };
  const get = (r: string[], h: string) => unesc((r[idx.get(h.toLowerCase()) ?? -1] ?? '').trim());
  const phones = new Set(existing.map(b => b.whatsapp)), ids = new Set(existing.map(b => b.id));
  rows.slice(1).forEach((r, i) => {
    const row = i + 2, name = get(r, 'Nama Buyer'), phone = normalizePhone(get(r, 'Nomor WhatsApp'));
    if (!name) return res.errors.push({ row, msg: 'Nama Buyer kosong' });
    if (!phone) return res.errors.push({ row, msg: 'Nomor WhatsApp tidak valid' });
    if (phones.has(phone)) { res.dupes++; return; }
    const id = get(r, 'ID Buyer'); phones.add(phone);
    res.add.push({ ...(id && /^[\w-]{3,40}$/.test(id) && !ids.has(id) ? { id } : {}), name, whatsapp: phone, notes: get(r, 'Catatan') });
  });
  return res;
}
