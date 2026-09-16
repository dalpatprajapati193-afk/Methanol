'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { submitInstance, type InstanceContext } from '../../actions/Actions';
import { step1Atom, step2Atom, step3Atom, step4Atom } from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-4">
      <h3 className="text-base font-semibold text-text-primary mb-3 pb-2 border-b border-border">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value || '—'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible list
// ---------------------------------------------------------------------------

function CollapsibleList({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-accent-blue hover:underline"
      >
        {open ? '▼' : '▶'} {title} ({items.length})
      </button>
      {open && (
        <ul className="mt-2 ml-4 space-y-1">
          {items.map((item) => (
            <li key={item} className="text-xs text-text-secondary list-disc list-inside">{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  instanceId: string;
  initialContext: InstanceContext;
  onBack: () => void;
}

export default function Step5Review({ instanceId, initialContext, onBack }: Props) {
  const [step1] = useAtom(step1Atom);
  const [step2] = useAtom(step2Atom);
  const [step3] = useAtom(step3Atom);
  const [step4] = useAtom(step4Atom);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialContext.status === 'published');
  const [error, setError] = useState<string | null>(null);

  // Step 2 stats — keyed on input_type (the actual field in KpiSelectionEntry)
  const kpiIds = Object.keys(step2);
  const configuredKpis = kpiIds.filter((id) => step2[id]?.input_type !== undefined);
  const sensorKpis = kpiIds.filter((id) => step2[id]?.input_type === 'sensor');
  const formulaKpis = kpiIds.filter((id) => step2[id]?.input_type === 'formula_mapped');
  const softSensorKpis = kpiIds.filter((id) => step2[id]?.input_type === 'soft_sensor');
  const unconfiguredKpis = kpiIds.filter((id) => step2[id]?.input_type === undefined);

  // Step 3 stats
  const varIds = Object.keys(step3);
  const sensorVars = varIds.filter((id) => step3[id]?.type === 'sensor');
  const fixedVars = varIds.filter((id) => step3[id]?.type === 'fixed');
  const notSetVars = varIds.filter((id) => step3[id]?.type === 'not_set');

  // Step 4 stats
  const sensorIds = Object.keys(step4);
  const configuredSensors = sensorIds.filter((id) => step4[id]?.has_pi_tag || Object.values(step4[id]?.x_variables ?? {}).some((xv) => xv.tag));

  async function handleSubmit() {
    setSubmitting(true);
    const res = await submitInstance(instanceId);
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
    } else {
      setError(res.error ?? 'Submit failed');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Step 5 — Review &amp; Submit</h2>
          <p className="text-sm text-text-secondary mt-1">Review your configuration before submitting to the main product.</p>
        </div>
        {submitted && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
            ✓ Submitted
          </span>
        )}
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Plant summary */}
      <SummaryCard title="Plant Summary">
        <Row label="Configuration Name" value={step1.configName} />
        <Row label="Plant Capacity" value={step1.plantCapacity ? `${step1.plantCapacity} kt/yr` : ''} />
        <Row label="Commissioning Year" value={step1.commissioningYear} />
        <Row label="Technology Licensor" value={step1.techLicensor} />
        <Row label="Reactor Type" value={step1.gr_reactorType} />
        <Row label="No. of Steam Headers" value={step1.numSteamHeaders} />
        <Row label="No. of Evaporator Effects" value={step1.ev_numEffects} />
        <Row label="Water-to-EO Ratio" value={step1.waterToEORatio} />
      </SummaryCard>

      {/* KPI summary */}
      <SummaryCard title="KPI Summary">
        <Row label="Total KPIs" value={kpiIds.length} />
        <Row label="Configured" value={configuredKpis.length} />
        <Row label="  ↳ Has PI Tag" value={sensorKpis.length} />
        <Row label="  ↳ Formula Mapped" value={formulaKpis.length} />
        <Row label="  ↳ Soft Sensor" value={softSensorKpis.length} />
        <Row label="Not Yet Configured" value={unconfiguredKpis.length} />
        {sensorKpis.length > 0 && (
          <CollapsibleList title="PI Tag KPIs" items={sensorKpis} />
        )}
        {formulaKpis.length > 0 && (
          <CollapsibleList title="Formula Mapped KPIs" items={formulaKpis} />
        )}
        {softSensorKpis.length > 0 && (
          <CollapsibleList title="Soft Sensor KPIs" items={softSensorKpis} />
        )}
      </SummaryCard>

      {/* Input mapping summary */}
      <SummaryCard title="Input Mapping Summary">
        <Row label="Total Variables" value={varIds.length} />
        <Row label="Mapped to PI Tag" value={sensorVars.length} />
        <Row label="Fixed Value" value={fixedVars.length} />
        <Row label="Not Set" value={notSetVars.length} />
        {sensorVars.length > 0 && (
          <CollapsibleList title="PI Tag Variables" items={sensorVars} />
        )}
      </SummaryCard>

      {/* Soft sensor summary */}
      <SummaryCard title="Soft Sensor Summary">
        <Row label="Total Soft Sensors" value={sensorIds.length} />
        <Row label="Configured" value={configuredSensors.length} />
        {configuredSensors.length > 0 && (
          <CollapsibleList title="Configured Sensors" items={configuredSensors} />
        )}
      </SummaryCard>

      {/* Submit */}
      {!submitted ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-text-secondary mb-4">
            Once submitted, this configuration will be available in the main product for pipeline execution.
            You can always re-run the wizard to update it.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-3 rounded-xl bg-accent-blue text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : '🚀 Submit Configuration'}
          </button>
        </div>
      ) : (
        <div className="bg-accent-green/10 border border-accent-green rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">✓</div>
          <h3 className="text-lg font-bold text-accent-green">Configuration Submitted!</h3>
          <p className="text-sm text-text-secondary mt-1">
            This configuration has been submitted and is available in the main product.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-8">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition"
        >
          ← Back to Forecasting
        </button>
      </div>
    </div>
  );
}
