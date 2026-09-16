// ─── Equipment section ids (shared by the step model + EquipmentDetails) ───────

export type EquipmentSectionId =
  | "strippingColumn"
  | "reabsorber"
  | "gfs"
  | "integrated"
  | "feedPreheat"
  | "glycolReactor"
  | "evaporation"
  | "otherEquipment";

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface DirectSteamInput {
  freshSteam: "yes" | "no";
  mediaSource: string;
  otherLabel: string;
}

export interface FpeExchanger {
  freshSteam: "yes" | "no";
  heatSource: string;
  heatSourceOther: string;
  exchangerType: string;
}

export interface OeEquipmentItem {
  oe_name: string;
  oe_type: string;
  oe_freshSteam: "yes" | "no";
  oe_heatSource: string;
  oe_heatSourceOther: string;
}

export interface TagEntry {
  tag: string;
  uom: string;
  min?: string;
  max?: string;
  default?: string;
  value_type?: "real" | "polynomial";
}

export interface OutputKpiMapping {
  input_type:
    | "pi_tag_direct"
    | "formula_mapped"
    | "soft_sensor"
    | "has_pi_tag"
    | "no_pi_tag"
    | "skipped"
    | "not_configured";
  tags?: TagEntry[];
  operation?: string;
  uom?: string;
  variables?: Record<string, { tags: TagEntry[]; uom: string; operation?: string }>;
  x_variables?: Record<string, { tags: TagEntry[]; uom: string; operation?: string }>;
  has_pi_tag?: boolean;
}

export interface AdditionalInputMapping {
  is_constant: boolean;
  value?: string;
  tags?: TagEntry[];
  uom?: string;
}

export interface SoftSensorModelInfo {
  model_name: string;
  target_column?: string;
  model_location?: string;
  scaling_method?: string;
  feature_names: string[];
  impute_values?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  training_metadata?: Record<string, unknown>;
}

export interface SoftSensorMapping {
  has_pi_tag: boolean;
  tags?: TagEntry[];
  x_variables?: Record<string, { tags: TagEntry[]; uom: string; operation?: string }>;
  model_info?: SoftSensorModelInfo;
  model_filename?: string;
  pkl_filename?: string;
}

export interface ForecastingModelMapping {
  model_info?: SoftSensorModelInfo;
  model_filename?: string;
  x_variables?: Record<string, { tags: TagEntry[]; uom: string }>;
}

export interface ForecastConfig {
  // Fields read directly from the uploaded forecast JSON
  model_name?: string;
  target_column?: string;
  metrics?: Record<string, number>;
  forecast_days?: number;
  data_frequency?: string;
  pullpi_timeinterval?: string;
  eff_format?: unknown[];
  model_filename?: string;
  pkl_filename?: string;
  /** Filenames of sub-model .pkl files keyed by tag_name_short (for X vars that are themselves models). */
  sub_model_pkls?: Record<string, string>;
  /** PI tag mappings keyed by tag_name_short (X variables from eff_format). */
  mappings?: Record<string, { tags: TagEntry[]; operation?: string } | { auto_resolved: true }>;
  /** PI tag(s) for the Y (target) variable. */
  y_tag?: TagEntry[];
}

// ─── Main config — flat structure matching exact Python KPI engine field names ─

export interface EgConfigData {
  // General
  configName: string;
  plantCapacity: string;
  commissioningYear: string;
  techLicensor: string;
  waterToEORatio: string;

  // Steam headers
  numSteamHeaders: number;
  steamHeaders: { headerLabel: string; isSuperheated: "yes" | "no" }[];

  // Equipment selection
  eq_hasGFS: "yes" | "no";
  eq_gfsArrangement: "Integrated Single Column" | "Separate Columns" | "";

  // Stripping Column
  sc_columnType: string;
  sc_hasReboiler: "yes" | "no";
  sc_reboilerFreshSteam: "yes" | "no";
  sc_reboilerMedium: string;
  sc_hasDirectSteam: "yes" | "no";
  sc_directSteamFreshSteam: "yes" | "no";
  sc_numDirectSteam: number;
  sc_directSteamInputs: DirectSteamInput[];
  sc_hasBottomBleed: "yes" | "no";

