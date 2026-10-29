import { calcExpiry, parseDate } from '../../shared/dates';
import { profitOf } from '../../shared/finance';
import { DEFAULT_OFFSETS } from '../../shared/reminders';
import { getStatus } from '../../shared/status';
import { PLANS, type Plan, type Transaction } from '../../shared/types';
import { newId } from './id';
import { normalizePhone } from './phone';

export const HEADERS = ['ID', 'ID Buyer', 'Nama Buyer', 'WhatsApp', 'Produk', 'Plan', 'Variasi', 'Durasi', 'Kuantitas', 'Tanggal Order', 'Tanggal Mulai', 'Tanggal Habis',
  'Email Akun', 'Harga Jual', 'Harga Modal', 'Keuntungan', 'FH', 'Catatan', 'Status'];

/** Sel teks berawalan = + - @ diberi tanda ' agar tidak dieksekusi sebagai rumus di Excel/Sheets. */
const esc = (s: string) => { if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const unesc = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export function toCSV(rows: Transaction[], today: string): string {
  const cols = HEADERS;
  const line = (t: Transaction) => {
    const m: Record<string, string> = {
      'ID': t.id, 'ID Buyer': t.buyerId, 'Nama Buyer': esc(t.buyerName), 'WhatsApp': t.whatsapp, 'Produk': esc(t.product), 'Plan': t.plan, 'Variasi': esc(t.variation),
      'Durasi': `${t.durationValue} ${t.durationUnit === 'month' ? 'bulan' : 'hari'}`, 'Kuantitas': String(t.quantity), 'Tanggal Order': t.orderDate,
      'Tanggal Mulai': t.startDate, 'Tanggal Habis': t.expiryDate, 'Email Akun': esc(t.accountEmail),
      'Harga Jual': String(t.sellPrice), 'Harga Modal': String(t.costPrice), 'Keuntungan': String(profitOf(t)), 'FH': esc(t.supplier), 'Catatan': esc(t.notes),
      'Status': getStatus(t, today),
    };
    return cols.map(c => m[c]).join(',');
  };
  return '\uFEFF' + [cols.join(','), ...rows.map(line)].join('\r\n');
}

export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] ?? '';
  const d = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(x => x.trim() !== ''));
}

const num = (s: string) => { const n = Number(s.replace(/[^\d-]/g, '')); return Number.isFinite(n) ? n : 0; };
const fp = (t: Pick<Transaction, 'buyerName' | 'whatsapp' | 'product' | 'plan' | 'orderDate' | 'expiryDate'>) =>
  [t.buyerName.toLowerCase(), t.whatsapp, t.product.toLowerCase(), t.plan, t.orderDate, t.expiryDate].join('|');

export interface ImportResult { add: Transaction[]; dupes: number; errors: { row: number; msg: string }[]; fatal?: string }

export function importCSV(text: string, existing: Transaction[]): ImportResult {
  const res: ImportResult = { add: [], dupes: 0, errors: [] };
  const rows = parseCSV(text);
  if (rows.length < 2) return { ...res, fatal: 'File kosong atau tidak memiliki baris data.' };
  const idx = new Map(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  const need = ['Nama Buyer', 'WhatsApp', 'Produk', 'Tanggal Order'].filter(h => !idx.has(h.toLowerCase()));
  if (need.length) return { ...res, fatal: `Kolom wajib tidak ditemukan: ${need.join(', ')}` };
  const get = (r: string[], h: string) => unesc((r[idx.get(h.toLowerCase()) ?? -1] ?? '').trim());
  const ids = new Set(existing.map(t => t.id)), prints = new Set(existing.map(fp));
  const now = new Date().toISOString();

  rows.slice(1).forEach((r, i) => {
    const row = i + 2, err = (msg: string) => res.errors.push({ row, msg });
    const buyerName = get(r, 'Nama Buyer'), product = get(r, 'Produk');
    if (!buyerName) return err('Nama Buyer kosong');
    if (!product) return err('Produk kosong');
    const whatsapp = normalizePhone(get(r, 'WhatsApp'));
    if (!whatsapp) return err('Nomor WhatsApp tidak valid');
    const planRaw = get(r, 'Plan'); const plan = PLANS.find(p => p.toLowerCase() === planRaw.toLowerCase()) ?? (planRaw ? null : 'Private' as Plan);
    if (!plan) return err(`Plan "${planRaw}" tidak dikenal`);
    const dm = /^(\d+)\s*(bulan|hari)$/i.exec(get(r, 'Durasi'));
    if (!dm || Number(dm[1]) < 1) return err('Durasi harus berformat "N bulan" atau "N hari"');
    const durationValue = Number(dm[1]), durationUnit = dm[2].toLowerCase() === 'bulan' ? 'month' as const : 'day' as const;
    const orderDate = parseDate(get(r, 'Tanggal Order'));
    if (!orderDate) return err('Tanggal Order tidak valid (gunakan YYYY-MM-DD atau DD/MM/YYYY)');
    const sd = get(r, 'Tanggal Mulai'), startDate = sd ? parseDate(sd) : orderDate;
    if (!startDate) return err('Tanggal Mulai tidak valid');
    const auto = calcExpiry(startDate, durationValue, durationUnit), ed = get(r, 'Tanggal Habis');
    const expiryDate = ed ? parseDate(ed) : auto;
    if (!expiryDate) return err('Tanggal Habis tidak valid');
    const quantity = get(r, 'Kuantitas') ? num(get(r, 'Kuantitas')) : 1;
    if (quantity < 1) return err('Kuantitas minimal 1');
    const sellPrice = num(get(r, 'Harga Jual')), costPrice = num(get(r, 'Harga Modal'));
    if (sellPrice < 0 || costPrice < 0) return err('Harga tidak boleh negatif');

    const t: Transaction = {
      id: '', buyerId: get(r, 'ID Buyer'), buyerName, whatsapp, product, plan, variation: get(r, 'Variasi'), durationValue, durationUnit, orderDate, startDate, expiryDate,
      expiryManual: expiryDate !== auto, accountEmail: get(r, 'Email Akun'), accountPassword: get(r, 'Password Akun') || undefined, sellPrice, costPrice, quantity,
      supplier: get(r, 'FH'), notes: get(r, 'Catatan'), cancelled: get(r, 'Status').toLowerCase() === 'dibatalkan', reminderEnabled: true,
      reminderOffsets: DEFAULT_OFFSETS, followedUp: false, createdAt: now, updatedAt: now, version: 1,
    };
    const id = get(r, 'ID');
    if ((id && ids.has(id)) || prints.has(fp(t))) { res.dupes++; return; }
    t.id = id && /^[\w-]{3,40}$/.test(id) ? id : newId();
    ids.add(t.id); prints.add(fp(t)); res.add.push(t);
  });
  return res;
}
