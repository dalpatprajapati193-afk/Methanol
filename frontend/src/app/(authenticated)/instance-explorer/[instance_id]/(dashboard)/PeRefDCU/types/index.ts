// ─── Equipment hierarchy ────────────────────────────────────────────────────

export interface Tube {
  id: string
  name: string
  hasTMT?: boolean
}

export interface Pass {
  id: string
  name: string
  tubes: Tube[]
}

export interface Cell {
  id: string
  name: string
  passes: Pass[]
}

export interface SpallGroup {
  id: string
  name: string // e.g. "SG1"
  groupNum: number // 1-indexed
  passCodes: string[] // pass elementCodes in this group, e.g. ["H1P1","H1P2"]
}

export interface Furnace {
  id: string
  name: string
  cells: Cell[]
  spallGroups?: SpallGroup[]
}

export interface Drum {
  id: string
  name: string
}

export interface DrumTrain {
  id: string
  name: string // e.g. "D1_D2"
  drums: Drum[]
}

export interface ColumnOverhead {
  id: string
  name: string
}

export interface ColumnReboiler {
  id: string
  name: string
}

export interface Fractionator {
  id: string
  name: string
  columnOverheads: ColumnOverhead[]
  columnReboilers: ColumnReboiler[]
}

export interface Equipment {
  furnaces: Furnace[]
  drumTrains: DrumTrain[]
  fractionators: Fractionator[]
  trainFractionatorLinks: Record<string, string[]> // train id → fractionator ids
  trainFurnaceLinks?: Record<string, string> // train id → furnace id (1:1)
}

// ─── Models ─────────────────────────────────────────────────────────────────

export type ModelGroup = 'coke_drum' | 'furnace'

export interface ModelParameter {
  parameter: string
  display_name: string
  value: string
  description: string
}

// ─── Tag mapping ─────────────────────────────────────────────────────────────

export type TagType = 'pi' | 'formula' | 'constant'

export type AggregationType = 'add' | 'min' | 'max' | 'avg' | 'difference'

export interface PISensor {
  sensor_code: string
  sensor_name: string
  sensor_uom: string
  sip_min?: string
  sip_max?: string
  sip_default_value?: string
  sip_policy?: '0' | 'last_good_value'
}

export interface TagEntry {
  tag_type: TagType
  pi_sensors: PISensor[]
  aggregation: AggregationType
  sip_min: string
  sip_max: string
  sip_default_value: string
  sip_policy: '0' | 'last_good_value'
  constant_value: string
  default_uom: string
  attribute_uom?: string // UOM for the attribute itself (editable, defaults to blueprint default_uom)
  display_name?: string // user override of the BM display name; written to tag_display in tag_registry
  expression_override?: string // per-node formula override for Inferred type; undefined = use blueprint expression
  data_type?: 'continuous' | 'discrete' // marks attributes that use value map lookup
  flag_ma?: boolean // moving average check (user override of blueprint default)
  sip_policies?: AttributeSipPolicy[] // per-model SIP policy override (PI/Inferred/Constant only)
}

export interface ValueMapEntry {
  label: string // e.g. "Auto", "Manual", "Open", "Closed"
  raw_value: string // what PI historian returns; editable by site engineer
  code: string // internal numeric code; developer only
  category?: string // optional grouping, e.g. "mode"
}

export interface AttributeSipPolicy {
  model_id: number
  sip_min?: number | null
  sip_max?: number | null
  sip_default?: number | null
  tag_oob_switch: string // policy_action for tag_out_of_bound_switch
  tag_stuck_switch: string // policy_action for tag_stuck_switch
  tag_nan_switch: string // policy_action for tag_nan_switch
  default_switch: string // policy_action for default_switch
}

export interface ModelTagMapping {
  model_ids: number[]
  level: string
  attribute: string
  display_name?: string // human-readable display name for the attribute
  type?: string // e.g. "PI", "Inferred", "Constant"
  uom_category?: string // e.g. "Volume Flow Rate", "Pressure"
  default_uom?: string // e.g. "kg", "bar", "°C" — set in Blueprint, fixed in PI form
  data_type?: 'continuous' | 'discrete' // marks attributes that use value map lookup
  expression?: string // formula expression for Inferred type
  flag_ma?: boolean // moving average check default (PI/Inferred only)
  sip_policies?: AttributeSipPolicy[] // per-model SIP policy (PI, Inferred, Constant only)
  visibleWhen?: {
    constantAttr: string // e.g. "cop_sensor_level" — which Constant attribute controls visibility
    nodeId?: string // which node to read the constant from; defaults to "system_dcu"
    value: string // the constant value that makes this row visible (e.g. "Cell")
  }
}

