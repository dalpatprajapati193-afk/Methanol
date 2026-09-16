'use client';

import { useAtom } from 'jotai';
import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSoftSensors, saveForecastConfig, type SoftSensor } from '../../actions/Actions';
import { step4Atom, type ForecastState } from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition w-full"
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <h3 className="text-base font-semibold text-text-primary mb-4 pb-2 border-b border-border">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Soft sensor card
// ---------------------------------------------------------------------------

function SoftSensorCard({
  sensor,
  entry,
  onChange,
}: {
  sensor: SoftSensor;
  entry: { has_pi_tag: boolean; pi_tag: string; uom: string; x_variables: Record<string, { tag: string; uom: string }> };
  onChange: (e: { has_pi_tag: boolean; pi_tag: string; uom: string; x_variables: Record<string, { tag: string; uom: string }> }) => void;
}) {
  return (
    <div className="space-y-3 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-sm font-semibold text-text-primary">{sensor.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">Has PI tag for this KPI?</span>
          <div className="flex gap-2">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => onChange({ ...entry, has_pi_tag: val })}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  entry.has_pi_tag === val
                    ? val
                      ? 'bg-accent-green/10 border-accent-green text-accent-green'
                      : 'bg-accent-red/10 border-accent-red text-accent-red'
                    : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
                )}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {entry.has_pi_tag && (
        <div className="ml-4 flex gap-3">
          <div className="flex-1">
            <Input
              value={entry.pi_tag}
              onChange={(v) => onChange({ ...entry, pi_tag: v })}
              placeholder={`PI tag for ${sensor.name}`}
            />
          </div>
          <div className="w-28">
            <Input
              value={entry.uom}
              onChange={(v) => onChange({ ...entry, uom: v })}
              placeholder="UOM"
            />
          </div>
        </div>
      )}

      {!entry.has_pi_tag && (
        <div className="ml-4 space-y-2">
          <p className="text-xs text-text-secondary">Map X-variable inputs for the soft sensor model:</p>
          {sensor.x_variables.map((xvar) => (
            <div key={xvar} className="flex items-center gap-3">
              <span className="text-xs font-mono text-text-secondary w-64 shrink-0">{xvar}</span>
              <div className="flex-1">
                <Input
                  value={entry.x_variables[xvar]?.tag ?? ''}
                  onChange={(v) =>
                    onChange({
                      ...entry,
                      x_variables: { ...entry.x_variables, [xvar]: { tag: v, uom: entry.x_variables[xvar]?.uom ?? '' } },
                    })
                  }
                  placeholder={`PI tag for ${xvar}`}
                />
              </div>
              <div className="w-24">
                <Input
                  value={entry.x_variables[xvar]?.uom ?? ''}
                  onChange={(v) =>
                    onChange({
                      ...entry,
                      x_variables: { ...entry.x_variables, [xvar]: { tag: entry.x_variables[xvar]?.tag ?? '', uom: v } },
                    })
                  }
                  placeholder="UOM"
                />
              </div>
            </div>
          ))}
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

export default function Step4Forecasting({ instanceId, onNext, onBack }: Props) {
  const [forecastState, setForecastState] = useAtom(step4Atom);
  const [sensors, setSensors] = useState<SoftSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillDone, setFillDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getSoftSensors();
      if (res.success && res.data) {
        setSensors(res.data);
        // Initialise missing sensors
        setForecastState((prev) => {
          const next = { ...prev };
          for (const s of res.data!) {
            if (!next[s.id]) {
              const xvars: Record<string, { tag: string; uom: string }> = {};
              for (const xv of s.x_variables) xvars[xv] = { tag: '', uom: '' };
              next[s.id] = { has_pi_tag: false, pi_tag: '', uom: '', x_variables: xvars };
            }
          }
          return next;
        });
      } else {
        setError(res.error ?? 'Failed to load soft sensors');
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((sensorId: string, entry: { has_pi_tag: boolean; pi_tag: string; uom: string; x_variables: Record<string, { tag: string; uom: string }> }) => {
    setForecastState((prev) => ({ ...prev, [sensorId]: entry }));
  }, [setForecastState]);

  function handleFillSample() {
    const filled: ForecastState = {};
    for (const s of sensors) {
      const xvars: Record<string, { tag: string; uom: string }> = {};
      for (const xv of s.x_variables) {
        xvars[xv] = { tag: `YANSAB.SS.${s.id.toUpperCase()}.${xv.toUpperCase()}.PV`, uom: '' };
      }
      filled[s.id] = { has_pi_tag: false, pi_tag: '', uom: '', x_variables: xvars };
    }
    setForecastState(filled);
    setFillDone(true);
    setTimeout(() => setFillDone(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveForecastConfig(instanceId, forecastState);
    setSaving(false);
    if (res.success) {
      onNext();
    } else {
      setError(res.error ?? 'Save failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading soft sensors…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Step 4 — Forecasting</h2>
          <p className="text-sm text-text-secondary mt-1">Configure soft sensor inputs for model-based KPI forecasting.</p>
        </div>
        <button
          type="button"
          onClick={handleFillSample}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition"
        >
          {fillDone ? '✓ Filled!' : '✨ Fill Sample Data'}
        </button>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red rounded-lg p-3 text-sm">{error}</div>
      )}

      <SectionCard title="Soft Sensor Configuration">
        {sensors.map((sensor) => {
          const entry = forecastState[sensor.id] ?? {
            has_pi_tag: false,
            pi_tag: '',
            uom: '',
            x_variables: Object.fromEntries(sensor.x_variables.map((xv) => [xv, { tag: '', uom: '' }])),
          };
          return (
            <SoftSensorCard
              key={sensor.id}
              sensor={sensor}
              entry={entry}
              onChange={(e) => handleChange(sensor.id, e)}
            />
          );
        })}
      </SectionCard>

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
