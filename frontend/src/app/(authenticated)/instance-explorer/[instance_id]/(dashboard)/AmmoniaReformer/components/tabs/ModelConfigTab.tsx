"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  downloadEffOutputAction,
  getModelBlueprintStatusAction,
} from "../../actions/Index";
import type { ResolvedModel } from "../../actions/Index";
import {
  instanceIdAtom,
  hierarchyAtom,
  requiresHierarchyConfirmationAtom,
  mandatoryKpiFulfilledAtom,
  mandatoryKpiPackageStatusAtom,
  submitStatusAtom,
  submitFinalConfigAtom,
} from "../../store/Index";
import ModelBlueprintStatus from "../shared/ModelBlueprintStatus";
import {
  SHOW_EFF_OUTPUT_EXPORT,
  maxOutlierStartDate,
  validateOutlierStartDate,
} from "../../Constants";

async function triggerDownload(action: () => Promise<{ base64: string; filename: string }>) {
  const result = await action();
  const bytes = atob(result.base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = result.filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ModelConfigTab() {
  const [models, setModels] = useState<ResolvedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activeStartDate, setActiveStartDate] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const instanceId = useAtomValue(instanceIdAtom);

  const hierarchy = useAtomValue(hierarchyAtom);
  const requiresConfirmation = useAtomValue(requiresHierarchyConfirmationAtom);
  // Match the KPI Applicability tab's readiness verdict exactly: trust the status
  // it publishes (folds in level groups, alternatives, cross-level verdicts, absent
  // elements) and only fall back to the standalone re-derivation when that tab
  // hasn't computed yet. Reading the fallback atom alone was stricter than the KPI
  // tab and blocked Submit even when every mandatory KPI showed as mapped there.
  const mandatoryFulfilledFallback = useAtomValue(mandatoryKpiFulfilledAtom);
  const mandatoryPackageStatus = useAtomValue(mandatoryKpiPackageStatusAtom);
  const mandatoryKpiFulfilled = mandatoryPackageStatus?.fulfilled ?? mandatoryFulfilledFallback;
  const submitStatus = useAtomValue(submitStatusAtom);
  const submitFinalConfig = useSetAtom(submitFinalConfigAtom);

  const systemChosen = !!hierarchy.root;
  const canSubmit =
    systemChosen && !requiresConfirmation && mandatoryKpiFulfilled && submitStatus !== "submitting";
  // Reason the Submit button is blocked (null when ready). Covers every gate in
  // `canSubmit` except the transient "submitting" state, so a disabled button
  // always explains itself — including the requiresConfirmation gate the old hint
  // silently missed.
  const submitBlockReason = !systemChosen
    ? "Build a system in System Config first."
    : requiresConfirmation
      ? "Confirm the system hierarchy before submitting."
      : !mandatoryKpiFulfilled
        ? "Map all mandatory KPI packages before submitting."
        : null;
  const submitReadyHint =
    "Flushes the draft configs then saves the finalized config as this instance's snapshot.";

  useEffect(() => {
    if (!instanceId) return;

    const error = validateOutlierStartDate(startDate);
    if (startDate && error) {
      setStartDateError(error);
      return;
    }

    setStartDateError(null);
    setLoading(true);
    getModelBlueprintStatusAction(instanceId, startDate || undefined)
      .then((res) => {
        setModels(res.models ?? []);
        setActiveStartDate(res.start_date ?? null);
        setStatusError(res.blueprint_found ? (res.error ?? null) : (res.error ?? "No model blueprint found."));
      })
      .catch(() => setStatusError("Failed to load model status."))
      .finally(() => setLoading(false));
  }, [instanceId, startDate]);

  const handleExport = () => {
    const error = validateOutlierStartDate(startDate);
    if (startDate && error) {
      setStartDateError(error);
      return;
    }
    setExportError(null);
    void triggerDownload(() => downloadEffOutputAction(instanceId, startDate || undefined)).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Export failed.";
      setExportError(message);
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Model readiness */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-text-secondary">Models</h3>
          {activeStartDate && (
            <span className="text-xs text-text-secondary border border-border rounded px-2 py-0.5">
              Start date: <span className="text-text-primary font-medium">{activeStartDate}</span>
            </span>
          )}
        </div>
        {loading ? (
          <div className="px-4 py-3 rounded-xl text-xs border bg-surface border-border text-text-secondary flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
            Checking model blueprints…
          </div>
        ) : models.length > 0 ? (
          models.map((m) => <ModelBlueprintStatus key={m.id} model={m} />)
        ) : (
          <div className="px-4 py-3 rounded-xl text-xs border bg-surface border-accent-yellow text-accent-yellow">
            ✗ {statusError ?? "No models available."}
          </div>
        )}
      </div>

      {/* Exports */}
      {SHOW_EFF_OUTPUT_EXPORT && (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm font-medium text-text-secondary self-center">Export:</span>
          <button
            className="px-4 py-2 bg-accent-orange text-surface text-sm rounded hover:bg-accent-orange disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!!startDateError}
            onClick={handleExport}
          >
            EFF_output.xlsx
          </button>
          {exportError && (
            <span className="text-xs text-accent-red w-full">{exportError}</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="outlier-start-date" className="text-sm font-medium text-text-secondary">
          Start date
        </label>
        <input
          id="outlier-start-date"
          type="date"
          max={maxOutlierStartDate()}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded bg-background text-text-primary"
        />
        <p className="text-xs text-text-secondary max-w-prose">
          Optional. For outlier detection, fetch data from the date selected above.
        </p>
        {startDateError && (
          <span className="text-xs text-accent-red">{startDateError}</span>
        )}
      </div>

      {/* Submit / finalize — persists the EFF_output workbook (pipeline_config_data)
          + finalized config (ui_config_data) to instance_configurations (doc 05). */}
      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-text-secondary">Submit configuration</h3>
        {submitBlockReason ? (
          <p className="text-xs text-accent-yellow flex items-start gap-1.5 max-w-prose">
            <span aria-hidden className="leading-none">⚠</span>
            <span>{submitBlockReason}</span>
          </p>
        ) : (
          <p className="text-xs text-text-secondary max-w-prose">{submitReadyHint}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canSubmit}
            title={submitBlockReason ?? undefined}
            onClick={() => { void submitFinalConfig(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold bg-accent-green text-surface hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitStatus === "submitting" && (
              <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
            )}
            {submitStatus === "submitting" ? "Submitting…" : "Submit / Save to database"}
          </button>
          {submitStatus === "submitted" && (
            <span className="text-xs text-accent-green">Configuration submitted to database.</span>
          )}
          {submitStatus === "error" && (
            <span className="text-xs text-accent-red">Submit failed — try again.</span>
          )}
        </div>
      </div>
    </div>
  );
}
