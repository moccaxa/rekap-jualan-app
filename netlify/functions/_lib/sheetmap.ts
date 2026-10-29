import { createHash } from 'node:crypto';
import { validateBuyer, type BuyerStat } from '../../../shared/buyers';
import { parseDate } from '../../../shared/dates';
import { profitOf } from '../../../shared/finance';
import { normalizePhone } from '../../../shared/phone';
import { DEFAULT_OFFSETS } from '../../../shared/reminders';
import { PLANS, type Buyer } from '../../../shared/types';
import { validateStored, type Stored } from '../../../shared/validate';

type Key = keyof Stored | 'profit';
export const COLS: [Key, string][] = [
  ['id', 'ID'], ['buyerId', 'ID Buyer'], ['buyerName', 'Nama Buyer'], ['whatsapp', 'WhatsApp'], ['product', 'Produk'], ['plan', 'Plan'], ['variation', 'Variasi'],
  ['durationValue', 'Durasi (angka)'], ['durationUnit', 'Satuan Durasi'], ['orderDate', 'Tanggal Order'], ['startDate', 'Tanggal Mulai'], ['expiryDate', 'Tanggal Habis'],
  ['expiryManual', 'Habis Manual'], ['accountEmail', 'Email Akun'], ['accountPasswordEnc', 'Password (terenkripsi)'], ['sellPrice', 'Harga Jual'], ['costPrice', 'Harga Modal'],
  ['quantity', 'Kuantitas'], ['profit', 'Keuntungan'], ['supplier', 'FH'], ['notes', 'Catatan'], ['cancelled', 'Dibatalkan'], ['reminderEnabled', 'Reminder Aktif'],
  ['reminderOffsets', 'Offset Reminder'], ['followedUp', 'Ditindaklanjuti'], ['createdAt', 'Dibuat'], ['updatedAt', 'Diubah'], ['version', 'Versi'], ['deletedAt', 'Dihapus'],
];
export const HEADER = COLS.map(c => c[1]);
export const COL_COUNT = COLS.length;

export function txToRow(s: Stored): string[] {
  return COLS.map(([k]) => {
    if (k === 'profit') return String(profitOf(s));
    const v = s[k];
    if (k === 'durationUnit') return v === 'month' ? 'bulan' : 'hari';
    if (k === 'reminderOffsets') return s.reminderOffsets.length ? s.reminderOffsets.join(';') : '-';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return v === undefined ? '' : String(v);
  });
}

/** Hash isi transaksi (tanpa createdAt/updatedAt/version) untuk mendeteksi perubahan nyata. */
export const hashTx = (s: Stored) => createHash('sha1').update(JSON.stringify(COLS.filter(([k]) => !['createdAt', 'updatedAt', 'version', 'profit'].includes(k)).map(([k]) => (k === 'deletedAt' ? s.deletedAt ?? '' : s[k as keyof Stored])))).digest('hex');

interface Deps { encrypt: (s: string) => string; isEnc: (s: string) => boolean; genId: () => string; now: string }
export function rowsToTx(values: string[][], d: Deps): { items: Stored[]; errors: { row: number; msg: string }[] } {
  const items: Stored[] = [], errors: { row: number; msg: string }[] = [];
  const [head, ...rows] = values;
  if (!head?.length) return { items, errors: [{ row: 1, msg: 'Baris header kosong' }] };
  const idx = new Map(head.map((h, i) => [String(h).trim().toLowerCase(), i]));
  const missing = ['ID', 'Nama Buyer', 'WhatsApp', 'Produk', 'Tanggal Order', 'Durasi (angka)', 'Satuan Durasi'].filter(h => !idx.has(h.toLowerCase()));
  if (missing.length) return { items, errors: [{ row: 1, msg: `Header tidak ditemukan: ${missing.join(', ')}` }] };
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 2; if (r.every(c => !String(c ?? '').trim())) return;
    const c = (label: string) => String(r[idx.get(label.toLowerCase()) ?? -1] ?? '').trim();
    const n = (label: string, def: number) => (c(label) === '' ? def : Number(c(label).replace(/[^\d-]/g, '')));
    const b = (label: string, def: boolean) => (c(label) === '' ? def : /^(true|ya|yes|1)$/i.test(c(label)));
    const err = (msg: string) => errors.push({ row, msg });
    const order = parseDate(c('Tanggal Order')); if (!order) return err('Tanggal Order tidak valid (pakai YYYY-MM-DD)');
    const start = c('Tanggal Mulai') ? parseDate(c('Tanggal Mulai')) : order; if (!start) return err('Tanggal Mulai tidak valid');
    const exp = parseDate(c('Tanggal Habis')); if (!exp) return err('Tanggal Habis tidak valid (pakai YYYY-MM-DD)');
    const phone = normalizePhone(c('WhatsApp')); if (!phone) return err('Nomor WhatsApp tidak valid');
    const unit = /^(bulan|month)$/i.test(c('Satuan Durasi')) ? 'month' : /^(hari|day)$/i.test(c('Satuan Durasi')) ? 'day' : '';
    const offRaw = c('Offset Reminder');
    const pw = c('Password (terenkripsi)');
    const id = c('ID') || d.genId(); // 'BY-PENDING' = belum ada ID Buyer (data lama / baris baru): dihubungkan ke buyer berdasarkan nomor WhatsApp saat sinkronisasi

    if (seen.has(id)) return err(`ID ${id} muncul lebih dari sekali`); seen.add(id);
    const v = validateStored({
      id, buyerId: c('ID Buyer') || 'BY-PENDING', buyerName: c('Nama Buyer'), whatsapp: phone, product: c('Produk'), plan: PLANS.find(p => p.toLowerCase() === c('Plan').toLowerCase()) ?? c('Plan'), variation: c('Variasi'),
      durationValue: n('Durasi (angka)', NaN), durationUnit: unit, orderDate: order, startDate: start, expiryDate: exp, expiryManual: b('Habis Manual', false),
      accountEmail: c('Email Akun'), accountPasswordEnc: pw === '' || d.isEnc(pw) ? pw : d.encrypt(pw), // kata sandi polos yang diketik di Sheets langsung dienkripsi
      sellPrice: n('Harga Jual', 0), costPrice: n('Harga Modal', 0), quantity: n('Kuantitas', 1), supplier: c('FH'), notes: c('Catatan'),
      cancelled: b('Dibatalkan', false), reminderEnabled: b('Reminder Aktif', true),
      reminderOffsets: offRaw === '' ? DEFAULT_OFFSETS : offRaw === '-' ? [] : offRaw.split(/[;,\s]+/).filter(Boolean).map(Number),
      followedUp: b('Ditindaklanjuti', false), createdAt: c('Dibuat') || d.now, updatedAt: c('Diubah') || d.now, version: n('Versi', 1) || 1, deletedAt: c('Dihapus') || undefined,
    });
    if (!v.ok) return err(v.error); items.push(v.v);
  });
  return { items, errors };
}

