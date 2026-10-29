import { lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const SaleForm = lazy(() => import('./pages/SaleForm'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Products = lazy(() => import('./pages/Products'));
const Sheets = lazy(() => import('./pages/Sheets'));
const Telegram = lazy(() => import('./pages/Telegram'));
const Settings = lazy(() => import('./pages/Settings'));
const Buyers = lazy(() => import('./pages/Buyers'));
const BuyerDetail = lazy(() => import('./pages/BuyerDetail'));
import { checkAuth, useAuth } from './lib/auth';
import { loadAll, useLoadState } from './lib/store';

const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center p-4 text-sm text-slate-500">{children}</div>;

export default function App() {
  const auth = useAuth(), load = useLoadState();
  useEffect(() => { checkAuth(); }, []);
  useEffect(() => { if (auth === 'in') loadAll(); }, [auth]);
  if (auth === 'checking') return <Center>Memeriksa sesi…</Center>;
  if (auth === 'out') return <Login />;
  if (!load.loaded) return <Center>{load.error ? <div className="space-y-3 text-center"><p className="text-red-600">{load.error}</p><button className="btn-p" onClick={loadAll}>Coba lagi</button></div> : 'Memuat data…'}</Center>;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="penjualan" element={<Sales />} />
        <Route path="buyer" element={<Buyers />} />
        <Route path="buyer/:id" element={<BuyerDetail />} />
        <Route path="tambah" element={<SaleForm />} />
        <Route path="edit/:id" element={<SaleForm />} />
        <Route path="reminder" element={<Reminders />} />
        <Route path="produk" element={<Products />} />
        <Route path="sheets" element={<Sheets />} />
        <Route path="telegram" element={<Telegram />} />
        <Route path="pengaturan" element={<Settings />} />
      </Route>
    </Routes>
  );
}
