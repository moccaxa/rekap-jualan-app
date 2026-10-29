import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HttpError } from './http';

const key = () => { const k = Buffer.from(process.env.DATA_ENC_KEY ?? '', 'base64'); if (k.length !== 32) throw new HttpError(500, 'DATA_ENC_KEY harus 32 byte dalam base64'); return k; };
export const isEnc = (s: string) => /^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(s);
/** AES-256-GCM, IV acak per enkripsi. Format: v1:iv:tag:ciphertext (base64). String kosong tetap kosong. */
export function encrypt(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
export function decrypt(enc: string): string {
  if (!enc) return '';
  if (!isEnc(enc)) throw new HttpError(500, 'Format password terenkripsi tidak dikenal');
  const [, iv, tag, ct] = enc.split(':');
  try { const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64')); d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'); }
  catch { throw new HttpError(500, 'Gagal mendekripsi password (kunci salah atau data rusak)'); }
}