// ---------- sheet "Buyers" ----------
export const BUYER_COLS: [string, string][] = [
  ['id', 'ID Buyer'], ['name', 'Nama Buyer'], ['whatsapp', 'Nomor WhatsApp'], ['firstOrder', 'Tanggal Pertama Order'], ['lastOrder', 'Tanggal Terakhir Order'],
  ['orders', 'Total Order'], ['revenue', 'Total Omzet'], ['cost', 'Total Modal'], ['profit', 'Total Keuntungan'], ['notes', 'Catatan'],
  ['createdAt', 'Dibuat'], ['updatedAt', 'Diubah'], ['version', 'Versi'], ['deletedAt', 'Dihapus'],
];
export const BUYER_HEADER = BUYER_COLS.map(c => c[1]);
/** Kolom statistik (tanggal pertama/terakhir, total order/omzet/modal/untung) diisi dari transaksi setiap sinkronisasi dan diabaikan saat membaca. */
export function buyerToRow(b: Buyer, s?: BuyerStat): string[] {
  return BUYER_COLS.map(([k]) => {
    if (k === 'firstOrder') return s?.firstOrder ?? ''; if (k === 'lastOrder') return s?.lastOrder ?? '';
    if (k === 'orders' || k === 'revenue' || k === 'cost' || k === 'profit') return s ? String(s[k]) : '0';
    return String(b[k as keyof Buyer] ?? '');
  });
}
export const hashBuyer = (b: Buyer) => createHash('sha1').update(JSON.stringify([b.name, b.whatsapp, b.notes, b.deletedAt ?? ''])).digest('hex');
export function rowsToBuyers(values: string[][], d: { genId: () => string; now: string }): { items: Buyer[]; errors: { row: number; msg: string }[] } {
  const items: Buyer[] = [], errors: { row: number; msg: string }[] = [], [head, ...rows] = values;
  if (!head?.length) return { items, errors: [] }; // sheet masih kosong: belum ada buyer di Sheets
  const idx = new Map(head.map((h, i) => [String(h).trim().toLowerCase(), i]));
  const missing = ['ID Buyer', 'Nama Buyer', 'Nomor WhatsApp'].filter(h => !idx.has(h.toLowerCase()));
  if (missing.length) return { items, errors: [{ row: 1, msg: `Header tidak ditemukan: ${missing.join(', ')}` }] };
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 2; if (r.every(c => !String(c ?? '').trim())) return;
    const c = (l: string) => String(r[idx.get(l.toLowerCase()) ?? -1] ?? '').trim(), id = c('ID Buyer') || d.genId();
    const v = validateBuyer({ id, name: c('Nama Buyer'), whatsapp: c('Nomor WhatsApp'), notes: c('Catatan'), createdAt: c('Dibuat') || d.now, updatedAt: c('Diubah') || d.now, version: Number(c('Versi')) || 1, deletedAt: c('Dihapus') || undefined });
    if (!v.ok) return errors.push({ row, msg: v.error });
    if (seen.has(id)) return errors.push({ row, msg: `ID Buyer ${id} muncul lebih dari sekali` }); seen.add(id);
    // nomor ganda antar-baris tidak ditolak: digabung otomatis oleh dedupeByPhone saat sinkronisasi
    items.push(v.v);
  });
  return { items, errors };
}
