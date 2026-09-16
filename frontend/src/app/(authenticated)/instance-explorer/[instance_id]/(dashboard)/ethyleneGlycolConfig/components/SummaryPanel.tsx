"use client";

import { useAtomValue } from "jotai";
import { configDataAtom, currentStepAtom } from "../store/WizardAtoms";
import { buildActiveSteps, findLeaf } from "../store/WizardSteps";
import BlockDiagram from "./BlockDiagram";
import LiveSummary from "./LiveSummary";

export default function SummaryPanel() {
  const config = useAtomValue(configDataAtom);
  const currentStepId = useAtomValue(currentStepAtom);

  const activeSteps = buildActiveSteps(config);
  const current = findLeaf(activeSteps, currentStepId) ?? activeSteps[0];

  const isEquipmentSelect = current.id === "eq.select";
  const isEquipmentDetail = current.group === "equipment" && !isEquipmentSelect;

  return (
    <aside className="w-[300px] shrink-0 bg-surface border-l border-border overflow-y-auto p-4 hidden lg:flex flex-col gap-4">
      <BlockDiagram
        config={config}
        phaseNum={current.phaseNum}
        isEquipmentSelect={isEquipmentSelect}
        isEquipmentDetail={isEquipmentDetail}
      />
      <LiveSummary config={config} leafId={current.id} heading={current.sidebarLabel} />
    </aside>
  );
}
