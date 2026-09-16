'use client';

/**
 * Step 1 — Plant Configuration
 *
 * Covers all equipment & design parameter sections from the EG Automation wizard:
 *   General → Steam → Equipment Selection → Stripping Column → Reabsorber / GFS →
 *   Feed Preheat → Reactor → Evaporation → Other Equipment
 *
 * Sections are shown/hidden based on conditional logic mirroring the Flask app.
 * On "Save & Continue", data is persisted via the saveStep server action.
 */

import { useAtom } from 'jotai';
import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { saveStep } from '../../actions/Actions';
import {
  step1Atom, STEP1_DEFAULTS,
  type Step1Data, type SteamHeader, type DirectSteamInput,
  type FeedPreheatExchanger, type OtherEquipment,
} from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// ---------------------------------------------------------------------------
// Shared field components
// ---------------------------------------------------------------------------

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-text-primary mb-1">
      {children}
      {required && <span className="text-accent-red ml-1">*</span>}
    </label>
  );
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition"
    />
  );
}

function Select({ value, onChange, options, placeholder = '— select —' }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function YesNo({ value, onChange }: {
  value: 'yes' | 'no' | ''; onChange: (v: 'yes' | 'no') => void;
}) {
  return (
    <div className="flex gap-3">
      {(['yes', 'no'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
            value === opt
              ? opt === 'yes'
                ? 'bg-accent-green/10 border-accent-green text-accent-green'
                : 'bg-accent-red/10 border-accent-red text-accent-red'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
          )}
        >
          {opt === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

function RadioGroup({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
            value === opt
              ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yansab sample data  (from configurations.json in EG Automation repo)
// ---------------------------------------------------------------------------

const YANSAB_SAMPLE: Step1Data = {
  configName: 'Yansab EG Plant',
  plantCapacity: '97.5',
  commissioningYear: '2002',
  techLicensor: 'Shell',
  waterToEORatio: '17',
  numSteamHeaders: '4',
  steamHeaders: [
    { headerLabel: 'LP steam', isSuperheated: 'No' },
    { headerLabel: 'IP steam', isSuperheated: 'No' },
    { headerLabel: 'MP steam', isSuperheated: 'No' },
    { headerLabel: 'Extraction steam', isSuperheated: 'No' },
  ],
  eq_hasGFS: 'yes',
  eq_gfsArrangement: 'Separate Columns',
  sc_columnType: 'Packed',
  sc_hasReboiler: 'yes',
  sc_reboilerFreshSteam: 'yes',
  sc_reboilerMedium: 'LP steam',
  sc_hasDirectSteam: 'yes',
  sc_directSteamFreshSteam: 'yes',
  sc_numDirectSteam: '3',
  sc_directSteamInputs: [
    { freshSteam: 'no', mediaSource: 'Extraction steam' },
    { freshSteam: 'no', mediaSource: 'Other', otherLabel: 'Process steam' },
    { freshSteam: 'yes', mediaSource: 'LP steam' },
  ],
  sc_hasBottomBleed: 'yes',
  ra_columnType: 'Packed',
  ra_absorptionMedium: 'Recycle water',
  ra_absorptionMediumOther: '',
  ra_hasIntercooler: 'yes',
  ra_intercoolerMedium: 'Cooling Water',
  ra_intercoolerMediumOther: '',
  ra_hasAftercooler: 'yes',
  ra_aftercoolerFreshSteam: 'no',
  ra_aftercoolerSource: 'Condensate',
  ra_aftercoolerSourceOther: '',
  gfs_columnType: 'Packed',
  gfs_hasReboiler: 'no',
  gfs_reboilerFreshSteam: '',
  gfs_reboilerMedium: '',
  gfs_hasDirectSteam: 'yes',
  gfs_directSteamFreshSteam: 'yes',
  gfs_numDirectSteam: '3',
  gfs_directSteamInputs: [
    { freshSteam: 'no', mediaSource: 'Extraction steam' },
    { freshSteam: 'no', mediaSource: 'Other', otherLabel: 'flash steam' },
    { freshSteam: 'yes', mediaSource: 'LP steam' },
  ],
  gfs_strippingPurpose: 'Both',
  gfs_overheadVent: 'Recycle to reabsorber',
  int_columnType: '',
  int_absorptionMedium: '',
  int_absorptionMediumOther: '',
  int_hasIntercooler: '',
  int_intercoolerMedium: '',
  int_intercoolerMediumOther: '',
  int_hasReboiler: '',
  int_reboilerFreshSteam: '',
  int_reboilerMedium: '',
  int_hasDirectSteam: '',
  int_directSteamFreshSteam: '',
  int_numDirectSteam: '',
  int_directSteamInputs: [],
  int_strippingPurpose: '',
  int_overheadVent: '',
  fpe_numExchangers: '4',
  fpe_exchangers: [
    { freshSteam: 'no', heatSource: 'Other', heatSourceOther: 'Condensate', exchangerType: 'Shell & Tube' },
    { freshSteam: 'no', heatSource: 'Other', heatSourceOther: 'Extraction steam', exchangerType: 'Shell & Tube' },
    { freshSteam: 'no', heatSource: 'Other', heatSourceOther: 'ALDEHYDE vapour', exchangerType: 'Shell & Tube' },
    { freshSteam: 'yes', heatSource: 'Other', heatSourceOther: 'IP steam', exchangerType: 'Shell & Tube' },
  ],
  gr_reactorType: 'Adiabatic Tubular',
  gr_numReactors: '1',
  gr_heatRecovered: 'no',
  gr_heatRecoverySinks: [],
  gr_numInterstage: '0',
  ev_numEffects: '6',
  ev_flowArrangement: 'Forward-feed',
  ev_firstEffectFreshSteam: 'yes',
  ev_firstEffectSource: 'MP Steam',
  ev_hasMVR: 'no',
  ev_mvrEffect: '',
  ev_hasTVR: 'no',
  ev_tvrEffect: '',
  ev_condensateFlash: 'no',
  oe_hasOther: 'yes',
  oe_numEquipment: '2',
  oe_equipment: [
    { oe_name: 'ALDEHYDE stripper', oe_type: 'Heater', oe_freshSteam: 'yes', oe_heatSource: 'MP steam' },
    { oe_name: 'VOC stripper', oe_type: 'Heater', oe_freshSteam: 'yes', oe_heatSource: 'LP steam' },
  ],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  instanceId: string;
  onNext: () => void;
}

export default function Step1PlantConfig({ instanceId, onNext }: Props) {
  const [data, setData] = useAtom(step1Atom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  function handleFillSample() {
    setData(YANSAB_SAMPLE);
    setFilled(true);
    setTimeout(() => setFilled(false), 2000);
  }

  const set = <K extends keyof Step1Data>(key: K, value: Step1Data[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  // Sync dynamic list length to a numeric field
  function syncList<T>(
    count: string,
    current: T[],
    makeDefault: () => T
  ): T[] {
    const n = Math.max(0, parseInt(count || '0', 10));
    if (n > current.length) return [...current, ...Array(n - current.length).fill(null).map(makeDefault)];
    return current.slice(0, n);
  }

  // Steam headers
  const handleNumSteamHeaders = (v: string) => {
    set('numSteamHeaders', v);
    set('steamHeaders', syncList<SteamHeader>(v, data.steamHeaders, () => ({ headerLabel: '', isSuperheated: '' })));
  };

  // GFS direct steam
  const handleGfsNumDirect = (v: string) => {
    set('gfs_numDirectSteam', v);
    set('gfs_directSteamInputs', syncList<DirectSteamInput>(v, data.gfs_directSteamInputs, () => ({ freshSteam: '', mediaSource: '' })));
  };

  // SC direct steam
  const handleScNumDirect = (v: string) => {
    set('sc_numDirectSteam', v);
    set('sc_directSteamInputs', syncList<DirectSteamInput>(v, data.sc_directSteamInputs, () => ({ freshSteam: '', mediaSource: '' })));
  };

  // INT direct steam
  const handleIntNumDirect = (v: string) => {
    set('int_numDirectSteam', v);
    set('int_directSteamInputs', syncList<DirectSteamInput>(v, data.int_directSteamInputs, () => ({ freshSteam: '', mediaSource: '' })));
  };

  // Feed preheat
  const handleFpeNum = (v: string) => {
    set('fpe_numExchangers', v);
    set('fpe_exchangers', syncList<FeedPreheatExchanger>(v, data.fpe_exchangers, () => ({ freshSteam: '', heatSource: '', exchangerType: '' })));
  };

  // Other equipment
  const handleOeNum = (v: string) => {
    set('oe_numEquipment', v);
    set('oe_equipment', syncList<OtherEquipment>(v, data.oe_equipment, () => ({ oe_name: '', oe_type: '', oe_freshSteam: '', oe_heatSource: '' })));
  };

  const steamHeaderOptions = data.steamHeaders.map((h) => h.headerLabel).filter(Boolean);
  const hasGFS = data.eq_hasGFS === 'yes';
  const isIntegrated = hasGFS && data.eq_gfsArrangement === 'Integrated Single Column';

  async function handleSave() {
    if (!data.configName.trim()) {
      setError('Plant Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveStep(instanceId, 'step1_plant_config', data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to save.');
      return;
    }
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Plant Configuration</h2>
          <p className="text-text-secondary mt-1">
            Define the plant's equipment layout and design parameters.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFillSample}
          className={cn(
            'shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
            filled
              ? 'bg-accent-green/10 border-accent-green text-accent-green'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          )}
        >
          <span>{filled ? '✓' : '✨'}</span>
          {filled ? 'Filled!' : 'Fill Sample Data (Yansab)'}
        </button>
      </div>

      {/* ── General ── */}
      <SectionCard title="General Plant Information" icon="🏭">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Plant Name" required>
              <Input value={data.configName} onChange={(v) => set('configName', v)} placeholder="e.g. Yansab EG Plant" />
            </Field>
          </div>
          <Field label="Plant Design Capacity (MT)" required>
            <Input type="number" value={data.plantCapacity} onChange={(v) => set('plantCapacity', v)} placeholder="e.g. 97.5" />
          </Field>
          <Field label="Year of Commissioning" required>
            <Input type="number" value={data.commissioningYear} onChange={(v) => set('commissioningYear', v)} placeholder="e.g. 2005" />
          </Field>
          <Field label="Technology Licensor" required>
            <Select value={data.techLicensor} onChange={(v) => set('techLicensor', v)}
              options={['Shell', 'Scientific Design (SD)', 'Linde', 'MEGLOBAL', 'Other']} />
          </Field>
          <Field label="Design Water-to-EO Molar Ratio" required>
            <Input type="number" value={data.waterToEORatio} onChange={(v) => set('waterToEORatio', v)} placeholder="Typical: 15–25" />
          </Field>
        </div>
      </SectionCard>

      {/* ── Steam ── */}
      <SectionCard title="Steam System" icon="♨️">
        <Field label="Number of Steam Headers Available to EG Section" required>
          <Input type="number" value={data.numSteamHeaders} onChange={handleNumSteamHeaders} />
        </Field>
        {data.steamHeaders.map((sh, i) => (
          <div key={i} className="grid grid-cols-2 gap-4 p-4 bg-background border border-border rounded-lg">
            <p className="col-span-2 text-xs font-semibold text-text-secondary uppercase">Steam Header {i + 1}</p>
            <Field label="Label" required>
              <Input value={sh.headerLabel} onChange={(v) =>
                set('steamHeaders', data.steamHeaders.map((x, j) => j === i ? { ...x, headerLabel: v } : x))} />
            </Field>
            <Field label="Is Superheated?" required>
              <RadioGroup value={sh.isSuperheated} options={['Yes', 'No']} onChange={(v) =>
                set('steamHeaders', data.steamHeaders.map((x, j) => j === i ? { ...x, isSuperheated: v as 'Yes' | 'No' } : x))} />
            </Field>
          </div>
        ))}
      </SectionCard>

      {/* ── Equipment Selection ── */}
      <SectionCard title="Equipment Selection" icon="⚙️">
        <Field label="Is Glycol Feed Stripper (GFS) present?" required>
          <YesNo value={data.eq_hasGFS} onChange={(v) => set('eq_hasGFS', v)} />
        </Field>
        {hasGFS && (
          <Field label="Reabsorber & GFS Arrangement" required>
            <RadioGroup value={data.eq_gfsArrangement}
              options={['Separate Columns', 'Integrated Single Column']}
              onChange={(v) => set('eq_gfsArrangement', v)} />
          </Field>
        )}
      </SectionCard>

      {/* ── Stripping Column ── */}
      <SectionCard title="Stripping Column" icon="🔽">
        <Field label="Column Type" required>
          <RadioGroup value={data.sc_columnType} options={['Packed', 'Tray']} onChange={(v) => set('sc_columnType', v)} />
        </Field>
        <Field label="Is Reboiler Present?" required>
          <YesNo value={data.sc_hasReboiler} onChange={(v) => set('sc_hasReboiler', v)} />
        </Field>
        {data.sc_hasReboiler === 'yes' && (<>
          <Field label="Fresh steam consumption for Reboiler?" required>
            <YesNo value={data.sc_reboilerFreshSteam} onChange={(v) => set('sc_reboilerFreshSteam', v)} />
          </Field>
          <Field label="Reboiler Heating Medium" required>
            <Select value={data.sc_reboilerMedium} onChange={(v) => set('sc_reboilerMedium', v)}
              options={steamHeaderOptions.length ? steamHeaderOptions : ['LP Steam', 'MP Steam', 'Hot Water', 'Other']} />
          </Field>
        </>)}
        <Field label="Is Direct Steam Injected into Column?" required>
          <YesNo value={data.sc_hasDirectSteam} onChange={(v) => set('sc_hasDirectSteam', v)} />
        </Field>
        {data.sc_hasDirectSteam === 'yes' && (<>
          <Field label="Fresh steam consumption for Direct Steam?" required>
            <YesNo value={data.sc_directSteamFreshSteam} onChange={(v) => set('sc_directSteamFreshSteam', v)} />
          </Field>
          <Field label="Number of Direct Steam Inputs" required>
            <Input type="number" value={data.sc_numDirectSteam} onChange={handleScNumDirect} />
          </Field>
          {data.sc_directSteamInputs.map((dsi, i) => (
            <div key={i} className="p-4 bg-background border border-border rounded-lg grid grid-cols-2 gap-4">
              <p className="col-span-2 text-xs font-semibold text-text-secondary uppercase">Direct Steam Input {i + 1}</p>
              <Field label="Fresh steam?" required>
                <YesNo value={dsi.freshSteam} onChange={(v) =>
                  set('sc_directSteamInputs', data.sc_directSteamInputs.map((x, j) => j === i ? { ...x, freshSteam: v } : x))} />
              </Field>
              <Field label="Heating Media" required>
                <Select value={dsi.mediaSource}
                  options={steamHeaderOptions.length ? [...steamHeaderOptions, 'Other'] : ['LP Steam', 'MP Steam', 'Other']}
                  onChange={(v) => set('sc_directSteamInputs', data.sc_directSteamInputs.map((x, j) => j === i ? { ...x, mediaSource: v } : x))} />
              </Field>
              {dsi.mediaSource === 'Other' && (
                <div className="col-span-2">
                  <Field label="Other Steam Label" required>
                    <Input value={dsi.otherLabel ?? ''} onChange={(v) =>
                      set('sc_directSteamInputs', data.sc_directSteamInputs.map((x, j) => j === i ? { ...x, otherLabel: v } : x))} />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </>)}
        <Field label="Does part of bottom go to cycle water treating unit as bleed?" required>
          <YesNo value={data.sc_hasBottomBleed} onChange={(v) => set('sc_hasBottomBleed', v)} />
        </Field>
      </SectionCard>

      {/* ── Reabsorber (only when not integrated) ── */}
      {!isIntegrated && (
        <SectionCard title="Reabsorber" icon="🔄">
          <Field label="Column Type" required>
            <RadioGroup value={data.ra_columnType} options={['Packed', 'Tray']} onChange={(v) => set('ra_columnType', v)} />
          </Field>
          <Field label="Absorption Medium" required>
            <Select value={data.ra_absorptionMedium} onChange={(v) => set('ra_absorptionMedium', v)}
              options={['Process Water', 'Lean Glycol Water', 'Recycle water', 'Other']} />
          </Field>
          {data.ra_absorptionMedium === 'Other' && (
            <Field label="Specify Other Absorption Medium" required>
              <Input value={data.ra_absorptionMediumOther} onChange={(v) => set('ra_absorptionMediumOther', v)} />
            </Field>
          )}
          <Field label="Is Intercooler Present?" required>
            <YesNo value={data.ra_hasIntercooler} onChange={(v) => set('ra_hasIntercooler', v)} />
          </Field>
          {data.ra_hasIntercooler === 'yes' && (<>
            <Field label="Intercooler Cooling Medium" required>
              <Select value={data.ra_intercoolerMedium} onChange={(v) => set('ra_intercoolerMedium', v)}
                options={['Cooling Water', 'Tempered Water', 'Other']} />
            </Field>
            {data.ra_intercoolerMedium === 'Other' && (
              <Field label="Specify Other Cooling Medium" required>
                <Input value={data.ra_intercoolerMediumOther} onChange={(v) => set('ra_intercoolerMediumOther', v)} />
              </Field>
            )}
          </>)}
          <Field label="Is Aftercooler Present?" required>
            <YesNo value={data.ra_hasAftercooler} onChange={(v) => set('ra_hasAftercooler', v)} />
          </Field>
          {data.ra_hasAftercooler === 'yes' && (<>
            <Field label="Fresh steam consumption for Aftercooler?" required>
              <YesNo value={data.ra_aftercoolerFreshSteam} onChange={(v) => set('ra_aftercoolerFreshSteam', v)} />
            </Field>
            <Field label="Aftercooler Hot-Side Source" required>
              <Select value={data.ra_aftercoolerSource} onChange={(v) => set('ra_aftercoolerSource', v)}
                options={['Reactor Effluent', 'Steam', 'Condensate', 'Other']} />
            </Field>
            {data.ra_aftercoolerSource === 'Other' && (
              <Field label="Specify Other Hot-Side Source" required>
                <Input value={data.ra_aftercoolerSourceOther} onChange={(v) => set('ra_aftercoolerSourceOther', v)} />
              </Field>
            )}
          </>)}
        </SectionCard>
      )}

      {/* ── GFS (separate columns) ── */}
      {hasGFS && !isIntegrated && (
        <SectionCard title="Glycol Feed Stripper (GFS)" icon="⬆️">
          <Field label="Column Type" required><RadioGroup value={data.gfs_columnType} options={['Packed', 'Tray']} onChange={(v) => set('gfs_columnType', v)} /></Field>
          <Field label="Is Reboiler Present?" required><YesNo value={data.gfs_hasReboiler} onChange={(v) => set('gfs_hasReboiler', v)} /></Field>
          {data.gfs_hasReboiler === 'yes' && (<>
            <Field label="Fresh steam for Reboiler?" required><YesNo value={data.gfs_reboilerFreshSteam} onChange={(v) => set('gfs_reboilerFreshSteam', v)} /></Field>
            <Field label="Reboiler Heating Medium" required>
              <Select value={data.gfs_reboilerMedium} onChange={(v) => set('gfs_reboilerMedium', v)}
                options={steamHeaderOptions.length ? steamHeaderOptions : ['LP Steam', 'MP Steam', 'Reactor Effluent', 'Other']} />
            </Field>
          </>)}
          <Field label="Is Direct Steam Injected?" required><YesNo value={data.gfs_hasDirectSteam} onChange={(v) => set('gfs_hasDirectSteam', v)} /></Field>
          {data.gfs_hasDirectSteam === 'yes' && (<>
            <Field label="Fresh steam for Direct Steam?" required><YesNo value={data.gfs_directSteamFreshSteam} onChange={(v) => set('gfs_directSteamFreshSteam', v)} /></Field>
            <Field label="Number of Direct Steam Inputs" required><Input type="number" value={data.gfs_numDirectSteam} onChange={handleGfsNumDirect} /></Field>
            {data.gfs_directSteamInputs.map((dsi, i) => (
              <div key={i} className="p-4 bg-background border border-border rounded-lg grid grid-cols-2 gap-4">
                <p className="col-span-2 text-xs font-semibold text-text-secondary uppercase">Direct Steam Input {i + 1}</p>
                <Field label="Fresh steam?" required><YesNo value={dsi.freshSteam} onChange={(v) => set('gfs_directSteamInputs', data.gfs_directSteamInputs.map((x, j) => j === i ? { ...x, freshSteam: v } : x))} /></Field>
                <Field label="Heating Media" required>
                  <Select value={dsi.mediaSource} options={steamHeaderOptions.length ? [...steamHeaderOptions, 'Other'] : ['LP Steam', 'Other']}
                    onChange={(v) => set('gfs_directSteamInputs', data.gfs_directSteamInputs.map((x, j) => j === i ? { ...x, mediaSource: v } : x))} />
                </Field>
              </div>
            ))}
          </>)}
          <Field label="Purpose of Stripping" required>
            <Select value={data.gfs_strippingPurpose} onChange={(v) => set('gfs_strippingPurpose', v)} options={['CO₂ Removal', 'Dissolved Gas Removal', 'Both']} />
          </Field>
          <Field label="Overhead Vent Destination" required>
            <Select value={data.gfs_overheadVent} onChange={(v) => set('gfs_overheadVent', v)} options={['Atmosphere', 'Flare', 'Recycle to reabsorber']} />
          </Field>
        </SectionCard>
      )}

      {/* ── Integrated Column ── */}
      {isIntegrated && (
        <SectionCard title="Integrated Reabsorber & GFS" icon="🔁">
          <Field label="Column Type" required><RadioGroup value={data.int_columnType} options={['Packed', 'Tray']} onChange={(v) => set('int_columnType', v)} /></Field>
          <Field label="Absorption Medium" required>
            <Select value={data.int_absorptionMedium} onChange={(v) => set('int_absorptionMedium', v)} options={['Process Water', 'Lean Glycol Water', 'Recycle water', 'Other']} />
          </Field>
          {data.int_absorptionMedium === 'Other' && <Field label="Specify Other" required><Input value={data.int_absorptionMediumOther} onChange={(v) => set('int_absorptionMediumOther', v)} /></Field>}
          <Field label="Stripping Purpose" required>
            <Select value={data.int_strippingPurpose} onChange={(v) => set('int_strippingPurpose', v)} options={['CO₂ Removal', 'Dissolved Gas Removal', 'Both']} />
          </Field>
          <Field label="Overhead Vent Destination" required>
            <Select value={data.int_overheadVent} onChange={(v) => set('int_overheadVent', v)} options={['Atmosphere', 'Flare', 'Recycle to reabsorber']} />
          </Field>
        </SectionCard>
      )}

      {/* ── Feed Preheat ── */}
      <SectionCard title="Feed Preheat Exchangers" icon="🔥">
        <Field label="Number of Feed Preheat Exchangers in Series" required>
          <Input type="number" value={data.fpe_numExchangers} onChange={handleFpeNum} />
        </Field>
        {data.fpe_exchangers.map((ex, i) => (
          <div key={i} className="p-4 bg-background border border-border rounded-lg grid grid-cols-2 gap-4">
            <p className="col-span-2 text-xs font-semibold text-text-secondary uppercase">Exchanger {i + 1}</p>
            <Field label="Fresh steam?" required><YesNo value={ex.freshSteam} onChange={(v) => set('fpe_exchangers', data.fpe_exchangers.map((x, j) => j === i ? { ...x, freshSteam: v } : x))} /></Field>
            <Field label="Heat Source" required>
              <Select value={ex.heatSource} options={['Reactor Effluent', 'LP Steam', 'MP Steam', 'Hot Water', 'Other']}
                onChange={(v) => set('fpe_exchangers', data.fpe_exchangers.map((x, j) => j === i ? { ...x, heatSource: v } : x))} />
            </Field>
            {ex.heatSource === 'Other' && (
              <div className="col-span-2"><Field label="Specify Other" required><Input value={ex.heatSourceOther ?? ''} onChange={(v) => set('fpe_exchangers', data.fpe_exchangers.map((x, j) => j === i ? { ...x, heatSourceOther: v } : x))} /></Field></div>
            )}
            <div className="col-span-2">
              <Field label="Exchanger Type" required>
                <Select value={ex.exchangerType} options={['Shell & Tube', 'Plate', 'Plate-fin']}
                  onChange={(v) => set('fpe_exchangers', data.fpe_exchangers.map((x, j) => j === i ? { ...x, exchangerType: v } : x))} />
              </Field>
            </div>
          </div>
        ))}
      </SectionCard>

      {/* ── Reactor ── */}
      <SectionCard title="Glycol Reactor" icon="⚗️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Reactor Type" required>
            <Select value={data.gr_reactorType} onChange={(v) => set('gr_reactorType', v)} options={['Adiabatic Tubular', 'Isothermal Tubular', 'CSTR']} />
          </Field>
          <Field label="Number of Reactors" required>
            <Input type="number" value={data.gr_numReactors} onChange={(v) => set('gr_numReactors', v)} />
          </Field>
        </div>
        <Field label="Is Reactor Exotherm Heat Recovered?" required>
          <YesNo value={data.gr_heatRecovered} onChange={(v) => set('gr_heatRecovered', v)} />
        </Field>
        {data.gr_heatRecovered === 'yes' && (
          <Field label="Heat Recovery Sink(s)">
            <div className="flex flex-wrap gap-2">
              {['Feed Preheat', 'Steam Generation', 'Evaporator', 'Hot Water Loop'].map((opt) => {
                const selected = data.gr_heatRecoverySinks.includes(opt);
                return (
                  <button key={opt} type="button"
                    onClick={() => set('gr_heatRecoverySinks', selected ? data.gr_heatRecoverySinks.filter((x) => x !== opt) : [...data.gr_heatRecoverySinks, opt])}
                    className={cn('px-3 py-1.5 rounded-lg border text-sm transition-all',
                      selected ? 'bg-accent-blue/10 border-accent-blue text-accent-blue' : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
                    )}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field label="Number of Inter-stage Coolers">
          <Input type="number" value={data.gr_numInterstage} onChange={(v) => set('gr_numInterstage', v)} placeholder="0 if single reactor" />
        </Field>
      </SectionCard>

      {/* ── Evaporation ── */}
      <SectionCard title="Evaporation System" icon="💨">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Number of Evaporator Effects" required>
            <Input type="number" value={data.ev_numEffects} onChange={(v) => set('ev_numEffects', v)} placeholder="Typical: 3–6" />
          </Field>
          <Field label="Flow Arrangement" required>
            <Select value={data.ev_flowArrangement} onChange={(v) => set('ev_flowArrangement', v)} options={['Forward-feed', 'Backward-feed', 'Mixed-feed']} />
          </Field>
        </div>
        <Field label="Fresh steam for 1st Effect?" required>
          <YesNo value={data.ev_firstEffectFreshSteam} onChange={(v) => set('ev_firstEffectFreshSteam', v)} />
        </Field>
        <Field label="Energy Source for 1st Effect" required>
          <Select value={data.ev_firstEffectSource} onChange={(v) => set('ev_firstEffectSource', v)}
            options={['HP Steam', 'MP Steam', 'LP Steam', 'Reactor Effluent Heat', 'Other']} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Field label="MVR Used?" required><YesNo value={data.ev_hasMVR} onChange={(v) => set('ev_hasMVR', v)} /></Field>
            {data.ev_hasMVR === 'yes' && <div className="mt-3"><Field label="MVR on Which Effect?"><Input type="number" value={data.ev_mvrEffect} onChange={(v) => set('ev_mvrEffect', v)} /></Field></div>}
          </div>
          <div>
            <Field label="TVR Used?" required><YesNo value={data.ev_hasTVR} onChange={(v) => set('ev_hasTVR', v)} /></Field>
            {data.ev_hasTVR === 'yes' && <div className="mt-3"><Field label="TVR on Which Effect?"><Input type="number" value={data.ev_tvrEffect} onChange={(v) => set('ev_tvrEffect', v)} /></Field></div>}
          </div>
        </div>
        <Field label="Condensate Flash Recovery Between Effects?" required>
          <YesNo value={data.ev_condensateFlash} onChange={(v) => set('ev_condensateFlash', v)} />
        </Field>
      </SectionCard>

      {/* ── Other Equipment ── */}
      <SectionCard title="Other Energy Sensitive Equipment" icon="⚡">
        <Field label="Is there any other energy sensitive equipment?" required>
          <YesNo value={data.oe_hasOther} onChange={(v) => set('oe_hasOther', v)} />
        </Field>
        {data.oe_hasOther === 'yes' && (<>
          <Field label="Number of Equipment" required>
            <Input type="number" value={data.oe_numEquipment} onChange={handleOeNum} />
          </Field>
          {data.oe_equipment.map((eq, i) => (
            <div key={i} className="p-4 bg-background border border-border rounded-lg grid grid-cols-2 gap-4">
              <p className="col-span-2 text-xs font-semibold text-text-secondary uppercase">Equipment {i + 1}</p>
              <div className="col-span-2"><Field label="Name / Description" required><Input value={eq.oe_name} onChange={(v) => set('oe_equipment', data.oe_equipment.map((x, j) => j === i ? { ...x, oe_name: v } : x))} /></Field></div>
              <Field label="Type" required>
                <Select value={eq.oe_type} options={['Exchanger', 'Pump', 'Compressor', 'Ejector', 'Heater', 'Other']}
                  onChange={(v) => set('oe_equipment', data.oe_equipment.map((x, j) => j === i ? { ...x, oe_type: v } : x))} />
              </Field>
              <Field label="Fresh steam?" required>
                <YesNo value={eq.oe_freshSteam} onChange={(v) => set('oe_equipment', data.oe_equipment.map((x, j) => j === i ? { ...x, oe_freshSteam: v } : x))} />
              </Field>
              <div className="col-span-2">
                <Field label="Heat Source" required>
                  <Select value={eq.oe_heatSource}
                    options={steamHeaderOptions.length ? [...steamHeaderOptions, 'Other'] : ['LP Steam', 'MP Steam', 'Hot Water', 'Other']}
                    onChange={(v) => set('oe_equipment', data.oe_equipment.map((x, j) => j === i ? { ...x, oe_heatSource: v } : x))} />
                </Field>
                {eq.oe_heatSource === 'Other' && (
                  <div className="mt-3"><Field label="Specify Other" required><Input value={eq.oe_heatSourceOther ?? ''} onChange={(v) => set('oe_equipment', data.oe_equipment.map((x, j) => j === i ? { ...x, oe_heatSourceOther: v } : x))} /></Field></div>
                )}
              </div>
            </div>
          ))}
        </>)}
      </SectionCard>

      {/* Error */}
      {error && (
        <div className="p-4 bg-accent-red/10 border border-accent-red rounded-lg text-sm text-accent-red">
          {error}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex justify-end pt-2 pb-8">
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
