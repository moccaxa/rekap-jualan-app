import { runReminders } from './_lib/reminderEngine';

/* Dijalankan Netlify tiap jam (UTC; jam Jakarta dihitung di dalam engine). Hanya aktif pada deploy produksi yang dipublikasikan.
   Engine idempoten: bila terpanggil dua kali, pesan yang sama tidak terkirim dua kali. */
export const config = { schedule: '0 * * * *' };
export default async () => {
  const r = await runReminders();
  console.log(`reminder-cron: terkirim=${r.sent} gagal=${r.failed} dilewati=${r.skipped}${r.error ? ' error=' + r.error : ''}`);
  return new Response(JSON.stringify({ sent: r.sent, failed: r.failed }), { headers: { 'content-type': 'application/json' } });
};
