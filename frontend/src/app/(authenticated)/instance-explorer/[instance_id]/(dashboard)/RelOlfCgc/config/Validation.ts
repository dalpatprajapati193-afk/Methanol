// ─── Wizard step validation — ported from validateStep()/validateMCConfig() ──
// in asset_config_ui/index.html. Returns an error string (shown as a toast) or
// null if the step is valid and the user may advance.

import type { AfpWizardState } from "./ConfigTypes";
import { generateSubAssets } from "./SubAssets";
import type { WizardStep } from "./ConfigAtoms";

function validateMachineConfig(state: AfpWizardState): string | null {
  const { mc } = state;
  if (!mc.service) return "Please select a compressor service.";
  if (!mc.driverType) return "Please select a driver type.";
  if (!mc.numCasings) return "Please select the number of casings.";

  for (const [i, ca] of mc.casings.slice(0, Number(mc.numCasings)).entries()) {
    const n = i + 1;
    if (!ca.name.trim()) return `Casing ${n}: name is required.`;
    if (!ca.stages.length) return `Casing ${n}: select at least one stage.`;
    if (ca.internallyConnected === null) return `Casing ${n}: specify whether stages are internally connected.`;
    if (!ca.suctionStreams) return `Casing ${n}: select the number of suction streams.`;
    if (!ca.dischargeStreams) return `Casing ${n}: select the number of discharge streams.`;
    if (ca.hasSideLoads === null) return `Casing ${n}: specify whether side loads exist.`;
    if (ca.hasSideLoads && !ca.numSideStreams) return `Casing ${n}: select the number of side loads.`;
    if (!ca.subsystems.length) return `Casing ${n}: select at least one casing subsystem.`;
    if (ca.subsystems.includes("dry_gas_seal") && !ca.dgsSupport.length)
      return `Casing ${n}: select at least one Dry Gas Seal support component.`;
    if (ca.dgsSupport.includes("de_dgs") && !ca.deDgsComponents.length)
      return `Casing ${n}: select at least one DE DGS component.`;
    if (ca.dgsSupport.includes("nde_dgs") && !ca.ndeDgsComponents.length)
      return `Casing ${n}: select at least one NDE DGS component.`;
    if (ca.subsystems.includes("condition_monitoring") && !ca.bearings.length)
      return `Casing ${n}: select at least one bearing for condition monitoring.`;
  }

  if (!mc.oilEquipment.length) return "Select at least one oil-system equipment item.";
  if (!mc.processTreatment.length) return "Select at least one process-treatment system.";

  if (mc.driverType === "steam_turbine") {
    if (!mc.numTurbines) return "Please select the number of turbines.";
    for (const [i, tb] of mc.turbines.slice(0, Number(mc.numTurbines)).entries()) {
      const n = i + 1;
      if (!tb.type) return `Turbine ${n}: select a turbine type.`;
      if (!tb.connectedCasingsOrdered.length) return `Turbine ${n}: select at least one connected casing.`;
      if (!tb.auxiliarySystems.length) return `Turbine ${n}: select at least one auxiliary system.`;
    }
  }

  return null;
}

function validateModels(state: AfpWizardState): string | null {
  const items = generateSubAssets(state.mc);
  if (!items.length) return "No sub-assets generated yet — complete Machine Config first.";
  for (const item of items) {
    if (!(state.models[item.id] || []).length) return `Select at least one model for "${item.label}".`;
  }
  return null;
}

function validateModelConfig(state: AfpWizardState): string | null {
  const { modelConfig } = state;
  if (!modelConfig.testStartDate) return "Set the test start date.";
  if (!modelConfig.testEndDate) return "Set the test end date.";
  const hasTag = modelConfig.plantOnlineTags.some((t) => t.piName.trim() !== "");
  if (!hasTag) return "Add at least one plant online tag with a PI name — Session 4 needs it to find a reference snapshot.";
  return null;
}

function validateSensors(state: AfpWizardState): string | null {
  const items = generateSubAssets(state.mc);
  const anyCommon = state.commonSensors.some((s) => s.name.trim() !== "");
  const anySubAsset = items.some((item) => (state.sensors[item.id] || []).some((s) => s.name.trim() !== ""));
  if (!anyCommon && !anySubAsset) return "Map at least one sensor tag before continuing.";
  return null;
}

export function validateStep(step: WizardStep, state: AfpWizardState): string | null {
  switch (step) {
    case 2:
      return validateMachineConfig(state);
    case 4:
      return validateModels(state);
    case 5:
      return validateModelConfig(state);
    case 6:
      return validateSensors(state);
    case 7:
      return null;
    default:
      return null;
  }
}
