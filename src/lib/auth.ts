import { useSyncExternalStore } from 'react';
import { api, setUnauthHandler } from './api';
import { clearAll } from './store';
type S = 'checking' | 'out' | 'in';
let s: S = 'checking'; const subs = new Set<() => void>();
const set = (n: S) => { s = n; subs.forEach(f => f()); };
export const useAuth = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => s);
setUnauthHandler(() => { if (s === 'in') { clearAll(); set('out'); } });
export async function checkAuth() { try { set((await api.me()).authenticated ? 'in' : 'out'); } catch { set('out'); } }
export async function login(pw: string) { await api.login(pw); set('in'); }
export async function logout() { await api.logout().catch(() => {}); clearAll(); set('out'); }
