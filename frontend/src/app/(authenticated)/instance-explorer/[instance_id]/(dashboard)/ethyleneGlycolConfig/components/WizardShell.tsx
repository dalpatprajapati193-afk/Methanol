"use client";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  currentStepAtom,
  configIdAtom,
  configDataAtom,
  configRecordAtom,
  wizardDirtyAtom,
  saveStatusAtom,
  draftLoadedAtom,
  draftUpdatedAtAtom,
  lbmOverridesAtom,
  wizardCompletedAtom,
  wizardCompletedAtAtom,
  kpiListAtom,
  modelFilesRegistryAtom,
  pklFilesAtom,
  uomBankAtom,
} from "../store/WizardAtoms";
import type { SoftSensorMapping } from "../store/Types";
import { buildActiveSteps, findLeaf, leafIndex, isLastLeafOfPhase } from "../store/WizardSteps";
import { validateStep } from "../store/StepValidation";
import { loadInitialConfig, submitFilledSnapshot, clearDraft, loadModelFilesRegistry, uploadModelFiles, getUomBank } from "../actions/Actions";
import { useDraftAutosave } from "../hooks/Index";
import { Navbar, WorkflowBar, SummaryPanel, WizardSidebar } from "./Index";
import styles from "./EgChrome.module.css";

