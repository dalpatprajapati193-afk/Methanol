'use client';

import { useAtom } from 'jotai';
import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getAdditionalInputs, saveInputMapping, type AdditionalInputDef } from '../../actions/Actions';
import { step3Atom, type AdditionalInputsState } from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Row for a sensor-type additional input (PI tag + UOM)
// ---------------------------------------------------------------------------

function SensorRow({
  def,
  tag,
  uom,
  onChange,
}: {
  def: AdditionalInputDef;
  tag: string;
  uom: string;
  onChange: (tag: string, uom: string) => void;
}) {
  const isMapped = tag.trim() !== '';
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{def.name}</span>
          {def.uom && (
            <span className="text-xs text-text-secondary px-1.5 py-0.5 bg-surface-hover rounded">
              {def.uom}
            </span>
          )}
        </div>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full',
          isMapped
            ? 'bg-accent-green/10 text-accent-green'
            : 'bg-surface-hover text-text-secondary'
        )}>
          {isMapped ? '✓ Mapped' : 'Not mapped'}
        </span>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            value={tag}
            onChange={(v) => onChange(v, uom)}
            placeholder={`PI tag (e.g. YANSAB.${def.attribute_name}.PV)`}
          />
        </div>
        <div className="w-28">
          <Input
            value={uom}
            onChange={(v) => onChange(tag, v)}
            placeholder={def.uom || 'UOM'}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row for a constant-type additional input (fixed numeric value)
// ---------------------------------------------------------------------------

function ConstantRow({
  def,
  value,
  onChange,
}: {
  def: AdditionalInputDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const isFilled = value.trim() !== '';
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{def.name}</span>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
            Design Constant
          </span>
          {def.uom && (
            <span className="text-xs text-text-secondary px-1.5 py-0.5 bg-surface-hover rounded">
              {def.uom}
            </span>
          )}
        </div>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full',
          isFilled
            ? 'bg-accent-green/10 text-accent-green'
            : 'bg-surface-hover text-text-secondary'
        )}>
          {isFilled ? '✓ Set' : 'Not set'}
        </span>
      </div>
      <div className="max-w-xs">
        <Input
          type="number"
          value={value}
          onChange={onChange}
          placeholder="Enter design value"
        />
      </div>
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

