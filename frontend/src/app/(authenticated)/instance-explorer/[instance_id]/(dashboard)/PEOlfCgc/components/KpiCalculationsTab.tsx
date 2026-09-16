import React, { useMemo, useState } from 'react';
import type { CgcConfig, KpiCondition, KpiConditionRow } from '../types/config';
import { defaultKpiCondition, defaultKpiConditionRow } from '../types/config';
import { generateAllKpiSpecs, resolveRawInputs, type KpiSpec } from '../utils/kpiGenerator';

interface KpiDef {
  name: string;
  category: string;
  uom: string;
  type: 'Final' | 'Intermediate';
  formula: string;
  inputs: string[];
  stage: number;
}

// Only Final KPIs are shown — intermediate calculations still run and feed
// the EFF export, but aren't useful for a user mapping tags. Each Final
// KPI's `inputs` is the fully-flattened set of raw tags it depends on,
// resolved transitively through any intermediate KPIs in its formula chain.
function buildDefs(specs: KpiSpec[], rawInputsByName: Map<string, string[]>): KpiDef[] {
  return specs
    .filter(s => (s.type ?? 'Final') === 'Final')
    .map(s => {
      let stage = 0;
      const m = s.name.match(/(?:_S|Stage_?)(\d+)/i);
      if (m) {
        stage = parseInt(m[1], 10);
      } else {
        const ordMatch = s.name.match(/(\d+)(?:st|nd|rd|th)/i);
        if (ordMatch) {
          stage = parseInt(ordMatch[1], 10);
        }
      }
      return {
        name: s.name,
        category: s.category,
        uom: s.uom,
        type: 'Final' as const,
        formula: s.formula || '',
        inputs: rawInputsByName.get(s.name) || [],
        stage
      };
    });
}

function chipBtn(label: string, count: number, active: boolean, onClick: () => void, key?: string) {
  return (
    <button
      key={key}
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-text-primary bg-text-primary text-surface'
          : 'border-border bg-surface text-text-secondary hover:border-text-secondary'
      ].join(' ')}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}

// ── UOM & Mapping Helpers ───────────────────────────────────────────────────

function getUomType(name: string): string {
  const n = name.toLowerCase();
  if (/temperature|_temp|_tt\b/.test(n)) return 'temperature';
  if (/pressure|_press|_pt\b/.test(n)) return 'pressure';
  if (/flow|mass_flow|measured_flow/.test(n) && !/fraction|gc_/.test(n)) return 'mass_flow';
  if (/feed_gc_|_gc_|composition|mol_?percent|mole_?percent/.test(n)) return 'composition';
  return '';
}

function getCalcUom(name: string): string {
  const n = name.toLowerCase();
  if (/temperature|_temp|_tt\b/.test(n)) return '°C';
  if (/pressure|_press|_pt\b/.test(n)) return 'kg/cm²(g)';
  if (/flow|mass_flow|measured_flow/.test(n) && !/fraction|gc_/.test(n)) return 'kg/h';
  if (/feed_gc_|_gc_|composition|mol_?percent|mole_?percent/.test(n)) return 'mol%';
  if (/water_mass_frac|fraction/.test(n)) return '-';
  return '';
}

function getUomOptions(name: string, type: string): string[] {
  const current = getCalcUom(name);
  const optsByType: Record<string, string[]> = {
    pressure: ['kg/cm²(g)', 'kg/cm²(a)', 'bar(g)', 'bar(a)', 'kPa(g)', 'kPa(a)', 'MPa(g)', 'MPa(a)', 'psi(g)', 'psi(a)'],
    temperature: ['°C', '°F', 'K'],
    mass_flow: ['kg/h', 't/h', 'kg/s', 'lb/h'],
    composition: ['mol%', '-', 'ppm'],
  };
  const opts = optsByType[type] || [current];
  return opts.includes(current) ? opts : [current, ...opts].filter(Boolean);
}