export default function WizardShell({ id, instanceName }: { id: string; instanceName: string }) {
  const router = useRouter();
  const instanceId = parseInt(id, 10);
  const [currentStepId, setCurrentStepId] = useAtom(currentStepAtom);
  const [, setConfigId] = useAtom(configIdAtom);
  const [configData, setConfigData] = useAtom(configDataAtom);
  const [, setConfigRecord] = useAtom(configRecordAtom);
  const [dirty, setDirty] = useAtom(wizardDirtyAtom);
  const [draftLoaded, setDraftLoaded] = useAtom(draftLoadedAtom);
  const setSaveStatus = useSetAtom(saveStatusAtom);
  const setDraftUpdatedAt = useSetAtom(draftUpdatedAtAtom);
  const lbmOverrides = useAtomValue(lbmOverridesAtom);
  const [wizardCompleted, setWizardCompleted] = useAtom(wizardCompletedAtom);
  const setWizardCompletedAt = useSetAtom(wizardCompletedAtAtom);
  const [modelFilesRegistry, setModelFilesRegistry] = useAtom(modelFilesRegistryAtom);
  const pklFiles = useAtomValue(pklFilesAtom);
  const setUomBank = useSetAtom(uomBankAtom);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [missing, setMissing] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { flush } = useDraftAutosave(isNaN(instanceId) ? null : instanceId);

  const activeSteps = useMemo(() => buildActiveSteps(configData), [configData]);
  const currentLeaf = findLeaf(activeSteps, currentStepId) ?? activeSteps[0];
  const idx = leafIndex(activeSteps, currentLeaf.id);
  const StepComponent = currentLeaf.component;
  const isStepEnd = isLastLeafOfPhase(activeSteps, currentLeaf.id);
  const isLastOverall = idx === activeSteps.length - 1;

  // Lock outer page scroll while wizard is mounted so fixed shell covers the full viewport.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (isNaN(instanceId)) {
      router.push("/");
      return;
    }
    setConfigId(instanceId);
    setDraftLoaded(false);
    async function load() {
      try {
        setLoadError(null);
        const [res, existingFiles, uomBank] = await Promise.all([
          loadInitialConfig(instanceId),
          loadModelFilesRegistry(instanceId),
          getUomBank(),
        ]);
        setConfigData(res.data);
        setCurrentStepId(res.currentStep ?? "general");
        setDraftUpdatedAt(res.source === "draft" ? new Date().toISOString() : null);
        setDirty(false);
        setSaveStatus("idle");
        setDraftLoaded(true);
        if (existingFiles.length > 0) setModelFilesRegistry(existingFiles);
        if (uomBank.length > 0) setUomBank(uomBank);
      } catch (err: any) {
        console.error("Failed to load initial config:", err);
        setLoadError(err?.message || "Failed to load configuration from server.");
      }
    }
    load();
    return () => {
      setCurrentStepId("general");
      setConfigId(null);
      setDraftLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // If the active leaf disappeared (e.g. equipment section hidden by a config
  // change), snap to the nearest still-valid step instead of a blank screen.
  useEffect(() => {
    if (!findLeaf(activeSteps, currentStepId)) {
      setCurrentStepId(activeSteps[Math.min(idx, activeSteps.length - 1)]?.id ?? "general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSteps]);

  // ── Navigation (autosave the draft before moving) ──────────────────────────
  async function navigateTo(targetId: string) {
    setMissing([]);
    if (wizardCompleted) setWizardCompleted(false);
    await flush();
    setCurrentStepId(targetId);
  }
  function goNext() {
    if (idx < activeSteps.length - 1) navigateTo(activeSteps[idx + 1].id);
  }
  function goBack() {
    if (idx > 0) navigateTo(activeSteps[idx - 1].id);
  }

  // ── Submit (last page of a step): validate → snapshot → advance ────────────
  function handleSubmit() {
    const issues = validateStep(currentLeaf.phaseId, configData);
    setMissing(issues); // advisory — shown but does not block
    startSubmit(async () => {
      try {
        setSaveStatus("saving");
        await flush(); // persist draft first

        const isExportStep = currentLeaf.phaseId === "export";

        // Steps 2–4: fill KPI/PI tag sheets only.
        // Step 5: finalise — fill LBM sheets and copy as-is sheets from ExportFileFormat;
        //         include any user edits from the LBM sheet editor.
        const sheetOverrides: Record<string, unknown> = {};
        if (isExportStep && lbmOverrides) {
          const LBM_TABS = ["lbm_iterations", "lbm_contributors", "ods_rules", "clean_data_ranges"] as const;
          for (const tab of LBM_TABS) {
            if (lbmOverrides[tab]) sheetOverrides[tab] = lbmOverrides[tab].rows;
          }
        }

        // Step 5: push any new .pkl files to output.model_files_registry
        if (isExportStep) {
          const newEntries = modelFilesRegistry.filter(e => e.state === "new");
          if (newEntries.length > 0) {
            const fileBase64s: Record<string, string> = {};
            for (const entry of newEntries) {
              const file = pklFiles[entry.file_name];
              if (file) {
                const ab = await file.arrayBuffer();
                const bytes = new Uint8Array(ab);
                let bin = "";
                for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
                fileBase64s[entry.file_name] = btoa(bin);
              }
            }
            await uploadModelFiles(instanceId, newEntries, fileBase64s);
            setModelFilesRegistry(prev => prev.map(e => ({ ...e, state: "uploaded" as const })));
          }
        }

        const rec = await submitFilledSnapshot(
          instanceId,
          configData,
          currentLeaf.phaseId !== "plant",
          { sheetOverrides, finalize: isExportStep },
        );
        setConfigRecord(rec);
        setSaveStatus("saved");
        if (isLastOverall) {
          setWizardCompleted(true);
          setWizardCompletedAt(new Date().toISOString());
          setShowSuccessModal(true);
        }
      } catch (err) {
        console.error("[WizardShell] Submit Step failed:", err);
        setSaveStatus("error");
        return;
      }
      if (!isLastOverall) setCurrentStepId(activeSteps[idx + 1].id);
    });
  }

  // ── Revert: discard the draft and reload last snapshot / defaults ──────────
  function handleRevert() {
    startSubmit(async () => {
      await clearDraft(instanceId);
      const res = await loadInitialConfig(instanceId);
      setConfigData(res.data);
      setCurrentStepId(res.currentStep ?? "general");
      setDraftUpdatedAt(null);
      setMissing([]);
      setDirty(false);
      setSaveStatus("idle");
    });
  }

  if (loadError) {
    throw new Error(loadError);
  }

  if (!draftLoaded) {
    return (
      <div className={`${styles.wizardLoading} text-sm text-text-secondary`}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-accent-blue animate-pulse" />
          <p className="font-medium animate-pulse">Loading configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizardRoot}>
      <Navbar />
      <WorkflowBar />

      <div className={styles.wizardBody}>
        <WizardSidebar
          instanceName={instanceName}
          activeSteps={activeSteps}
          currentLeafId={currentLeaf.id}
          onNavigate={navigateTo}
        />

        {/* Main content column */}
        <div className={styles.wizardColumn}>
          {/* Top bar */}
          <header className="h-12 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
            <p className="text-sm text-text-secondary">
              Step {idx + 1} of {activeSteps.length} — {currentLeaf.sidebarLabel}
            </p>
            <div className="flex items-center gap-3">
              <SaveStatusChip dirty={dirty} />
              <button
                onClick={handleRevert}
                disabled={submitting}
                className="text-xs text-text-secondary hover:text-accent-red disabled:opacity-40"
                title="Discard unsaved draft changes and reload the last saved version"
              >
                Revert
              </button>
            </div>
          </header>

          {/* Step content — scrollable */}
          <main className={styles.wizardMain}>
            {wizardCompleted && !showSuccessModal ? (
              <CompletionScreen
                instanceName={instanceName}
                onEdit={() => {
                  setWizardCompleted(false);
                  setCurrentStepId(activeSteps[0].id);
                }}
              />
            ) : (
              <div className={currentLeaf.phaseId === "export" ? "w-full" : "max-w-3xl mx-auto"}>
                {missing.length > 0 && (
                  <div className="mb-5 rounded-lg border border-accent-orange bg-accent-orange-light p-3 text-sm">
                    <p className="font-medium text-accent-orange">
                      Some recommended fields are still empty — you can submit anyway and fill them later:
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-text-secondary">
                      {missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <StepComponent only={currentLeaf.only} />
              </div>
            )}
          </main>

          {/* Step navigation footer */}
          <footer className="h-14 border-t border-border bg-surface flex items-center justify-between px-8 shrink-0">
            <button
              onClick={goBack}
              disabled={idx === 0 || submitting}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              ← Back
            </button>
            <div className="flex gap-1">
              {activeSteps.map((s, i) => (
                <div
                  key={s.id}
                  className={[
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === idx ? "bg-accent-blue" : i < idx ? "bg-accent-green" : "bg-border",
                  ].join(" ")}
                />
              ))}
            </div>
            {isStepEnd ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary text-sm disabled:opacity-40"
              >
                {submitting ? "Submitting…" : isLastOverall ? "Submit & Finish" : "Submit Step →"}
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary text-sm">
                Save and Continue →
              </button>
            )}
          </footer>
        </div>

        <SummaryPanel />
      </div>

      {/* Success modal — shown immediately after Submit & Finish, dismissed to completion screen */}
      {showSuccessModal && (
        <SuccessModal
          instanceName={instanceName}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
}

function SaveStatusChip({ dirty }: { dirty: boolean }) {
  const status = useAtomValue(saveStatusAtom);
  let text = "All changes saved";
  let cls = "text-text-secondary";
  if (status === "saving") {
    text = "Saving…";
    cls = "text-accent-blue";
  } else if (status === "error") {
    text = "Save failed";
    cls = "text-accent-red";
  } else if (dirty) {
    text = "Unsaved changes";
    cls = "text-accent-orange";
  } else {
    text = "All changes saved ✓";
    cls = "text-accent-green";
  }
  return <span className={`text-xs ${cls}`}>{text}</span>;
}

function CompletionScreen({ instanceName, onEdit }: { instanceName: string; onEdit: () => void }) {
  const completedAt = useAtomValue(wizardCompletedAtAtom);
  const configData = useAtomValue(configDataAtom);
  const kpiList = useAtomValue(kpiListAtom);
  const saved = completedAt ? new Date(completedAt).toLocaleString() : "";

  const regularKpis = kpiList.filter((k) => k.kpi_type !== "soft_sensor");
  const softSensorKpis = kpiList.filter((k) => k.kpi_type === "soft_sensor");

  const ssTotal = softSensorKpis.length;
  const ssConfigured = softSensorKpis.filter((k) => {
    const m = configData.soft_sensor_mappings[k.id] as SoftSensorMapping | undefined;
    if (!m) return false;
    return (m.has_pi_tag && !!m.tags?.[0]?.tag) ||
      (!m.has_pi_tag && (!!m.model_info || Object.keys(m.x_variables ?? {}).length > 0));
  }).length;

  const forecastConfigured = !!configData.forecast_config?.model_filename;

  const SummaryRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <>
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium ${highlight ? "text-accent-green" : "text-text-primary"}`}>{value}</span>
    </>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 max-w-xl mx-auto text-center">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-green shadow-lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-text-primary">Configuration Complete</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          All steps submitted. Your LBM configuration has been saved to the database.
        </p>
      </div>

      {/* Summary card */}
      <div className="w-full rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 text-left">
        {/* Plant info */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2.5">Plant Details</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <SummaryRow label="Instance" value={instanceName} />
            <SummaryRow label="Plant Name" value={configData.configName || "—"} />
            <SummaryRow label="Design Capacity" value={configData.plantCapacity ? `${configData.plantCapacity}` : "—"} />
            <SummaryRow label="Technology Licensor" value={configData.techLicensor || "—"} />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Configuration stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2.5">Configuration Status</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
            {regularKpis.length > 0 && (
              <SummaryRow label="KPIs" value={`${regularKpis.length} configured`} highlight />
            )}
            {ssTotal > 0 && (
              <SummaryRow
                label="Soft Sensors"
                value={`${ssConfigured} / ${ssTotal} configured`}
                highlight={ssConfigured === ssTotal}
              />
            )}
            <SummaryRow
              label="Forecast Model (S44)"
              value={forecastConfigured ? "1 / 1 configured" : "Not configured"}
              highlight={forecastConfigured}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Timestamp */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-accent-green">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-accent-green">Saved to Database</p>
            <p className="text-xs text-text-secondary mt-0.5">{saved}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <button onClick={onEdit} className="btn-secondary w-full py-2.5 text-sm">
          ← Edit Configuration
        </button>
        <p className="text-xs text-text-secondary">
          Or click any step in the sidebar to jump directly to it.
        </p>
      </div>
    </div>
  );
}

function SuccessModal({ instanceName, onClose }: { instanceName: string; onClose: () => void }) {
  const completedAt = useAtomValue(wizardCompletedAtAtom);
  const saved = completedAt ? new Date(completedAt).toLocaleString() : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-6 flex flex-col items-center p-10 gap-6">

        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-green shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Heading */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-text-primary">Configuration Saved!</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your LBM configuration for{" "}
            <span className="font-semibold text-text-primary">{instanceName}</span>{" "}
            has been successfully saved to the database.
          </p>
        </div>

        {/* Timestamp badge */}
        <div className="w-full flex items-center gap-3 rounded-lg bg-accent-green-light border border-accent-green px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-accent-green">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-accent-green">Saved to Database</p>
            <p className="text-xs text-text-secondary mt-0.5">{saved}</p>
          </div>
        </div>

        {/* Close */}
        <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm font-semibold">
          Done
        </button>
      </div>
    </div>
  );
}
