import { createHash } from 'node:crypto';
import { isSecure, makeToken, sessionCookie, verifyPassword } from './_lib/auth';
import { db } from './_lib/db';
import { HttpError, json, readBody, wrap } from './_lib/http';
export const config = { path: '/api/auth-login' };

const WINDOW = 15 * 60_000, MAX = 5;
export default wrap(async req => {
  if (req.method !== 'POST') throw new HttpError(405, 'Metode tidak diizinkan');
  const { password } = await readBody<{ password?: string }>(req);
  if (typeof password !== 'string' || !password || password.length > 200) throw new HttpError(400, 'Password wajib diisi');
  // batas percobaan per alamat IP agar orang lain tidak bisa mengunci admin dari IP berbeda
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const fk = createHash('sha1').update(ip).digest('hex').slice(0, 16);
  let f = await db.failures(fk); const now = Date.now();
  if (now - f.first > WINDOW) f = { count: 0, first: now };
  if (f.count >= MAX) throw new HttpError(429, 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.');
  if (!verifyPassword(password)) { await db.setFailures(fk, { count: f.count + 1, first: f.first || now }); throw new HttpError(401, 'Password salah'); }
  await db.setFailures(fk, { count: 0, first: 0 });
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(makeToken(), isSecure(req)) });
});
