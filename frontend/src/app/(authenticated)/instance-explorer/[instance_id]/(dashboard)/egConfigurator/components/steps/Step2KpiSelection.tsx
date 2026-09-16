'use client';

/**
 * Step 2 — KPI Selection
 *
 * Matches the Flask app's "Output KPI List" page behaviour:
 *   - Per KPI: "PI tag available?" Yes / No radio + Clear button
 *   - Yes  → PI tag text input + UOM dropdown
 *   - No (calculated_tag)  → "🔗 Configure KPI Inputs" → inline variable mapping
 *   - No (soft_sensor)     → recommended X-variables card + inline x-var tag inputs
 *   - 3 tabs: Steam System | Equipment | Plant — each with configured/total badge
 *   - "Configured / Not Configured" status pill per KPI row
 */

import { useAtom } from 'jotai';
import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getKpiTemplates, saveKpiSelections, type KpiTemplate } from '../../actions/Actions';
import {
  step2Atom,
  type KpiSelectionState,
  type KpiSelectionEntry,
  type KpiVariableInput,
} from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// ---------------------------------------------------------------------------
// UOM helpers
// ---------------------------------------------------------------------------

const ALL_UOMS = [
  '', 'barg', 'bara', 'psi', 'kPa', 'MPa', 'kg/cm²', 'atm', 'mmHg abs',
  '°C', '°F', 'K',
  'T/hr', 'kg/hr', 'kg/s', 'lb/hr',
  'kJ/kg', 'kcal/kg',
  'MW', 'kW', 'GJ/hr', 'kcal/hr',
  'GJ/T', 'kWh/T', '%', 'T/T', 'kg/T', 'wt%', '-',
];

function compatibleUnits(baseUom: string): string[] {
  switch (baseUom) {
    case '°C': return ['°C', '°F', 'K'];
    case 'barg': return ['barg', 'bara', 'psi', 'kPa', 'kg/cm²', 'atm'];
    case 'mmHg abs': return ['mmHg abs', 'bara', 'psi', 'kPa', 'atm'];
    case 'T/hr': return ['T/hr', 'kg/hr', 'kg/s', 'lb/hr'];
    case 'MW': return ['MW', 'kW', 'GJ/hr', 'kcal/hr'];
    case 'kW': return ['kW', 'MW', 'hp'];
    case 'GJ/hr': return ['GJ/hr', 'MW', 'kW', 'kcal/hr'];
    case '%': return ['%'];
    case '-': return ['-'];
    default: return baseUom ? [baseUom, ...ALL_UOMS.filter(u => u && u !== baseUom)] : ALL_UOMS;
  }
}

// ---------------------------------------------------------------------------
// Tab helpers
// ---------------------------------------------------------------------------

type Tab = 'steam' | 'equipment' | 'plant';

function getTab(section: string): Tab {
  if (section === 'Steam System') return 'steam';
  if (section === 'Plant Level' || section === 'Overall Plant') return 'plant';
  return 'equipment';
}

const TAB_LABELS: Record<Tab, string> = {
  steam: '♨️ Steam System',
  equipment: '⚙️ Equipment',
  plant: '📊 Plant',
};

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function UomSelect({ value, onChange, baseUom }: {
  value: string; onChange: (v: string) => void; baseUom: string;
}) {
  const opts = compatibleUnits(baseUom);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue w-28"
    >
      {opts.map((u) => <option key={u} value={u}>{u || '— UOM —'}</option>)}
    </select>
  );
}

function TagInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'e.g. FI-1001.PV'}
      className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
    />
  );
}

// ---------------------------------------------------------------------------
// Variable input row (inside "Configure KPI Inputs" expansion)
// ---------------------------------------------------------------------------

