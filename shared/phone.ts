/** Normalisasi ke format internasional tanpa '+'. 08xx / 8xx -> 62xx; awalan + dipertahankan (negara lain). */
export function normalizePhone(raw: string): string | null {
  let d = raw.trim().replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  if (!/^\d{8,15}$/.test(d)) return null;
  if (d.startsWith('62') && !/^628\d{7,12}$/.test(d)) return null;
  return d;
}
export const waLink = (p: string) => `https://wa.me/${p}`;
