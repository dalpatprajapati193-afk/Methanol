"use client";

import { useAtom, useSetAtom } from "jotai";
import { wizardStateAtom, wizardStepAtom, runStatusAtom, hasSucceededOnceAtom, lastRunOkAtom, lastRunSnapshotAtom } from "../../config/ConfigAtoms";
import { generateSubAssets } from "../../config/SubAssets";
import { getOnboardProgress, runOnboardingFromWizard } from "../../actions/Actions";
import type { OnboardProgressStage, OnboardResult, OnboardingSnapshot } from "../../store/Types";
import { useEffect, useState } from "react";

// Mirrors router.py's STAGE_KEYS/STAGE_LABELS — shown immediately on click,
// before the first poll can possibly land, so the checklist is visible from
// the start instead of only appearing once network data arrives.
const INITIAL_STAGES: OnboardProgressStage[] = [
  { key: "kpi_calculation", label: "KPI Calculation", status: "pending" },
  { key: "kpi_validation", label: "KPI Formula Validation", status: "pending" },
  { key: "failure_mode_matrix", label: "Failure Mode Matrix Selection", status: "pending" },
  { key: "training_data_selection", label: "Training Data Selection", status: "pending" },
  { key: "model_tuning_storing", label: "Model Tuning and Storing", status: "pending" },
  { key: "final_tables_created", label: "Draft Tables Generation", status: "pending" },
];

interface StepReviewProps {
  instanceId: number;
  initialSnapshot: OnboardingSnapshot | null;
  /** Flush the draft before finalizing, per documentation/05 — submit must
   * act on the latest saved state, not a stale one. */
  flushDraft: () => Promise<void>;
}

