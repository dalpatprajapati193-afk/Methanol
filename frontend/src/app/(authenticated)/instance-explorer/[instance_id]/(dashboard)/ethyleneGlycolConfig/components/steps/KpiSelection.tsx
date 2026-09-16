"use client";

import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  configIdAtom,
  configDataAtom,
  kpiListAtom,
  wizardDirtyAtom,
  kpiMtimeAtom,
  expandedKpiIdAtom,
  currentStepAtom,
} from "../../store/WizardAtoms";
import { getOutputKpiList, getKpiTemplateMtime } from "../../actions/Actions";
import type { ExpandedKpi, OutputKpiMapping, SoftSensorMapping } from "../../store/Types";
import SoftSensorKpiRow from "./SoftSensorKpiRow";
import TagArrayEditor from "./TagArrayEditor";

type Tab = "steam" | "equipment" | "plant";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "steam",     label: "Steam System KPIs", emoji: "♨️" },
  { id: "equipment", label: "Equipment KPIs",     emoji: "⚙️" },
  { id: "plant",     label: "Plant KPIs",         emoji: "📊" },
];

function getKpiTab(section: string): Tab {
  if (section === "Steam System") return "steam";
  if (section === "Overall Plant") return "plant";
  return "equipment";
}

function isConfigured(mapping: OutputKpiMapping | undefined): boolean {
  if (!mapping) return false;
  if (mapping.input_type === "pi_tag_direct" || mapping.input_type === "has_pi_tag") return true;
  if (mapping.input_type === "no_pi_tag") return true;
  if (mapping.input_type === "soft_sensor") return true;
  if (mapping.input_type === "formula_mapped") return true;
  return false;
}

