export type Plan = 'Private' | 'Sharing' | 'Indplan' | 'Famplan' | 'Member' | 'Designer';
export const PLANS: Plan[] = ['Private', 'Sharing', 'Indplan', 'Famplan', 'Member', 'Designer'];
export type DurationUnit = 'month' | 'day';
export type Status = 'Aktif' | 'Akan Habis' | 'Habis Hari Ini' | 'Sudah Habis' | 'Dibatalkan';

export interface Transaction {
  id: string; buyerId: string; buyerName: string; whatsapp: string; product: string; plan: Plan; variation: string;
  durationValue: number; durationUnit: DurationUnit;
  orderDate: string; startDate: string; expiryDate: string; expiryManual: boolean;
  accountEmail: string;
  /** Hanya dikirim ke server saat simpan (disimpan terenkripsi). Server tidak pernah mengembalikannya di daftar; pakai endpoint reveal. undefined = jangan ubah. */
  accountPassword?: string;
  hasPassword?: boolean;
  sellPrice: number; costPrice: number; quantity: number; supplier: string; notes: string;
  cancelled: boolean; reminderEnabled: boolean; reminderOffsets: number[]; followedUp: boolean;
  createdAt: string; updatedAt: string; version: number; deletedAt?: string;
}

export type ReminderStatus = 'Terjadwal' | 'Terkirim' | 'Gagal' | 'Ditindaklanjuti';
export interface ReminderLog {
  key: string;            // dedupeKey: idTransaksi|offset|tanggalKirim
  txId: string; offset: number; sendDate: string;
  status: ReminderStatus; at: string; channel: 'telegram' | 'manual'; detail?: string;
}
export interface AppSettings { monthOptions: number[]; dayOptions: number[]; warnDays: number; buyerNewDays: number; buyerInactiveDays: number }
export const DEFAULT_SETTINGS: AppSettings = { monthOptions: [1, 2, 3, 4, 5, 6, 12], dayOptions: [1, 3, 7, 14, 15, 30, 60, 90], warnDays: 7, buyerNewDays: 30, buyerInactiveDays: 90 };

export interface SyncMeta {
  lastSyncAt?: string; lastAction?: string; lastStatus?: 'ok' | 'error'; lastError?: string;
  stats?: { toSheet: number; toWeb: number; conflicts: number; unchanged: number };
}
export interface BackupInfo { key: string; at: string; label: string; count: number }

export interface TelegramSettings { enabled: boolean; chatId: string; sendHour: number; offsets: number[] }
export const DEFAULT_TELEGRAM: TelegramSettings = { enabled: false, chatId: '', sendHour: 8, offsets: [14, 7, 3, 1, 0] };
export interface ReminderRunInfo { at: string; sent: number; failed: number; skipped: number; notes: string[]; error?: string }

/** Buyer hanya menyimpan identitas. Statistik (order, omzet, modal, untung, tanggal pertama/terakhir, status) SELALU dihitung dari transaksi: lihat shared/buyers.ts. */
export interface Buyer { id: string; name: string; whatsapp: string; notes: string; createdAt: string; updatedAt: string; version: number; deletedAt?: string }
export type BuyerStatus = 'Baru' | 'Aktif' | 'Tidak Aktif';
