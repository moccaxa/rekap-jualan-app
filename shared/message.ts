import { diffDays } from './dates';
import type { Stored } from './validate';

const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(n);
const tgl = (s: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z'));
type M = Pick<Stored, 'buyerName' | 'product' | 'plan' | 'variation' | 'durationValue' | 'durationUnit' | 'orderDate' | 'expiryDate' | 'sellPrice' | 'quantity' | 'supplier' | 'notes'>;

/** Pesan reminder. Sengaja TIDAK memuat password maupun email akun. Teks polos (tanpa parse_mode) agar karakter khusus tidak merusak pesan. */
export function buildReminderMessage(t: M, today: string, prefix = ''): string {
  const left = diffDays(today, t.expiryDate);
  return `${prefix}🔔 REMINDER MASA AKTIF

Buyer: ${t.buyerName}
Produk: ${t.product}
Plan: ${t.plan}
Variasi: ${t.variation || '-'}
Durasi: ${t.durationValue} ${t.durationUnit === 'month' ? 'bulan' : 'hari'}
Tanggal Order: ${tgl(t.orderDate)}
Tanggal Habis: ${tgl(t.expiryDate)}
Sisa Durasi: ${left} hari
Harga Jual: ${rp(t.sellPrice)}${t.quantity > 1 ? ` × ${t.quantity}` : ''}
FH / Beli di Siapa: ${t.supplier || '-'}

Catatan: ${t.notes || '-'}

Silakan tindak lanjuti transaksi ini sebelum masa aktif berakhir.`;
}
