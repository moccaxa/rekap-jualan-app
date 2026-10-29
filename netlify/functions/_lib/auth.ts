import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http';

const COOKIE = 'rj_session', TTL = 7 * 86400;
const secret = () => { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new HttpError(500, 'SESSION_SECRET belum diatur (minimal 32 karakter)'); return s; };
const sign = (p: string) => createHmac('sha256', secret()).update(p).digest('base64url');
const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export const hashPassword = (pw: string, salt: Buffer = randomBytes(16)) => `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
export function verifyPassword(pw: string): boolean {
  const plain = process.env.ADMIN_PASSWORD;
  if (!process.env.ADMIN_PASSWORD_HASH && plain) { // opsi sederhana tanpa terminal; hash scrypt tetap lebih disarankan
    if (plain.length < 12) throw new HttpError(500, 'ADMIN_PASSWORD minimal 12 karakter');
    const d = (s: string) => createHash('sha256').update(s).digest();
    return timingSafeEqual(d(pw), d(plain));
  }
  const [alg, salt, hash] = (process.env.ADMIN_PASSWORD_HASH ?? '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) throw new HttpError(500, 'ADMIN_PASSWORD_HASH (atau ADMIN_PASSWORD) belum diatur atau formatnya salah');
  const a = scryptSync(pw, Buffer.from(salt, 'hex'), 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
export function makeToken(now = Date.now()) {
  const p = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + TTL })).toString('base64url'); return `${p}.${sign(p)}`;
}
export function checkToken(t: string | undefined, now = Date.now()): boolean {
  if (!t) return false; const [p, sig] = t.split('.'); if (!p || !sig || !eq(sig, sign(p))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > now / 1000; } catch { return false; }
}
const cookieOf = (req: Request) => (req.headers.get('cookie') ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
export const isSecure = (req: Request) => new URL(req.url).protocol === 'https:';
export const sessionCookie = (token: string, secure: boolean) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL}${secure ? '; Secure' : ''}`;
export const clearCookie = (secure: boolean) => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
export const isAuthed = (req: Request) => checkToken(cookieOf(req));
/** Wajib dipanggil di awal setiap endpoint data. Metode non-GET juga harus membawa header X-Rekap (perlindungan CSRF tambahan). */
export function requireAuth(req: Request) {
  if (!isAuthed(req)) throw new HttpError(401, 'Belum login atau sesi berakhir');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('x-rekap') !== '1') throw new HttpError(403, 'Permintaan tidak valid');
}
