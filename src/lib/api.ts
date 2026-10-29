import type { AppSettings, BackupInfo, Buyer, ReminderLog, ReminderRunInfo, SyncMeta, TelegramSettings, Transaction } from '../../shared/types';

export class ApiError extends Error { constructor(public status: number, msg: string, public data?: Record<string, any>) { super(msg); } }
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan');
let onUnauth = () => {};
export const setUnauthHandler = (f: () => void) => { onUnauth = f; };

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/' + path, { method: init.method ?? 'GET', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-rekap': '1' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch { throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'); }
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new ApiError(0, 'API tidak ditemukan. Saat pengembangan lokal jalankan "npm run dev:netlify", bukan "npm run dev".');
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('auth-login')) onUnauth();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Terjadi kesalahan (${res.status})`, data as Record<string, unknown>);
  return data as T;
}
export interface SheetsStatus { configured: boolean; serviceEmail: string; spreadsheetUrl: string; meta: SyncMeta; backups: BackupInfo[] }
export interface TgStatus { tokenConfigured: boolean; envChatId: boolean; settings: TelegramSettings; lastRun: ReminderRunInfo | null; history: ReminderLog[] }
export interface TgChat { id: number; type: string; name: string }
export const api = {
  me: () => call<{ authenticated: boolean }>('auth-me'),
  login: (password: string) => call('auth-login', { method: 'POST', body: { password } }),
  logout: () => call('auth-logout', { method: 'POST' }),
  listTx: async () => (await call<{ items: Transaction[] }>('transactions')).items,
  saveTx: (t: Transaction, baseVersion?: number) => call<{ item: Transaction; buyer: Buyer | null }>('transactions', { method: 'POST', body: { ...t, baseVersion } }),
  delTx: (id: string) => call('transactions?id=' + encodeURIComponent(id), { method: 'DELETE' }),
  bulk: (items: Transaction[]) => call<{ items: Transaction[]; buyers: Buyer[] }>('transactions?action=bulk', { method: 'POST', body: { items } }),
  listBuyers: async () => (await call<{ items: Buyer[] }>('buyers')).items,
  createBuyer: (b: { name: string; whatsapp: string; notes: string }) => call<{ item: Buyer }>('buyers', { method: 'POST', body: b }),
  updateBuyer: (b: Buyer) => call<{ item: Buyer; changed: number }>('buyers', { method: 'PUT', body: { ...b, baseVersion: b.version } }),
  deleteBuyer: (id: string) => call('buyers?id=' + encodeURIComponent(id), { method: 'DELETE' }),
  mergeBuyers: (fromId: string, intoId: string) => call<{ item: Buyer }>('buyers?action=merge', { method: 'POST', body: { fromId, intoId } }),
  bulkBuyers: (items: { id?: string; name: string; whatsapp: string; notes: string }[]) => call<{ added: number; skipped: number; items: Buyer[] }>('buyers?action=bulk', { method: 'POST', body: { items } }),
  reveal: (id: string) => call<{ password: string }>('transactions?id=' + encodeURIComponent(id)),
  getSettings: async () => (await call<{ settings: AppSettings }>('settings')).settings,
  putSettings: async (s: AppSettings) => (await call<{ settings: AppSettings }>('settings', { method: 'PUT', body: s })).settings,
  getLogs: async () => (await call<{ items: ReminderLog[] }>('reminder-logs')).items,
  addLog: async (b: { txId: string; offset: number; sendDate: string }) => (await call<{ item: ReminderLog }>('reminder-logs', { method: 'POST', body: b })).item,
  tgStatus: () => call<TgStatus>('telegram'),
  tgSave: (s: TelegramSettings) => call<TgStatus>('telegram', { method: 'PUT', body: s }),
  tgAction: <T = TgStatus>(action: 'connect' | 'detect' | 'test' | 'run' | 'test-reminder', extra: object = {}) => call<T>('telegram', { method: 'POST', body: { action, ...extra } }),
  configCheck: () => call<{ https: boolean; checks: { id: string; label: string; ok: boolean; optional?: boolean }[] }>('config-check'),
  sheetsStatus: () => call<SheetsStatus>('sheets'),
  sheetsAction: (action: 'connect' | 'sync' | 'push' | 'pull' | 'backup' | 'restore', key?: string) => call<SheetsStatus>('sheets', { method: 'POST', body: { action, key } }),
};
