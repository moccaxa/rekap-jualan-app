import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type AppSettings, type Buyer, type ReminderLog, type Transaction } from '../../shared/types';
import { api, ApiError, errMsg } from './api';
export { newId } from './id';
/* Data hidup di server (Netlify Blobs). Di browser hanya cache di memori: tidak ada data buyer/akun di localStorage. */
function cell<T>(init: T) {
  let v = init; const subs = new Set<() => void>();
  return { get: () => v, set(n: T) { v = n; subs.forEach(f => f()); }, use: () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => v) };
}
const tx = cell<Transaction[]>([]), st = cell<AppSettings>(DEFAULT_SETTINGS), lg = cell<ReminderLog[]>([]);
const by = cell<Buyer[]>([]);
const load = cell({ loading: false, error: null as string | null, loaded: false });
export const useBuyers = by.use, useTransactions = tx.use, useSettings = st.use, useLogs = lg.use, useLoadState = load.use;

export async function loadAll() {
  load.set({ ...load.get(), loading: true, error: null });
  try { const [a, b, c, d] = await Promise.all([api.listTx(), api.getSettings(), api.getLogs(), api.listBuyers()]); tx.set(a); st.set(b); lg.set(c); by.set(d); load.set({ loading: false, error: null, loaded: true }); }
  catch (e) { load.set({ loading: false, error: errMsg(e), loaded: false }); }
}
export function clearAll() { by.set([]); tx.set([]); st.set(DEFAULT_SETTINGS); lg.set([]); load.set({ loading: false, error: null, loaded: false }); }

export const txStore = {
  get: (id: string) => tx.get().find(t => t.id === id),
  refresh: async () => { tx.set(await api.listTx()); },
  async save(t: Transaction) {
    const cur = txStore.get(t.id);
    try { const r = await api.saveTx(t, cur?.version), item = r.item; if (r.buyer) by.set([r.buyer, ...by.get()]); tx.set(cur ? tx.get().map(x => (x.id === item.id ? item : x)) : [item, ...tx.get()]); return item; }
    catch (e) { if (e instanceof ApiError && e.status === 409) await txStore.refresh().catch(() => {}); throw e; }
  },
  async remove(id: string) { await api.delTx(id); tx.set(tx.get().filter(t => t.id !== id)); },
  async addMany(list: Transaction[]) { const r = await api.bulk(list); if (r.buyers.length) by.set([...r.buyers, ...by.get()]); tx.set([...r.items, ...tx.get()]); return r.items.length; },
};
export const settingsStore = {
  get: st.get,
  async set(s: AppSettings) { const prev = st.get(); st.set(s); try { st.set(await api.putSettings(s)); } catch (e) { st.set(prev); throw e; } },
};
export const logStore = { refresh: async () => { lg.set(await api.getLogs()); }, async add(l: { txId: string; offset: number; sendDate: string }) { const item = await api.addLog(l); lg.set([...lg.get(), item]); await txStore.refresh(); } };

export const buyerStore = {
  get: (id: string) => by.get().find(b => b.id === id),
  refresh: async () => { by.set(await api.listBuyers()); },
  async create(i: { name: string; whatsapp: string; notes: string }) { const item = (await api.createBuyer(i)).item; by.set([item, ...by.get()]); return item; },
  async update(b: Buyer) {
    try { const r = await api.updateBuyer(b); by.set(by.get().map(x => (x.id === r.item.id ? r.item : x))); if (r.changed) await txStore.refresh(); return r.item; }
    catch (e) { if (e instanceof ApiError && e.status === 409 && !e.data?.duplicate) await buyerStore.refresh().catch(() => {}); throw e; }
  },
  async remove(id: string) { await api.deleteBuyer(id); by.set(by.get().filter(b => b.id !== id)); },
  async merge(fromId: string, intoId: string) { await api.mergeBuyers(fromId, intoId); by.set(await api.listBuyers()); await txStore.refresh(); },
  async addMany(items: { id?: string; name: string; whatsapp: string; notes: string }[]) { const r = await api.bulkBuyers(items); by.set([...r.items, ...by.get()]); return r; },
};
