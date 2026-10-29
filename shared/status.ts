import { diffDays } from './dates';
import type { Status, Transaction } from './types';
export function getStatus(t: Pick<Transaction, 'cancelled' | 'expiryDate'>, today: string, warnDays = 7): Status {
  if (t.cancelled) return 'Dibatalkan';
  const left = diffDays(today, t.expiryDate);
  if (left < 0) return 'Sudah Habis';
  if (left === 0) return 'Habis Hari Ini';
  return left <= warnDays ? 'Akan Habis' : 'Aktif';
}
export const daysLeft = (expiry: string, today: string) => diffDays(today, expiry);
