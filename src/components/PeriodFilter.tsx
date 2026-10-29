import { PRESETS, type Preset } from '../../shared/buyers';
import type { Period } from '../lib/buyerStats';

export default function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter periode">
      <select aria-label="Periode" className="inp w-auto" value={value.preset} onChange={e => onChange({ ...value, preset: e.target.value as Preset })}>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {value.preset === 'custom' && <><input type="date" aria-label="Dari tanggal" className="inp w-auto" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })} />
        <span className="text-sm text-slate-400">–</span><input type="date" aria-label="Sampai tanggal" className="inp w-auto" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })} /></>}
    </div>
  );
}