export function StepReview({ instanceId, initialSnapshot, flushDraft }: StepReviewProps) {
  const [state] = useAtom(wizardStateAtom);
  const setStep = useSetAtom(wizardStepAtom);
  const [status, setStatus] = useAtom(runStatusAtom);
  const setHasSucceededOnce = useSetAtom(hasSucceededOnceAtom);
  const setLastRunOk = useSetAtom(lastRunOkAtom);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [stages, setStages] = useState<OnboardProgressStage[]>([]);
  // The success path auto-advances to step 8 right after a run, unmounting
  // this component before result.log is readable — displayedLastRun.result.log
  // is the same data persisted server-side, so this toggle is the only way to
  // see it after the fact (e.g. the checklist all show "done" but a step was
  // silently skipped — the printed log line is what actually explains why).
  const [showLastRunLog, setShowLastRunLog] = useState(false);
  // initialSnapshot is fetched once by the server component at page load, so
  // the "Last run" banner would otherwise stay frozen on a stale run after
  // one completes in this same session — track the latest attempt in an atom
  // (not local state — this component unmounts on every step change, see
  // ConfigWizard's `step === 7 && ...`) and prefer it once it exists.
  const [lastRun, setLastRun] = useAtom(lastRunSnapshotAtom);
  // The backend only resets its progress tracker once the /onboard POST
  // actually starts executing — status flips to "running" synchronously well
  // before that (flushDraft() + workbook-building + network dispatch still
  // have to happen first). Polling on status alone would read the PREVIOUS
  // run's leftover "all done" entry during that gap. Gate polling on this
  // flag instead, flipped true right before the /onboard call is dispatched,
  // to shrink that stale-read window down to just network latency.
  const [polling, setPolling] = useState(false);
  const items = generateSubAssets(state.mc);
  const displayedLastRun = lastRun ?? initialSnapshot;

  // Poll the FastAPI process's in-memory stage tracker while a run is in
  // flight — the /onboard POST itself stays open for the whole run, so this
  // is a separate, fast GET the UI can check every couple seconds.
  useEffect(() => {
    console.log("[AFP-DEBUG] poll effect ran", { status, polling });
    if (status !== "running" || !polling) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const progress = await getOnboardProgress(instanceId);
        console.log("[AFP-DEBUG] poll tick", progress.stages);
        if (!cancelled) setStages(progress.stages);
      } catch (e) {
        console.log("[AFP-DEBUG] poll tick threw", e);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      console.log("[AFP-DEBUG] poll effect cleanup");
      cancelled = true;
      clearInterval(id);
    };
  }, [status, polling, instanceId]);

  const onRun = async () => {
    console.log("[AFP-DEBUG] onRun start");
    setStatus("running");
    setResult(null);
    setStages(INITIAL_STAGES);
    setPolling(false);
    const fileName = `afp_config_${state.mc.service || "instance"}_${Date.now()}.xlsx`;
    try {
      console.log("[AFP-DEBUG] awaiting flushDraft");
      await flushDraft();
      console.log("[AFP-DEBUG] flushDraft done, setting polling true");
      setPolling(true);
      const res = await runOnboardingFromWizard(instanceId, fileName, state);
      setResult(res);
      setLastRun({ fileName, ranAt: new Date().toISOString(), result: res });
      // One authoritative read on settle — a run can fail (or finish) faster
      // than the 2s poll interval, so the last interval tick may be stale by
      // the time this resolves. Best-effort: the checklist just keeps
      // whatever it last had if this fails.
      try {
        const finalProgress = await getOnboardProgress(instanceId);
        setStages(finalProgress.stages);
      } catch {
        // ignore — keep last-known stages
      }
      setStatus(res.ok ? "done" : "error");
      setLastRunOk(res.ok);
      // Auto-advance to Domain Limits on success — also marks current_step
      // "8" on the next autosave, so a resume lands here, not back on Review.
      if (res.ok) {
        setHasSucceededOnce(true);
        setStep(8);
      }
    } catch (e) {
      const failed: OnboardResult = { ok: false, log: "", error: e instanceof Error ? e.message : "Run failed" };
      setResult(failed);
      setLastRun({ fileName, ranAt: new Date().toISOString(), result: failed });
      setStatus("error");
      setLastRunOk(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {displayedLastRun && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">
          <div className="flex items-center justify-between gap-3">
            <span>
              Last run: <span className="text-text-primary">{new Date(displayedLastRun.ranAt).toLocaleString()}</span>{" "}
              —{" "}
              <span className={displayedLastRun.result.ok ? "text-accent-green" : "text-accent-red"}>
                {displayedLastRun.result.ok ? "succeeded" : "failed"}
              </span>
            </span>
            {(displayedLastRun.result.log || displayedLastRun.result.error) && (
              <button
                type="button"
                onClick={() => setShowLastRunLog((v) => !v)}
                className="text-xs font-medium uppercase text-accent-blue hover:underline"
              >
                {showLastRunLog ? "Hide log" : "View log"}
              </button>
            )}
          </div>
          {showLastRunLog && (
            <>
              {displayedLastRun.result.error && (
                <p className="text-xs text-accent-red">{displayedLastRun.result.error}</p>
              )}
              {displayedLastRun.result.log && (
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-background p-3 text-xs text-text-secondary">
                  {displayedLastRun.result.log}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-text-primary">Summary</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-text-secondary">Casings</dt>
          <dd className="text-text-primary">{state.mc.numCasings || 0}</dd>
          <dt className="text-text-secondary">Turbines</dt>
          <dd className="text-text-primary">{state.mc.numTurbines || 0}</dd>
          <dt className="text-text-secondary">Sub-Assets Generated</dt>
          <dd className="text-text-primary">{items.length}</dd>
        </dl>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={status === "running"}
        className="w-fit rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {status === "running" ? "Running onboarding…" : "Run Onboarding"}
      </button>

      {stages.length > 0 && (
        <ol className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
          {stages.map((stage) => (
            <li key={stage.key} className="flex items-center gap-3 text-sm">
              <span
                className={
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs " +
                  (stage.status === "done"
                    ? "bg-accent-green text-background"
                    : stage.status === "running"
                      ? "animate-pulse bg-accent-blue text-background"
                      : stage.status === "error"
                        ? "bg-accent-red text-background"
                        : "border border-border text-text-secondary")
                }
              >
                {stage.status === "done" ? "✓" : stage.status === "error" ? "!" : ""}
              </span>
              <span
                className={
                  stage.status === "pending"
                    ? "text-text-secondary"
                    : stage.status === "error"
                      ? "text-accent-red"
                      : "text-text-primary"
                }
              >
                {stage.label}
                {stage.status === "running" && "…"}
              </span>
            </li>
          ))}
        </ol>
      )}

      {result && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-primary">
            {result.ok ? (
              <span className="text-accent-green">Onboarding complete — continuing to Domain Limits…</span>
            ) : (
              <span className="text-accent-red">Onboarding failed</span>
            )}
          </h2>
          {result.error && <p className="text-sm text-accent-red">{result.error}</p>}
          {result.log && (
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
              {result.log}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
