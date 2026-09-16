"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  STEP_META,
  WIZARD_STEPS,
  dirtyAtom,
  hasAppliedDomainLimitsOnceAtom,
  lastRunOkAtom,
  saveStatusAtom,
  wizardStateAtom,
  wizardStepAtom,
  type WizardStep,
} from "../../config/ConfigAtoms";
import { validateStep } from "../../config/Validation";
import { generateKpiDraft, loadInitialConfig } from "../../actions/Actions";
import { useDraftAutosave } from "../../hooks/Index";
import { StepMachineConfig } from "./StepMachineConfig";
import { StepModels } from "./StepModels";
import { StepModelConfig } from "./StepModelConfig";
import { StepSensors } from "./StepSensors";
import { StepReview } from "./StepReview";
import { StepDomainLimits } from "./StepDomainLimits";
import type { OnboardingSnapshot } from "../../store/Types";

interface ConfigWizardProps {
  instanceId: number;
  instanceName: string;
  initialSnapshot: OnboardingSnapshot | null;
}

export function ConfigWizard({ instanceId, instanceName, initialSnapshot }: ConfigWizardProps) {
  const [step, setStep] = useAtom(wizardStepAtom);
  const [state, setState] = useAtom(wizardStateAtom);
  const setDirty = useSetAtom(dirtyAtom);
  const saveStatus = useAtomValue(saveStatusAtom);
  const lastRunOk = useAtomValue(lastRunOkAtom);
  const hasAppliedDomainLimitsOnce = useAtomValue(hasAppliedDomainLimitsOnceAtom);
  const { flush } = useDraftAutosave(Number.isNaN(instanceId) ? null : instanceId);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Resume precedence per documentation/04: live draft -> last submitted
  // snapshot -> defaults. Runs once on mount; hydration itself must not mark
  // the draft dirty (nothing the user did), so dirty is reset right after.
  useEffect(() => {
    if (Number.isNaN(instanceId)) return;
    loadInitialConfig(instanceId)
      .then((res) => {
        setState(res.data);
        const resumedStep = Number(res.currentStep) as WizardStep;
        setStep(WIZARD_STEPS.includes(resumedStep) ? resumedStep : 2);
        setDirty(false);
        setLoadError(null);
      })
      .catch((e) => {
        // Surface this instead of silently falling back to a blank wizard —
        // a failure here (e.g. a schema mismatch on old saved data) must not
        // look indistinguishable from "there's genuinely nothing saved yet."
        // The saved draft/snapshot in the database is untouched either way.
        console.error("[ConfigWizard] loadInitialConfig failed:", e);
        setLoadError(e instanceof Error ? e.message : "Failed to load saved configuration.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const stepIndex = WIZARD_STEPS.indexOf(step);

  const goNext = () => {
    const err = validateStep(step, state);
    if (err) {
      window.alert(err);
      return;
    }
    // Machine Config just validated ("green tick") — generate the KPI draft
    // (kpi_draft_pi/kpi_draft_inferred) now so Sensor Mapping (step 6) has
    // real rows by the time the user gets there. Best-effort: a failure here
    // shouldn't block wizard navigation — Sensor Mapping's own fetch surfaces
    // the error if the draft never lands.
    if (step === 2 && !Number.isNaN(instanceId)) {
      generateKpiDraft(instanceId, state).catch((e) =>
        console.error("[ConfigWizard] generateKpiDraft failed:", e)
      );
    }
    if (stepIndex < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (stepIndex > 0) setStep(WIZARD_STEPS[stepIndex - 1]);
  };

  return (
    <div className="flex flex-col pb-20">
      {loadError && (
        <div className="mx-auto mt-6 w-full max-w-4xl rounded-md border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
          Couldn&apos;t load your saved configuration ({loadError}). The form below is starting from
          defaults, but your saved data has <strong>not</strong> been deleted — this is a load/display error.
          Try reloading the page; if it persists, share this message.
        </div>
      )}
      <div className="mx-auto mt-6 flex w-full max-w-4xl flex-col rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h1 className="text-lg font-bold text-text-primary">AFP Configuration Wizard</h1>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span
              className={
                "h-2.5 w-2.5 rounded-full " +
                (saveStatus === "saving"
                  ? "animate-pulse bg-accent-blue"
                  : saveStatus === "saved"
                    ? "bg-accent-green"
                    : saveStatus === "error"
                      ? "bg-accent-red"
                      : "bg-border")
              }
            />
            <span>
              Draft:{" "}
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && <span className="text-accent-green">Saved</span>}
              {saveStatus === "error" && <span className="text-accent-red">Save failed</span>}
              {saveStatus === "idle" && "Idle"}
            </span>
          </div>
        </div>

        <ol className="flex w-full items-center justify-center gap-0 px-6 py-5">
          {WIZARD_STEPS.map((s, i) => {
          const isActive = s === step;
          // Review (step 7) and Domain Limits (step 8) are terminal action
          // steps, not fill-in-a-form steps — validateStep doesn't mean
          // anything for them. Tick them instead on their real completion
          // signal. Step 7's tick tracks the MOST RECENT run only (lastRunOk,
          // falling back to the durable snapshot's last attempt on first
          // load) — unlike hasAppliedDomainLimitsOnceAtom below, it must NOT
          // stay green through a later failed re-run (see lastRunOkAtom).
          const isFilled =
            !isActive &&
            (s === 7
              ? lastRunOk !== null
                ? lastRunOk
                : !!initialSnapshot?.result?.ok
              : s === 8
                ? !!initialSnapshot?.domainLimitsAppliedAt || hasAppliedDomainLimitsOnce
                : validateStep(s, state) === null);
          const isPast = i < stepIndex;
          return (
            <li key={s} className="relative flex flex-1 flex-col items-center">
              {i < WIZARD_STEPS.length - 1 && (
                <div
                  className={
                    "absolute top-4 right-[calc(-50%+18px)] left-[calc(50%+18px)] z-0 h-0.5 transition-colors duration-300 " +
                    (isPast ? "bg-accent-blue" : "bg-border")
                  }
                />
              )}
              <button
                type="button"
                onClick={() => setStep(s)}
                title={`Go to ${STEP_META[s].label}`}
                className="relative z-10 flex flex-col items-center gap-1 rounded-md px-2 py-1 outline-none transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold shadow-sm transition-all duration-200 " +
                    (isActive
                      ? "border-accent-blue bg-accent-blue text-background shadow-accent-blue/30"
                      : isFilled
                        ? "border-accent-green bg-accent-green/10 text-accent-green"
                        : "border-border bg-background text-text-secondary group-hover:border-accent-blue/50")
                  }
                >
                  {isFilled ? "✓" : i + 1}
                </span>
                <span
                  className={
                    "text-center text-[10px] uppercase tracking-wide transition-colors duration-150 " +
                    (isActive ? "text-accent-blue" : isFilled ? "text-accent-green" : "text-text-secondary")
                  }
                >
                  {STEP_META[s].label}
                </span>
              </button>
            </li>
          );
        })}
        </ol>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <section className="flex flex-col gap-1">
          <p className="text-sm text-text-secondary">{STEP_META[step].subtitle}</p>
        </section>

        <div className="flex flex-col gap-4">
          {step === 2 && <StepMachineConfig />}
          {step === 4 && <StepModels />}
          {step === 5 && <StepModelConfig />}
          {step === 6 && <StepSensors instanceId={instanceId} />}
          {step === 7 && <StepReview instanceId={instanceId} initialSnapshot={initialSnapshot} flushDraft={flush} />}
          {step === 8 && <StepDomainLimits instanceId={instanceId} initialSnapshot={initialSnapshot} />}
        </div>

        <footer className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs uppercase tracking-wide text-text-secondary">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
            >
              Back
            </button>
            {step !== 8 && (
              <button
                type="button"
                onClick={goNext}
                className="rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background"
              >
                Next
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export type { WizardStep };
