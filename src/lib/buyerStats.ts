import { useMemo, useState } from 'react';
import { analytics, computeStats, rangeFor, type Preset, type Range } from '../../shared/buyers';
import { todayJakarta } from '../../shared/dates';
import { useBuyers, useSettings, useTransactions } from './store';

export interface Period { preset: Preset; from: string; to: string }
/** Status filter periode; `range` dipakai bersama oleh kartu, ranking, grafik, dan tabel agar selalu konsisten. */
export function usePeriod(initial: Preset = 'all') {
  const [p, setP] = useState<Period>({ preset: initial, from: '', to: '' });
  const today = todayJakarta();
  const range: Range = useMemo(() => rangeFor(p.preset, today, { from: p.from, to: p.to }), [p, today]);
  return { period: p, setPeriod: setP, range };
}
export function useBuyerStats(range: Range) {
  const buyers = useBuyers(), txs = useTransactions(), st = useSettings(), today = todayJakarta();
  return useMemo(() => {
    const stats = computeStats(buyers, txs, range, today, { newDays: st.buyerNewDays, inactiveDays: st.buyerInactiveDays });
    return { stats, an: analytics(stats, range), today };
  }, [buyers, txs, st.buyerNewDays, st.buyerInactiveDays, range, today]);
}
