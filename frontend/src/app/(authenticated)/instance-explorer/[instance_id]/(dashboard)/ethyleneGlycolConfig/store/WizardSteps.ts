import type { ComponentType } from "react";
import type { EgConfigData, EquipmentSectionId } from "./Types";

import GeneralInfo from "../components/steps/GeneralInfo";
import SteamSystem from "../components/steps/SteamSystem";
import EquipmentSelect from "../components/steps/EquipmentSelect";
import EquipmentDetails from "../components/steps/EquipmentDetails";
import KpiSelection from "../components/steps/KpiSelection";
import InputMapping from "../components/steps/InputMapping";
import AdditionalInputs from "../components/steps/AdditionalInputs";
import ForecastConfig from "../components/steps/ForecastConfig";
import ExportConfig from "../components/steps/ExportConfig";

// ─── Equipment sections (ordered) + legacy conditional visibility ──────────────

export const EQUIPMENT_SECTIONS: {
  id: EquipmentSectionId;
  label: string;
  visible: (c: EgConfigData) => boolean;
}[] = [
  { id: "strippingColumn", label: "Stripping Column", visible: () => true },
  {
    id: "reabsorber",
    label: "Reabsorber",
    visible: (c) => c.eq_hasGFS === "yes" && c.eq_gfsArrangement === "Separate Columns",
  },
  {
    id: "gfs",
    label: "Glycol Feed Stripper — GFS",
    visible: (c) => c.eq_hasGFS === "yes" && c.eq_gfsArrangement === "Separate Columns",
  },
  {
    id: "integrated",
    label: "Integrated Reabsorber & GFS",
    visible: (c) => c.eq_hasGFS === "yes" && c.eq_gfsArrangement === "Integrated Single Column",
  },
  { id: "feedPreheat", label: "Feed Preheat Exchangers", visible: () => true },
  { id: "glycolReactor", label: "Glycol Reactor", visible: () => true },
  { id: "evaporation", label: "Evaporation System", visible: () => true },
  { id: "otherEquipment", label: "Other Energy Sensitive Equipment", visible: () => true },
];

// ─── Phase tree (top workflow bar) ─────────────────────────────────────────────

export type PhaseId = "plant" | "kpi" | "input" | "forecast" | "export";

export interface PhaseSubstep {
  key: "3.1" | "3.2";
  label: string;
  leafId: string;
}

export interface Phase {
  id: PhaseId;
  num: number;
  label: string;
  substeps?: PhaseSubstep[];
}

export const PHASES: Phase[] = [
  { id: "plant", num: 1, label: "Plant config" },
  { id: "kpi", num: 2, label: "KPI selection" },
  {
    id: "input",
    num: 3,
    label: "Input mapping",
    substeps: [
      { key: "3.1", label: "KPI Inputs", leafId: "inputKpi" },
      { key: "3.2", label: "Additional", leafId: "inputAdditional" },
    ],
  },
  { id: "forecast", num: 4, label: "Forecasting" },
  { id: "export", num: 5, label: "Review and Submit" },
];

// ─── Leaf steps (the navigable units) ──────────────────────────────────────────

export interface LeafStep {
  id: string;
  phaseId: PhaseId;
  phaseNum: number;
  phaseLabel: string;
  sidebarLabel: string;
  group?: "equipment";
  substep?: "3.1" | "3.2";
  component: ComponentType<{ only?: EquipmentSectionId }>;
  only?: EquipmentSectionId;
}

function phaseMeta(id: PhaseId): { num: number; label: string } {
  const p = PHASES.find((ph) => ph.id === id)!;
  return { num: p.num, label: p.label };
}

function leaf(
  id: string,
  phaseId: PhaseId,
  sidebarLabel: string,
  component: ComponentType<{ only?: EquipmentSectionId }>,
  extra?: Partial<LeafStep>,
): LeafStep {
  const { num, label } = phaseMeta(phaseId);
  return { id, phaseId, phaseNum: num, phaseLabel: label, sidebarLabel, component, ...extra };
}

/** Ordered flat list of currently-visible leaf steps, derived from the config. */
export function buildActiveSteps(c: EgConfigData): LeafStep[] {
  const steps: LeafStep[] = [];

  // Phase 1 — Plant config
  steps.push(leaf("general", "plant", "General Info", GeneralInfo));
  steps.push(leaf("steam", "plant", "Steam System", SteamSystem));
  steps.push(leaf("eq.select", "plant", "Equipment Selection", EquipmentSelect, { group: "equipment" }));
  for (const s of EQUIPMENT_SECTIONS) {
    if (s.visible(c)) {
      steps.push(
        leaf(`eq.${s.id}`, "plant", s.label, EquipmentDetails, { group: "equipment", only: s.id }),
      );
    }
  }

  // Phase 2 — KPI selection (soft sensors merged inline; no separate leaf)
  steps.push(leaf("kpi", "kpi", "KPI Selection", KpiSelection));

  // Phase 3 — Input mapping (two substeps)
  steps.push(leaf("inputKpi", "input", "KPI Inputs", InputMapping, { substep: "3.1" }));
  steps.push(leaf("inputAdditional", "input", "Additional Inputs", AdditionalInputs, { substep: "3.2" }));

  // Phase 4 — Forecasting
  steps.push(leaf("forecast", "forecast", "Forecasting", ForecastConfig));

  // Phase 5 — Export
  steps.push(leaf("export", "export", "Review & Submit", ExportConfig));

  return steps;
}

// ─── Selectors ─────────────────────────────────────────────────────────────────

export function findLeaf(steps: LeafStep[], id: string): LeafStep | undefined {
  return steps.find((s) => s.id === id);
}

export function leafIndex(steps: LeafStep[], id: string): number {
  return steps.findIndex((s) => s.id === id);
}

export function firstLeafOfPhase(steps: LeafStep[], phaseId: PhaseId): LeafStep | undefined {
  return steps.find((s) => s.phaseId === phaseId);
}

export function leafForSubstep(steps: LeafStep[], substep: "3.1" | "3.2"): LeafStep | undefined {
  return steps.find((s) => s.substep === substep);
}

/** True if `leafId` is the LAST visible leaf of its phase (i.e. the page that
 *  carries the step's "Submit" button). */
export function isLastLeafOfPhase(steps: LeafStep[], leafId: string): boolean {
  const leaf = findLeaf(steps, leafId);
  if (!leaf) return false;
  const phaseLeaves = steps.filter((s) => s.phaseId === leaf.phaseId);
  return phaseLeaves[phaseLeaves.length - 1]?.id === leafId;
}