function getConversionFactor(inUom: string, outUom: string): number | null {
  if (!inUom || !outUom || inUom === outUom) return 1.0;
  const key = `${inUom}→${outUom}`;
  const convMap: Record<string, number | null> = {
    't/h→kg/h': 1000, 'kg/h→t/h': 0.001,
    'lb/h→kg/h': 0.453592, 'kg/h→lb/h': 2.20462,
    'kg/s→kg/h': 3600, 'kg/h→kg/s': 1 / 3600,
    'kg/cm²(g)→bar(g)': 0.980665, 'bar(g)→kg/cm²(g)': 1 / 0.980665,
    'bar(g)→kPa(g)': 100, 'kPa(g)→bar(g)': 0.01,
    'bar(g)→psi(g)': 14.5038, 'psi(g)→bar(g)': 0.0689476,
    'kg/cm²(g)→kPa(g)': 98.0665, 'kPa(g)→kg/cm²(g)': 1 / 98.0665,
    '°C→°F': null, '°F→°C': null,
    '°C→K': null, 'K→°C': null,
  };
  const v = convMap[key];
  if (v !== undefined) return v;
  return 1.0;
}

function calcInputMappingComplete(name: string, bank: Record<string, any>): boolean {
  const entry = bank[name] || {};
  const src = entry.source_type || 'pi_tag';
  if (src === 'unavailable') return true;
  if (src === 'constant') return entry.design_value !== undefined && entry.design_value !== null && entry.design_value !== '';
  return !!entry.pi_tag;
}

// ── Main Component ──────────────────────────────────────────────────────────

// ── Activation Conditions (per-KPI run guard) ───────────────────────────────

