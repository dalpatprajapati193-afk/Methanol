'use client';

import React from 'react';
import type {
  CgcConfig, CompositionBasis, DriverType, DriverConfig,
  StageConfig, PrimaryFlowTransmitter, AdditionalStream,
  CompositionComponent,
} from '../types/config';
import { ordinal } from '../types/config';

// ── Shared UI atoms ──────────────────────────────────────────────────────────

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}

const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50';
const sel = inp;
const numInp = (onChange: (v: number) => void, value: number | null | undefined) => (
  <input type="number" step="any" className={inp} value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
);

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ config, activeSection, setActiveSection }: {
  config: CgcConfig; activeSection: string; setActiveSection: (s: string) => void;
}) {
  const items = [
    { id: 'plant', label: 'Plant Setup' },
    { id: 'driver', label: 'Driver' },
    ...config.stages.map((_, i) => ({ id: `stage_${i}`, label: `Stage ${i + 1}` })),
  ];
  return (
    <nav className="w-44 flex-shrink-0 space-y-0.5 border-r border-border pr-3">
      {items.map(item => (
        <button key={item.id} onClick={() => setActiveSection(item.id)}
          className={['w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
            activeSection === item.id
              ? 'bg-primary/10 text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          ].join(' ')}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

// ── Plant Setup panel ─────────────────────────────────────────────────────────

function PlantPanel({ config, setPlant, setUnitSystem, setBaseline, setOpportunity, setFeedFraction, setStageCount, setPrimaryFlowTransmitter }: {
  config: CgcConfig;
  setPlant: (k: keyof CgcConfig['plant'], v: unknown) => void;
  setUnitSystem: (k: keyof CgcConfig['plant']['unit_system'], v: string) => void;
  setBaseline: (k: keyof CgcConfig['plant']['baselines'], v: number) => void;
  setOpportunity: (k: keyof CgcConfig['plant']['opportunity'], v: number) => void;
  setFeedFraction: (c: string, v: number) => void;
  setStageCount: (n: number) => void;
  setPrimaryFlowTransmitter: (v: PrimaryFlowTransmitter | null) => void;
}) {
  const { plant } = config;

  return (
    <div className="space-y-8">
      {/* Identification */}
      <section>
        <h3 className="mb-4 border-b border-border pb-2 text-sm font-bold text-text-primary">Identification</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Plant / site name"><input className={inp} value={plant.plant_name} onChange={e => setPlant('plant_name', e.target.value)} placeholder="e.g. SABIC OLF CGC" /></Field>
          <Field label="Compressor equipment code"><input className={inp} value={plant.train} onChange={e => setPlant('train', e.target.value)} placeholder="e.g. CGC Train 1" /></Field>
          <Field label="Process licensor"><input className={inp} value={plant.process_licensor} onChange={e => setPlant('process_licensor', e.target.value)} /></Field>
          <Field label="Downstream destination"><input className={inp} value={plant.final_outlet_destination} onChange={e => setPlant('final_outlet_destination', e.target.value)} /></Field>
          <Field label="Data source"><input className={inp} value={plant.data_source} onChange={e => setPlant('data_source', e.target.value)} placeholder="PI historian + EFF data Excel" /></Field>
        </div>
      </section>

      {/* Compressor Configuration */}
      <section>
        <h3 className="mb-4 border-b border-border pb-2 text-sm font-bold text-text-primary">Compressor Configuration</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="How many compressor stages?">
            <input type="number" className={inp} min={1} max={50} value={plant.stage_count}
              onChange={e => setStageCount(parseInt(e.target.value) || 1)} />
          </Field>
          <Field label="Composition basis">
            <select className={sel} value={plant.composition_basis} onChange={e => setPlant('composition_basis', e.target.value as CompositionBasis)}>
              <option value="dry">Dry basis</option>
              <option value="wet">Wet basis (includes water)</option>
            </select>
          </Field>
          <Field label="Driver type">
            <select className={sel} value={plant.driver_type} onChange={e => setPlant('driver_type', e.target.value as DriverType)}>
              <option value="steam_turbine">Steam turbine</option>
              <option value="motor_vfd">Electric motor (VFD)</option>
              <option value="gas_turbine">Gas turbine</option>
              <option value="other">Other / unknown</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Primary Flow Transmitter */}
      <section>
        <h3 className="mb-4 border-b border-border pb-2 text-sm font-bold text-text-primary">Primary Flow Transmitter</h3>
        <p className="mb-3 text-xs text-text-secondary">Sets which stage and location provides the mass-flow balance anchor for the PR-EOS calculation.</p>
        <div className="mb-4 max-w-xs">
          <Field label="Stage">
            <select className={sel}
              value={plant.primary_flow_transmitter?.stage ?? plant.stage_count}
              onChange={e => setPrimaryFlowTransmitter({
                stage: parseInt(e.target.value, 10),
                location: plant.primary_flow_transmitter?.location ?? 'discharge',
                is_wet: plant.primary_flow_transmitter?.is_wet ?? true,
              })}>
              {Array.from({ length: plant.stage_count }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Stage {n}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {(['suction','discharge','cooler_outlet'] as const).map(loc => (
            <button key={loc}
              onClick={() => setPrimaryFlowTransmitter({ stage: plant.primary_flow_transmitter?.stage ?? plant.stage_count, location: loc, is_wet: plant.primary_flow_transmitter?.is_wet ?? true })}
              className={['rounded-lg border px-3 py-2 text-sm font-semibold transition-colors', plant.primary_flow_transmitter?.location === loc ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-surface-hover'].join(' ')}>
              {loc.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </section>

      {/* Unit System */}
      <section>
        <h3 className="mb-4 border-b border-border pb-2 text-sm font-bold text-text-primary">Unit System</h3>
        <div className="grid grid-cols-3 gap-4">
          {([['Pressure','pressure',[['bar(a)','bar(a)'],['bar(g)','bar(g)'],['kg/cm²(g)','kg/cm²(g)'],['kg/cm²(a)','kg/cm²(a)'],['psi(a)','psi(a)'],['psi(g)','psi(g)'],['kPa(a)','kPa(a)'],['kPa(g)','kPa(g)'],['MPa(a)','MPa(a)'],['MPa(g)','MPa(g)']]],['Temperature','temperature',[['°C','°C'],['°F','°F'],['K','K']]],['Mass Flow','mass_flow',[['kg/h','kg/h'],['t/h','t/h'],['lb/h','lb/h'],['kg/s','kg/s']]],['Power','power',[['kW','kW'],['MW','MW'],['hp','hp']]],['Specific Power','specific_power',[['kWh/t','kWh/t'],['kJ/kg','kJ/kg']]]] as [string, keyof CgcConfig['plant']['unit_system'], [string,string][]][]).map(([label, k, opts]) => (
            <Field key={k} label={label}>
              <select className={sel} value={plant.unit_system[k]} onChange={e => setUnitSystem(k, e.target.value)}>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          ))}
        </div>
      </section>


    </div>
  );
}

// ── Stage panel ───────────────────────────────────────────────────────────────

const EQUIPMENT_TAG_LABELS: Record<string, string> = {
  suction_drum: 'Suction / KO Drum',
  compressor: 'Compressor',
  aftercooler: 'Aftercooler',
  downstream_drum: 'Downstream / Next Suction',
};

function StagePanel({ stage, idx, totalStages, compositionComponents, setStageDesign, setStageInjection, setStageField, setEquipmentTag, setStageInterstage }: {
  stage: StageConfig; idx: number; totalStages: number;
  compositionComponents: CompositionComponent[];
  setStageDesign: (i: number, k: keyof StageConfig['design'], v: number | null) => void;
  setStageInjection: (i: number, t: 'bfw_injection'|'wash_oil_injection', k: string, v: unknown) => void;
  setStageField: <K extends keyof StageConfig>(i: number, k: K, v: StageConfig[K]) => void;
  setEquipmentTag: (i: number, key: string, v: string) => void;
  setStageInterstage: (i: number, key: keyof StageConfig['interstage_after'], v: boolean) => void;
}) {
  const n = idx + 1;

  const handleAddStream = () => {
    const defaultStream: AdditionalStream = {
      id: `stream_${idx + 1}_${Date.now()}_${stage.additional_streams.length}`,
      name: `Additional stream ${stage.additional_streams.length + 1}`,
      role: 'additional',
      stage: idx + 1,
      location: 'before_compressor',
      flow_col: '',
      source_tag_name: '',
      source_pi_tag: '',
      flow_availability: 'tag',
      composition_mode: null,
      composition_basis: 'dry',
      composition_cols: {},
      fixed_composition: {},
      component_mass_flow_cols: {},
      component_mass_flow_defaults: {},
      input_uom: '',
      output_uom: '',
      has_gc_analyzer: false,
      design_flow_kg_h: null,
    };
    setStageField(idx, 'additional_streams', [...stage.additional_streams, defaultStream]);
  };

  return (
    <div className="space-y-8">
      <h3 className="text-sm font-bold text-text-primary">Stage {n} Configuration</h3>

      {/* Equipment Tags */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">Equipment Tags</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(stage.equipment_tags).map(([k, v]) => (
            <Field key={k} label={EQUIPMENT_TAG_LABELS[k] ?? k.replace(/_/g, ' ')}>
              <input className={`${inp} font-mono`} value={v} onChange={e => setEquipmentTag(idx, k, e.target.value)} />
            </Field>
          ))}
        </div>
      </section>

      {/* Equipment Present */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">Equipment Present</h4>
        <div className="flex flex-wrap gap-4">
          {([
            ['has_suction_drum', 'Suction / KO Drum'],
            ['has_aftercooler', 'Discharge Aftercooler', idx + 1 >= totalStages],
          ] as const).map(([k, lbl, disabled]) => (
            <label key={k} className={['flex items-center gap-2 text-sm text-text-secondary', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'].join(' ')}>
              <input type="checkbox" className="rounded" disabled={!!disabled}
                checked={!!stage[k as 'has_suction_drum' | 'has_aftercooler']}
                onChange={e => setStageField(idx, k as 'has_suction_drum' | 'has_aftercooler', e.target.checked)} />
              <span>{lbl}</span>
            </label>
          ))}
        </div>
        {idx + 1 >= totalStages && (
          <p className="mt-2 text-xs text-text-tertiary">Aftercooler is not applicable on the last stage.</p>
        )}
      </section>

      {/* Additional Streams */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
            Additional Streams <span className="text-[10px] font-normal text-text-tertiary">(optional — side feeds, recycles, vents)</span>
          </h4>
          <button
            type="button"
            onClick={handleAddStream}
            className="rounded border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            + Add stream
          </button>
        </div>

        {stage.additional_streams.length === 0 ? (
          <p className="text-xs italic text-text-tertiary">No additional streams configured for this stage.</p>
        ) : (
          <div className="space-y-4">
            {stage.additional_streams.map((s, si) => {
              const handleUpdate = (field: keyof AdditionalStream, val: any) => {
                const updated = [...stage.additional_streams];
                updated[si] = { ...updated[si], [field]: val };
                setStageField(idx, 'additional_streams', updated);
              };

              const handleRemove = () => {
                const updated = [...stage.additional_streams];
                updated.splice(si, 1);
                setStageField(idx, 'additional_streams', updated);
              };

              return (
                <div key={s.id || si} className="rounded-lg border border-border p-4 bg-surface space-y-3 relative">
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="absolute right-3 top-3 text-destructive hover:text-destructive/80 font-bold text-sm"
                    title="Remove stream"
                  >
                    ✕
                  </button>

                  <div className="grid grid-cols-2 gap-3 pr-6">
                    <Field label="Stream name / ID">
                      <input
                        className={inp}
                        value={s.name}
                        onChange={e => handleUpdate('name', e.target.value)}
                        placeholder="Stream name / ID"
                      />
                    </Field>
                    <Field label="Description (optional)">
                      <input
                        className={inp}
                        value={s.description || ''}
                        onChange={e => handleUpdate('description', e.target.value)}
                        placeholder="Description (optional)"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Role">
                      <select
                        className={sel}
                        value={s.role}
                        onChange={e => handleUpdate('role', e.target.value)}
                      >
                        <option value="additional">Side feed</option>
                        <option value="recycle">Recycle</option>
                        <option value="vent">Vent</option>
                        <option value="condensate">Condensate</option>
                        <option value="purge">Purge</option>
                      </select>
                    </Field>
                    <Field label="Location">
                      <select
                        className={sel}
                        value={s.location}
                        onChange={e => handleUpdate('location', e.target.value)}
                      >
                        <option value="before_suction_drum">Joins suction drum feed</option>
                        <option value="before_compressor">Joins compressor suction line</option>
                        <option value="after_compressor">Joins discharge cooler inlet</option>
                        <option value="after_aftercooler">Joins cooled gas to next stage</option>
                      </select>
                    </Field>
                  </div>

                  {/* Flow measurement */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-text-secondary min-w-[110px]">Flow measurement:</span>
                    <div className="flex overflow-hidden rounded border border-border">
                      {([
                        ['tag', 'PI Tag'],
                        ['design', 'Design value'],
                        ['unavailable', 'Not available']
                      ] as const).map(([opt, lbl]) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleUpdate('flow_availability', opt)}
                          className={[
                            'px-3 py-1 font-semibold transition-colors',
                            s.flow_availability === opt
                              ? 'bg-primary/10 text-primary border-r border-border last:border-0'
                              : 'bg-surface text-text-secondary hover:bg-surface-hover border-r border-border last:border-0'
                          ].join(' ')}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* GC analyser */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-text-secondary min-w-[110px]">GC analyser:</span>
                    <div className="flex overflow-hidden rounded border border-border">
                      {([
                        [true, 'Available'],
                        [false, 'Not available']
                      ] as const).map(([opt, lbl]) => (
                        <button
                          key={String(opt)}
                          type="button"
                          onClick={() => handleUpdate('has_gc_analyzer', opt)}
                          className={[
                            'px-3 py-1 font-semibold transition-colors',
                            !!s.has_gc_analyzer === opt
                              ? 'bg-primary/10 text-primary border-r border-border last:border-0'
                              : 'bg-surface text-text-secondary hover:bg-surface-hover border-r border-border last:border-0'
                          ].join(' ')}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {s.has_gc_analyzer ? (
                    <div className="text-xs text-success bg-success/5 border border-success/20 rounded-lg p-2 space-y-1">
                      <div className="font-bold">Composition inputs (8 components):</div>
                      <div>H₂ · CH₄ · C₂H₄ · C₂H₆ · C₃H₆ · C₃H₈ · iC₄ · nC₄</div>
                      <div className="text-text-tertiary">
                        Auto-generated as <code className="font-mono bg-background px-1 border border-border rounded">CGC_IS{n}_GC_&#123;comp&#125;</code> — mapped per-KPI in KPI Calculations
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-text-secondary min-w-[110px]">Composition source:</span>
                        <div className="flex overflow-hidden rounded border border-border">
                          {([
                            ['fixed_composition', 'Fixed composition'],
                            ['component_mass_flow', 'Per-component mass flow'],
                          ] as const).map(([opt, lbl]) => (
                            <button key={opt} type="button"
                              onClick={() => handleUpdate('composition_mode', opt)}
                              className={[
                                'px-3 py-1 font-semibold transition-colors',
                                s.composition_mode === opt
                                  ? 'bg-primary/10 text-primary border-r border-border last:border-0'
                                  : 'bg-surface text-text-secondary hover:bg-surface-hover border-r border-border last:border-0'
                              ].join(' ')}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {s.composition_mode === 'fixed_composition' && (
                        <div className="grid grid-cols-4 gap-2">
                          {compositionComponents.map(comp => (
                            <Field key={comp.id} label={`${comp.label} (mol%)`}>
                              <input type="number" step="any" className={inp}
                                value={s.fixed_composition[comp.id] ?? ''}
                                onChange={e => handleUpdate('fixed_composition', {
                                  ...s.fixed_composition,
                                  [comp.id]: parseFloat(e.target.value) || 0,
                                })} />
                            </Field>
                          ))}
                        </div>
                      )}

                      {s.composition_mode === 'component_mass_flow' && (
                        <div className="grid grid-cols-2 gap-2">
                          {compositionComponents.map(comp => (
                            <div key={comp.id} className="grid grid-cols-2 gap-2">
                              <Field label={`${comp.label} tag / column`}>
                                <input className={inp}
                                  value={s.component_mass_flow_cols[comp.id] ?? ''}
                                  onChange={e => handleUpdate('component_mass_flow_cols', {
                                    ...s.component_mass_flow_cols,
                                    [comp.id]: e.target.value,
                                  })} />
                              </Field>
                              <Field label={`${comp.label} default (kg/h)`}>
                                <input type="number" step="any" className={inp}
                                  value={s.component_mass_flow_defaults[comp.id] ?? ''}
                                  onChange={e => handleUpdate('component_mass_flow_defaults', {
                                    ...s.component_mass_flow_defaults,
                                    [comp.id]: parseFloat(e.target.value) || 0,
                                  })} />
                              </Field>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>



      {/* Injections */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">Injections</h4>
        <div className="grid grid-cols-2 gap-4">
          {(['bfw_injection', 'wash_oil_injection'] as const).map(type => (
            <div key={type} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {type === 'bfw_injection' ? 'BFW Injection' : 'Wash Oil Injection'}
                </span>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="rounded"
                    checked={stage[type].enabled}
                    onChange={e => setStageInjection(idx, type, 'enabled', e.target.checked)} />
                  <span className="text-sm text-text-secondary">Enabled</span>
                </label>
              </div>
              {stage[type].enabled && (
                <Field label="Location">
                  <select className={sel} value={stage[type].location}
                    onChange={e => setStageInjection(idx, type, 'location', e.target.value)}>
                    <option value="compressor_internal">Compressor internal</option>
                    <option value="before_compressor">Before compressor</option>
                    <option value="after_cooler">After cooler</option>
                  </select>
                </Field>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Interstage */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">Interstage After</h4>
        <div className="flex flex-wrap gap-4">
          {(Object.entries(stage.interstage_after) as [keyof StageConfig['interstage_after'], boolean][]).map(([k, v]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" className="rounded" checked={!!v}
                onChange={e => setStageInterstage(idx, k, e.target.checked)} />
              <span>{k.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Driver panel ──────────────────────────────────────────────────────────────

const PRIMARY_METHOD_OPTIONS: { value: DriverConfig['primary_method']; title: string; detail: string }[] = [
  { value: 'A', title: 'Compressor power', detail: 'P_turbine = compressor absorbed power ÷ shaft efficiency.' },
  { value: 'B', title: 'Condenser duty', detail: 'System duty minus surface-condenser duty.' },
  { value: 'C', title: 'Assumed isentropic eff.', detail: 'Isentropic turbine power × assumed efficiency.' },
  { value: 'D', title: 'Dryness fraction', detail: 'Condensing section closed from exhaust wetness / curve fit.' },
];

function YesNoQuestion({ question, hint, value, onChange }: {
  question: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-text-primary">{question}</div>
          {hint && <div className="mt-0.5 text-xs text-text-secondary">{hint}</div>}
        </div>
        <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-border">
          {([[true, 'Yes'], [false, 'No']] as const).map(([v, lbl]) => (
            <button key={String(v)} type="button" onClick={() => onChange(v)}
              className={[
                'px-4 py-1.5 text-sm font-semibold transition-colors',
                value === v
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover',
              ].join(' ')}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TileChoice<T extends string | boolean>({ options, value, onChange }: {
  options: { value: T; title: string; detail: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map(opt => (
        <button key={String(opt.value)} type="button" onClick={() => onChange(opt.value)}
          className={[
            'rounded-lg border p-3 text-left transition-colors',
            value === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-hover',
          ].join(' ')}>
          <div className={['text-sm font-semibold', value === opt.value ? 'text-primary' : 'text-text-primary'].join(' ')}>{opt.title}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{opt.detail}</div>
        </button>
      ))}
    </div>
  );
}

function DriverPanel({ config, setDriver }: {
  config: CgcConfig; setDriver: <K extends keyof DriverConfig>(k: K, v: DriverConfig[K]) => void;
}) {
  const d = config.driver;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-text-primary">Driver Configuration</h3>
        <p className="text-sm text-text-secondary">Configure the turbine arrangement. KPI formulas follow this path exactly.</p>
      </div>

      <YesNoQuestion
        question="Does the turbine have a controlled extraction?"
        hint="Medium-pressure steam extracted to the plant header before the final exhaust section."
        value={!!d.has_extraction}
        onChange={v => setDriver('has_extraction', v)}
      />

      <YesNoQuestion
        question="Does it have steam injection / induction?"
        hint="Another steam stream enters the turbine casing between expansion sections."
        value={!!d.has_injection}
        onChange={v => setDriver('has_injection', v)}
      />
      {d.has_injection && d.has_extraction && (
        <div className="pl-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">Where does injection enter?</div>
          <TileChoice
            value={d.injection_before_extraction}
            onChange={v => setDriver('injection_before_extraction', v)}
            options={[
              { value: true, title: 'Before extraction', detail: 'Induction steam mixes before the extraction point.' },
              { value: false, title: 'After extraction', detail: 'Induction steam enters downstream of the extraction point.' },
            ]}
          />
        </div>
      )}

      <YesNoQuestion
        question="Does the turbine exhaust to a condenser or back-pressure outlet?"
        hint="Select No if there is no final exhaust section — engine treats it as extraction/back-pressure only."
        value={!!d.has_exhaust}
        onChange={v => setDriver('has_exhaust', v)}
      />
      {d.has_exhaust && (
        <div className="pl-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">Exhaust type</div>
          <TileChoice
            value={d.exhaust_condensing}
            onChange={v => setDriver('exhaust_condensing', v)}
            options={[
              { value: true, title: 'Condensing exhaust', detail: 'Exhaust goes to vacuum / surface condenser. Outlet temperature from saturation curve.' },
              { value: false, title: 'Back-pressure exhaust', detail: 'Exhaust leaves as superheated / saturated steam to a plant header.' },
            ]}
          />
        </div>
      )}

      <section>
        <h4 className="mb-1 text-sm font-bold text-text-primary">Headline turbine power — closure method</h4>
        <p className="mb-3 text-xs text-text-secondary">Select how the engine calculates turbine shaft power.</p>
        <TileChoice options={PRIMARY_METHOD_OPTIONS} value={d.primary_method} onChange={v => setDriver('primary_method', v)} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Shaft / coupling efficiency (%)">
            <input type="number" step="0.1" className={inp} value={d.shaft_efficiency_pct} onChange={e => setDriver('shaft_efficiency_pct', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Isentropic efficiency (%)">
            <input type="number" step="0.1" className={inp} value={d.custom_isentropic_eff_pct} onChange={e => setDriver('custom_isentropic_eff_pct', parseFloat(e.target.value) || 0)} />
          </Field>
        </div>
      </section>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  config: CgcConfig;
  activeSection: string;
  setActiveSection: (s: string) => void;
  setPlant: (k: keyof CgcConfig['plant'], v: unknown) => void;
  setUnitSystem: (k: keyof CgcConfig['plant']['unit_system'], v: string) => void;
  setBaseline: (k: keyof CgcConfig['plant']['baselines'], v: number) => void;
  setOpportunity: (k: keyof CgcConfig['plant']['opportunity'], v: number) => void;
  setFeedFraction: (c: string, v: number) => void;
  setPrimaryFlowTransmitter: (v: PrimaryFlowTransmitter | null) => void;
  setStageCount: (n: number) => void;
  setStageDesign: (i: number, k: keyof StageConfig['design'], v: number | null) => void;
  setStageInjection: (i: number, t: 'bfw_injection'|'wash_oil_injection', k: string, v: unknown) => void;
  setStageField: <K extends keyof StageConfig>(i: number, k: K, v: StageConfig[K]) => void;
  setEquipmentTag: (i: number, key: string, v: string) => void;
  setStageInterstage: (i: number, key: keyof StageConfig['interstage_after'], v: boolean) => void;
  setDriver: <K extends keyof DriverConfig>(k: K, v: DriverConfig[K]) => void;
}

export default function PlantConfigTab({ config, activeSection, setActiveSection, setPlant, setUnitSystem, setBaseline, setOpportunity, setFeedFraction, setPrimaryFlowTransmitter, setStageCount, setStageDesign, setStageInjection, setStageField, setEquipmentTag, setStageInterstage, setDriver }: Props) {
  const stageMatch = activeSection.match(/^stage_(\d+)$/);
  const stageIdx = stageMatch ? parseInt(stageMatch[1]) : -1;

  return (
    <div className="flex min-h-[600px] gap-6">
      <Sidebar config={config} activeSection={activeSection} setActiveSection={setActiveSection} />
      <div className="flex-1 overflow-y-auto pb-8">
        {activeSection === 'plant' && (
          <PlantPanel config={config} setPlant={setPlant} setUnitSystem={setUnitSystem} setBaseline={setBaseline} setOpportunity={setOpportunity} setFeedFraction={setFeedFraction} setStageCount={setStageCount} setPrimaryFlowTransmitter={setPrimaryFlowTransmitter} />
        )}
        {activeSection === 'driver' && (
          <DriverPanel config={config} setDriver={setDriver} />
        )}
        {stageIdx >= 0 && stageIdx < config.stages.length && (
          <StagePanel stage={config.stages[stageIdx]} idx={stageIdx} totalStages={config.stages.length}
            compositionComponents={config.composition_components}
            setStageDesign={setStageDesign} setStageInjection={setStageInjection} setStageField={setStageField}
            setEquipmentTag={setEquipmentTag} setStageInterstage={setStageInterstage} />
        )}
      </div>
    </div>
  );
}

