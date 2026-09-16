"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { configDataAtom, kpiListAtom, wizardDirtyAtom, expandedKpiIdAtom, currentStepAtom, configIdAtom, modelFilesRegistryAtom, pklFilesAtom, uomBankAtom } from "../../store/WizardAtoms";
import { useDraftAutosave } from "../../hooks/UseDraftAutosave";
import type { ExpandedKpi, OutputKpiMapping, TagEntry, SoftSensorMapping, SoftSensorModelInfo, ModelFileEntry } from "../../store/Types";
import TagArrayEditor from "./TagArrayEditor";

const BLANK_TAG: TagEntry = { tag: "", uom: "", value_type: "real" };

function buildVariableBank(
  outputKpis: Record<string, OutputKpiMapping>,
  excludeKpiId: string
): Record<string, { tags: TagEntry[]; uom: string }> {
  const bank: Record<string, { tags: TagEntry[]; uom: string }> = {};
  for (const [kpiId, m] of Object.entries(outputKpis)) {
    if (kpiId === excludeKpiId) continue;
    if (m.input_type !== "formula_mapped" || !m.variables) continue;
    for (const [varName, varData] of Object.entries(m.variables)) {
      if (bank[varName]) continue;
      if (varData.tags?.some((t) => t.tag.trim())) {
        bank[varName] = varData;
      }
    }
  }
  return bank;
}

function parseModelInfo(json: Record<string, unknown>): SoftSensorModelInfo {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  const feature_names =
    arr(json.feature_names) ?? arr(json.feature_columns) ?? arr(json.features) ?? [];
  return {
    model_name: (json.model_name as string) ?? (json.name as string) ?? "model",
    target_column: json.target_column as string | undefined,
    model_location: json.model_location as string | undefined,
    scaling_method: json.scaling_method as string | undefined,
    feature_names,
    impute_values: json.impute_values as Record<string, unknown> | undefined,
    metrics: json.metrics as Record<string, unknown> | undefined,
    training_metadata: json.training_metadata as Record<string, unknown> | undefined,
  };
}

function readSoftSensorModelFile(
  file: File,
  onSuccess: (info: SoftSensorModelInfo, filename: string) => void,
  onError: (msg: string) => void
) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result)) as Record<string, unknown>;
      onSuccess(parseModelInfo(json), file.name);
    } catch {
      onError("Could not parse the file — expected valid JSON (e.g. pipeline_info.json).");
    }
  };
  reader.onerror = () => onError("Failed to read the file.");
  reader.readAsText(file);
}

