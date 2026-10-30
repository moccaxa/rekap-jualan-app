import { addDays, diffDays } from './dates';
import type { Transaction } from './types';
export const DEFAULT_OFFSETS = [14, 7, 3, 1, 0];
export const reminderSchedule = (t: Pick<Transaction, 'expiryDate' | 'reminderOffsets'>) =>
  [...new Set(t.reminderOffsets)].sort((a, b) => b - a).map(offset => ({ offset, date: addDays(t.expiryDate, -offset) }));
export const dedupeKey = (id: string, offset: number, sendDate: string) => `${id}|${offset}|${sendDate}`;

export interface SchedItem { kind: 'offset' | 'date'; offset: number; date: string; key: string }
/** Jadwal lengkap: offset relatif tanggal habis (H-14 dst.) + tanggal khusus pilihan pengguna. `offset` pada tanggal khusus = selisih hari ke tanggal habis. */
export function fullSchedule(t: { id: string; expiryDate: string; reminderOffsets: number[]; reminderDates?: string[] }): SchedItem[] {
  const out: SchedItem[] = reminderSchedule(t).map(s => ({ kind: 'offset' as const, offset: s.offset, date: s.date, key: dedupeKey(t.id, s.offset, s.date) }));
  for (const d of [...new Set(t.reminderDates ?? [])].sort()) out.push({ kind: 'date', offset: diffDays(d, t.expiryDate), date: d, key: `${t.id}|tgl|${d}` });
  return out;
}
