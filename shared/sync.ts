type Row = { id: string; version: number; createdAt: string; updatedAt: string; deletedAt?: string };
export interface SyncStats { toSheet: number; toWeb: number; conflicts: number; unchanged: number }
export interface SyncInput<T extends Row> { web: T[]; sheet: T[]; base: Record<string, string>; hash: (t: T) => string; now: string }
export interface SyncOutput<T extends Row> { merged: T[]; base: Record<string, string>; stats: SyncStats; conflicts: T[] }

/**
 * Sinkronisasi tiga arah. `base[id]` = hash isi transaksi saat sinkronisasi terakhir.
 *  - hanya web berubah  -> web menang
 *  - hanya sheet berubah -> sheet menang
 *  - keduanya berubah   -> web menang, versi sheet dicatat sebagai konflik
 * Baris yang dihapus dari sheet (padahal sudah pernah tersinkron & web tidak berubah) = dihapus lunak di web.
 */
export function mergeSync<T extends Row>({ web, sheet, base, hash, now }: SyncInput<T>): SyncOutput<T> {
  const wm = new Map(web.map(t => [t.id, t])), sm = new Map(sheet.map(t => [t.id, t]));
  const merged: T[] = [], conflicts: T[] = [], stats: SyncStats = { toSheet: 0, toWeb: 0, conflicts: 0, unchanged: 0 };
  for (const id of new Set([...wm.keys(), ...sm.keys()])) {
    const w = wm.get(id), s = sm.get(id), b = base[id];
    if (w && !s) {
      if (b && hash(w) === b && !w.deletedAt) { merged.push({ ...w, deletedAt: now, updatedAt: now, version: w.version + 1 }); stats.toWeb++; }
      else { merged.push(w); stats.toSheet++; }
    } else if (!w && s) { merged.push({ ...s, updatedAt: now, version: 1 }); stats.toWeb++; }
    else if (w && s) {
      const hw = hash(w), hs = hash(s);
      if (hw === hs) { merged.push(w); stats.unchanged++; }
      else if (b === hs) { merged.push(w); stats.toSheet++; }
      else if (b === hw) { merged.push({ ...s, createdAt: w.createdAt, version: w.version + 1, updatedAt: now }); stats.toWeb++; }
      else { merged.push(w); conflicts.push(s); stats.conflicts++; stats.toSheet++; }
    }
  }
  const nb: Record<string, string> = {}; merged.forEach(t => { nb[t.id] = hash(t); });
  return { merged, base: nb, stats, conflicts };
}
