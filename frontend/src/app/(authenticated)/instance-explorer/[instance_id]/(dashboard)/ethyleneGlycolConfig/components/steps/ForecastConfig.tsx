"use client";

import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { configDataAtom, wizardDirtyAtom, modelFilesRegistryAtom, pklFilesAtom, uomBankAtom } from "../../store/WizardAtoms";
import type { ForecastConfig, TagEntry, ModelFileEntry } from "../../store/Types";
import TagArrayEditor from "./TagArrayEditor";

const AIML_PLATFORM_URL = "https://aiml-platform.ingenero360.ai";

// Recommended X variables shown before JSON upload (informational only).
// Actual X variables for PI tag mapping are read from uploaded JSON EFF_format.
const RECOMMENDED_X_VARS = [
  { name: "Reactor outlet average temperature", needs_model: true },
  { name: "Total EO/E", needs_model: false },
  { name: "Days Online", needs_model: false },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type EFFEntry = {
  tag_name_short: string;
  role: string;
  model_type?: string;
  child_model_name?: string;
  [key: string]: unknown;
};

// ── JSON parser for forecast_config_*.json ────────────────────────────────────
// Actual file shape:
//   model_info:          { model_name, target_column, algorithm, ... }
//   training_summary:    { features_used[], target_column, scaling_method, ... }
//   evaluation_metrics:  { r2_score, adjusted_r2, cv_r2, rmse, mae, feature_importance }
//   EFF_format:          [{ tag_name_short, role:"X"|"Y"|"id", model_type, ... }]

function parseForecastJson(json: Record<string, unknown>, filename: string): Partial<ForecastConfig> {
  // EFF_format key can be capitalised or lowercase
  const effRaw = (json["EFF_format"] ?? json["eff_format"]) as unknown[] | undefined;
  const modelInfo = (json.model_info ?? {}) as Record<string, unknown>;
  const trainSum = (json.training_summary ?? {}) as Record<string, unknown>;
  const evalMet = (json.evaluation_metrics ?? {}) as Record<string, unknown>;

  if (!effRaw && !modelInfo.model_name) {
    throw new Error(
      "Not a valid forecast config JSON — expected model_info and/or EFF_format."
    );
  }

  const metrics: Record<string, number> = {};
  const addM = (key: string, val: unknown) => {
    if (typeof val === "number") metrics[key] = val;
  };
  addM("r2_score", evalMet.r2_score);
  addM("adjusted_r2", evalMet.adjusted_r2);
  addM("cv_r2", evalMet.cv_r2);
  addM("rmse", evalMet.rmse);
  addM("mae", evalMet.mae);

  // Build mappings from EFF_format X entries.
  // "use current value" → auto_resolved (computed by KPI engine, no PI tag needed).
  const xEntries = Array.isArray(effRaw)
    ? (effRaw as EFFEntry[]).filter((e) => e.role === "X")
    : [];
  const existingMappings = (json.mappings as ForecastConfig["mappings"]) ?? {};
  const mappings: ForecastConfig["mappings"] = { ...existingMappings };
  for (const entry of xEntries) {
    if (isAutoResolved(entry)) {
      mappings[entry.tag_name_short] = { auto_resolved: true };
    } else if (!mappings[entry.tag_name_short]) {
      mappings[entry.tag_name_short] = { tags: [] };
    }
  }

  return {
    model_name: modelInfo.model_name as string | undefined,
    target_column:
      (modelInfo.target_column as string | undefined) ??
      (trainSum.target_column as string | undefined),
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    eff_format: effRaw ?? [],
    model_filename: filename,
    mappings,
  };
}

// "use current value" means the DM reads this from the KPI engine — no PI tag needed.
const AUTO_RESOLVED_MODEL_TYPES = new Set(["use current value"]);

function getXVariables(fc: ForecastConfig): EFFEntry[] {
  if (!Array.isArray(fc.eff_format)) return [];
  return (fc.eff_format as EFFEntry[]).filter((e) => e.role === "X");
}

function getYVariable(fc: ForecastConfig): EFFEntry | undefined {
  if (!Array.isArray(fc.eff_format)) return undefined;
  return (fc.eff_format as EFFEntry[]).find((e) => e.role === "Y");
}

function isAutoResolved(entry: EFFEntry): boolean {
  return AUTO_RESOLVED_MODEL_TYPES.has(entry.model_type ?? "");
}

// ── Model statistics card ─────────────────────────────────────────────────────

function ModelStatsCard({ fc }: { fc: ForecastConfig }) {
  const m = (fc.metrics ?? {}) as Record<string, number>;
  const xVars = getXVariables(fc);

  const stat = (label: string, val: number | undefined) =>
    val != null ? (
      <div key={label}>
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{val.toFixed(4)}</p>
      </div>
    ) : null;

  return (
    <div className="rounded-lg border border-border bg-surface-hover p-3 flex flex-col gap-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        Model Statistics
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {fc.model_name && (
          <div>
            <p className="text-xs text-text-secondary">Model Name</p>
            <p className="text-sm font-semibold text-text-primary">{fc.model_name}</p>
          </div>
        )}
        {fc.target_column && (
          <div>
            <p className="text-xs text-text-secondary">Target Variable</p>
            <p className="text-sm font-semibold text-text-primary">{fc.target_column}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-text-secondary">No. of X Variables</p>
          <p className="text-sm font-semibold text-text-primary">{xVars.length}</p>
        </div>
        {stat("R² Score", m.r2_score)}
        {stat("Adjusted R²", m.adjusted_r2)}
        {stat("CV R²", m.cv_r2)}
        {stat("RMSE", m.rmse)}
        {stat("MAE", m.mae)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ForecastConfigStep() {
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);

  const fc = configData.forecast_config;
  const hasJson = Array.isArray(fc.eff_format) && (fc.eff_format as EFFEntry[]).length > 0;
  const xEntries = getXVariables(fc);
  const yEntry = getYVariable(fc);

  function updateFc(patch: Partial<ForecastConfig>) {
    setConfigData((prev) => ({
      ...prev,
      forecast_config: { ...prev.forecast_config, ...patch },
    }));
    setDirty(true);
  }

  function updateMapping(tagShort: string, tags: TagEntry[], operation?: string) {
    const existing = fc.mappings?.[tagShort];
    const existingOp = existing && !("auto_resolved" in existing) ? existing.operation : undefined;
    updateFc({ mappings: { ...(fc.mappings ?? {}), [tagShort]: { tags, operation: operation ?? existingOp } } });
  }

  function updateYTag(tags: TagEntry[]) {
    updateFc({ y_tag: tags });
  }

  function clearModel() {
    setConfigData((prev) => ({ ...prev, forecast_config: { mappings: {} } }));
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Forecast Configuration</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure the forecasting model for plant operations.
        </p>
      </div>

      <ModelCard
        fc={fc}
        hasJson={hasJson}
        xEntries={xEntries}
        yEntry={yEntry}
        onUpdate={updateFc}
        onUpdateMapping={updateMapping}
        onUpdateYTag={updateYTag}
        onClear={clearModel}
      />
    </div>
  );
}

// ── Selectivity_S44 card ──────────────────────────────────────────────────────

function ModelCard({
  fc,
  hasJson,
  xEntries,
  yEntry,
  onUpdate,
  onUpdateMapping,
  onUpdateYTag,
  onClear,
}: {
  fc: ForecastConfig;
  hasJson: boolean;
  xEntries: EFFEntry[];
  yEntry?: EFFEntry;
  onUpdate: (patch: Partial<ForecastConfig>) => void;
  onUpdateMapping: (tagShort: string, tags: TagEntry[], operation?: string) => void;
  onUpdateYTag: (tags: TagEntry[]) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pklDragOver, setPklDragOver] = useState(false);
  const [subPklDragOver, setSubPklDragOver] = useState<Record<string, boolean>>({});
  const [pklFileError, setPklFileError] = useState<string | null>(null);
  const [subPklFileErrors, setSubPklFileErrors] = useState<Record<string, string>>({});
  const expectedPklName = hasJson ? `${yEntry?.tag_name_short ?? fc.target_column ?? "model"}.pkl` : null;
  const [modelFilesRegistry, setModelFilesRegistry] = useAtom(modelFilesRegistryAtom);
  const [, setPklFiles] = useAtom(pklFilesAtom);
  const uomBank = useAtomValue(uomBankAtom);

  function readJsonFile(file: File) {
    setFileError(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setFileError("Only .json files are accepted.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result)) as Record<string, unknown>;
        onUpdate(parseForecastJson(json, file.name));
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to parse the file.");
      }
    };
    reader.onerror = () => setFileError("Failed to read the file.");
    reader.readAsText(file);
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary">Selectivity_S44</span>
          <span className="rounded px-1.5 py-0.5 text-xs bg-surface-hover text-text-secondary border border-border">
            Reactor
          </span>
          <span className="rounded px-1.5 py-0.5 text-xs bg-surface-hover text-text-secondary border border-border">
            🔄 Retraining: offline
          </span>
        </div>
        <span
          className={[
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
            hasJson
              ? "bg-accent-green-light text-accent-green"
              : "bg-surface-hover text-text-secondary",
          ].join(" ")}
        >
          {hasJson ? "Configured" : "Not Configured"}
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Description + AI/ML link */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-xs text-text-secondary flex-1">
            Forecasting model for reactor selectivity (S44). Requires periodic offline retraining
            on the AI/ML Platform.
          </p>
          <a
            href={AIML_PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium text-accent-blue hover:opacity-70"
          >
            🧠 Go to AI/ML Platform ↗
          </a>
        </div>

        {/* Recommended X Variables — always shown */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Recommended X Variables
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RECOMMENDED_X_VARS.map((xv) => (
              <span
                key={xv.name}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-accent-yellow-light text-accent-yellow border border-accent-yellow"
              >
                {xv.name}
                {xv.needs_model && (
                  <span className="rounded px-1 text-[0.6rem] font-bold bg-accent-blue-light text-accent-blue border border-accent-blue ml-1">
                    needs model
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Upload JSON */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Upload Forecast Config JSON
          </p>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readJsonFile(file);
            }}
            className={[
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 cursor-pointer text-center transition-colors",
              dragOver
                ? "border-accent-blue bg-accent-blue-light"
                : "border-border bg-background hover:bg-surface-hover",
            ].join(" ")}
          >
            <span className="text-2xl">📎</span>
            <span className="text-sm text-text-primary">
              {fc.model_filename ?? "Drop forecast_config.json here or click to browse"}
            </span>
            <span className="text-xs text-text-secondary">
              Accepts .json only (forecast_config_*.json)
            </span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readJsonFile(file);
              }}
            />
          </label>
          {fileError && <p className="text-xs text-accent-red">{fileError}</p>}
        </div>

        {/* Model statistics — shown after upload */}
        {hasJson && <ModelStatsCard fc={fc} />}

        {/* Upload main model .pkl — shown only after JSON upload, validates filename */}
        {expectedPklName && (() => {
          const registryEntry = modelFilesRegistry.find(e => e.file_name === expectedPklName);
          const isUploaded = registryEntry?.state === "uploaded";
          function handleMainPkl(f: File) {
            if (f.name !== expectedPklName) {
              setPklFileError(`Expected "${expectedPklName}", got "${f.name}"`);
              return;
            }
            setPklFileError(null);
            const displayName = yEntry?.tag_name_short ?? fc.target_column ?? "model";
            const entry: ModelFileEntry = { model_alias: "DM", file_name: f.name, model_file_display_name: displayName, model_metadata: null, state: "new" };
            setModelFilesRegistry(prev => [...prev.filter(e => e.file_name !== f.name), entry]);
            setPklFiles(prev => ({ ...prev, [f.name]: f }));
            onUpdate({ pkl_filename: f.name });
          }
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Upload {expectedPklName}
                </p>
                {isUploaded && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green-light text-accent-green border border-accent-green">
                    ✓ Uploaded
                  </span>
                )}
              </div>
              <label
                onDragOver={(e) => { e.preventDefault(); setPklDragOver(true); }}
                onDragLeave={() => setPklDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setPklDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleMainPkl(f); }}
                className={[
                  "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 cursor-pointer text-center transition-colors",
                  pklDragOver ? "border-accent-blue bg-accent-blue-light" : "border-border bg-background hover:bg-surface-hover",
                ].join(" ")}
              >
                <span className="text-2xl">📎</span>
                <span className="text-sm text-text-primary">
                  {fc.pkl_filename ?? `Drop ${expectedPklName} here or click to browse`}
                </span>
                <span className="text-xs text-text-secondary">
                  {isUploaded ? "Drop to replace the existing file" : "Accepts .pkl only"}
                </span>
                <input type="file" accept=".pkl" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMainPkl(f); }} />
              </label>
              {pklFileError && <p className="text-xs text-accent-red">{pklFileError}</p>}
            </div>
          );
        })()}

        {/* Y variable PI tag input — from EFF_format role=Y, shown after upload */}
        {hasJson && yEntry && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Y Variable PI Tag Mapping
            </p>
            <div className="pl-3 border-l-2 border-border flex flex-col gap-1">
              <span className="text-xs font-medium text-text-primary">{yEntry.tag_name_short}</span>
              <TagArrayEditor
                label={yEntry.tag_name_short}
                tags={fc.y_tag ?? []}
                uomHint=""
                nameHint={yEntry.tag_name_short}
                uomList={uomBank}
                onChange={onUpdateYTag}
              />
            </div>
          </div>
        )}

        {/* X variable PI tag inputs — from EFF_format role=X, shown after upload */}
        {hasJson && xEntries.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              X Variable PI Tag Mapping
            </p>
            {xEntries.map((entry) => {
              const { tag_name_short } = entry;
              const auto = isAutoResolved(entry);
              const featureMapping = fc.mappings?.[tag_name_short];
              const nonAutoMapping = featureMapping && !("auto_resolved" in featureMapping) ? featureMapping : undefined;
              const tags = nonAutoMapping ? nonAutoMapping.tags : [];
              const currentOperation = nonAutoMapping?.operation;

              return (
                <div key={tag_name_short} className="pl-3 border-l-2 border-border flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">{tag_name_short}</span>
                    {auto && (
                      <span className="rounded px-1.5 py-0.5 text-xs bg-accent-green-light text-accent-green border border-accent-green">
                        ✓ Auto-resolved
                      </span>
                    )}
                  </div>
                  {!auto && (
                    <TagArrayEditor
                      label={tag_name_short}
                      tags={tags}
                      uomHint=""
                      nameHint={tag_name_short}
                      uomList={uomBank}
                      operation={currentOperation}
                      onOperationChange={(op) => onUpdateMapping(tag_name_short, tags, op)}
                      onChange={(newTags) => onUpdateMapping(tag_name_short, newTags)}
                    />
                  )}
                  {entry.child_model_name && (() => {
                    const subExpected = `${entry.child_model_name}.pkl`;
                    const subEntry = modelFilesRegistry.find(e => e.file_name === subExpected);
                    const subUploaded = subEntry?.state === "uploaded";
                    function handleSubPkl(file: File) {
                      if (file.name !== subExpected) {
                        setSubPklFileErrors(prev => ({ ...prev, [entry.child_model_name!]: `Expected "${subExpected}", got "${file.name}"` }));
                        return;
                      }
                      setSubPklFileErrors(prev => ({ ...prev, [entry.child_model_name!]: "" }));
                      const dmEntry: ModelFileEntry = { model_alias: "DM", file_name: file.name, model_file_display_name: entry.child_model_name!, model_metadata: null, state: "new" };
                      setModelFilesRegistry(prev => [...prev.filter(e => e.file_name !== file.name), dmEntry]);
                      setPklFiles(prev => ({ ...prev, [file.name]: file }));
                      onUpdate({ sub_model_pkls: { ...(fc.sub_model_pkls ?? {}), [entry.child_model_name!]: file.name } });
                    }
                    return (
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-text-secondary font-medium">Upload {entry.child_model_name} sub-model .pkl</p>
                          {subUploaded && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green-light text-accent-green border border-accent-green">
                              ✓ Uploaded
                            </span>
                          )}
                        </div>
                        <label
                          onDragOver={(e) => { e.preventDefault(); setSubPklDragOver(prev => ({ ...prev, [entry.child_model_name!]: true })); }}
                          onDragLeave={() => setSubPklDragOver(prev => ({ ...prev, [entry.child_model_name!]: false }))}
                          onDrop={(e) => { e.preventDefault(); setSubPklDragOver(prev => ({ ...prev, [entry.child_model_name!]: false })); const file = e.dataTransfer.files?.[0]; if (file) handleSubPkl(file); }}
                          className={[
                            "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 cursor-pointer text-center transition-colors",
                            subPklDragOver[entry.child_model_name]
                              ? "border-accent-blue bg-accent-blue-light"
                              : "border-border bg-background hover:bg-surface-hover",
                          ].join(" ")}
                        >
                          <span className="text-sm text-text-primary">
                            {fc.sub_model_pkls?.[entry.child_model_name] ?? `Drop ${subExpected} here or click to browse`}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {subUploaded ? "Drop to replace" : "Accepts .pkl only"}
                          </span>
                          <input type="file" accept=".pkl" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleSubPkl(file); }} />
                        </label>
                        {subPklFileErrors[entry.child_model_name] && (
                          <p className="text-xs text-accent-red">{subPklFileErrors[entry.child_model_name]}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* Clear */}
        {hasJson && (
          <button
            onClick={onClear}
            className="btn-secondary self-start text-xs text-accent-red"
          >
            Clear Configuration
          </button>
        )}
      </div>
    </div>
  );
}
