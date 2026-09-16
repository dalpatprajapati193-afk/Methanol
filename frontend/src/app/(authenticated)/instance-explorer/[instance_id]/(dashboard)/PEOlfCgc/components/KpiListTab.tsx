import React, { useMemo, useState } from 'react';
import type { CgcConfig, KpiCatalogEntry } from '../types/config';
import { generateAllKpiSpecs } from '../utils/kpiGenerator';

// Only Final KPIs are listed here — intermediate calculations still run and
// feed the EFF export, but selecting them for KPI Calculations wouldn't be
// useful since their value is never mapped to a tag directly.
function buildKpiList(config: CgcConfig): KpiCatalogEntry[] {
  const specs = generateAllKpiSpecs(config);
  return specs.filter(s => (s.type ?? 'Final') === 'Final').map(s => ({ name: s.name, category: s.category }));
}

const CAT_ORDER = [
  'Corrected Discharge Temperature',
  'Mass Flow Estimation',
  'Overall',
  'Stage 1',
  'Stage 2',
  'Stage 3',
  'Stage 4',
  'Stage 5',
  'Steam Turbine'
];
function sortCat(a: string, b: string) {
  const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1; if (bi >= 0) return 1;
  return a.localeCompare(b);
}

interface Props {
  config: CgcConfig; selectedNames: Set<string>;
  onToggle: (name: string) => void; onSelectAll: (names: string[]) => void; onClearAll: () => void;
}

export default function KpiListTab({ config, selectedNames, onToggle, onSelectAll, onClearAll }: Props) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const all = useMemo(() => buildKpiList(config), [config]);
  const cats = useMemo(() => ['All', ...[...new Set(all.map(k => k.category))].sort(sortCat)], [all]);
  const bycat = useMemo(() => { const m: Record<string,number> = {}; all.forEach(k => m[k.category] = (m[k.category]||0)+1); return m; }, [all]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter(k => (cat==='All'||k.category===cat) && (!q||k.name.toLowerCase().includes(q)));
  }, [all, cat, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 rounded-xl border border-border bg-background px-4 py-3">
        <div className="text-center"><div className="text-2xl font-bold text-text-primary">{all.length}</div><div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Final KPIs</div></div>
        <div className="h-10 w-px bg-border" />
        <div className="text-center"><div className="text-2xl font-bold text-warning">{selectedNames.size}</div><div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Selected</div></div>
        <div className="flex-1" />
        <button onClick={() => onSelectAll(filtered.map(k=>k.name))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">+ Add to KPI Calculations</button>
        <button onClick={onClearAll} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover">Clear</button>
      </div>
      <div className="relative">
        <input className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Search KPI name…" value={search} onChange={e=>setSearch(e.target.value)} />
        <svg className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
      <div className="flex flex-wrap gap-2">
        {cats.map(c => (
          <button key={c} onClick={()=>setCat(c)} className={['rounded-full border px-3 py-1 text-xs font-semibold transition-colors', c===cat ? 'border-text-primary bg-text-primary text-surface' : 'border-border bg-surface text-text-secondary hover:border-text-secondary'].join(' ')}>
            {c} <span className="opacity-60">{c==='All'?all.length:(bycat[c]||0)}</span>
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="w-10 py-3 pl-4"><input type="checkbox" className="rounded" checked={filtered.length>0&&filtered.every(k=>selectedNames.has(k.name))} onChange={e=>e.target.checked?onSelectAll(filtered.map(k=>k.name)):onClearAll()} /></th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">KPI Name</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((kpi, i) => (
              <tr key={kpi.name} className={['cursor-pointer transition-colors hover:bg-surface-hover', selectedNames.has(kpi.name)?'border-l-2 border-l-primary bg-primary/5':''].join(' ')} onClick={()=>onToggle(kpi.name)}>
                <td className="py-3 pl-4"><input type="checkbox" className="rounded" checked={selectedNames.has(kpi.name)} onChange={()=>onToggle(kpi.name)} onClick={e=>e.stopPropagation()} /></td>
                <td className="px-3 py-3 text-xs text-text-tertiary">{i+1}</td>
                <td className="px-3 py-3"><div className="font-semibold text-text-primary">{kpi.name}</div></td>
                <td className="px-3 py-3"><span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-secondary">{kpi.category}</span></td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={4} className="py-12 text-center text-sm text-text-tertiary">No KPIs match your filter.</td></tr>}
          </tbody>
        </table>
        <div className="border-t border-border bg-background px-4 py-2 text-xs text-text-secondary">{filtered.length} KPI{filtered.length!==1?'s':''} matched</div>
      </div>
    </div>
  );
}
