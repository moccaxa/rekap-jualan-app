export class HttpError extends Error { constructor(public status: number, msg: string, public extra?: Record<string, unknown>) { super(msg); } }
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
export const fail = (msg: string, status = 400) => json({ error: msg }, status);
export async function readBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > 5_000_000) throw new HttpError(413, 'Data yang dikirim terlalu besar');
  try { return JSON.parse(text) as T; } catch { throw new HttpError(400, 'Body permintaan bukan JSON yang valid'); }
}
/** Membungkus handler: error terduga hanya dicatat pesannya (tanpa data/token) dan dijawab generik. */
export const wrap = (fn: (req: Request) => Promise<Response>) => async (req: Request): Promise<Response> => {
  try { return await fn(req); } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
    console.error('Unhandled error:', e instanceof Error ? e.message : 'unknown'); return fail('Terjadi kesalahan pada server', 500);
  }
};
export const genId = () => `TX-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const genBuyerId = () => `BY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
