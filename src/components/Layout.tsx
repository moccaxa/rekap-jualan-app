import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, Users, LayoutDashboard, Table2, PlusCircle, Bell, Package, Sheet, Send, Settings } from 'lucide-react';
import { ToastHost } from './ui';
import { logout } from '../lib/auth';

const nav = [
  ['/', 'Dashboard', LayoutDashboard], ['/penjualan', 'Data Penjualan', Table2], ['/buyer', 'Data Buyer', Users], ['/tambah', 'Tambah Penjualan', PlusCircle],
  ['/reminder', 'Reminder', Bell], ['/produk', 'Produk & Durasi', Package], ['/sheets', 'Google Sheets', Sheet],
  ['/telegram', 'Telegram', Send], ['/pengaturan', 'Pengaturan', Settings],
] as const;

export default function Layout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden w-60 shrink-0 border-r bg-white p-4 md:block">
        <div className="mb-6 text-lg font-bold text-brand-900">Rekap Jualan</div>
        <nav className="space-y-1">{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={link}><Icon size={16} />{label}</NavLink>)}</nav>
        <button onClick={logout} className="mt-6 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"><LogOut size={16} />Keluar</button>
      </aside>
      <div className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-30 border-b bg-white md:hidden">
          <div className="flex items-center justify-between px-4 pt-3"><span className="font-bold text-brand-900">Rekap Jualan</span><button onClick={logout} aria-label="Keluar" className="text-slate-500"><LogOut size={18} /></button></div>
          <nav className="flex gap-1 overflow-x-auto p-2">{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={link}><Icon size={16} />{label}</NavLink>)}</nav>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6"><Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat…</div>}><Outlet /></Suspense></main>
      </div>
      <ToastHost />
    </div>
  );
}
