"use client";

import { useAtomValue } from "jotai";
import { type LeafStep, leafIndex } from "../store/WizardSteps";
import { wizardCompletedAtom } from "../store/WizardAtoms";
import styles from "./EgChrome.module.css";

export default function WizardSidebar({
  instanceName,
  activeSteps,
  currentLeafId,
  onNavigate,
}: {
  instanceName: string;
  activeSteps: LeafStep[];
  currentLeafId: string;
  onNavigate: (id: string) => void;
}) {
  const wizardCompleted = useAtomValue(wizardCompletedAtom);
  const current = activeSteps.find((s) => s.id === currentLeafId) ?? activeSteps[0];
  const activePhaseId = current.phaseId;
  const phaseLeaves = activeSteps.filter((s) => s.phaseId === activePhaseId);
  const currentIdx = leafIndex(activeSteps, currentLeafId);
  const progress = wizardCompleted ? 100 : Math.round(((currentIdx + 1) / activeSteps.length) * 100);

  const flat = phaseLeaves.filter((l) => l.group !== "equipment");
  const equipment = phaseLeaves.filter((l) => l.group === "equipment");

  function stateOf(l: LeafStep) {
    if (wizardCompleted) return "completed" as const;
    const idx = leafIndex(activeSteps, l.id);
    if (l.id === currentLeafId) return "active" as const;
    if (idx < currentIdx) return "completed" as const;
    return "future" as const;
  }

  function StepRow({ leaf, num, nested }: { leaf: LeafStep; num: number; nested?: boolean }) {
    const state = stateOf(leaf);
    return (
      <button
        onClick={() => onNavigate(leaf.id)}
        className={[
          styles.stepRow,
          state === "active" ? styles.stepRowActive : "",
          nested ? styles.stepRowNested : "",
        ].join(" ")}
        style={state === "completed" ? { backgroundColor: "#f0fdf4", color: "#16a34a", fontWeight: 500 } : undefined}
      >
        <span
          className={[
            styles.circle,
            nested ? styles.circleSmall : "",
            state === "active" ? styles.circleActive : "",
            state === "completed" ? styles.circleCompleted : "",
          ].join(" ")}
        >
          {state === "completed" ? "✓" : num}
        </span>
        <span className="truncate">
          {leaf.substep ? `${leaf.substep} ${leaf.sidebarLabel}` : leaf.sidebarLabel}
        </span>
      </button>
    );
  }

  let counter = 0;

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-border">
        <p className="text-xs text-text-secondary truncate">{instanceName}</p>
        <p className="text-sm font-semibold text-text-primary mt-0.5">{current.phaseLabel}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-text-secondary shrink-0">{progress}%</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {flat.map((l) => (
          <StepRow key={l.id} leaf={l} num={++counter} />
        ))}

        {equipment.length > 0 && (
          <>
            <p className="px-2.5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Equipment
            </p>
            {equipment.map((l) => (
              <StepRow key={l.id} leaf={l} num={++counter} nested />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
