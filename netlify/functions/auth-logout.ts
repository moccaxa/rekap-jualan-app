import { clearCookie, isSecure } from './_lib/auth';
import { json, wrap } from './_lib/http';
export const config = { path: '/api/auth-logout' };
export default wrap(async req => json({ ok: true }, 200, { 'set-cookie': clearCookie(isSecure(req)) }));