// ─── Node selection for topology ─────────────────────────────────────────────

export type NodeType =
  | 'system'
  | 'furnace'
  | 'cell'
  | 'pass'
  | 'tube'
  | 'drum_train'
  | 'drum'
  | 'fractionator'
  | 'column_overhead'
  | 'column_reboiler'
  | 'spall_group'

export interface TopologyNode {
  id: string
  name: string
  type: NodeType
  level: string
  path: string
  parentPath: string
  elementCode: string
  children: TopologyNode[]
  hasTMT?: boolean // set on tube nodes; undefined means "all tubes shown" (legacy)
}

// ─── Spall configuration ──────────────────────────────────────────────────────

export interface SpallHeaterTubeConfig {
  totalTubesPerPass: number
  radiantTubesPerPass: number
  convectionTubesPerPass: number
  tubeNumbering: 'top_to_bottom' | 'bottom_to_top'
  tmtTubes: number[]
}

export interface SpallHeaterGroups {
  numGroups: number
  assignment: Record<string, number>
}

export interface SpallHeaterOps {
  numOps: number
  assignment: Record<string, number>
}

export interface FurnaceGeometry {
  numHeaters: number
  firingConfig: 'double' | 'single'
  passesPerCell: number
  uniformPasses: boolean
  passesPerCellMap: Record<string, number>
}

export interface AuxiliaryEquipmentConfig {
  drumsPerTrain: number
  uniformDrums: boolean
  drumsPerTrainMap: Record<string, number>
  numFractionators: number
  overheads: number
  reboilers: number
}

export interface PassTubeMapping {
  passToCell: Record<string, Record<string, number>>
  tubeConfigs: Record<string, SpallHeaterTubeConfig>
}

export interface SpallConfig {
  hasOpTags: boolean
  heaterGroups: Record<string, SpallHeaterGroups>
  spallOps: Record<string, SpallHeaterOps>
}

// ─── Form state ───────────────────────────────────────────────────────────────

export interface FormState {
  step: number
  maxStep: number // tracks the furthest step reached for navigation
  view: 'wizard' | 'blueprint-manager' | 'model-blueprint'
  dashboard: string
  clientId: string
  equipment: Equipment
  furnaceGeometry: FurnaceGeometry | null
  auxiliaryEquipmentConfig: AuxiliaryEquipmentConfig | null
  passTubeMapping: PassTubeMapping | null
  spallConfig: SpallConfig | null
  selectedModelIds: number[]
  modelParameters: Record<number, ModelParameter[]>
  tagEntries: Record<string, Record<string, TagEntry>>
  tagMappings: ModelTagMapping[]
  valueMap: ValueMapEntry[]
  wizardQuestions: WizardQuestion[]
  multipliedAttributes: MultipliedAttributeEntry[]
  odsRules: OdsRule[]
  models: ModelEntry[]
  uomSet: Record<string, string>
}

// ─── ODS Rules ───────────────────────────────────────────────────────────────

export interface OdsRule {
  id: string
  model_id: number
  cause_tag: string
  effect_tag: string
  cause_monitoring_tag: string
  effect_monitoring_tag: string
  message: string
  actionable_tolerance: number | null
}

// ─── Models ──────────────────────────────────────────────────────────────────

export type ScalerType = 'min-max' | 'std'
export type ModelTypeOption = 'regression' | 'classification' | 'forecasting'

export interface CleaningBound {
  feature_key: string
  min: string
  max: string
}

export interface SubModelTrainingConfig {
  normalize_features: boolean
  feature_scaler: ScalerType
  normalize_target: boolean
  target_scaler: ScalerType
  data_cleaning: boolean
  cleaning_bounds: CleaningBound[]
  model_type: ModelTypeOption
  algorithms: string[]
  evaluation_criteria: string[]
  save_training_data: boolean
  save_normalized_data: boolean
  save_top5_results: boolean
  retrain_frequency: string
  training_data_file?: string // filename of uploaded training data
  model_file?: string // filename of uploaded ML model artifact
  training_result?: { status: 'success' | 'failure'; message: string }
}