function VariableRow({ varName, entry, baseUom, onChange }: {
  varName: string;
  entry: KpiVariableInput;
  baseUom: string;
  onChange: (v: KpiVariableInput) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 flex-wrap">
      <span className="text-xs font-mono text-text-secondary w-48 shrink-0 truncate" title={varName}>
        {varName}
      </span>
      {/* type toggle */}
      <div className="flex gap-1 shrink-0">
        {(['sensor', 'fixed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...entry, type: t })}
            className={cn(
              'px-2.5 py-1 rounded border text-xs font-medium transition-all',
              entry.type === t
                ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
            )}
          >
            {t === 'sensor' ? 'PI Tag' : 'Fixed'}
          </button>
        ))}
      </div>
      {entry.type === 'sensor' && (
        <TagInput value={entry.tag} onChange={(v) => onChange({ ...entry, tag: v })} />
      )}
      {entry.type === 'fixed' && (
        <input
          type="number"
          value={entry.fixedValue}
          onChange={(e) => onChange({ ...entry, fixedValue: e.target.value })}
          placeholder="constant value"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
        />
      )}
      <UomSelect
        value={entry.uom}
        onChange={(v) => onChange({ ...entry, uom: v })}
        baseUom={baseUom}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI row — matches Flask renderOutputKpiRow exactly
// ---------------------------------------------------------------------------

function KpiRow({ kpi, entry, onChange }: {
  kpi: KpiTemplate;
  entry: KpiSelectionEntry | undefined;
  onChange: (e: KpiSelectionEntry | undefined) => void;
}) {
  const [inputsOpen, setInputsOpen] = useState(false);
  const isConfigured = entry?.input_type !== undefined;
  const hasPiTagYes = entry?.input_type === 'sensor';
  const hasPiTagNo = entry?.input_type === 'formula_mapped' || entry?.input_type === 'soft_sensor';
  const isSoftSensor = kpi.kpi_type === 'soft_sensor';

  function handleYes() {
    onChange({ input_type: 'sensor', tag: entry?.tag ?? '', uom: entry?.uom ?? kpi.uom });
    setInputsOpen(false);
  }

  function handleNo() {
    if (isSoftSensor) {
      onChange({ input_type: 'soft_sensor', has_pi_tag: false, x_variables: entry?.x_variables ?? {} });
    } else {
      const vars: Record<string, KpiVariableInput> = {};
      for (const v of kpi.variables) {
        vars[v] = entry?.variables?.[v] ?? { type: 'not_set', tag: '', fixedValue: '', uom: '' };
      }
      onChange({ input_type: 'formula_mapped', variables: vars });
    }
  }

  function handleClear() {
    onChange(undefined);
    setInputsOpen(false);
  }

  // Variable input change (formula_mapped)
  function handleVarChange(varName: string, v: KpiVariableInput) {
    const updated = { ...entry?.variables, [varName]: v };
    onChange({ ...entry, input_type: 'formula_mapped', variables: updated });
  }

  // X-variable change (soft_sensor, no pi tag)
  function handleXVarChange(varName: string, field: 'tag' | 'uom', v: string) {
    const currentVar = entry?.x_variables?.[varName] ?? { tag: '', uom: '' };
    const xVars = { ...(entry?.x_variables ?? {}), [varName]: { ...currentVar, [field]: v } } as Record<string, { tag: string; uom: string }>;
    onChange({ ...entry, input_type: 'soft_sensor', has_pi_tag: false, x_variables: xVars });
  }

  return (
    <div className="border border-border rounded-lg p-4 mb-3 bg-background">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isSoftSensor && (
            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Soft Sensor
            </span>
          )}
          <span className="text-sm font-semibold text-text-primary truncate">{kpi.name}</span>
          <span className="shrink-0 text-xs text-text-secondary">({kpi.uom})</span>
        </div>
        <span className={cn(
          'shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full',
          isConfigured
            ? 'bg-accent-green/10 text-accent-green'
            : 'bg-surface text-text-secondary border border-border'
        )}>
          {isConfigured ? 'Configured' : 'Not Configured'}
        </span>
      </div>

      {/* PI tag available? row */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm text-text-secondary">PI tag available?</span>
        {(['yes', 'no'] as const).map((opt) => (
          <label
            key={opt}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all select-none',
              (opt === 'yes' ? hasPiTagYes : hasPiTagNo)
                ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
            )}
          >
            <input
              type="radio"
              name={`kpi_pi_yn_${kpi.id}`}
              value={opt}
              checked={opt === 'yes' ? hasPiTagYes : hasPiTagNo}
              onChange={() => opt === 'yes' ? handleYes() : handleNo()}
              className="accent-accent-blue"
            />
            {opt === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
        {isConfigured && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-accent-red hover:underline ml-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* When YES: PI tag + UOM input */}
      {hasPiTagYes && (
        <div className="flex items-center gap-2 mt-3">
          <TagInput
            value={entry?.tag ?? ''}
            onChange={(v) => onChange({ ...entry, input_type: 'sensor', tag: v })}
          />
          <UomSelect
            value={entry?.uom ?? kpi.uom}
            onChange={(v) => onChange({ ...entry, input_type: 'sensor', uom: v })}
            baseUom={kpi.uom}
          />
        </div>
      )}

      {/* When NO (calculated_tag): Configure KPI Inputs button + inline variable mapping */}
      {hasPiTagNo && !isSoftSensor && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setInputsOpen((p) => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-hover transition"
          >
            🔗 {inputsOpen ? 'Hide KPI Inputs ▲' : 'Configure KPI Inputs ▼'}
          </button>
          {inputsOpen && (
            <div className="mt-3 pl-1">
              {kpi.variables.length === 0 ? (
                <p className="text-xs text-text-secondary">No formula variables found.</p>
              ) : (
                <>
                  <p className="text-xs text-text-secondary mb-2 font-mono bg-surface px-3 py-1.5 rounded border border-border">
                    Formula: {kpi.formula}
                  </p>
                  {kpi.variables.map((varName) => (
                    <VariableRow
                      key={varName}
                      varName={varName}
                      entry={entry?.variables?.[varName] ?? { type: 'not_set', tag: '', fixedValue: '', uom: '' }}
                      baseUom={kpi.uom}
                      onChange={(v) => handleVarChange(varName, v)}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* When NO (soft_sensor): recommended X-variables + inline tag inputs */}
      {hasPiTagNo && isSoftSensor && (
        <div className="mt-3 space-y-3">
          {/* Recommended X-variables card (amber) */}
          {kpi.variables.length > 0 && (
            <div className="p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
              <p className="text-xs font-semibold text-accent-yellow uppercase tracking-wide mb-2">
                Recommended X Variables for Model Training
              </p>
              <div className="flex flex-wrap gap-2">
                {kpi.variables.map((v) => (
                  <span key={v} className="text-xs px-2 py-1 bg-accent-yellow/20 border border-accent-yellow/40 rounded-md text-text-primary font-mono">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* X variable tag inputs */}
          <button
            type="button"
            onClick={() => setInputsOpen((p) => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-hover transition"
          >
            📎 {inputsOpen ? 'Hide X-Variable Mapping ▲' : 'Configure X-Variable Mapping ▼'}
          </button>
          {inputsOpen && (
            <div className="pl-1 space-y-2">
              {kpi.variables.map((varName) => (
                <div key={varName} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 flex-wrap">
                  <span className="text-xs font-mono text-text-secondary w-48 shrink-0 truncate">{varName}</span>
                  <TagInput
                    value={entry?.x_variables?.[varName]?.tag ?? ''}
                    onChange={(v) => handleXVarChange(varName, 'tag', v)}
                  />
                  <UomSelect
                    value={entry?.x_variables?.[varName]?.uom ?? ''}
                    onChange={(v) => handleXVarChange(varName, 'uom', v)}
                    baseUom={kpi.uom}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  instanceId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2KpiSelection({ instanceId, onNext, onBack }: Props) {
  const [kpiState, setKpiState] = useAtom(step2Atom);
  const [templates, setTemplates] = useState<KpiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillDone, setFillDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('steam');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getKpiTemplates(instanceId);
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        setError(res.error ?? 'Failed to load KPI templates');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((kpiId: string, entry: KpiSelectionEntry | undefined) => {
    setKpiState((prev) => {
      const next = { ...prev };
      if (entry === undefined) {
        delete next[kpiId];
      } else {
        next[kpiId] = entry;
      }
      return next;
    });
  }, [setKpiState]);

  function handleFillSample() {
    // KPIs marked "No PI tag" so the user can test formula-variable mapping and
    // soft-sensor x-variable flows.  A representative mix was chosen:
    //   • A few calculated KPIs across different sections → formula_mapped
    //   • All soft-sensor KPIs                           → soft_sensor (no PI tag)
    // Everything else gets a placeholder PI tag.
    const NO_PI_TAG_IDS = new Set([
      // Steam System — saturation temps are calculated from pressure formula
      'steam_h1_sat_temp',
      'steam_h2_sat_temp',
      'steam_h3_sat_temp',
      'steam_h4_sat_temp',
      // Stripping Column — reboiler duty needs formula inputs
      'sc_reboiler_duty',
      // GFS — reboiler duty (if present)
      'gfs_reboiler_duty',
      // Feed Preheat — heat duties are calculated
      'fpe_total_duty',
      'fpe_ex1_steam_flow',
      'fpe_ex2_steam_flow',
      'fpe_ex3_steam_flow',
      'fpe_ex4_steam_flow',
      // Evaporation — condensate return is calculated
      'ev_condensate_return',
    ]);

    const filled: KpiSelectionState = {};
    for (const kpi of templates) {
      if (kpi.kpi_type === 'soft_sensor') {
        // All soft sensors: no PI tag → x-variable mapping needed
        const xVars: Record<string, { tag: string; uom: string }> = {};
        for (const v of kpi.variables) {
          xVars[v] = { tag: `YANSAB.SS.${v}.PV`, uom: '' };
        }
        filled[kpi.id] = {
          input_type: 'soft_sensor',
          has_pi_tag: false,
          x_variables: xVars,
        };
      } else if (NO_PI_TAG_IDS.has(kpi.id)) {
        // No PI tag → formula variable mapping
        const variables: Record<string, import('../../store/WizardAtoms').KpiVariableInput> = {};
        for (const v of kpi.variables) {
          variables[v] = { type: 'sensor', tag: `YANSAB.CALC.${v}.PV`, fixedValue: '', uom: kpi.uom };
        }
        filled[kpi.id] = { input_type: 'formula_mapped', variables };
      } else {
        // Has PI tag
        const tag = `YANSAB.${kpi.section.toUpperCase().replace(/\s+/g, '_')}.${kpi.id.toUpperCase()}.PV`;
        filled[kpi.id] = { input_type: 'sensor', tag, uom: kpi.uom };
      }
    }
    setKpiState(filled);
    setFillDone(true);
    setTimeout(() => setFillDone(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveKpiSelections(instanceId, kpiState);
    setSaving(false);
    if (res.success) {
      onNext();
    } else {
      setError(res.error ?? 'Save failed');
    }
  }

  // Group templates by tab
  const byTab: Record<Tab, KpiTemplate[]> = { steam: [], equipment: [], plant: [] };
  for (const kpi of templates) byTab[getTab(kpi.section)].push(kpi);

  // Tab badge counts
  function tabCounts(tab: Tab) {
    const kpis = byTab[tab];
    const configured = kpis.filter((k) => kpiState[k.id]?.input_type !== undefined).length;
    return { configured, total: kpis.length };
  }

  // Overall progress
  const totalConfigured = templates.filter((k) => kpiState[k.id]?.input_type !== undefined).length;
  const progressPct = templates.length > 0 ? Math.round((totalConfigured / templates.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading KPI templates…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">KPI Selection</h2>
          <p className="text-text-secondary mt-1 text-sm">
            For each KPI, indicate whether a PI tag is available or configure formula inputs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFillSample}
          className={cn(
            'shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
            fillDone
              ? 'bg-accent-green/10 border-accent-green text-accent-green'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          )}
        >
          {fillDone ? '✓ Filled!' : '✨ Fill Sample Data'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-text-secondary">Overall progress</span>
          <span className="font-semibold text-text-primary">
            {totalConfigured} / {templates.length} KPIs configured
            <span className="text-text-secondary font-normal ml-2">({progressPct}%)</span>
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div className="bg-accent-blue h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['steam', 'equipment', 'plant'] as Tab[]).map((tab) => {
          const { configured, total } = tabCounts(tab);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              {TAB_LABELS[tab]}
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-semibold',
                configured === total && total > 0
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'bg-surface border border-border text-text-secondary'
              )}>
                {configured}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI list for active tab */}
      <div className="space-y-1">
        {byTab[activeTab].length === 0 ? (
          <p className="text-center text-text-secondary py-12 text-sm">
            No KPIs in this category for the current plant configuration.
          </p>
        ) : (
          byTab[activeTab].map((kpi) => (
            <KpiRow
              key={kpi.id}
              kpi={kpi}
              entry={kpiState[kpi.id]}
              onChange={(e) => handleChange(kpi.id, e)}
            />
          ))
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-8">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2.5 rounded-xl bg-accent-blue text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save & Continue →'}
        </button>
      </div>
    </div>
  );
}