export default function InputMapping() {
  const [configId] = useAtom(configIdAtom);
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [kpiList] = useAtom(kpiListAtom);
  const [, setDirty] = useAtom(wizardDirtyAtom);
  const [targetExpandedKpiId, setTargetExpandedKpiId] = useAtom(expandedKpiIdAtom);
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(targetExpandedKpiId);
  const [focusedKpiId] = useState<string | null>(targetExpandedKpiId);
  const setCurrentStep = useSetAtom(currentStepAtom);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { flush } = useDraftAutosave(configId);

  useEffect(() => {
    if (targetExpandedKpiId) {
      setTargetExpandedKpiId(null);
    }
  }, [targetExpandedKpiId, setTargetExpandedKpiId]);

  // Only show KPIs that are selected (not skipped, not absent)
  const selectedKpis = kpiList.filter((kpi) => {
    const m = configData.output_kpis[kpi.id];
    return !m || m.input_type !== "skipped";
  });

  const sections = Array.from(new Set(selectedKpis.map((k) => k.section)));

  function getMapping(kpiId: string): OutputKpiMapping {
    return configData.output_kpis[kpiId] ?? { input_type: "not_configured" };
  }

  function setMapping(kpiId: string, mapping: OutputKpiMapping) {
    setConfigData((prev) => ({
      ...prev,
      output_kpis: { ...prev.output_kpis, [kpiId]: mapping },
    }));
    setDirty(true);
  }

  function updateSoftSensorMapping(kpiId: string, ssm: SoftSensorMapping) {
    setConfigData((prev) => ({
      ...prev,
      soft_sensor_mappings: { ...prev.soft_sensor_mappings, [kpiId]: ssm },
      output_kpis: { ...prev.output_kpis, [kpiId]: { input_type: "soft_sensor" } },
    }));
    setDirty(true);
  }

  async function handleFocusedDone() {
    if (!focusedKpiId || !configId) return;
    const kpi = kpiList.find((k) => k.id === focusedKpiId);
    if (!kpi) return;

    const mapping = configData.output_kpis[focusedKpiId];
    if (!mapping || mapping.input_type !== "formula_mapped") {
      setSaveError("No formula mapping configured for this KPI.");
      return;
    }

    for (const [varName, meta] of Object.entries(kpi.pi_var_meta)) {
      const varMapping = mapping.variables?.[varName];
      if (meta.type === "constant") {
        const val = varMapping?.tags?.[0]?.tag ?? "";
        if (!val.trim()) {
          setSaveError(`Please fill in the design constant: ${meta.display_name}`);
          return;
        }
      } else {
        const tags = varMapping?.tags ?? [];
        if (!tags.some((t) => t.tag.trim())) {
          setSaveError(`Please enter at least one PI tag for: ${meta.display_name}`);
          return;
        }
      }
    }

    setSaveError(null);
    setSaving(true);
    try {
      await flush();
    } catch {
      setSaveError("Save failed — check your connection and try again.");
      return;
    } finally {
      setSaving(false);
    }
    setCurrentStep("kpi");
  }

  async function handleSoftSensorDone() {
    if (!focusedKpiId || !configId) return;
    const ssm = configData.soft_sensor_mappings[focusedKpiId] ?? { has_pi_tag: false };

    if (ssm.has_pi_tag) {
      if (!ssm.tags?.some((t) => t.tag.trim())) {
        setSaveError("Please enter the output PI tag."); return;
      }
    } else {
      if (!ssm.model_info) {
        setSaveError("Please upload a model JSON file before saving."); return;
      }
      for (const name of ssm.model_info.feature_names) {
        const tags = ssm.x_variables?.[name]?.tags ?? [];
        if (!tags.some((t) => t.tag.trim())) {
          setSaveError(`Please enter at least one PI tag for: ${name}`); return;
        }
      }
    }

    setSaveError(null);
    setSaving(true);
    try { await flush(); }
    catch { setSaveError("Save failed — check your connection and try again."); return; }
    finally { setSaving(false); }
    setCurrentStep("kpi");
  }

  if (focusedKpiId) {
    const focusedKpi = kpiList.find((k) => k.id === focusedKpiId);
    if (focusedKpi) {
      if (focusedKpi.kpi_type === "soft_sensor") {
        return (
          <FocusedSoftSensorMapping
            kpi={focusedKpi}
            ssm={configData.soft_sensor_mappings[focusedKpiId] ?? { has_pi_tag: false }}
            onChange={(ssm) => updateSoftSensorMapping(focusedKpiId, ssm)}
            onBack={() => setCurrentStep("kpi")}
            onDone={handleSoftSensorDone}
            saving={saving}
            error={saveError}
          />
        );
      }
      const variableBank = buildVariableBank(configData.output_kpis, focusedKpiId);
      return (
        <FocusedKpiMapping
          kpi={focusedKpi}
          mapping={getMapping(focusedKpiId)}
          onChange={(m) => setMapping(focusedKpiId, m)}
          onBack={() => setCurrentStep("kpi")}
          onDone={handleFocusedDone}
          saving={saving}
          error={saveError}
          variableBank={variableBank}
        />
      );
    }
  }

  if (selectedKpis.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Input Mapping</h2>
          <p className="text-sm text-text-secondary mt-1">
            Map PI historian tags to each KPI. Complete KPI selection first.
          </p>
        </div>
        <p className="text-sm text-text-secondary italic">No KPIs selected. Go back to KPI Selection.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Input Mapping</h2>
        <p className="text-sm text-text-secondary mt-1">
          Assign PI historian tags to each KPI variable. Multiple tags can be combined with an operation.
        </p>
      </div>

      {sections.map((sec) => {
        const secKpis = selectedKpis.filter((k) => k.section === sec);
        return (
          <div key={sec} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{sec}</p>
            {secKpis.map((kpi) => (
              <KpiMappingCard
                key={kpi.id}
                kpi={kpi}
                mapping={getMapping(kpi.id)}
                softSensorMapping={configData.soft_sensor_mappings[kpi.id]}
                expanded={expandedKpiId === kpi.id}
                onToggle={() => setExpandedKpiId(expandedKpiId === kpi.id ? null : kpi.id)}
                onChange={(m) => setMapping(kpi.id, m)}
                onSoftSensorChange={(ssm) => updateSoftSensorMapping(kpi.id, ssm)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiMappingCard({
  kpi,
  mapping,
  softSensorMapping,
  expanded,
  onToggle,
  onChange,
  onSoftSensorChange,
}: {
  kpi: ExpandedKpi;
  mapping: OutputKpiMapping;
  softSensorMapping: SoftSensorMapping | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (m: OutputKpiMapping) => void;
  onSoftSensorChange: (m: SoftSensorMapping) => void;
}) {
  const configured = mapping.input_type !== "not_configured" && mapping.input_type !== "skipped";
  const isFormula = kpi.kpi_type === "formula";
  const isSoftSensor = kpi.kpi_type === "soft_sensor";

  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pklDragOver, setPklDragOver] = useState(false);
  const [pklFileError, setPklFileError] = useState<string | null>(null);
  const [modelFilesRegistry, setModelFilesRegistry] = useAtom(modelFilesRegistryAtom);
  const [, setPklFiles] = useAtom(pklFilesAtom);
  const uomBank = useAtomValue(uomBankAtom);

  const ssm: SoftSensorMapping = softSensorMapping ?? { has_pi_tag: false };

  const features = ssm.model_info?.feature_names ?? [];

  const uomFor = (_name: string) => "";

  function setOutputTag(tags: TagEntry[]) {
    onSoftSensorChange({ ...ssm, tags });
  }

  function readModelFile(file: File) {
    setFileError(null);
    readSoftSensorModelFile(
      file,
      (info, filename) => onSoftSensorChange({ ...ssm, model_info: info, model_filename: filename }),
      (msg) => setFileError(msg)
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-hover text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusDot configured={configured} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{kpi.name}</p>
            {kpi.uom && <p className="text-xs text-text-secondary">{kpi.uom}</p>}
          </div>
          {kpi.kpi_type === "formula" && (
            <span className="text-xs bg-accent-blue-light text-accent-blue px-2 py-0.5 rounded shrink-0">Formula</span>
          )}
          {kpi.kpi_type === "soft_sensor" && (
            <span className="text-xs bg-accent-orange-light text-accent-orange px-2 py-0.5 rounded shrink-0">Soft Sensor</span>
          )}
        </div>
        <span className="text-text-secondary text-sm ml-3">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 py-4 flex flex-col gap-5 bg-background border-t border-border">
          {/* Not configured */}
          {mapping.input_type === "not_configured" && (
            <p className="text-sm text-text-secondary italic">
              This KPI is not yet configured. Please configure it in Step 2 (KPI Selection).
            </p>
          )}

          {/* No PI tag available (sensor KPI) */}
          {mapping.input_type === "no_pi_tag" && (
            <p className="text-sm text-text-secondary">
              No PI tag is available for this KPI. The data team will handle model development.
            </p>
          )}

          {/* Skipped */}
          {mapping.input_type === "skipped" && (
            <p className="text-sm text-text-secondary italic">
              This KPI is skipped.
            </p>
          )}

          {/* Has PI tag (legacy state) */}
          {mapping.input_type === "has_pi_tag" && (
            <p className="text-sm text-text-secondary">
              This KPI is configured to use a direct PI tag.
            </p>
          )}

          {/* PI Tag direct */}
          {mapping.input_type === "pi_tag_direct" && (
            <TagArrayEditor
              label="PI Tags"
              tags={mapping.tags ?? []}
              uomHint={kpi.uom}
              uomList={uomBank}
              operation={mapping.operation}
              onOperationChange={(op) => onChange({ ...mapping, operation: op })}
              onChange={(tags) => onChange({ ...mapping, tags })}
            />
          )}

          {/* Formula mapped — one tag array per pi_var_meta variable */}
          {mapping.input_type === "formula_mapped" && isFormula && (
            <div className="flex flex-col gap-4">
              {kpi.formula_display && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Formula</span>
                  <div className="relative overflow-hidden rounded-lg border border-border/80 bg-gradient-to-r from-surface to-surface-hover p-4 shadow-sm">
                    <div className="absolute top-0 left-0 h-full w-1 bg-accent-blue" />
                    <code className="block text-xs font-mono text-text-primary whitespace-pre-wrap break-all leading-relaxed pl-2">
                      {kpi.formula_display}
                    </code>
                  </div>
                </div>
              )}
              {/* KPI ref inputs — read-only chips */}
              {kpi.kpi_ref_inputs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-text-secondary uppercase">Auto-resolved KPI References</p>
                  <div className="flex flex-wrap gap-2">
                    {kpi.kpi_ref_inputs.map((ref) => (
                      <span key={ref.variable} className="text-xs bg-accent-green-light text-accent-green px-2 py-1 rounded">
                        {ref.display_name || ref.variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* PI var inputs */}
              {Object.entries(kpi.pi_var_meta).map(([varName, meta]) => {
                const varMapping = mapping.variables?.[varName] ?? { tags: [], uom: meta.uom };
                function updateVar(tags: TagEntry[], uom: string, op?: string) {
                  onChange({
                    ...mapping,
                    variables: { ...(mapping.variables ?? {}), [varName]: { tags, uom, operation: op ?? varMapping.operation } },
                  });
                }
                if (meta.type === "constant") {
                  const constTag = varMapping.tags?.[0] ?? { ...BLANK_TAG };
                  return (
                    <div key={varName} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-text-secondary">{meta.display_name} (design constant)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input-base text-sm max-w-xs"
                          placeholder="value"
                          value={constTag.tag}
                          onChange={(e) => updateVar([{ ...constTag, tag: e.target.value }], varMapping.uom)}
                        />
                        <span className="text-sm text-text-secondary self-center">{meta.uom}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <TagArrayEditor
                    key={varName}
                    label={`${meta.display_name} (${meta.uom || "—"})`}
                    tags={varMapping.tags}
                    uomHint={meta.uom}
                    nameHint={meta.display_name || varName}
                    uomList={uomBank}
                    operation={varMapping.operation}
                    onOperationChange={(op) => updateVar(varMapping.tags, varMapping.uom, op)}
                    onChange={(tags) => updateVar(tags, varMapping.uom)}
                  />
                );
              })}
            </div>
          )}

          {/* Soft sensor */}
          {mapping.input_type === "soft_sensor" && isSoftSensor && (
            <div className="flex flex-col gap-4">
              {ssm.has_pi_tag ? (
                <TagArrayEditor
                  label="Output Tag"
                  tags={ssm.tags ?? []}
                  uomHint={kpi.uom}
                  uomList={uomBank}
                  onChange={setOutputTag}
                />
              ) : (
                <>
                  {/* Recommended X variables info */}
                  {kpi.x_variables.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Recommended X Variables for Model Training
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

                  {/* Drag-drop / file select area */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Upload Model JSON</label>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) readModelFile(file);
                      }}
                      className={[
                        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 cursor-pointer text-center transition-colors",
                        dragOver
                          ? "border-accent-blue bg-accent-blue-light"
                          : "border-border bg-background hover:bg-surface-hover",
                      ].join(" ")}
                    >
                      <span className="text-sm text-text-primary">
                        {ssm.model_filename ? ssm.model_filename : "Drop model JSON here or click to browse"}
                      </span>
                      <span className="text-xs text-text-secondary">pipeline_info.json (.json)</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) readModelFile(file);
                        }}
                      />
                    </label>
                    {fileError && <p className="text-xs text-accent-red">{fileError}</p>}
                    {ssm.model_info && <ModelInfoCard modelInfo={ssm.model_info} />}
                  </div>

                  {/* Upload Model .pkl — shown only after JSON upload, validates filename */}
                  {ssm.model_info && (() => {
                    const expectedName = `${ssm.model_info.target_column}.pkl`;
                    const regEntry = modelFilesRegistry.find(e => e.file_name === expectedName);
                    const isUploaded = regEntry?.state === "uploaded";
                    function handlePkl(file: File) {
                      if (file.name !== expectedName) { setPklFileError(`Expected "${expectedName}", got "${file.name}"`); return; }
                      setPklFileError(null);
                      const entry: ModelFileEntry = { model_alias: "LBM", file_name: file.name, model_file_display_name: ssm.model_info!.target_column ?? file.name.replace(".pkl", ""), model_metadata: null, state: "new" };
                      setModelFilesRegistry(prev => [...prev.filter(e => e.file_name !== file.name), entry]);
                      setPklFiles(prev => ({ ...prev, [file.name]: file }));
                      onSoftSensorChange({ ...ssm, pkl_filename: file.name });
                    }
                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-text-secondary uppercase">
                            Upload {expectedName}
                          </label>
                          {isUploaded && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green-light text-accent-green border border-accent-green">
                              ✓ Uploaded
                            </span>
                          )}
                        </div>
                        <label
                          onDragOver={(e) => { e.preventDefault(); setPklDragOver(true); }}
                          onDragLeave={() => setPklDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setPklDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handlePkl(file); }}
                          className={[
                            "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 cursor-pointer text-center transition-colors",
                            pklDragOver ? "border-accent-blue bg-accent-blue-light" : "border-border bg-background hover:bg-surface-hover",
                          ].join(" ")}
                        >
                          <span className="text-sm text-text-primary">
                            {ssm.pkl_filename ?? `Drop ${expectedName} here or click to browse`}
                          </span>
                          <span className="text-xs text-text-secondary">{isUploaded ? "Drop to replace" : "Accepts .pkl only"}</span>
                          <input type="file" accept=".pkl" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePkl(file); }} />
                        </label>
                        {pklFileError && <p className="text-xs text-accent-red">{pklFileError}</p>}
                      </div>
                    );
                  })()}

                  {/* Feature → PI tag mapping inputs */}
                  {ssm.model_info && features.length > 0 && (
                    <div className="flex flex-col gap-3 mt-1">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Feature Variables (X) Mappings
                      </p>
                      {features.map((name) => (
                        <div key={name} className="pl-3 border-l-2 border-border">
                          <TagArrayEditor
                            label={`${name} ${uomFor(name) ? `(${uomFor(name)})` : ""}`}
                            tags={ssm.x_variables?.[name]?.tags ?? []}
                            uomHint={uomFor(name)}
                            nameHint={name}
                            uomList={uomBank}
                            operation={ssm.x_variables?.[name]?.operation}
                            onOperationChange={(op) => {
                              onSoftSensorChange({
                                ...ssm,
                                x_variables: {
                                  ...(ssm.x_variables ?? {}),
                                  [name]: { tags: ssm.x_variables?.[name]?.tags ?? [], uom: uomFor(name), operation: op },
                                },
                              });
                            }}
                            onChange={(tags) => {
                              onSoftSensorChange({
                                ...ssm,
                                x_variables: {
                                  ...(ssm.x_variables ?? {}),
                                  [name]: { tags, uom: uomFor(name), operation: ssm.x_variables?.[name]?.operation },
                                },
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {ssm.model_info && (
                    <button
                      onClick={() => { onSoftSensorChange({ has_pi_tag: false }); }}
                      className="btn-secondary self-start text-xs text-accent-red"
                    >
                      Clear Configuration
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── FocusedKpiMapping ─────────────────────────────────────────────────────────
// Rendered when the user arrives from Step 2 via "Configure KPI Inputs".

function FocusedKpiMapping({
  kpi,
  mapping,
  onChange,
  onBack,
  onDone,
  saving,
  error,
  variableBank,
}: {
  kpi: ExpandedKpi;
  mapping: OutputKpiMapping;
  onChange: (m: OutputKpiMapping) => void;
  onBack: () => void;
  onDone: () => void;
  saving: boolean;
  error: string | null;
  variableBank: Record<string, { tags: TagEntry[]; uom: string }>;
}) {
  const vars = mapping.input_type === "formula_mapped" ? (mapping.variables ?? {}) : {};

  const uomBank = useAtomValue(uomBankAtom);
  const [prefilledVarNames] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const varName of Object.keys(kpi.pi_var_meta)) {
      if (!vars[varName] && variableBank[varName]) s.add(varName);
    }
    return s;
  });

  useEffect(() => {
    if (prefilledVarNames.size === 0) return;
    const newVars = { ...vars };
    for (const varName of prefilledVarNames) {
      if (!newVars[varName]) newVars[varName] = variableBank[varName];
    }
    onChange({ ...mapping, input_type: "formula_mapped", variables: newVars });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateVar(varName: string, tags: TagEntry[], uom: string, op?: string) {
    onChange({
      ...mapping,
      input_type: "formula_mapped",
      variables: { ...vars, [varName]: { tags, uom, operation: op ?? vars[varName]?.operation } },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="btn-secondary self-start text-xs flex items-center gap-1.5">
        ← Back to KPI Selection
      </button>

      <div>
        <h2 className="text-lg font-semibold text-text-primary">{kpi.name}</h2>
        <p className="text-sm text-text-secondary mt-0.5">{kpi.section}</p>
      </div>

      {kpi.formula_display && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Formula</span>
          <div className="relative overflow-hidden rounded-lg border border-border/80 bg-gradient-to-r from-surface to-surface-hover p-4 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1 bg-accent-blue" />
            <code className="block text-xs font-mono text-text-primary whitespace-pre-wrap break-all leading-relaxed pl-2">
              {kpi.formula_display}
            </code>
          </div>
        </div>
      )}

      {kpi.kpi_ref_inputs.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-text-secondary uppercase">Auto-resolved KPI References</p>
          <div className="flex flex-wrap gap-2">
            {kpi.kpi_ref_inputs.map((ref) => (
              <span key={ref.variable} className="text-xs bg-accent-green-light text-accent-green px-2 py-1 rounded">
                {ref.display_name || ref.variable}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.entries(kpi.pi_var_meta).map(([varName, meta]) => {
        const varMapping = vars[varName] ?? variableBank[varName] ?? { tags: [], uom: meta.uom };
        const isPrefilled = prefilledVarNames.has(varName);
        if (meta.type === "constant") {
          const constTag = varMapping.tags?.[0] ?? { ...BLANK_TAG };
          return (
            <div key={varName} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {meta.display_name} (design constant)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`input-base text-sm max-w-xs ${isPrefilled ? "border-accent-blue bg-accent-blue-light" : ""}`}
                  placeholder="value"
                  value={constTag.tag}
                  onChange={(e) => updateVar(varName, [{ ...constTag, tag: e.target.value }], varMapping.uom)}
                />
                <span className="text-sm text-text-secondary self-center">{meta.uom}</span>
              </div>
              {isPrefilled && (
                <p className="text-xs text-accent-blue mt-0.5">
                  ℹ️ Pre-filled from another KPI — verify and save
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={varName} className="flex flex-col gap-1">
            <TagArrayEditor
              label={`${meta.display_name} (${meta.uom || "—"})`}
              tags={varMapping.tags}
              uomHint={meta.uom}
              nameHint={meta.display_name || varName}
              uomList={uomBank}
              operation={varMapping.operation}
              onOperationChange={(op) => updateVar(varName, varMapping.tags, varMapping.uom, op)}
              onChange={(tags) => updateVar(varName, tags, varMapping.uom)}
            />
            {isPrefilled && (
              <p className="text-xs text-accent-blue mt-0.5">
                ℹ️ Pre-filled from another KPI — verify and save
              </p>
            )}
          </div>
        );
      })}

      {error && <p className="text-xs text-accent-red">{error}</p>}

      <div className="flex gap-3 pt-2 border-t border-border">
        <button onClick={onBack} className="btn-secondary text-sm">
          Cancel
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {saving ? "Saving…" : "✓ Save Mapping"}
        </button>
      </div>
    </div>
  );
}

// ── ModelInfoCard ─────────────────────────────────────────────────────────────

function ModelInfoCard({ modelInfo }: { modelInfo: SoftSensorModelInfo }) {
  const metrics = modelInfo.metrics as Record<string, number> | undefined;
  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2 mt-1">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Model Info</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-text-secondary">Model Name</p>
          <p className="text-sm font-medium text-text-primary">{modelInfo.model_name}</p>
        </div>
        {modelInfo.target_column && (
          <div>
            <p className="text-xs text-text-secondary">Target Variable</p>
            <p className="text-sm font-medium text-text-primary">{modelInfo.target_column}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-text-secondary">Input Variables</p>
          <p className="text-sm font-medium text-text-primary">{modelInfo.feature_names.length}</p>
        </div>
        {metrics?.r2 != null && (
          <div>
            <p className="text-xs text-text-secondary">R²</p>
            <p className="text-sm font-medium text-text-primary">{Number(metrics.r2).toFixed(4)}</p>
          </div>
        )}
        {metrics?.rmse != null && (
          <div>
            <p className="text-xs text-text-secondary">RMSE</p>
            <p className="text-sm font-medium text-text-primary">{Number(metrics.rmse).toFixed(4)}</p>
          </div>
        )}
        {metrics?.mae != null && (
          <div>
            <p className="text-xs text-text-secondary">MAE</p>
            <p className="text-sm font-medium text-text-primary">{Number(metrics.mae).toFixed(4)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FocusedSoftSensorMapping ──────────────────────────────────────────────────
// Rendered when the user arrives from Step 2 via "Upload Model & Configure".

function FocusedSoftSensorMapping({
  kpi,
  ssm,
  onChange,
  onBack,
  onDone,
  saving,
  error,
}: {
  kpi: ExpandedKpi;
  ssm: SoftSensorMapping;
  onChange: (ssm: SoftSensorMapping) => void;
  onBack: () => void;
  onDone: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pklDragOver, setPklDragOver] = useState(false);
  const [pklFileError, setPklFileError] = useState<string | null>(null);
  const [modelFilesRegistry, setModelFilesRegistry] = useAtom(modelFilesRegistryAtom);
  const [, setPklFiles] = useAtom(pklFilesAtom);
  const uomBank = useAtomValue(uomBankAtom);

  const features = ssm.model_info?.feature_names ?? [];

  function handleFile(file: File) {
    setFileError(null);
    readSoftSensorModelFile(
      file,
      (info, filename) => onChange({ ...ssm, model_info: info, model_filename: filename }),
      (msg) => setFileError(msg)
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-accent-orange-light text-accent-orange px-2 py-0.5 rounded font-medium">
              Soft Sensor
            </span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">{kpi.name}</h2>
          {kpi.uom && <p className="text-sm text-text-secondary">{kpi.uom}</p>}
        </div>
        <button onClick={onBack} className="btn-secondary text-xs shrink-0 flex items-center gap-1">
          ← Back to KPI Selection
        </button>
      </div>

      {/* PI tag available? */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-text-secondary">PI tag available for output?</span>
        <div className="flex gap-4">
          {([true, false] as const).map((v) => (
            <label key={String(v)} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                className="accent-accent-blue"
                checked={ssm.has_pi_tag === v}
                onChange={() => onChange({ ...ssm, has_pi_tag: v })}
              />
              {v ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </div>

      {ssm.has_pi_tag ? (
        <TagArrayEditor
          label="Output Tag"
          tags={ssm.tags ?? []}
          uomHint={kpi.uom}
          uomList={uomBank}
          onChange={(tags) => onChange({ ...ssm, tags })}
        />
      ) : (
        <>
          {/* Recommended X Variables */}
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

          {/* JSON upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-secondary uppercase">
              Upload Model JSON
            </label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={[
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 cursor-pointer text-center transition-colors",
                dragOver
                  ? "border-accent-blue bg-accent-blue-light"
                  : "border-border bg-background hover:bg-surface-hover",
              ].join(" ")}
            >
              <span className="text-2xl">📎</span>
              <span className="text-sm text-text-primary">
                {ssm.model_filename ? ssm.model_filename : "Drop model JSON here or click to browse"}
              </span>
              <span className="text-xs text-text-secondary">pipeline_info.json (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            {fileError && <p className="text-xs text-accent-red">{fileError}</p>}
          </div>

          {/* Upload Model .pkl — shown only after JSON upload, validates filename */}
          {ssm.model_info && (() => {
            const expectedName = `${ssm.model_info.target_column}.pkl`;
            const regEntry = modelFilesRegistry.find(e => e.file_name === expectedName);
            const isUploaded = regEntry?.state === "uploaded";
            function handlePkl(file: File) {
              if (file.name !== expectedName) { setPklFileError(`Expected "${expectedName}", got "${file.name}"`); return; }
              setPklFileError(null);
              const entry: ModelFileEntry = { model_alias: "LBM", file_name: file.name, model_file_display_name: ssm.model_info!.target_column ?? file.name.replace(".pkl", ""), model_metadata: null, state: "new" };
              setModelFilesRegistry(prev => [...prev.filter(e => e.file_name !== file.name), entry]);
              setPklFiles(prev => ({ ...prev, [file.name]: file }));
              onChange({ ...ssm, pkl_filename: file.name });
            }
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase">
                    Upload {expectedName}
                  </label>
                  {isUploaded && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green-light text-accent-green border border-accent-green">
                      ✓ Uploaded
                    </span>
                  )}
                </div>
                <label
                  onDragOver={(e) => { e.preventDefault(); setPklDragOver(true); }}
                  onDragLeave={() => setPklDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setPklDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handlePkl(file); }}
                  className={[
                    "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 cursor-pointer text-center transition-colors",
                    pklDragOver ? "border-accent-blue bg-accent-blue-light" : "border-border bg-background hover:bg-surface-hover",
                  ].join(" ")}
                >
                  <span className="text-2xl">📎</span>
                  <span className="text-sm text-text-primary">
                    {ssm.pkl_filename ?? `Drop ${expectedName} here or click to browse`}
                  </span>
                  <span className="text-xs text-text-secondary">{isUploaded ? "Drop to replace" : "Accepts .pkl only"}</span>
                  <input type="file" accept=".pkl" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePkl(file); }} />
                </label>
                {pklFileError && <p className="text-xs text-accent-red">{pklFileError}</p>}
              </div>
            );
          })()}

          {/* Model info card */}
          {ssm.model_info && <ModelInfoCard modelInfo={ssm.model_info} />}

          {/* Feature → PI tag mappings */}
          {ssm.model_info && features.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Feature Variables (X) Mappings
              </p>
              {features.map((name) => (
                <div key={name} className="pl-3 border-l-2 border-border">
                  <TagArrayEditor
                    label={name}
                    tags={ssm.x_variables?.[name]?.tags ?? []}
                    uomHint=""
                    nameHint={name}
                    uomList={uomBank}
                    operation={ssm.x_variables?.[name]?.operation}
                    onOperationChange={(op) =>
                      onChange({
                        ...ssm,
                        x_variables: {
                          ...(ssm.x_variables ?? {}),
                          [name]: { tags: ssm.x_variables?.[name]?.tags ?? [], uom: "", operation: op },
                        },
                      })
                    }
                    onChange={(tags) =>
                      onChange({
                        ...ssm,
                        x_variables: {
                          ...(ssm.x_variables ?? {}),
                          [name]: { tags, uom: "", operation: ssm.x_variables?.[name]?.operation },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {ssm.model_info && (
            <button
              onClick={() => { onChange({ has_pi_tag: false }); }}
              className="btn-secondary self-start text-xs text-accent-red"
            >
              Clear Configuration
            </button>
          )}
        </>
      )}

      {error && <p className="text-xs text-accent-red">{error}</p>}

      <div className="flex gap-3 pt-2 border-t border-border">
        <button onClick={onBack} disabled={saving} className="btn-secondary text-sm">
          Cancel
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {saving ? "Saving…" : "✓ Save Mapping"}
        </button>
      </div>
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${configured ? "bg-accent-green" : "bg-accent-yellow"}`}
    />
  );
}
