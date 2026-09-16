// Backend-owned shapes are sourced from the generated OpenAPI contract (../api/Index)
// — single source of truth, no hand-sync drift. Frontend-only shapes (dynamic sheet/
// mapping rows the backend types as dict[str, Any], wizard/UI state, and the not-yet-
// typed Hierarchy responses) are defined locally below.
import type { Schemas, CoverageStats } from "../api/Index";
export type { CoverageStats };

// ── Blueprint ──────────────────────────────────────────────────────────────────

export interface AttributeRow {
  "Plant Name"?: string;
  "System Name"?: string;
  "Element Type"?: string;
  "Parent El. Type"?: string;
  "Attribute Name"?: string;
  "Attribute Type"?: "Sensor Tag" | "Constant" | "";
  UOM?: string;
  "Element Path"?: string;
  [key: string]: unknown;
}

export interface UomRow {
  /** Blueprint "UOM Reference" sheet — two columns: the exact (case-sensitive,
   *  trimmed) blueprint Attribute Name, and the UOM Category it belongs to. The
   *  selectable units for that attribute are all active units in the category,
   *  sourced from the DB catalog (configurations.unit_of_measurement) — see
   *  [[UomOption]] / uomCatalogAtom. Blank Category ⇒ no options. */
  Attribute?: string;
  Category?: string;
  [key: string]: unknown;
}

/** A selectable unit, sourced from configurations.unit_of_measurement (read via
 *  Prisma in the dashboard Server Component). Carries the FK id we persist plus the
 *  linear conversion to the category's reference unit
 *  (value_in_ref = value * refFactor + refOffset). */
export interface UomOption {
  uomId: number;
  symbol: string;
  name: string;
  category: string;
  refUomId: number;
  refFactor: number;
  refOffset: number;
}

/** Active unit catalog grouped by category for O(1) per-attribute lookup. Fetched
 *  once in the RSC and seeded into `uomCatalogAtom`. */
export type UomCatalog = Record<string, UomOption[]>;

export interface ConstraintRow {
  "Parent Element Path"?: string;
  "Parent Level"?: string;
  "Child Level"?: string;
  "Min Required"?: number;
  Silent?: 0 | 1;
  "Suffix Style"?: "alpha" | "num";
  Notes?: string;
  [key: string]: unknown;
}

export interface QuestionRow {
  "Element Level"?: string;
  "Question ID"?: string;
  Step?: number;
  "Question Text"?: string;
  Type?: string;
  Options?: string;
  Default?: string;
  Required?: 0 | 1;
  "Show If"?: string;
  Effect?: string;
  "Help Text"?: string;
  "Tile Order"?: number | null;
  [key: string]: unknown;
}

export interface BlueprintSummary {
  plantName: string;
  systemName: string;
  elementLevels: string[];
  attributeCount: number;
  sensorTagCount: number;
  constantCount: number;
  hasConstraints: boolean;
  hasWizardQuestions: boolean;
}

export interface BlueprintState {
  attributes: AttributeRow[];
  uom: UomRow[];
  constraints: ConstraintRow[];
  questions: QuestionRow[];
  summary: BlueprintSummary | null;
  errors: string[];
  warnings: string[];
  isLoaded: boolean;
  isLoading: boolean;
}

// ── Hierarchy ──────────────────────────────────────────────────────────────────

export interface HierarchyNode {
  id: string;
  name: string;
  level: string;
  notes?: string;
  children: HierarchyNode[];
}

export interface FlatNode {
  element_path: string;
  element_code: string;
  element_name: string;
  level: string;
  level_path: string;
  id: string;
}

export interface LandingTile {
  level: string;
  isConfigured: boolean;
  isSilent: boolean;
  isRequired: boolean;
  count: number;
  tileOrder: number | null;
}

export interface WizardStep {
  type: "count" | "question_group" | "children";
  // count step
  level?: string;
  currentCount?: number;
  // question_group step
  stepNum?: number;
  questions?: QuestionDef[];
  // children step
  parentLevel?: string;
  children?: ChildCountInfo[];
}

export interface QuestionDef {
  questionId: string;
  questionText: string;
  type: "count" | "boolean" | "select" | "number" | "text";
  options: string[];
  default: string;
  required: boolean;
  showIf: string;
  effect: string;
  helpText: string;
  tileOrder: number | null;
  currentAnswer?: string;
}

export interface ChildCountInfo {
  level: string;
  minRequired: number;
  currentCount: number;
}

export interface WizardState {
  mode: "landing" | "element_wizard" | "done";
  activeElement: string | null;
  elementStep: number;
  landingTiles: LandingTile[];
  configuredLevels: string[];
  hierarchyBuilt: boolean;
  missingRequired: string[];
  activeSteps: WizardStep[];
  instanceCount: number;
  instanceIdx: number | null;
}

