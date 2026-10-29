import { createSign } from 'node:crypto';
import { HttpError } from './http';

export const SHEETS = { tx: 'Transaksi', buyers: 'Buyers', settings: 'Pengaturan', logs: 'Riwayat Reminder', conflicts: 'Konflik' } as const;
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const cfgRaw = () => ({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), id: process.env.GOOGLE_SHEET_ID });
export const isConfigured = () => { const c = cfgRaw(); return !!(c.email && c.key && c.id); };
export const serviceEmail = () => process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
export const sheetUrl = () => (process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : '');
function cfg() {
  const c = cfgRaw();
  if (!c.email || !c.key || !c.id) throw new HttpError(400, 'Google Sheets belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_SHEET_ID di environment variables Netlify.');
  return { email: c.email, key: c.key, id: c.id };
}

let cached: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.v;
  const { email, key } = cfg(), iat = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })}`;
  let jwt: string;
  try { jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url')}`; }
  catch { throw new HttpError(502, 'GOOGLE_PRIVATE_KEY tidak valid. Salin seluruh isi "private_key" dari file JSON, termasuk BEGIN/END.'); }
  let res: Response;
  try { res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) }); }
  catch { throw new HttpError(502, 'Tidak dapat terhubung ke Google. Coba lagi sebentar lagi.'); }
  if (!res.ok) throw new HttpError(502, 'Login service account Google gagal. Periksa GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY.');
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return cached.v;
}

async function g<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { id, email } = cfg();
  let res: Response;
  try { res = await fetch(`${API}/${id}${path}`, { method, headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'Tidak dapat terhubung ke Google Sheets. Coba lagi sebentar lagi.'); }
  if (!res.ok) {
    if (res.status === 403) throw new HttpError(502, `Akses ditolak. Bagikan spreadsheet ke ${email} sebagai Editor dan pastikan Google Sheets API sudah diaktifkan.`);
    if (res.status === 404) throw new HttpError(502, 'Spreadsheet tidak ditemukan. Periksa GOOGLE_SHEET_ID.');
    if (res.status === 429) throw new HttpError(502, 'Kuota Google Sheets terlampaui. Tunggu 1 menit lalu coba lagi.');
    throw new HttpError(502, `Google Sheets mengembalikan error ${res.status}.`);
  }
  return (await res.json()) as T;
}
const rng = (title: string, a1 = 'A:AZ') => encodeURIComponent(`'${title}'!${a1}`);
interface Props { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } }
const props = async () => (await g<{ sheets: { properties: Props }[] }>('GET', '?fields=sheets.properties(sheetId,title,gridProperties)')).sheets.map(s => s.properties);

const HEADERS: Record<string, string[]> = {
  [SHEETS.settings]: ['Kunci', 'Nilai (salinan, hanya baca)'],
  [SHEETS.logs]: ['Waktu', 'ID Transaksi', 'Buyer', 'Offset', 'Tanggal Kirim', 'Status', 'Channel', 'Detail'],
  [SHEETS.conflicts]: ['Waktu', 'ID', 'Buyer', 'Versi Sheets yang tidak dipakai (JSON, tanpa password)'],
};
export async function ensureSheets(heads: { tx: string[]; buyers: string[] }) {
  const have = new Set((await props()).map(p => p.title));
  const titles = Object.values(SHEETS).filter(t => !have.has(t));
  if (titles.length) await g('POST', ':batchUpdate', { requests: titles.map(title => ({ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 30, frozenRowCount: 1 } } } })) });
  const all = await props();
  const textSheets = [SHEETS.tx, SHEETS.buyers].filter(t => titles.includes(t)); // kolom teks agar tanggal/nomor yang diketik tidak diubah otomatis oleh Sheets
  if (textSheets.length) await g('POST', ':batchUpdate', { requests: textSheets.map(t => ({ repeatCell: { range: { sheetId: all.find(p => p.title === t)!.sheetId }, cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat.numberFormat' } })) });
  for (const [title, head] of [[SHEETS.tx, heads.tx], [SHEETS.buyers, heads.buyers], ...Object.entries(HEADERS)] as [string, string[]][]) {
    const first = await g<{ values?: string[][] }>('GET', `/values/${rng(title, 'A1:A1')}`);
    if (!first.values?.length) await g('PUT', `/values/${rng(title, 'A1')}?valueInputOption=RAW`, { values: [head] });
  }
}
export async function readTable(title: string): Promise<string[][]> {
  return (await g<{ values?: string[][] }>('GET', `/values/${rng(title)}?valueRenderOption=FORMATTED_VALUE`)).values ?? [];
}
export async function writeTable(title: string, values: string[][]) {
  const p = (await props()).find(x => x.title === title)!;
  const rows = values.length + 100, cols = Math.max(...values.map(r => r.length), 1);
  if (rows > p.gridProperties.rowCount || cols > p.gridProperties.columnCount)
    await g('POST', ':batchUpdate', { requests: [{ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { rowCount: Math.max(rows, p.gridProperties.rowCount), columnCount: Math.max(cols, p.gridProperties.columnCount) } }, fields: 'gridProperties(rowCount,columnCount)' } }] });
  await g('POST', `/values/${rng(title)}:clear`, {});
  await g('PUT', `/values/${rng(title, 'A1')}?valueInputOption=RAW`, { values });
}
export async function appendRows(title: string, values: string[][]) {
  if (values.length) await g('POST', `/values/${rng(title, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values });
}
