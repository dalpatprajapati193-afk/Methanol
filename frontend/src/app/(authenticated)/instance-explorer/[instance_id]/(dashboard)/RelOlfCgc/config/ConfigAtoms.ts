import { atom } from "jotai";
import { newWizardState, type AfpWizardState } from "./ConfigTypes";
import type { OnboardResult } from "../store/Types";

/** Wizard step; step 1 ("Affiliate") and step 3 ("Sub-Assets") are skipped —
 * there's no more affiliate/case concept, and centrifugal-only builds
 * sub-assets from Machine Config, mirroring the original's step-hiding. */
export const WIZARD_STEPS = [2, 4, 5, 6, 7, 8] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_META: Record<WizardStep, { label: string; subtitle: string }> = {
  2: { label: "Machine Config", subtitle: "Answer the compressor configuration questionnaire." },
  4: { label: "Model Selection", subtitle: "Select analytics per sub-asset. Selecting a later model auto-selects all preceding ones." },
  5: { label: "Model Config", subtitle: "Set the test data date range and plant online tags." },
  6: { label: "Sensor Mapping", subtitle: "Name the sensors for each sub-asset and set their units." },
  7: { label: "Review & Run", subtitle: "Review your configuration, then run onboarding to save the reliability data for this equipment." },
  8: {
    label: "Domain/Trip Limit",
    subtitle:
      "Run onboarding on the Review step first — Fill the required information used to calculate the Domain Limit of the parameters for the sub-assets below. Then, fill the Trip Limit for each listed parameter.",
  },
};

export const runStatusAtom = atom<"idle" | "running" | "done" | "error">("idle");

/** Set true on any successful onboarding run and never reset — unlike
 * runStatusAtom (which reflects only the latest attempt), this survives a
 * later failed re-run so the Domain Limits step doesn't "forget" an earlier
 * success that already wrote real data. */
export const hasSucceededOnceAtom = atom(false);

/** Outcome of the most recent onboarding run this session, for the Review &
 * Run stepper tick — unlike hasSucceededOnceAtom, this DOES flip false on a
 * failed re-run, so the tick doesn't stay green while the "Last run: ...
 * failed" banner shows red right next to it. null = no run yet this session
 * (isFilled falls back to initialSnapshot.result.ok). */
export const lastRunOkAtom = atom<boolean | null>(null);

/** Latest onboarding attempt's full record for the "Last run: ... " banner —
 * an atom (not local useState) because StepReview unmounts whenever the
 * wizard steps away from step 7 (see ConfigWizard's `step === 7 && ...`),
 * which would otherwise drop this back to the stale server-fetched
 * initialSnapshot on return, showing a previous run's result. */
export const lastRunSnapshotAtom = atom<{ fileName: string; ranAt: string; result: OnboardResult } | null>(null);

/** Set true once applyDomainLimits() succeeds and never reset — mirrors
 * hasSucceededOnceAtom's reasoning, so the stepper's Domain/Trip Limit tick
 * survives whatever else happens on the page afterward this session. */
export const hasAppliedDomainLimitsOnceAtom = atom(false);

/** Same as hasAppliedDomainLimitsOnceAtom, for the Trip Limit apply flow. */
export const hasAppliedTripLimitsOnceAtom = atom(false);

/** Dirty-guard for draft autosave — set true by any write to wizardStateAtom
 * or wizardStepAtom (see the derived write-atoms below), cleared on flush. */
export const dirtyAtom = atom(false);
export const saveStatusAtom = atom<"idle" | "saving" | "saved" | "error">("idle");

const wizardStepBaseAtom = atom<WizardStep>(2);
/** Writable derived atom — every `set(wizardStepAtom, ...)` across the wizard
 * also marks the draft dirty, with no change needed at each call site. */
export const wizardStepAtom = atom(
  (get) => get(wizardStepBaseAtom),
  (get, set, next: WizardStep) => {
    set(wizardStepBaseAtom, next);
    set(dirtyAtom, true);
  }
);

const wizardStateBaseAtom = atom<AfpWizardState>(newWizardState());
/** Writable derived atom — every `set(wizardStateAtom, ...)` across every step
 * component also marks the draft dirty, with no change needed at each call site. */
export const wizardStateAtom = atom(
  (get) => get(wizardStateBaseAtom),
  (get, set, next: AfpWizardState) => {
    set(wizardStateBaseAtom, next);
    set(dirtyAtom, true);
  }
);
