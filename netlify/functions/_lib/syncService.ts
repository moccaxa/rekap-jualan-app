import { loadData, makeIdGen } from './buyerService';
import { encrypt, isEnc } from './crypto';
import { db } from './db';
import { appendRows, ensureSheets, readTable, SHEETS, writeTable } from './google';
import { genId } from './http';
import { HEADER, BUYER_HEADER, buyerToRow, hashBuyer, hashTx, rowsToBuyers, rowsToTx, txToRow } from './sheetmap';
import { HttpError } from './http';
import { computeStats, dedupeByPhone, ensureBuyerLinks, reviveReferenced, syncSnapshots } from '../../../shared/buyers';
import { todayJakarta } from '../../../shared/dates';
import { mergeSync, type SyncStats } from '../../../shared/sync';
import type { Buyer, SyncMeta } from '../../../shared/types';
import type { Stored } from '../../../shared/validate';

export type SyncAction = 'connect' | 'sync' | 'push' | 'pull';
const ordered = (l: Stored[]) => [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
const sum = (a: SyncStats, b: SyncStats): SyncStats => ({ toSheet: a.toSheet + b.toSheet, toWeb: a.toWeb + b.toWeb, conflicts: a.conflicts + b.conflicts, unchanged: a.unchanged + b.unchanged });

export async function runSync(action: SyncAction): Promise<SyncMeta> {
  const prev = await db.meta(), now = new Date().toISOString();
  try {
    await ensureSheets({ tx: HEADER, buyers: BUYER_HEADER });
    if (action === 'connect') { const m: SyncMeta = { ...prev, lastAction: 'connect', lastStatus: 'ok', lastError: undefined }; await db.setMeta(m); return m; }

    const { tx: webTx, buyers: webBuyers } = await loadData();
    let mergedTx = webTx, mergedBuyers = webBuyers, stats: SyncStats = { toSheet: webTx.length + webBuyers.length, toWeb: 0, conflicts: 0, unchanged: 0 };
    const conflicts: { id: string; name: string; json: string }[] = [];
    if (action !== 'push') {
      const ptx = rowsToTx(await readTable(SHEETS.tx), { encrypt, isEnc, genId, now }), pb = rowsToBuyers(await readTable(SHEETS.buyers), { genId: makeIdGen(webBuyers), now });
      const errs = [...ptx.errors.map(e => `Transaksi baris ${e.row} (${e.msg})`), ...pb.errors.map(e => `Buyers baris ${e.row} (${e.msg})`)];
      if (errs.length) throw new HttpError(422, `Sinkronisasi dibatalkan, tidak ada data yang diubah. ${errs.length} baris di Sheets tidak valid: ${errs.slice(0, 5).join('; ')}`);
      if (action === 'sync') {
        const bm = mergeSync<Buyer>({ web: webBuyers, sheet: pb.items, base: await db.baseBuyers(), hash: hashBuyer, now });
        const tm = mergeSync<Stored>({ web: webTx, sheet: ptx.items, base: await db.base(), hash: hashTx, now });
        mergedBuyers = bm.merged; mergedTx = tm.merged; stats = sum(bm.stats, tm.stats);
        for (const c of bm.conflicts) conflicts.push({ id: c.id, name: c.name, json: JSON.stringify({ jenis: 'buyer', ...c }) });
        for (const c of tm.conflicts) { const { accountPasswordEnc, ...safe } = c; void accountPasswordEnc; conflicts.push({ id: c.id, name: c.buyerName, json: JSON.stringify(safe) }); }
      } else { mergedTx = ptx.items; mergedBuyers = pb.items; stats = { toSheet: 0, toWeb: mergedTx.length + mergedBuyers.length, conflicts: 0, unchanged: 0 }; }
      // konsistensi: hubungkan transaksi baru ke buyer (berdasarkan nomor), gabungkan buyer ber-nomor sama, selaraskan salinan nama/nomor
      const l = ensureBuyerLinks(mergedTx, mergedBuyers, now, makeIdGen(mergedBuyers)); mergedTx = l.txs;
      const d = dedupeByPhone(l.buyers, mergedTx, now); mergedTx = d.txs;
      mergedBuyers = reviveReferenced(d.buyers, mergedTx, now); mergedTx = syncSnapshots(mergedTx, mergedBuyers, now);
      if (stats.toWeb > 0 || JSON.stringify(mergedTx) !== JSON.stringify(webTx) || JSON.stringify(mergedBuyers) !== JSON.stringify(webBuyers)) await db.backup('auto-sebelum-sync');
      await db.setBuyers(mergedBuyers); await db.setTx(mergedTx);
    }
    mergedTx = ordered(mergedTx);
    const st = await db.settings(), stat = new Map(computeStats(mergedBuyers, mergedTx, {}, todayJakarta(), { newDays: st.buyerNewDays, inactiveDays: st.buyerInactiveDays }).map(s => [s.buyer.id, s]));
    const buyerRows = [...mergedBuyers].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(b => buyerToRow(b, stat.get(b.id)));
    await writeTable(SHEETS.tx, [HEADER, ...mergedTx.map(txToRow)]);
    await writeTable(SHEETS.buyers, [BUYER_HEADER, ...buyerRows]);
    const baseTx: Record<string, string> = {}, baseB: Record<string, string> = {};
    mergedTx.forEach(t => { baseTx[t.id] = hashTx(t); }); mergedBuyers.forEach(b => { baseB[b.id] = hashBuyer(b); }); await db.setBase(baseTx); await db.setBaseBuyers(baseB);

    const names = new Map(mergedTx.map(t => [t.id, t.buyerName]));
    await appendRows(SHEETS.conflicts, conflicts.map(c => [now, c.id, c.name, c.json]));
    await writeTable(SHEETS.settings, [['Kunci', 'Nilai (salinan, hanya baca)'], ['monthOptions', st.monthOptions.join(', ')], ['dayOptions', st.dayOptions.join(', ')], ['warnDays', String(st.warnDays)], ['buyerNewDays', String(st.buyerNewDays)], ['buyerInactiveDays', String(st.buyerInactiveDays)]]);
    await writeTable(SHEETS.logs, [['Waktu', 'ID Transaksi', 'Buyer', 'Offset', 'Tanggal Kirim', 'Status', 'Channel', 'Detail'],
      ...(await db.logs()).map(l => [l.at, l.txId, names.get(l.txId) ?? '', String(l.offset), l.sendDate, l.status, l.channel, l.detail ?? ''])]);

    const m: SyncMeta = { lastSyncAt: now, lastAction: action, lastStatus: 'ok', lastError: undefined, stats }; await db.setMeta(m); return m;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Kesalahan tidak diketahui';
    await db.setMeta({ ...prev, lastAction: action, lastStatus: 'error', lastError: msg }); throw e;
  }
}