export interface SubModelEntry {
  sub_model_id: number // globally sequential across all models
  sub_model_name: string // e.g. "pdi_d1"
  attributes?: string[] // resolved (prefixed) attribute names, e.g. "train1_d1_online_status"
  feature_selection?: string[] // user-selected template keys — subset of model.attributes
  target_variable?: string[] // resolved target variable names for this sub-model
  cumulative_attributes?: string[] // resolved cumulative attribute names for this sub-model
  model_skip_attributes?: string[] // resolved skip attribute names for this sub-model
  training_config?: SubModelTrainingConfig
}

export interface ModelEntry {
  id: string // internal UUID
  model_id: number // numeric id (was ModelDefinition.id)
  model_alias: string // display name, e.g. "PDI" (was ModelDefinition.displayName)
  name: string // key name, e.g. "pdi" (was ModelDefinition.name)
  group: ModelGroup // 'coke_drum' | 'furnace' (was ModelDefinition.group)
  model_level: string // topology level, e.g. "Drum"
  model_display?: string // human-readable label shown in UI / reports
  model_description?: string // free-text description of this model
  sub_models?: SubModelEntry[]
  attributes?: string[] // selected attribute keys (excludes Constant/Cause/Effect types)
  target_variable?: string[] // composite "level|attribute" keys for the target (Y) variables
  cumulative_attributes?: string[] // composite "level|attribute" keys for cumulative attributes
  model_skip_attributes?: string[] // composite "level|attribute" keys for model skip attributes
}

// ─── Multiplied Attributes ────────────────────────────────────────────────────

export interface MultipliedAttributeEntry {
  attribute: string // base attribute name, e.g. 'hold_temp'
  countAttr: string // constant attribute that holds the count, e.g. 'hold_temp_steps'
  nodeId: string // node context, default 'system_dcu'
  model_ids: number[] // which models this rule applies to
}

// ─── Wizard Questions ─────────────────────────────────────────────────────────

export interface WizardChildQuestion {
  attribute_prefix: string // e.g. 'hold_temp'
  label_template: string // e.g. 'Hold temperature for step {n}'
}

export interface WizardQuestion {
  id: string // auto-generated: select→'{base}_level', else→attribute name
  model_ids: number[]
  label: string
  input_type: 'select' | 'number' | 'target_steps'
  attribute: string // constant stored in tagEntries[node_id]
  base_attribute?: string // 'select' only: the tagMappings attribute (e.g. 'cop')
  options?: string[] // 'select': level list; 'target_steps': ['1','2','3']
  max_steps?: number // 'target_steps' only
  child_questions?: WizardChildQuestion[]
  node_id: string
  order: number
}

// ─── Blueprint reference data ─────────────────────────────────────────────────

export interface ModelParameterWithIds extends ModelParameter {
  model_ids: number[]
}

export interface ImputationPolicyEntry {
  policy_type: string
  policy_action: string
  policy_description: string
  policy_display_text: string | null
  warning_flag: 0 | 1
  skip_flag: 0 | 1
  model_status_code: string
}

// ─── UOM Bank ───────────────────────────────────────────────────────────────

export interface UOMEntry {
  name: string
  symbol: string
  category: string
  refUOM: string | null
  refFactor: number
  refOffset: number
  source: 'system' | 'user'
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface OutputRow_InstantiatedAttributes {
  element_path: string
  element_code: string
  element_name: string
  level: string
  attribute: string
  default_uom: string | null
  formula: string | null
  constant_value: string | null
  client_id: string
}

export interface OutputRow_SensorsMapping {
  element_path: string
  element_code: string
  level: string
  attribute: string
  sensor_code: string | null
  sensor_name: string | null
  sensor_uom: string | null
  sip_min: number | null
  sip_max: number | null
  sip_default_value: number | null
  sip_policy: string
  data_type: string | null
  client_id: string
}

export interface OutputRow_UserPreferences {
  client_id: string
  system: string
  sub_system: string
  model: string
  model_id: number
  active: number
}

export interface OutputRow_ModelParameterConfig {
  model_id: number
  parameter: string
  value: string | number | null
  description: string | null
}
