// ─── AFP Machine Config wizard — state shape ────────────────────────────────
// Mirrors STATE.mc / STATE.models / STATE.sensors / STATE.modelConfig from the
// original asset_config_ui/index.html. Centrifugal-compressor path only
// (Extruder's simpler generic sub-asset-group path is out of scope for now).

export interface StageEquipmentConfig {
  equipment: string[]; // STAGE_EQ_MAP keys
  intercoolerCount?: number;
  intercoolerLocation?: string; // LOC_MAP key
  kodCount?: number;
  kodLocation?: string; // LOC_MAP key
  recycleSource?: string;
  recycleDestination?: string;
  refDesuperheaterCount?: number;
  refCondenserCount?: number;
  refAccumulatorCount?: number;
}

export interface SideLoad {
  stage: string;
}

export interface Casing {
  name: string;
  stages: string[]; // "stage_1".."stage_6"
  internallyConnected: boolean | null;
  internalConnections: string[]; // "stage_1-stage_2"
  suctionStreams: string; // "0".."4+"
  dischargeStreams: string;
  hasSideLoads: boolean | null;
  numSideStreams: string; // "1","2","3+"
  sideLoads: SideLoad[];
  subsystems: string[]; // SUBSYS_MAP keys
  dgsSupport: string[]; // DGS_MAP keys
  deDgsComponents: string[]; // DGS_COMP_MAP keys
  ndeDgsComponents: string[];
  bearings: string[]; // BEARING_MAP keys
  /** stage-group id ("stage_1" or "stage_1-stage_2") -> equipment config */
  stageEquipment: Record<string, StageEquipmentConfig>;
}

export function newCasing(): Casing {
  return {
    name: "",
    stages: [],
    internallyConnected: null,
    internalConnections: [],
    suctionStreams: "",
    dischargeStreams: "",
    hasSideLoads: null,
    numSideStreams: "",
    sideLoads: [],
    subsystems: [],
    dgsSupport: [],
    deDgsComponents: [],
    ndeDgsComponents: [],
    bearings: [],
    stageEquipment: {},
  };
}

export interface Turbine {
  type: string; // TURB_MAP key
  connectedCasingsOrdered: string[]; // casing names, in train order
  connectedCasings: string[]; // same set, unordered (legacy mirror)
  auxiliarySystems: string[]; // AUX_MAP keys
  scAuxSystems: string[]; // AUX_MAP keys (surface-condenser sub-selection)
  surfaceCondenserCount: number | "";
  surfaceCondenserArrangement: string; // COND_ARR_MAP key
  surfaceCondenserPumpCount: number | "";
  turbineCondMonitoring: string[]; // BEARING_MAP keys (subset)
}

export function newTurbine(): Turbine {
  return {
    type: "",
    connectedCasingsOrdered: [],
    connectedCasings: [],
    auxiliarySystems: [],
    scAuxSystems: [],
    surfaceCondenserCount: "",
    surfaceCondenserArrangement: "",
    surfaceCondenserPumpCount: "",
    turbineCondMonitoring: [],
  };
}

export interface MachineConfig {
  service: string; // SERVICE_MAP key
  driverType: string; // DRIVER_MAP key
  numCasings: number | "";
  casings: Casing[];
  oilEquipment: string[]; // OIL_MAP keys
  processTreatment: string[]; // TREAT_MAP keys
  causticConnection: string; // "after_stage_N" or "after_stage_N-M"
  numTurbines: number | "";
  turbines: Turbine[];
}

export function newMachineConfig(): MachineConfig {
  return {
    service: "",
    driverType: "",
    numCasings: "",
    casings: [],
    oilEquipment: [],
    processTreatment: [],
    causticConnection: "",
    numTurbines: "",
    turbines: [],
  };
}

export interface PlantOnlineTag {
  piName: string;
  min: number | "";
  max: number | "";
}

export interface ModelConfig {
  testStartDate: string; // "YYYY-MM-DD"
  testEndDate: string;
  plantOnlineTags: PlantOnlineTag[];
}

export function newModelConfig(): ModelConfig {
  return { testStartDate: "", testEndDate: "", plantOnlineTags: [] };
}

/** One row in a sub-asset's sensor table (Sensor Mapping sheet source). */
export interface SensorRow {
  templateId: string;
  defaultName: string;
  defaultUom: string;
  name: string; // user's PI tag name(s), comma-separated allowed
  uom: string;
  paramType: "PI" | "Constant";
}

/** A generated sub-asset (from generateSubAssets()) — id/label/group + its sensor rows. */
export interface SubAssetItem {
  id: string;
  label: string;
  groupId: string;
  groupLabel: string;
}

/** One OEM design-limit row for a sub-asset's parameter (keyed by the same
 * templateId as its OemLimitTemplateItem — see config/OemLimitTemplates.ts,
 * ported from Domain_limit_rational.xlsx). Mirrors SensorRow's uom/defaultUom
 * split: `defaultUom` is fixed from the template for reference, `uom` is the
 * user-editable value (defaults to defaultUom). */
export interface OemLimitRow {
  templateId: string;
  parameter: string;
  uom: string;
  defaultUom: string;
  designLow: number | "";
  designHigh: number | "";
  rated: number | "";
}

/** One Trip Limit row for a sub-asset's parameter (keyed by the same
 * templateId as its TripLimitTemplateItem — see config/TripLimitTemplates.ts,
 * ported from Failure_Prediction_Tags.xlsx). Same uom/defaultUom split as
 * OemLimitRow; only shown for sub-assets with the Failure Prediction model
 * selected. */
export interface TripLimitRow {
  templateId: string;
  parameter: string;
  uom: string;
  defaultUom: string;
  tripLimit: number | "";
  /** Which side trips the parameter (HIGH/LOW) — defaults from the template's
   * Trip Direction (Failure_Prediction_Tags.xlsx) but user-editable. */
  tripDirection: string;
  /** User-selected justification — see ConfigCatalog.TRIP_LIMIT_BASIS_OPTIONS. */
  tripLimitBasis: string;
}

/** Full wizard state, mirrors STATE in the original app. */
export interface AfpWizardState {
  asset: "cracked_gas_compressor"; // centrifugal-only for this port
  mc: MachineConfig;
  modelConfig: ModelConfig;
  /** sub-asset id -> set of MODEL_CHAIN values selected */
  models: Record<string, string[]>;
  /** sub-asset id -> sensor rows (populated/synced from templates on demand) */
  sensors: Record<string, SensorRow[]>;
  commonSensors: SensorRow[];
  /** sub-asset id -> OEM design-limit rows (populated/synced from templates on demand) */
  oemLimits: Record<string, OemLimitRow[]>;
  /** sub-asset id -> Trip Limit rows (populated/synced from templates on demand) */
  tripLimits: Record<string, TripLimitRow[]>;
}

export function newWizardState(): AfpWizardState {
  return {
    asset: "cracked_gas_compressor",
    mc: newMachineConfig(),
    modelConfig: newModelConfig(),
    models: {},
    sensors: {},
    commonSensors: [],
    oemLimits: {},
    tripLimits: {},
  };
}
