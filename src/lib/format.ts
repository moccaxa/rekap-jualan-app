const rp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const rupiah = (n: number) => rp.format(n);
export const tgl = (s: string) => !s ? '-' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z'));
export const durLabel = (v: number, u: 'month' | 'day') => `${v} ${u === 'month' ? 'bulan' : 'hari'}`;
