// ─── AFP Machine Config wizard — option catalogs & label-mapping dictionaries ───
// Ported verbatim from D:\fp\AFP UI Development\asset_config_ui\index.html
// (buildMachineConfigRows(), lines ~3504-3516, plus the questionnaire option
// lists in renderMachineConfig). Codes (map keys) are what's stored in state;
// labels are what gets written into the Excel and shown in the UI.

export interface Option {
  value: string;
  label: string;
}

const toOptions = (map: Record<string, string>): Option[] =>
  Object.entries(map).map(([value, label]) => ({ value, label }));

export const SERVICE_MAP: Record<string, string> = {
  cgc: "Cracked Gas Compressor",
  c2r: "Ethylene Refrigeration",
  c3r: "Propylene Refrigeration",
};
export const SERVICE_OPTIONS = toOptions(SERVICE_MAP);

export const DRIVER_MAP: Record<string, string> = { steam_turbine: "Steam Turbine", other: "Other" };
export const DRIVER_OPTIONS = toOptions(DRIVER_MAP);

export const SUBSYS_MAP: Record<string, string> = {
  wet_seal: "Wet Seal System",
  dry_gas_seal: "Dry Gas Seal System",
  condition_monitoring: "Condition Monitoring System",
  other: "Other",
};
export const SUBSYS_OPTIONS = toOptions(SUBSYS_MAP);

export const BEARING_MAP: Record<string, string> = {
  de_journal: "DE Journal Bearing",
  nde_journal: "NDE Journal Bearing",
  thrust_bearing: "Thrust Bearing",
  coupling: "Coupling",
};
export const BEARING_OPTIONS = toOptions(BEARING_MAP);

/** Turbine condition-monitoring reuses BEARING_MAP but only the first 3 (no "Coupling"). */
export const TURBINE_BEARING_OPTIONS = BEARING_OPTIONS.filter((o) => o.value !== "coupling");

export const DGS_MAP: Record<string, string> = {
  seal_gas_filter: "Seal Gas Filter",
  de_dgs: "DE DGS",
  nde_dgs: "NDE DGS",
};
export const DGS_OPTIONS = toOptions(DGS_MAP);

export const DGS_COMP_MAP: Record<string, string> = {
  separation_gas: "Separation Gas System",
  primary_vent: "Primary Vent Monitoring",
  secondary_vent: "Secondary Vent Monitoring",
};
export const DGS_COMP_OPTIONS = toOptions(DGS_COMP_MAP);

export const OIL_MAP: Record<string, string> = {
  main_oil_pump: "Main Oil Pump",
  standby_oil_pump: "Standby Oil Pump",
  emergency_oil_pump: "Emergency Oil Pump",
  shaft_driven_pump: "Shaft Driven Oil Pump",
  oil_console: "Oil Console",
  oil_filter: "Oil Filter",
  duplex_oil_filter: "Duplex Oil Filter",
  oil_cooler: "Oil Cooler",
  rundown_tank: "Rundown Tank",
  accumulator: "Accumulator",
  temp_control_valve: "Temperature Control Valve",
  other: "Other",
};
export const OIL_OPTIONS = toOptions(OIL_MAP);

export const TREAT_MAP: Record<string, string> = { caustic_tower: "Caustic Tower", other: "Other" };
export const TREAT_OPTIONS = toOptions(TREAT_MAP);

/** Refrigeration-only stage equipment, appended for service in {c2r, c3r}. */
const STAGE_EQ_REFRIGERATION_MAP: Record<string, string> = {
  ref_desuperheater: "Refrigerant Desuperheater",
  ref_condenser: "Refrigerant Condenser",
  ref_accumulator: "Refrigerant Accumulator",
};
export const STAGE_EQ_MAP: Record<string, string> = {
  intercooler: "Intercooler",
  aftercooler: "Aftercooler",
  ...STAGE_EQ_REFRIGERATION_MAP,
  kod: "Knockout Drum",
  suction_strainer: "Suction Strainer",
  recycle_loop: "Recycle Loop",
  other: "Other",
};
/** Base set (all services) — refrigeration-only options appended per-service in the UI. */
export const STAGE_EQ_BASE_OPTIONS: Option[] = [
  { value: "intercooler", label: "Intercooler" },
  { value: "aftercooler", label: "Aftercooler" },
  { value: "kod", label: "Knockout Drum" },
  { value: "suction_strainer", label: "Suction Strainer" },
  { value: "recycle_loop", label: "Recycle Loop" },
  { value: "other", label: "Other" },
];
export const STAGE_EQ_REFRIGERATION_OPTIONS = toOptions(STAGE_EQ_REFRIGERATION_MAP);

