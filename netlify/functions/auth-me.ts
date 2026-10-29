import { isAuthed } from './_lib/auth';
import { json, wrap } from './_lib/http';
export const config = { path: '/api/auth-me' };
export default wrap(async req => json({ authenticated: isAuthed(req) }));
