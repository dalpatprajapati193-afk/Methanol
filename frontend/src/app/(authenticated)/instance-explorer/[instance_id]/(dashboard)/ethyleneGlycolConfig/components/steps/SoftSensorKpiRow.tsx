"use client";

import { useSetAtom } from "jotai";
import { expandedKpiIdAtom, currentStepAtom } from "../../store/WizardAtoms";
import type { ExpandedKpi, SoftSensorMapping } from "../../store/Types";

export default function SoftSensorKpiRow({
  kpi,
  mapping,
  onChange,
}: {
  kpi: ExpandedKpi;
  mapping: SoftSensorMapping | undefined;
  onChange: (m: SoftSensorMapping) => void;
}) {
  const m: SoftSensorMapping = mapping ?? { has_pi_tag: false };
  const setExpandedKpiId = useSetAtom(expandedKpiIdAtom);
  const setCurrentStep = useSetAtom(currentStepAtom);

  const configured =
    !!mapping &&
    ((m.has_pi_tag && !!m.tags?.[0]?.tag) ||
      (!m.has_pi_tag && (!!m.model_info || Object.keys(m.x_variables ?? {}).length > 0)));

  function setHasPiTag(value: boolean) {
    onChange({ ...m, has_pi_tag: value });
  }

  function setOutputTag(tag: string) {
    onChange({ ...m, tags: [{ tag, uom: kpi.uom }] });
  }

  return (
    <div className="p-3 rounded-lg border border-border bg-surface flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-accent-blue-light text-accent-blue border border-accent-blue">
            Soft Sensor
          </span>
          <span className="text-sm text-text-primary truncate">{kpi.name}</span>
          {kpi.uom && <span className="text-xs text-text-secondary shrink-0">{kpi.uom}</span>}
        </div>
        <span
          className={[
            "shrink-0 rounded px-1.5 py-0.5 text-xs",
            configured
              ? "bg-accent-green-light text-accent-green"
              : "bg-surface-hover text-text-secondary",
          ].join(" ")}
        >
          {configured ? "Configured" : "Not Configured"}
        </span>
      </div>

      {/* PI tag available? */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">PI tag available?</span>
        {([
          ["yes", true],
          ["no", false],
        ] as const).map(([label, val]) => (
          <label key={label} className="flex items-center gap-1.5 cursor-pointer text-sm capitalize">
            <input
              type="radio"
              className="accent-accent-blue"
              checked={m.has_pi_tag === val}
              onChange={() => setHasPiTag(val)}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Yes → output PI tag */}
      {m.has_pi_tag && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Output PI Tag</label>
          <input
            type="text"
            className="input-base text-sm"
            placeholder="e.g. PLANT.SOFT_SENSOR.OUTPUT"
            value={m.tags?.[0]?.tag ?? ""}
            onChange={(e) => setOutputTag(e.target.value)}
          />
        </div>
      )}

      {/* No → recommended X vars + model upload + feature mapping */}
      {!m.has_pi_tag && (
        <div className="flex flex-col gap-3">
          {kpi.x_variables.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Recommended X Variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {kpi.x_variables.map((xv) => (
                  <span
                    key={xv}
                    className="rounded px-1.5 py-0.5 text-xs bg-accent-yellow-light text-accent-yellow border border-accent-yellow"
                  >
                    {xv}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap mt-1">
            <a
              href="https://aiml-platform.ingenero360.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-blue border border-accent-blue rounded px-3 py-1.5 hover:bg-accent-blue-light transition-colors decoration-none"
            >
              🧠 Go to AI/ML Platform
            </a>
            <button
              onClick={() => {
                setExpandedKpiId(kpi.id);
                setCurrentStep("inputKpi");
              }}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {m.model_info?.model_name ? (
                <span>📎 Model: {m.model_info.model_name} — Edit Mapping</span>
              ) : (
                <span>📎 Upload Model &amp; Configure</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
