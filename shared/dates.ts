import type { DurationUnit } from './types';
export const TZ = 'Asia/Jakarta';
export const todayJakarta = (now: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
const toUTC = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const pad = (n: number) => String(n).padStart(2, '0');
export const diffDays = (from: string, to: string) => Math.round((toUTC(to) - toUTC(from)) / 86400000);
export const addDays = (s: string, n: number) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
/** Bulan kalender; hari dipotong ke akhir bulan (31 Jan + 1 bln = 28/29 Feb). */
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n, ny = Math.floor(idx / 12), nm = idx % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}
export const calcExpiry = (start: string, value: number, unit: DurationUnit) =>
  unit === 'month' ? addMonths(start, value) : addDays(start, value);

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
/** Menerima YYYY-MM-DD atau DD/MM/YYYY; mengembalikan YYYY-MM-DD atau null. */
export function parseDate(s: string): string | null {
  s = s.trim(); if (isValidDate(s)) return s;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s); if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return isValidDate(iso) ? iso : null;
}
export function hourJakarta(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now)) % 24;
}
