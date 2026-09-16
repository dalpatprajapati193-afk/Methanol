"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { configDataAtom, currentStepAtom, wizardCompletedAtom } from "../store/WizardAtoms";
import {
  PHASES,
  buildActiveSteps,
  findLeaf,
  firstLeafOfPhase,
  leafForSubstep,
} from "../store/WizardSteps";

export default function WorkflowBar() {
  const config = useAtomValue(configDataAtom);
  const [currentStepId, setCurrentStepId] = useAtom(currentStepAtom);
  const wizardCompleted = useAtomValue(wizardCompletedAtom);
  const setWizardCompleted = useSetAtom(wizardCompletedAtom);

  const activeSteps = buildActiveSteps(config);
  const current = findLeaf(activeSteps, currentStepId) ?? activeSteps[0];
  const activePhaseNum = current.phaseNum;
  const activeSubstep = current.substep;

  function goToPhase(phaseId: (typeof PHASES)[number]["id"]) {
    const leaf = firstLeafOfPhase(activeSteps, phaseId);
    if (leaf) {
      if (wizardCompleted) setWizardCompleted(false);
      setCurrentStepId(leaf.id);
    }
  }

  function goToSubstep(key: "3.1" | "3.2") {
    const leaf = leafForSubstep(activeSteps, key);
    if (leaf) {
      if (wizardCompleted) setWizardCompleted(false);
      setCurrentStepId(leaf.id);
    }
  }

  return (
    <div className="shrink-0 bg-background border-b border-border px-6 py-3">
      <div className="grid grid-cols-5 gap-3 items-start">
        {PHASES.map((phase) => {
          const state = wizardCompleted
            ? "completed"
            : phase.num === activePhaseNum
            ? "active"
            : phase.num < activePhaseNum
            ? "completed"
            : "future";
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => goToPhase(phase.id)}
              className={[
                "rounded-lg border px-4 py-2.5 flex flex-col text-left transition-colors",
                state === "active"
                  ? "bg-accent-blue-light border-accent-blue"
                  : state === "completed"
                  ? "bg-accent-green-light border-accent-green"
                  : "bg-surface border-border hover:bg-surface-hover",
              ].join(" ")}
            >
              <span
                className={[
                  "text-xs font-medium",
                  state === "active"
                    ? "text-accent-blue"
                    : state === "completed"
                    ? "text-accent-green"
                    : "text-text-secondary",
                ].join(" ")}
              >
                Step {phase.num}
              </span>
              <span
                className={[
                  "text-sm font-semibold mt-0.5",
                  state === "future" ? "text-text-secondary" : "text-text-primary",
                ].join(" ")}
              >
                {phase.label}
              </span>

              {phase.substeps && (
                <div className="flex gap-1.5 mt-2">
                  {phase.substeps.map((sub) => {
                    const subActive = phase.num === activePhaseNum && activeSubstep === sub.key;
                    return (
                      <span
                        key={sub.key}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          goToSubstep(sub.key);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            goToSubstep(sub.key);
                          }
                        }}
                        className={[
                          "rounded px-1.5 py-0.5 text-xs cursor-pointer transition-colors",
                          subActive
                            ? "bg-accent-blue text-surface"
                            : "bg-surface text-text-secondary border border-border hover:bg-surface-hover",
                        ].join(" ")}
                      >
                        {sub.key} {sub.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