export default function Step3InputMapping({ instanceId, onNext, onBack }: Props) {
  const [mappingState, setMappingState] = useAtom(step3Atom);
  const [inputDefs, setInputDefs] = useState<AdditionalInputDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillDone, setFillDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getAdditionalInputs(instanceId);
      if (res.success && res.data) {
        setInputDefs(res.data);
        // Initialise missing entries so controlled inputs work
        setMappingState((prev) => {
          const next = { ...prev };
          for (const def of res.data!) {
            if (!next[def.id]) {
              if (def.type === 'constant') {
                next[def.id] = { type: 'fixed', tag: '', fixedValue: '', uom: def.uom };
              } else {
                next[def.id] = { type: 'not_set', tag: '', fixedValue: '', uom: def.uom };
              }
            }
          }
          return next;
        });
      } else {
        setError(res.error ?? 'Failed to load additional inputs');
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sensor row change handler
  const handleSensorChange = useCallback((id: string, tag: string, uom: string) => {
    setMappingState((prev) => ({
      ...prev,
      [id]: { type: tag.trim() ? 'sensor' : 'not_set', tag, fixedValue: '', uom },
    }));
  }, [setMappingState]);

  // Constant row change handler
  const handleConstantChange = useCallback((id: string, value: string, uom: string) => {
    setMappingState((prev) => ({
      ...prev,
      [id]: { type: 'fixed', tag: '', fixedValue: value, uom },
    }));
  }, [setMappingState]);

  function handleFillSample() {
    const filled: AdditionalInputsState = {};
    for (const def of inputDefs) {
      if (def.type === 'constant') {
        const defaults: Record<string, string> = {
          design_water_eo_ratio: '6.5',
          eo_feed_purity: '99.8',
          meg_product_concentration: '99.5',
        };
        filled[def.id] = { type: 'fixed', tag: '', fixedValue: defaults[def.id] ?? '100', uom: def.uom };
      } else {
        filled[def.id] = {
          type: 'sensor',
          tag: `YANSAB.${def.attribute_name}.PV`,
          fixedValue: '',
          uom: def.uom,
        };
      }
    }
    setMappingState(filled);
    setFillDone(true);
    setTimeout(() => setFillDone(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveInputMapping(instanceId, mappingState);
    setSaving(false);
    if (res.success) {
      onNext();
    } else {
      setError(res.error ?? 'Save failed');
    }
  }

  // Progress
  const sensors = inputDefs.filter((d) => d.type === 'sensor');
  const constants = inputDefs.filter((d) => d.type === 'constant');
  const mappedSensors = sensors.filter((d) => (mappingState[d.id]?.tag ?? '').trim() !== '').length;
  const mappedConstants = constants.filter((d) => (mappingState[d.id]?.fixedValue ?? '').trim() !== '').length;
  const totalItems = inputDefs.length;
  const mappedItems = mappedSensors + mappedConstants;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading additional inputs…</span>
        </div>
      </div>
    );
  }

  if (inputDefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-4">➕</div>
        <h2 className="text-xl font-bold text-text-primary">No additional inputs defined</h2>
        <p className="text-text-secondary mt-2">
          Additional PI tag inputs appear here once configured in the Excel sheet.
        </p>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onBack}
            className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition">
            ← Back
          </button>
          <button type="button" onClick={onNext}
            className="px-6 py-2.5 rounded-lg bg-accent-blue text-sm font-semibold text-white hover:opacity-90 transition">
            Skip → Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Step 3 — Additional Inputs</h2>
          <p className="text-sm text-text-secondary mt-1">
            Provide PI tags and design constants needed globally by the digital twin model.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFillSample}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition"
        >
          {fillDone ? '✓ Filled!' : '✨ Fill Sample Data'}
        </button>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-text-secondary">Inputs configured</span>
          <span className="font-semibold text-text-primary">{mappedItems} of {totalItems}</span>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div
            className="bg-accent-blue h-2 rounded-full transition-all"
            style={{ width: totalItems > 0 ? `${Math.round((mappedItems / totalItems) * 100)}%` : '0%' }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-text-secondary">
          <span>PI Tags: {mappedSensors}/{sensors.length}</span>
          <span>Design Constants: {mappedConstants}/{constants.length}</span>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* PI Tag Inputs */}
      {sensors.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold text-text-primary mb-1 pb-2 border-b border-border flex items-center gap-2">
            <span>📡 PI Tag Inputs</span>
            <span className="text-xs font-normal text-text-secondary">
              ({mappedSensors}/{sensors.length} mapped)
            </span>
          </h3>
          <p className="text-xs text-text-secondary mb-3">
            Global process measurements used across multiple KPI calculations.
          </p>
          {sensors.map((def) => (
            <SensorRow
              key={def.id}
              def={def}
              tag={mappingState[def.id]?.tag ?? ''}
              uom={mappingState[def.id]?.uom ?? def.uom}
              onChange={(tag, uom) => handleSensorChange(def.id, tag, uom)}
            />
          ))}
        </div>
      )}

      {/* Design Constants */}
      {constants.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold text-text-primary mb-1 pb-2 border-b border-border flex items-center gap-2">
            <span>🔧 Design Constants</span>
            <span className="text-xs font-normal text-text-secondary">
              ({mappedConstants}/{constants.length} set)
            </span>
          </h3>
          <p className="text-xs text-text-secondary mb-3">
            Fixed design values used by the model. Enter the nominal/design value for this plant.
          </p>
          {constants.map((def) => (
            <ConstantRow
              key={def.id}
              def={def}
              value={mappingState[def.id]?.fixedValue ?? ''}
              onChange={(value) => handleConstantChange(def.id, value, def.uom)}
            />
          ))}
        </div>
      )}

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
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition bg-accent-blue hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Continue →'}
        </button>
      </div>
    </div>
  );
}
