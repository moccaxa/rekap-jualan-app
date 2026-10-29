import { getStore } from '@netlify/blobs';
import { DEFAULT_SETTINGS, DEFAULT_TELEGRAM, type AppSettings, type BackupInfo, type Buyer, type ReminderLog, type ReminderRunInfo, type SyncMeta, type TelegramSettings } from '../../../shared/types';
import type { Stored } from '../../../shared/validate';

/* Sumber data utama = Netlify Blobs. RJ_MEMORY_DB=1 hanya untuk pengujian lokal otomatis. */
const mem = new Map<string, string>();
const useMem = () => process.env.RJ_MEMORY_DB === '1';
const store = () => getStore({ name: 'rekap', consistency: 'strong' });
async function read<T>(key: string, def: T): Promise<T> {
  if (useMem()) { const v = mem.get(key); return v ? (JSON.parse(v) as T) : def; }
  return ((await store().get(key, { type: 'json' })) as T | null) ?? def;
}
async function write(key: string, val: unknown) { if (useMem()) mem.set(key, JSON.stringify(val)); else await store().setJSON(key, val); }
async function remove(key: string) { if (useMem()) mem.delete(key); else await store().delete(key); }
async function keys(prefix: string): Promise<string[]> {
  if (useMem()) return [...mem.keys()].filter(k => k.startsWith(prefix));
  return (await store().list({ prefix })).blobs.map(b => b.key);
}
interface Backup { at: string; label: string; transactions: Stored[]; buyers?: Buyer[]; settings: AppSettings }

export const db = {
  tx: () => read<Stored[]>('transactions', []), setTx: (v: Stored[]) => write('transactions', v),
  buyers: () => read<Buyer[]>('buyers', []), setBuyers: (v: Buyer[]) => write('buyers', v),
  baseBuyers: () => read<Record<string, string>>('sync-base-buyers', {}), setBaseBuyers: (v: Record<string, string>) => write('sync-base-buyers', v),
  settings: async () => ({ ...DEFAULT_SETTINGS, ...(await read<Partial<AppSettings>>('settings', {})) }), setSettings: (v: AppSettings) => write('settings', v),
  logs: () => read<ReminderLog[]>('reminder-logs', []), setLogs: (v: ReminderLog[]) => write('reminder-logs', v),
  meta: () => read<SyncMeta>('sync-meta', {}), setMeta: (v: SyncMeta) => write('sync-meta', v),
  base: () => read<Record<string, string>>('sync-base', {}), setBase: (v: Record<string, string>) => write('sync-base', v),
  failures: (k: string) => read<{ count: number; first: number }>('login-fail-' + k, { count: 0, first: 0 }), setFailures: (k: string, v: { count: number; first: number }) => write('login-fail-' + k, v),
  ping: async () => { try { await read('transactions', []); return true; } catch { return false; } },
  tg: async () => ({ ...DEFAULT_TELEGRAM, ...(await read<Partial<TelegramSettings>>('telegram', {})) }), setTg: (v: TelegramSettings) => write('telegram', v),
  run: () => read<ReminderRunInfo | null>('reminder-run', null), setRun: (v: ReminderRunInfo) => write('reminder-run', v),
  /** Kunci best-effort (tulis lalu baca ulang). Perlindungan utama anti-ganda adalah catatan "mengirim" sebelum kirim. */
  async lock(owner: string, ttlMs = 5 * 60_000): Promise<boolean> {
    const cur = await read<{ owner: string; until: number } | null>('reminder-lock', null);
    if (cur && cur.until > Date.now()) return false;
    await write('reminder-lock', { owner, until: Date.now() + ttlMs });
    await new Promise(r => setTimeout(r, 250));
    return (await read<{ owner: string } | null>('reminder-lock', null))?.owner === owner;
  },
  async unlock(owner: string) { if ((await read<{ owner: string } | null>('reminder-lock', null))?.owner === owner) await remove('reminder-lock'); },
  async backup(label: string): Promise<string> {
    const at = new Date().toISOString(), key = `backup-${at.replace(/:/g, '-')}-${label}`;
    await write(key, { at, label, transactions: await db.tx(), buyers: await db.buyers(), settings: await db.settings() } satisfies Backup);
    const all = (await keys('backup-')).sort(); for (const k of all.slice(0, Math.max(0, all.length - 10))) await remove(k);
    return key;
  },
  async backups(): Promise<BackupInfo[]> {
    const out: BackupInfo[] = [];
    for (const key of (await keys('backup-')).sort().reverse()) { const b = await read<Backup | null>(key, null); if (b) out.push({ key, at: b.at, label: b.label, count: b.transactions.filter(t => !t.deletedAt).length }); }
    return out;
  },
  async restore(key: string) {
    if (!key.startsWith('backup-')) throw new Error('Kunci backup tidak valid');
    const b = await read<Backup | null>(key, null); if (!b) throw new Error('Backup tidak ditemukan');
    await db.backup('pre-restore'); await db.setTx(b.transactions); await db.setBuyers(b.buyers ?? []); await db.setSettings(b.settings); await db.setBase({}); await db.setBaseBuyers({});
  },
};