export const TURB_MAP: Record<string, string> = {
  condensing: "Condensing Turbine",
  back_pressure: "Back-Pressure Turbine",
  extraction_condensing: "Extraction-Condensing Turbine",
  single_stage: "Single-Stage Turbine",
  multi_stage: "Multi-Stage Turbine",
};
export const TURB_OPTIONS = toOptions(TURB_MAP);

export const AUX_MAP: Record<string, string> = {
  surface_condenser: "Surface Condenser",
  steam_ejector: "Steam Ejector System",
  surface_condenser_pump: "Surface Condenser Pump",
  vacuum_system: "Vacuum System",
  gland_steam: "Gland Steam System",
  condensate_system: "Condensate System",
  overspeed_protection: "Overspeed Protection",
  trip_throttle_valve: "Trip & Throttle Valve",
  extraction_steam: "Extraction Steam System",
};
/** Auxiliary-systems checklist shown to the user (excludes surface_condenser_pump,
 * which is derived from the surface-condenser sub-flow, not picked directly). */
export const AUX_OPTIONS = toOptions(AUX_MAP).filter((o) => o.value !== "surface_condenser_pump");

export const COND_ARR_MAP: Record<string, string> = {
  shell_tube: "Shell & Tube Condenser",
  air_cooled: "Air Cooled Condenser",
};
export const COND_ARR_OPTIONS = toOptions(COND_ARR_MAP);

export const LOC_MAP: Record<string, string> = {
  suction: "Suction Side",
  discharge: "Discharge Side",
  both: "Both",
};
export const LOC_OPTIONS = toOptions(LOC_MAP);

/** The 4 analytics models, in cascade order (selecting index N auto-selects 0..N-1). */
export const MODEL_CHAIN: Option[] = [
  { value: "deviation_detection", label: "Deviation Detection" },
  { value: "failure_mode_identification", label: "Failure Mode Identification" },
  { value: "failure_prediction", label: "Failure Prediction" },
  { value: "workflow_suggestions", label: "Workflow Suggestions" },
];

export const UOM_OPTIONS: string[] = [
  "-", "bar(g)", "mbar(g)", "psi(g)", "atm(g)", "Pa(g)", "kPa(g)", "MPa(g)",
  "kg/cm²(g)", "mmH2O(g)", "mmHg(g)",
  "°C", "°F", "K", "°R", "rpm", "mm/s", "µm", "mm", "kW", "A", "V", "%",
  "lb/h", "kg/h", "t/h", "kg/s", "m³/h", "m³/s", "L/m", "ft³/h",
  "Nm³/h", "Hz",  "µS/cm", "S/m", "kg/m³"
];

/** Which side of the trip limit trips the parameter — ported alongside the
 * parameter itself from Static Input/Failure_Prediction_Tags.xlsx's "Trip
 * Direction" column (see TripLimitTemplates.ts). */
export const TRIP_DIRECTION_OPTIONS: string[] = ["HIGH", "LOW"];

/** User-selected justification for a Trip Limit value. */
export const TRIP_LIMIT_BASIS_OPTIONS: string[] = [
  "Threshold limit is defined based on configured DCS alarm limits for the parameter",
  "Threshold limit is defined based on OEM or design-specified maximum allowable value",
  "Threshold limit is defined based on historical operating behavior of the parameter",
  "Threshold limit is defined based on user manual input",
];

/** Non-alphanumeric → "_", matching the original toKey() exactly. */
export function toKey(s: string | null | undefined): string {
  return String(s ?? "").replace(/[^a-zA-Z0-9_]/g, "_");
}
