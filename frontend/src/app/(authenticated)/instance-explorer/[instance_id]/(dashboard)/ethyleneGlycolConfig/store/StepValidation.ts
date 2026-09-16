import type { EgConfigData } from "./Types";
import type { PhaseId } from "./WizardSteps";

/**
 * Advisory per-step validation. Returns a list of human-readable messages for
 * required fields that are still empty. Submit shows these but still lets the
 * user proceed ("validate, but allow skip").
 */
export function validateStep(phaseId: PhaseId, c: EgConfigData): string[] {
  switch (phaseId) {
    case "plant":
      return validatePlant(c);
    // KPI / Input mapping / Forecasting / Export have no hard-required fields —
    // they are configured incrementally and are safe to submit partially.
    case "kpi":
    case "input":
    case "forecast":
    case "export":
    default:
      return [];
  }
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function validatePlant(c: EgConfigData): string[] {
  const missing: string[] = [];

  // General Plant Information
  if (isBlank(c.configName)) missing.push("Plant Name");
  if (isBlank(c.plantCapacity)) missing.push("Plant Design Capacity");
  if (isBlank(c.commissioningYear)) missing.push("Year of Commissioning");
  if (isBlank(c.techLicensor)) missing.push("Technology Licensor");
  if (isBlank(c.waterToEORatio)) missing.push("Design Water-to-EO Molar Ratio");

  // Steam System — every header needs a label
  c.steamHeaders.forEach((h, i) => {
    if (isBlank(h.headerLabel)) missing.push(`Steam Header ${i + 1} label`);
  });

  // Equipment Selection
  if (c.eq_hasGFS === "yes" && isBlank(c.eq_gfsArrangement)) {
    missing.push("Reabsorber & GFS Arrangement");
  }

  // Stripping Column (always present)
  if (isBlank(c.sc_columnType)) missing.push("Stripping Column — Column Type");

  // Conditionally-visible columns
  const separate = c.eq_hasGFS === "yes" && c.eq_gfsArrangement === "Separate Columns";
  const integrated = c.eq_hasGFS === "yes" && c.eq_gfsArrangement === "Integrated Single Column";
  if (separate) {
    if (isBlank(c.ra_columnType)) missing.push("Reabsorber — Column Type");
    if (isBlank(c.ra_absorptionMedium)) missing.push("Reabsorber — Absorption Medium");
    if (isBlank(c.gfs_columnType)) missing.push("GFS — Column Type");
  }
  if (integrated) {
    if (isBlank(c.int_columnType)) missing.push("Integrated Column — Column Type");
    if (isBlank(c.int_absorptionMedium)) missing.push("Integrated Column — Absorption Medium");
  }

  // Glycol Reactor
  if (isBlank(c.gr_reactorType)) missing.push("Reactor Type");

  // Evaporation System
  if (isBlank(c.ev_flowArrangement)) missing.push("Evaporation — Flow Arrangement");
  if (isBlank(c.ev_firstEffectSource)) missing.push("Evaporation — Energy Source for 1st Effect");

  return missing;
}