export default function KpiSelection() {
  const [configId] = useAtom(configIdAtom);
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [kpiList, setKpiList] = useAtom(kpiListAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);
  const [, setKpiMtime] = useAtom(kpiMtimeAtom);
  const mtimeRef = useRef(0);
  const configRef = useRef(configData);
  configRef.current = configData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("steam");

  // Edits write straight into configData; the wizard autosaves it to the draft.
  const mappings = configData.output_kpis;

  useEffect(() => {
    if (!configId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [list, mtimeRes] = await Promise.all([
          getOutputKpiList(configData),
          getKpiTemplateMtime(),
        ]);
        setKpiList(list);
        setKpiMtime(mtimeRes.mtime);
        mtimeRef.current = mtimeRes.mtime;
      } catch {
        setError("Failed to load KPI list from the server.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  // Poll the KPI template file mtime; refresh the KPI list when it changes
  // upstream (e.g. EgReactorKpis.xlsx edited) without a full page reload.
  useEffect(() => {
    if (!configId) return;
    const interval = setInterval(async () => {
      try {
        const { mtime } = await getKpiTemplateMtime();
        if (mtime && mtime !== mtimeRef.current) {
          mtimeRef.current = mtime;
          setKpiMtime(mtime);
          const list = await getOutputKpiList(configRef.current);
          setKpiList(list);
        }
      } catch {
        /* transient — ignore and retry next tick */
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  function updateMapping(kpiId: string, mapping: OutputKpiMapping) {
    setConfigData((prev) => ({
      ...prev,
      output_kpis: { ...prev.output_kpis, [kpiId]: mapping },
    }));
    setDirty(true);
  }

  function clearMapping(kpiId: string) {
    updateMapping(kpiId, { input_type: "not_configured" });
  }

  function updateSoftSensorMapping(kpiId: string, mapping: SoftSensorMapping) {
    setConfigData((prev) => ({
      ...prev,
      soft_sensor_mappings: { ...prev.soft_sensor_mappings, [kpiId]: mapping },
      output_kpis: { ...prev.output_kpis, [kpiId]: { input_type: "soft_sensor" } },
    }));
    setDirty(true);
  }

  // Tab progress counts
  const filterLower = filter.toLowerCase();

  function tabCounts(tabId: Tab) {
    const tabKpis = kpiList.filter((k) => k.kpi_type !== "soft_sensor" && getKpiTab(k.section) === tabId);
    const configured = tabKpis.filter((k) => isConfigured(mappings[k.id])).length;
    return { total: tabKpis.length, configured };
  }

  const tabKpis = kpiList
    .filter((k) => getKpiTab(k.section) === activeTab)
    .filter(
      (k) =>
        k.name.toLowerCase().includes(filterLower) ||
        k.section.toLowerCase().includes(filterLower)
    );

  const sections = Array.from(new Set(tabKpis.map((k) => k.section)));

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading KPI list…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">KPI Selection</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure each KPI — assign PI tags directly, or map formula variables below when no PI tag is available.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-accent-red-light border border-accent-red rounded-lg text-sm text-accent-red">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => {
          const { total, configured } = tabCounts(tab.id);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors",
                active
                  ? "bg-accent-blue text-white border-accent-blue"
                  : "bg-surface text-text-secondary border-border hover:bg-surface-hover",
              ].join(" ")}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {total > 0 && (
                <span
                  className={[
                    "text-xs px-1.5 py-0.5 rounded-full",
                    active
                      ? "bg-white text-accent-blue"
                      : configured === total
                      ? "bg-accent-green-light text-accent-green"
                      : "bg-surface-hover text-text-secondary",
                  ].join(" ")}
                >
                  {configured}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <input
        type="text"
        placeholder="Filter KPIs…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input-base max-w-xs text-sm"
      />

      {/* KPI list */}
      <div className="flex flex-col gap-6">
        {tabKpis.length === 0 && (
          <p className="text-sm text-text-secondary italic">
            No KPIs in this category
            {filter ? " matching your filter" : ""}.
          </p>
        )}

        {sections.map((sec) => {
          const secKpis = tabKpis.filter((k) => k.section === sec);
          if (secKpis.length === 0) return null;
          const secConfigured = secKpis.filter((k) => isConfigured(mappings[k.id])).length;
          return (
            <div key={sec}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{sec}</p>
                <span className="text-xs text-text-secondary">
                  {secConfigured}/{secKpis.length} configured
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {secKpis.map((kpi) =>
                  kpi.kpi_type === "soft_sensor" ? (
                    <SoftSensorKpiRow
                      key={kpi.id}
                      kpi={kpi}
                      mapping={configData.soft_sensor_mappings[kpi.id]}
                      onChange={(m) => updateSoftSensorMapping(kpi.id, m)}
                    />
                  ) : (
                    <KpiConfigRow
                      key={kpi.id}
                      kpi={kpi}
                      mapping={mappings[kpi.id]}
                      onUpdate={(m) => updateMapping(kpi.id, m)}
                      onClear={() => clearMapping(kpi.id)}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KpiConfigRow ──────────────────────────────────────────────────────────────

function KpiConfigRow({
  kpi,
  mapping,
  onUpdate,
  onClear,
}: {
  kpi: ExpandedKpi;
  mapping: OutputKpiMapping | undefined;
  onUpdate: (m: OutputKpiMapping) => void;
  onClear: () => void;
}) {
  const setExpandedKpiId = useSetAtom(expandedKpiIdAtom);
  const setCurrentStep = useSetAtom(currentStepAtom);

  function deriveHasPiTag(m: OutputKpiMapping | undefined): boolean | null {
    if (!m) return null;
    if (m.input_type === "pi_tag_direct" || m.input_type === "has_pi_tag") return true;
    if (m.input_type === "no_pi_tag" || m.input_type === "formula_mapped") return false;
    return null;
  }

  const [hasPiTag, setHasPiTag] = useState<boolean | null>(() => deriveHasPiTag(mapping));

  const configured = isConfigured(mapping);

  function selectYes() {
    setHasPiTag(true);
    onUpdate({
      input_type: "pi_tag_direct",
      tags: mapping?.input_type === "pi_tag_direct" ? (mapping.tags ?? []) : [{ tag: "", uom: kpi.uom, value_type: "real" }],
    });
  }

  function selectNo() {
    setHasPiTag(false);
    if (kpi.kpi_type === "formula") {
      // Preserve any existing variable mappings; set type to formula_mapped so
      // the KPI registers as "configured" once the user fills in variables.
      const existingVars = mapping?.input_type === "formula_mapped" ? (mapping.variables ?? {}) : {};
      onUpdate({ input_type: "formula_mapped", variables: existingVars });
    } else {
      onUpdate({ input_type: "no_pi_tag" });
    }
  }

  function handleClear() {
    setHasPiTag(null);
    onClear();
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header: name + UOM + configured badge */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{kpi.name}</p>
          {kpi.uom && <p className="text-xs text-text-secondary">{kpi.uom}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {kpi.kpi_type === "formula" && (
            <span className="text-xs bg-accent-blue-light text-accent-blue px-2 py-0.5 rounded">Formula</span>
          )}
          <span
            className={[
              "text-xs px-2 py-0.5 rounded",
              configured
                ? "bg-accent-green-light text-accent-green"
                : "bg-surface-hover text-text-secondary",
            ].join(" ")}
          >
            {configured ? "Configured" : "Not Configured"}
          </span>
        </div>
      </div>

      {/* Body: PI tag question + inline editor */}
      <div className="px-4 py-3 border-t border-border bg-background flex flex-col gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-text-secondary">PI tag available?</span>
          <div className="flex gap-4">
            {([true, false] as const).map((v) => (
              <label key={String(v)} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  className="accent-accent-blue"
                  checked={hasPiTag === v}
                  onChange={() => (v ? selectYes() : selectNo())}
                />
                {v ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {configured && (
            <button
              onClick={handleClear}
              className="ml-auto text-xs text-accent-red hover:opacity-70"
            >
              Clear
            </button>
          )}
        </div>

        {/* Yes branch: inline tag editor */}
        {hasPiTag === true && (
          <TagArrayEditor
            label="PI Tags"
            tags={mapping?.input_type === "pi_tag_direct" ? (mapping.tags ?? []) : []}
            uomHint={kpi.uom}
            onChange={(tags) => onUpdate({ input_type: "pi_tag_direct", tags })}
          />
        )}

        {/* No branch — sensor KPI: just mark as no_pi_tag (handled by data team) */}
        {hasPiTag === false && kpi.kpi_type !== "formula" && (
          <p className="text-xs text-text-secondary bg-surface border border-border rounded px-3 py-2">
            ℹ️ This KPI will be flagged as <span className="font-medium text-text-primary">No PI Tag Available</span>.
            The data team will handle model development.
          </p>
        )}

        {/* No branch — formula KPI: redirect button to Step 3.1 */}
        {hasPiTag === false && kpi.kpi_type === "formula" && (
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={() => {
                setExpandedKpiId(kpi.id);
                setCurrentStep("inputKpi");
              }}
              className="btn-secondary self-start text-xs flex items-center gap-1.5"
            >
              <span>🔗</span> Configure KPI Inputs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