function ConditionBuilder({ kpiName, condition, onChange }: {
  kpiName: string; condition: KpiCondition; onChange: (data: KpiCondition) => void;
}) {
  const update = (patch: Partial<KpiCondition>) => onChange({ ...condition, ...patch });

  const updateRow = (idx: number, patch: Partial<KpiConditionRow>) => {
    const rows = [...condition.conditions];
    rows[idx] = { ...rows[idx], ...patch };
    update({ conditions: rows });
  };

  const addRow = () => update({ conditions: [...condition.conditions, defaultKpiConditionRow()] });
  const removeRow = (idx: number) => update({ conditions: condition.conditions.filter((_, i) => i !== idx) });

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-primary">
          <input type="checkbox" className="rounded" checked={condition.enabled}
            onChange={e => update({ enabled: e.target.checked })} />
          Enable activation condition
        </label>
        {condition.enabled && condition.conditions.length > 1 && (
          <div className="flex overflow-hidden rounded border border-border">
            {(['AND', 'OR'] as const).map(l => (
              <button key={l} type="button" onClick={() => update({ logic: l })}
                className={[
                  'px-2 py-1 text-xs font-semibold transition-colors',
                  condition.logic === l ? 'bg-primary/10 text-primary' : 'bg-surface text-text-secondary hover:bg-surface-hover',
                ].join(' ')}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {condition.enabled && (
        <>
          <div className="space-y-2">
            {condition.conditions.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input className="w-40 rounded border border-border px-2 py-1 text-xs font-mono bg-background text-text-primary"
                  placeholder="Tag / KPI name" value={row.tag} onChange={e => updateRow(idx, { tag: e.target.value })} />
                <select className="rounded border border-border px-2 py-1 text-xs bg-background text-text-primary"
                  value={row.op} onChange={e => updateRow(idx, { op: e.target.value as KpiConditionRow['op'] })}>
                  {['>', '>=', '<', '<=', '==', '!='].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className="w-24 rounded border border-border px-2 py-1 text-xs bg-background text-text-primary"
                  placeholder="Value" value={row.value} onChange={e => updateRow(idx, { value: e.target.value })} />
                <input className="flex-1 rounded border border-border px-2 py-1 text-xs bg-background text-text-primary"
                  placeholder="Label (optional)" value={row.label} onChange={e => updateRow(idx, { label: e.target.value })} />
                <button type="button" onClick={() => removeRow(idx)}
                  className="text-destructive hover:text-destructive/80 font-bold text-sm px-1" title="Remove condition">✕</button>
              </div>
            ))}
            <button type="button" onClick={addRow}
              className="rounded border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
              + Add condition
            </button>
          </div>

          <Field label="If condition is false">
            <select className="w-48 rounded border border-border px-2 py-1 text-xs bg-background text-text-primary"
              value={condition.false_action} onChange={e => update({ false_action: e.target.value as KpiCondition['false_action'] })}>
              <option value="null">Set to null</option>
              <option value="zero">Set to zero</option>
              <option value="hold_last">Hold last value</option>
            </select>
          </Field>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

interface KpiCalculationsTabProps {
  config: CgcConfig;
  selectedNames: Set<string>;
  onUpdateTag: (name: string, patch: Record<string, unknown>) => void;
  onSetKpiCondition: (kpiName: string, data: KpiCondition) => void;
  onNavigateToTagMapping: () => void;
}

export default function KpiCalculationsTab({ config, selectedNames, onUpdateTag, onSetKpiCondition, onNavigateToTagMapping }: KpiCalculationsTabProps) {
  const [cat, setCat]   = useState('all');
  const [stg, setStg]   = useState<number | 'all'>('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [q, setQ]       = useState('');
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const allSpecs = useMemo(() => generateAllKpiSpecs(config), [config]);
  const rawInputsByName = useMemo(() => resolveRawInputs(allSpecs), [allSpecs]);
  const all  = useMemo(() => buildDefs(allSpecs, rawInputsByName), [allSpecs, rawInputsByName]);
  const sel  = useMemo(() => all.filter(d => selectedNames.has(d.name)), [all, selectedNames]);
  const bycat= useMemo(() => {
    const m: Record<string, number> = {};
    sel.forEach(d => m[d.category] = (m[d.category] || 0) + 1);
    return m;
  }, [sel]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return sel.filter(d => {
      if (cat !== 'all' && d.category !== cat) return false;
      if (stg !== 'all' && d.stage !== stg) return false;
      if (ql && !d.name.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [sel, cat, stg, q]);

  const bank = useMemo(
    () => Object.fromEntries(config.raw_pi_tags.map(t => [t.name, t])),
    [config.raw_pi_tags],
  );

  return (
    <div className="space-y-4">
      {/* Tag mapping guidance */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="text-text-secondary">
          <span className="font-semibold text-text-primary">✓ next to an input</span> means it's already mapped — every KPI sharing
          that input reuses the same mapping, so you never map it twice. To map everything in one place, use the Tag Mapping tab.
        </p>
        <button
          onClick={onNavigateToTagMapping}
          className="flex-shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to Tag Mapping →
        </button>
      </div>

      {/* Category / Stage quick selectors */}
      <div className="rounded-xl border border-border bg-background p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {chipBtn('All', sel.length, cat === 'all', () => { setCat('all'); setStg('all'); }, 'all')}
          {Object.entries(bycat).map(([categoryName, count]) =>
            chipBtn(categoryName, count, cat === categoryName, () => setCat(categoryName), categoryName)
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {chipBtn(`All Stages ${sel.length}`, sel.length, stg === 'all', () => setStg('all'), 'stages-all')}
          {config.stages.map((_, i) => {
            const n = i + 1;
            const c = sel.filter(d => d.stage === n).length;
            return chipBtn(`Stage ${n} ${c}`, c, stg === n, () => setStg(n), `stage-${n}`);
          })}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <input
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Search KPI name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-border">
          {(['table', 'cards'] as const).map(m => (
            <button
              key={m}
              onClick={() => setView(m)}
              className={[
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                view === m
                  ? 'bg-text-primary text-surface'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              ].join(' ')}
            >
              {m === 'table' ? '☰ Table' : '⧉ Stage Cards'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table view */}
      {view === 'table' && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                {['#', 'KPI Name', 'UOM', 'Category', 'Type', 'Input Attributes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((kpi, i) => {
                const isExpanded = expandedKpi === kpi.name;
                const directInputs = kpi.inputs;

                return (
                  <React.Fragment key={kpi.name}>
                    <tr
                      onClick={() => setExpandedKpi(isExpanded ? null : kpi.name)}
                      className={[
                        'hover:bg-surface-hover cursor-pointer transition-colors',
                        isExpanded ? 'bg-background-hover font-semibold' : ''
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 text-xs text-text-tertiary">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="text-text-tertiary text-[10px] w-3">{isExpanded ? '▼' : '▶'}</span>
                        {kpi.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{kpi.uom || '–'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-background px-2 py-0.5 text-xs text-text-secondary">
                          {kpi.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            kpi.type === 'Final' ? 'bg-success/10 text-success' : 'bg-background text-text-secondary'
                          ].join(' ')}
                        >
                          {kpi.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {directInputs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {directInputs.map(inp => {
                              const isMapped = calcInputMappingComplete(inp, bank);
                              return (
                                <span
                                  key={inp}
                                  className={[
                                    'rounded px-1.5 py-0.5 font-mono text-[10.5px] border',
                                    isMapped
                                      ? 'bg-success/5 border-success/30 text-success font-bold'
                                      : 'bg-background border-border text-text-secondary'
                                  ].join(' ')}
                                >
                                  {inp}
                                  {isMapped && ' ✓'}
                                </span>
                              );
                            })}
                          </div>
                        ) : kpi.formula ? (
                          <span className="text-xs italic text-text-tertiary">Derived (no direct inputs)</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded tag mapping detail editor */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-background-hover p-4 border-t border-b border-border">
                          <div className="space-y-4">
                            {/* Formula expression */}
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                              <div className="text-xs font-semibold text-primary uppercase tracking-wider">Formula & Lineage</div>
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-text-primary p-2 bg-surface rounded border border-border">
                                {kpi.formula || '(no formula - externally calculated KPI)'}
                              </pre>
                            </div>

                            {/* Inputs tag grid */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                                <span>ðŸ“¥ Input Attribute PI Tag Mappings</span>
                                <span className="text-text-tertiary font-normal">Changes save automatically</span>
                              </div>

                              {directInputs.length === 0 ? (
                                <div className="text-xs italic text-text-tertiary py-2">
                                  No direct PI tag inputs required for this KPI.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                                  <table className="w-full text-xs">
                                    <thead className="bg-background border-b border-border">
                                      <tr>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary">#</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary">Attribute (Tag ID)</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-28">Source</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary">PI Tag / Value</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-28">Input UOM</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-28">Calc UOM</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-20">Design</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-20">Default</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-20">Min</th>
                                        <th className="px-2 py-2 text-left font-semibold text-text-secondary w-20">Max</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {directInputs.map((inp, idx) => {
                                        const saved = (bank[inp] || {}) as any;
                                        const source = saved.source_type || 'pi_tag';
                                        const piTag = saved.pi_tag ?? '';
                                        const inputUom = saved.input_uom ?? saved.uom ?? '';
                                        const outputUom = saved.output_uom ?? saved.uom ?? '';
                                        const design = saved.design_value ?? '';
                                        const defaultVal = saved.ccp_default ?? '';
                                        const minVal = saved.min_val ?? '';
                                        const maxVal = saved.max_val ?? '';

                                        const uomType = getUomType(inp);
                                        const uomOptions = getUomOptions(inp, uomType);

                                        const handleFieldChange = (field: string, val: any) => {
                                          const patch: Record<string, unknown> = { [field]: val };
                                          if (field === 'input_uom' || field === 'output_uom') {
                                            const inU = field === 'input_uom' ? val : inputUom;
                                            const outU = field === 'output_uom' ? val : outputUom;
                                            patch.input_uom = inU;
                                            patch.output_uom = outU;
                                            patch.conversion_factor = getConversionFactor(inU, outU);
                                          }
                                          onUpdateTag(inp, patch);
                                        };

                                        return (
                                          <tr key={inp} className="hover:bg-surface-hover">
                                            <td className="px-2 py-2 text-text-tertiary">{idx + 1}</td>
                                            <td className="px-2 py-2 font-mono font-semibold text-text-primary">{inp}</td>
                                            <td className="px-2 py-1">
                                              <select
                                                value={source}
                                                onChange={e => handleFieldChange('source_type', e.target.value)}
                                                className="w-full rounded border border-border p-1 text-xs font-semibold bg-surface text-text-primary"
                                              >
                                                <option value="pi_tag">PI Tag</option>
                                                <option value="constant">Constant</option>
                                                <option value="unavailable">Unavailable</option>
                                              </select>
                                            </td>
                                            <td className="px-2 py-1">
                                              {source === 'constant' ? (
                                                <input
                                                  type="number"
                                                  step="any"
                                                  value={design}
                                                  onChange={e => handleFieldChange('design_value', e.target.value === '' ? null : parseFloat(e.target.value))}
                                                  placeholder="Constant value"
                                                  className="w-full rounded border border-border px-2 py-1 text-xs font-mono bg-surface text-text-primary"
                                                />
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={piTag}
                                                  onChange={e => handleFieldChange('pi_tag', e.target.value)}
                                                  disabled={source === 'unavailable'}
                                                  placeholder={
                                                    source === 'unavailable'
                                                      ? '—'
                                                      : 'Tag name (e.g. FT-101.PV)'
                                                  }
                                                  className="w-full rounded border border-border px-2 py-1 text-xs font-mono bg-surface text-text-primary"
                                                />
                                              )}
                                            </td>
                                            <td className="px-2 py-1">
                                              <select
                                                value={inputUom}
                                                onChange={e => handleFieldChange('input_uom', e.target.value)}
                                                className="w-full rounded border border-border p-1 text-xs bg-surface text-text-primary"
                                              >
                                                <option value="">-</option>
                                                {uomOptions.map(o => (
                                                  <option key={o} value={o}>
                                                    {o}
                                                  </option>
                                                ))}
                                              </select>
                                            </td>
                                            <td className="px-2 py-1">
                                              <select
                                                value={outputUom}
                                                onChange={e => handleFieldChange('output_uom', e.target.value)}
                                                className="w-full rounded border border-border p-1 text-xs bg-surface text-text-primary"
                                              >
                                                <option value="">-</option>
                                                {uomOptions.map(o => (
                                                  <option key={o} value={o}>
                                                    {o}
                                                  </option>
                                                ))}
                                              </select>
                                            </td>
                                            <td className="px-2 py-1">
                                              <input
                                                type="text"
                                                value={design}
                                                onChange={e =>
                                                  handleFieldChange(
                                                    'design_value',
                                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                                  )
                                                }
                                                placeholder="Design"
                                                className="w-full rounded border border-border px-2 py-1 text-xs text-right bg-surface text-text-primary"
                                              />
                                            </td>
                                            <td className="px-2 py-1">
                                              <input
                                                type="text"
                                                value={defaultVal}
                                                onChange={e =>
                                                  handleFieldChange(
                                                    'ccp_default',
                                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                                  )
                                                }
                                                placeholder="Default"
                                                className="w-full rounded border border-border px-2 py-1 text-xs text-right bg-surface text-text-primary"
                                              />
                                            </td>
                                            <td className="px-2 py-1">
                                              <input
                                                type="text"
                                                value={minVal}
                                                onChange={e =>
                                                  handleFieldChange(
                                                    'min_val',
                                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                                  )
                                                }
                                                placeholder="Min"
                                                className="w-full rounded border border-border px-2 py-1 text-xs text-right bg-surface text-text-primary"
                                              />
                                            </td>
                                            <td className="px-2 py-1">
                                              <input
                                                type="text"
                                                value={maxVal}
                                                onChange={e =>
                                                  handleFieldChange(
                                                    'max_val',
                                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                                  )
                                                }
                                                placeholder="Max"
                                                className="w-full rounded border border-border px-2 py-1 text-xs text-right bg-surface text-text-primary"
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Activation condition */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                âš™ Activation Condition
                              </div>
                              <ConditionBuilder
                                kpiName={kpi.name}
                                condition={config.kpi_conditions[kpi.name] || defaultKpiCondition()}
                                onChange={data => onSetKpiCondition(kpi.name, data)}
                              />
                            </div>

                            <div className="flex justify-end pt-2 border-t border-border">
                              <button
                                onClick={() => setExpandedKpi(null)}
                                className="rounded-lg bg-text-primary text-surface px-4 py-1.5 text-xs font-semibold hover:bg-text-primary/90 transition-colors"
                              >
                                ✓ Close Mapping
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-text-tertiary">
                    {selectedNames.size === 0
                      ? 'Go to Master KPI List and add KPIs first.'
                      : 'No KPIs match your filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-border bg-background px-4 py-2 text-xs text-text-secondary">
            {filtered.length} KPI{filtered.length !== 1 ? 's' : ''} matched
          </div>
        </div>
      )}

      {/* Stage Cards view */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 gap-4">
          {config.stages.map((_, i) => {
            const n = i + 1;
            const ks = filtered.filter(d => d.stage === n);
            if (!ks.length) return null;
            return (
              <div key={n} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
                  <span className="text-sm font-bold text-text-primary">Stage {n}</span>
                  <span className="text-xs text-text-secondary">{ks.length} KPIs</span>
                </div>
                <div className="divide-y divide-border">
                  {ks.map(kpi => (
                    <div key={kpi.name} className="flex items-center gap-4 px-4 py-2.5 hover:bg-surface-hover">
                      <span className="flex-1 font-mono text-xs text-text-primary">{kpi.name}</span>
                      <span className="w-16 text-right text-xs text-text-secondary">{kpi.uom || '–'}</span>
                      <span
                        className={[
                          'w-20 rounded px-2 py-0.5 text-center text-xs font-semibold',
                          kpi.type === 'Final' ? 'bg-success/10 text-success' : 'bg-background text-text-secondary'
                        ].join(' ')}
                      >
                        {kpi.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

