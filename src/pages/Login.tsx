import { useState } from 'react';
import { Lock } from 'lucide-react';
import { login } from '../lib/auth';
import { errMsg } from '../lib/api';

export default function Login() {
  const [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login(pw); } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-brand-900"><Lock size={18} />Rekap Jualan</div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Password admin</span>
          <input type="password" autoFocus autoComplete="current-password" className="inp" value={pw} onChange={e => setPw(e.target.value)} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-p w-full" disabled={busy || !pw}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
    </div>
  );
}
