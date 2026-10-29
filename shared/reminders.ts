import { addDays } from './dates';
import type { Transaction } from './types';
export const DEFAULT_OFFSETS = [14, 7, 3, 1, 0];
export const reminderSchedule = (t: Pick<Transaction, 'expiryDate' | 'reminderOffsets'>) =>
  [...new Set(t.reminderOffsets)].sort((a, b) => b - a).map(offset => ({ offset, date: addDays(t.expiryDate, -offset) }));
export const dedupeKey = (id: string, offset: number, sendDate: string) => `${id}|${offset}|${sendDate}`;