export interface HierarchyState {
  root: HierarchyNode | null;
  flatNodes: FlatNode[];
  wizardState: WizardState | null;
  databaseName: string;
}

// ── Sensor Mapping ─────────────────────────────────────────────────────────────

export interface SensorMappingRow {
  element_path?: string;
  element_code?: string;
  level?: string;
  attribute?: string;
  sensor_code?: string;
  sensor_name?: string;
  /** Chosen unit symbol (display/export). Paired with `uom_id` — the FK into
   *  configurations.unit_of_measurement that downstream (tag_registry) consumes. */
  sensor_uom?: string;
  uom_id?: number | null;
  sip_min?: string | number;
  sip_max?: string | number;
  sip_default_value?: string | number;
  sip_policy?: number;
  _value_type?: "sensor_tag" | "constant" | "formula";
  formula?: string;
  constant_value?: string | number;
  _is_calc_override?: boolean;
  [key: string]: unknown;
}

// CoverageStats is sourced from the generated contract (re-exported at the top of this file).

export interface SensorsState {
  mappingRows: SensorMappingRow[];
  coverage: CoverageStats;
  selectedNodeLabel: string;
}

// ── KPI ────────────────────────────────────────────────────────────────────────

export interface KpiPackage {
  name: string;
  description?: string;
  mandatory_calcs?: string[];
  calcs: string[];
}

export interface CalcAlternativeGroup {
  levels: string[];
  label: string;
  description?: string;
  affected_calcs: string[];
  // mode "any": option satisfied when ≥1 sensor mapped (atleast_one/any_of groups).
  // mode "all" (default): option satisfied only when every sensor is mapped.
  // sensors are scoped short-form paths ("fuels.composition_ch4" — level key(s) +
  // attr, same convention as sensor_overrides paths); a bare attr matches any level.
  options: { label: string; sensors: string[]; note?: string; mode?: "any" | "all" }[];
}

export interface KpiState {
  calcBlueprintData: Record<string, unknown> | null;
  packages: KpiPackage[];
  calcOptionality: CalcAlternativeGroup[];
  calcRequirements: Record<string, {
    required: string[];
    optional: string[];
    required_sensor_paths: { attr: string; level: string | null; parent: string | null; parent_path?: string; element_path?: string; path: string }[];
    optional_sensor_paths: { attr: string; level: string | null; parent: string | null; parent_path?: string; element_path?: string; path: string }[];
    unresolvable_sensor_paths?: string[];
    missing_element_sensor_paths?: { attr: string; level: string; path: string }[];
    // Blueprint endpoints whose level is absent from the current config AND reached
    // only via formula-optional paths — informational, does NOT degrade calc status.
    optional_missing_sensor_paths?: { attr: string; level: string; path: string }[];
    // Carries both numpy.where auto-detected groups and sensor_groups inherited from
    // intermediate calcs (which may use mode "any" for atleast_one semantics).
    auto_sensor_alternatives?: { label: string; options: { label: string; sensors: string[]; mode?: "any" | "all" }[] }[];
  }>;
  calcRequirementsLoading: boolean;
}

// ── API response types ─────────────────────────────────────────────────────────

// Anchored to the contract envelope (errors/warnings sourced from the backend schema),
// with the dynamic rows + summary narrowed to the frontend's richer types.
export type BlueprintResponse =
  Omit<Schemas["BlueprintResponse"], "attributes" | "uom" | "constraints" | "questions" | "summary"> & {
    attributes: AttributeRow[];
    uom: UomRow[];
    constraints: ConstraintRow[];
    questions: QuestionRow[];
    summary: BlueprintSummary;
  };

export interface HierarchyBuildResponse {
  root: HierarchyNode;
  flatNodes: FlatNode[];
  nodeCount: number;
}

// ── Instance draft payload ──────────────────────────────────────────────────────
// The JSON stored in one `instance_configuration_drafts` row per instance. Produced
// by the FastAPI `/hierarchy/serialize` endpoint and replayed by `/hierarchy/hydrate`.
// `systemConfig` is the System Config tab's hierarchy; `sensorMapping.rows` carries the
// KPI Packages tab's per-instance calc overrides; `topology` carries the Connectivity tab's
// graph + stream sensors + canvas layout (instance-scoped — no system+plant disk sidecar).
export interface DraftConfigPayload {
  version: number;
  systemConfig: Record<string, unknown> | null;
  sensorMapping?: { rows: Record<string, unknown>[] };
  topology?: {
    topology: Record<string, unknown> | null;
    streamSensorMap?: Record<string, unknown> | null;
    layout?: Record<string, unknown>;
  } | null;
}

export interface HydrateConfigResponse {
  hydrated: boolean;
  root?: HierarchyNode | null;
  flatNodes?: FlatNode[];
  databaseName?: string;
  systemName?: string;
  blueprintLoaded?: boolean;
  sensorMappingLoaded?: boolean;
  topologyLoaded?: boolean;
}
