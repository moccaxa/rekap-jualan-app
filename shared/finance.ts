import type { Transaction } from './types';
type P = Pick<Transaction, 'sellPrice' | 'costPrice' | 'quantity'>;
export const revenueOf = (t: P) => t.sellPrice * t.quantity;
export const costOf = (t: P) => t.costPrice * t.quantity;
export const profitOf = (t: P) => revenueOf(t) - costOf(t);
export const marginPct = (t: P) => (revenueOf(t) === 0 ? 0 : (profitOf(t) / revenueOf(t)) * 100);
export function summarize(list: Transaction[]) {
  const valid = list.filter(t => !t.cancelled && !t.deletedAt);
  const revenue = valid.reduce((a, t) => a + revenueOf(t), 0);
  const cost = valid.reduce((a, t) => a + costOf(t), 0);
  return { count: valid.length, revenue, cost, profit: revenue - cost, margin: revenue === 0 ? 0 : ((revenue - cost) / revenue) * 100 };
}