  // Reabsorber (when eq_gfsArrangement = "Separate Columns")
  ra_columnType: string;
  ra_absorptionMedium: string;
  ra_absorptionMediumOther: string;
  ra_hasIntercooler: "yes" | "no";
  ra_intercoolerMedium: string;
  ra_intercoolerMediumOther: string;
  ra_hasAftercooler: "yes" | "no";
  ra_aftercoolerFreshSteam: "yes" | "no";
  ra_aftercoolerSource: string;
  ra_aftercoolerSourceOther: string;

  // Integrated Column (when eq_gfsArrangement = "Integrated Single Column")
  int_columnType: string;
  int_absorptionMedium: string;
  int_absorptionMediumOther: string;
  int_hasIntercooler: "yes" | "no";
  int_intercoolerMedium: string;
  int_intercoolerMediumOther: string;
  int_hasReboiler: "yes" | "no";
  int_reboilerFreshSteam: "yes" | "no";
  int_reboilerMedium: string;
  int_hasDirectSteam: "yes" | "no";
  int_directSteamFreshSteam: "yes" | "no";
  int_numDirectSteam: number;
  int_directSteamInputs: DirectSteamInput[];
  int_strippingPurpose: string;
  int_overheadVent: string;

  // GFS Separate (when eq_gfsArrangement = "Separate Columns")
  gfs_columnType: string;
  gfs_hasReboiler: "yes" | "no";
  gfs_reboilerFreshSteam: "yes" | "no";
  gfs_reboilerMedium: string;
  gfs_hasDirectSteam: "yes" | "no";
  gfs_directSteamFreshSteam: "yes" | "no";
  gfs_numDirectSteam: number;
  gfs_directSteamInputs: DirectSteamInput[];
  gfs_strippingPurpose: string;
  gfs_overheadVent: string;

  // Feed Preheat Exchangers
  fpe_numExchangers: number;
  fpe_exchangers: FpeExchanger[];

  // Glycol Reactor
  gr_reactorType: string;
  gr_numReactors: number;
  gr_heatRecovered: "yes" | "no";
  gr_heatRecoverySinks: string[];
  gr_numInterstage: number;

  // Evaporation System
  ev_numEffects: number;
  ev_flowArrangement: string;
  ev_firstEffectFreshSteam: "yes" | "no";
  ev_firstEffectSource: string;
  ev_hasMVR: "yes" | "no";
  ev_mvrEffect: number;
  ev_hasTVR: "yes" | "no";
  ev_tvrEffect: number;
  ev_condensateFlash: "yes" | "no";

  // Other Energy Sensitive Equipment
  oe_hasOther: "yes" | "no";
  oe_numEquipment: number;
  oe_equipment: OeEquipmentItem[];

  // KPI / tag mappings
  output_kpis: Record<string, OutputKpiMapping>;
  additional_inputs: Record<string, AdditionalInputMapping>;
  soft_sensor_mappings: Record<string, SoftSensorMapping>;
  forecast_config: ForecastConfig;
}

// ─── Model files registry ────────────────────────────────────────────────────

export interface ModelFileEntry {
  model_alias: "DM" | "LBM";           // DM = Data Model, LBM = Live Benchmarking Model
  file_name: string;                    // e.g. "Selectivity_S44.pkl"
  model_file_display_name: string;      // = variable name
  model_metadata: null;
  state: "new" | "uploaded";           // "new" = needs DB insert; "uploaded" = already in DB
}

// ─── DB record wrapper ────────────────────────────────────────────────────────

export interface EgConfigListItem {
  instanceConfigurationId: number;
  instanceId: number;
  createdAt: string;
  updatedAt: string;
}

export interface EgConfigRecord extends EgConfigListItem {
  data: EgConfigData;
}

// ─── FastAPI response types ───────────────────────────────────────────────────

export interface ExpandedKpi {
  id: string;
  name: string;
  section: string;
  instance_label?: string;
  kpi_type: "sensor" | "formula" | "soft_sensor";
  attribute_name?: string;
  uom: string;
  formula?: string;
  formula_display?: string;
  pi_tag_inputs: string[];
  kpi_ref_inputs: { variable: string; display_name: string }[];
  pi_var_meta: Record<string, { display_name: string; uom: string; type: string }>;
  x_variables: string[];
  configured: boolean;
  config?: OutputKpiMapping;
}

export interface AdditionalInput {
  id: string;
  name: string;
  attribute_name: string;
  uom: string;
  type: string;
}

export interface SoftSensor {
  name: string;
  uom: string;
  x_variables: string[];
}
