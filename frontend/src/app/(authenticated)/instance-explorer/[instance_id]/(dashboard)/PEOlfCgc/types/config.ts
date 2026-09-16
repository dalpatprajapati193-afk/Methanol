/**
 * config.ts — CGC Configuration Types
 *
 * Generated from the live cgc_master_configuration_v1 schema embedded in
 * index_with_cdt_section.html (bundle 2026-07-07). Every field here mirrors
 * the HTML tool's config object exactly so that JSON exported from the HTML
 * can be passed directly to the FastAPI backend without any transformation.
 *
 * Destination:
 *   src/app/(authenticated)/instance-explorer/[instance_id]/(dashboard)/PEOlfCgc/types/config.ts
 */

import defaultConfigJson from './defaultConfig.json';

// ── Primitives ───────────────────────────────────────────────────────────────

export type DriverType       = 'steam_turbine' | 'motor_vfd' | 'gas_turbine' | 'other';
export type CompositionBasis = 'dry' | 'wet';
export type SourceType       = 'pi_tag' | 'constant' | 'inferred' | 'formula' | 'unavailable';
export type FlowLocation     = 'suction' | 'discharge' | 'cooler_outlet';

// ── Unit System ──────────────────────────────────────────────────────────────

export interface UnitSystem {
  pressure:       'bar(a)' | 'bar(g)' | 'kg/cm²(g)' | 'kg/cm²(a)' | 'psi(a)' | 'psi(g)' | 'kPa(a)' | 'kPa(g)' | 'MPa(a)' | 'MPa(g)';
  temperature:    '°C' | '°F' | 'K';
  mass_flow:      'kg/h' | 't/h' | 'lb/h' | 'kg/s';
  power:          'kW' | 'MW' | 'hp';
  specific_power: 'kWh/t' | 'kJ/kg';
  fraction:       'mol%' | '-';
}

// ── Baselines ────────────────────────────────────────────────────────────────

export interface PlantBaselines {
  rated_power_kw:              number;
  governor_speed_rpm:          number;
  spc_benchmark_kw_t_h:        number;
  suction_p_benchmark_kgcm2:   number;
  cw_supply_temp_c:            number;
  global_dp_baseline_kgcm2:    number;
  bfw_temp_c:                  number;
  wash_oil_mw:                 number;
  total_dry_flow_kg_h:         number;
  design_throughput_t_h:       number;
}

// ── Opportunity / Cost ───────────────────────────────────────────────────────

export interface PlantOpportunity {
  steam_calorific_value_gj_t:       number;
  energy_cost_usd_gj:               number;
  co2_emission_factor_t_per_t_steam: number;
}

// ── Feed Composition ─────────────────────────────────────────────────────────

export interface FeedFixedFractions {
  H2:     number;
  CH4:    number;
  C2H2:   number;
  C2H4:   number;
  C2H6:   number;
  C3H6:   number;
  C3H8:   number;
  C4_lmp: number;
  C5plus: number;
  CO:     number;
  CO2:    number;
  N2:     number;
  H2S:    number;
  [key: string]: number;
}

export interface PlantFeed {
  mode:              'fixed' | 'balance';
  water_mass_frac:   number;
  fixed_fractions:   FeedFixedFractions;
}

// ── Primary Flow Transmitter ─────────────────────────────────────────────────

export interface PrimaryFlowTransmitter {
  stage:    number;
  location: FlowLocation;
  is_wet:   boolean;
  col?:     string;
  input_uom?:  string;
  output_uom?: string;
}

// ── Plant ────────────────────────────────────────────────────────────────────

export interface PlantConfig {
  plant_name:                string;
  train:                     string;
  process_licensor:          string;
  driver_type:               DriverType;
  stage_count:               number;
  max_stage_limit:           number;
  composition_basis:         CompositionBasis;
  final_outlet_destination:  string;
  data_source:               string;
  property_mode:             string;
  unit_system:               UnitSystem;
  baselines:                 PlantBaselines;
  opportunity:               PlantOpportunity;
  feed:                      PlantFeed;
  primary_flow_transmitter?: PrimaryFlowTransmitter | null;
  case_name?:                string;
  tag_prefix?:               string;
}

// ── Driver / Steam Turbine ───────────────────────────────────────────────────

export interface DriverSection {
  id:   string;
  from: string;
  to:   string;
  kind: string;
}

export interface DriverConfig {
  driver_type:                    DriverType;
  _confirmed:                     boolean;
  has_extraction:                 boolean;
  has_injection:                  boolean;
  has_exhaust:                    boolean;
  injection_before_extraction:    boolean;
  exhaust_condensing:             boolean;
  inlet_flow_from_balance:        boolean;
  extraction_flow_from_balance:   boolean;
  injection_flow_from_balance:    boolean;
  exhaust_flow_from_balance:      boolean;
  inlet_press_abs_const:          number;
  extraction_press_abs_const:     number;
  injection_press_abs_const:      number;
  exhaust_press_abs_const:        number;
  inlet_press_drop_mbar:          number;
  injection_press_drop_mbar:      number;
  shaft_efficiency_pct:           number;
  custom_isentropic_eff_pct:      number;
  df_coeff:                       number[];
  primary_method:                 'A' | 'B' | 'C' | 'D';
  sections:                       DriverSection[];
}

// ── Stage ────────────────────────────────────────────────────────────────────

export interface InjectionConfig {
  enabled:         boolean;
  location:        string;
  injection_point: string;
}

export interface StreamTagMapping {
  flow:        Record<string, unknown>;
  temperature: Record<string, unknown>;
  pressure:    Record<string, unknown>;
  mw?:         Record<string, unknown>;
}

export interface StreamTags {
  bfw:      StreamTagMapping;
  wash_oil: StreamTagMapping & { mw: Record<string, unknown> };
}

export interface AdditionalStream {
  id:                         string;
  name:                       string;
  role:                       string;
  description?:               string;
  stage:                      number | null;
  location:                   string;
  flow_col:                   string;
  source_tag_name:            string;
  source_pi_tag:              string;
  flow_availability:          string;
  composition_mode:           string | null;
  composition_basis:          string;
  composition_cols:           Record<string, string>;
  fixed_composition:          Record<string, number>;
  component_mass_flow_cols:   Record<string, string>;
  component_mass_flow_defaults: Record<string, number>;
  input_uom:                  string;
  output_uom:                 string;
  has_gc_analyzer:            boolean;
  design_flow_kg_h:           number | null;
}

export interface InterstageAfter {
  caustic_tower:            boolean;
  caustic_outlet_separator: boolean;
  pressure_drop_vessel:     boolean;
}

export interface StageDesign {
  ac_dp_baseline_kgcm2:  number;
  ac_design_duty_kw:     number;
  ac_design_ua_kw_c:     number;
  t_outlier_threshold:   number;
  bfw_design_flow_kg_h:  number;
  wo_design_flow_kg_h:   number;
  interstage_dp_kgcm2:   number;
}

export interface StageConfig {
  stage_number:       number;
  _visited:           boolean;
  _confirmed:         boolean;
  equipment_tags:     Record<string, string>;
  has_suction_drum:   boolean;
  has_aftercooler:    boolean;
  has_discharge_drum: boolean;
  bfw_injection:      InjectionConfig;
  wash_oil_injection: InjectionConfig;
  stream_tags:        StreamTags;
  additional_streams: AdditionalStream[];
  interstage_after:   InterstageAfter;
  design:             StageDesign;
}

// ── Composition Component ─────────────────────────────────────────────────────

export interface CompositionComponent {
  id:    string;
  label: string;
  mw:    number;
}

// ── Engine Defaults ──────────────────────────────────────────────────────────

export interface EngineDefaults {
  cp_cool_kj_kg_k:        number;
  cp_gas_kj_kg_k:         number;
  bfw_dh_kj_kg:           number;
  cp_wash_oil_kj_kg_k:    number;
  z_factor:               number;
  cw_supply_temp_c:       number;
  bfw_temp_c:             number;
  wash_oil_temp_c:        number;
  eff_warn_pct:           number;
  eff_fault_pct:          number;
  approach_typical_min_c: number;
  approach_typical_max_c: number;
}

// ── Raw PI Tag ───────────────────────────────────────────────────────────────

export interface RawPiTag {
  name:              string;
  pi_tag:            string;
  description:       string;
  uom:               string;
  input_uom:         string;
  output_uom:        string;
  conversion_factor: number;
  design_value:      number | null;
  min_val:           number | null;
  max_val:           number | null;
  ccp_default:       number | null;
  category:          string;
  user_tag_id:       number | null;
  data_type:         string;
  kpi_ref_count:     number;
  is_kpi_input:      boolean;
  pi_section:        string;
  feeds_sections:    string[];
  source_type:       SourceType;
  _auto_generated?:  boolean;
}

// ── KPI Activation Conditions ─────────────────────────────────────────────────

export interface KpiConditionRow {
  tag:   string;
  op:    '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: string;
  label: string;
}

export interface KpiCondition {
  enabled:      boolean;
  logic:        'AND' | 'OR';
  false_action: 'null' | 'zero' | 'hold_last';
  conditions:   KpiConditionRow[];
}

export function defaultKpiCondition(): KpiCondition {
  return { enabled: false, logic: 'AND', false_action: 'null', conditions: [] };
}

export function defaultKpiConditionRow(): KpiConditionRow {
  return { tag: '', op: '>', value: '', label: '' };
}

// ── KPI Catalog ──────────────────────────────────────────────────────────────

export interface KpiCatalogEntry {
  name:     string;
  category: string;
}

// ── Top-level CGC Config ──────────────────────────────────────────────────────

export interface CgcConfig {
  schema:             'cgc_master_configuration_v1';
  plant:              PlantConfig;
  driver:             DriverConfig;
  stages:             StageConfig[];
  kpis:               unknown[];
  tag_mappings:       Record<string, unknown>;
  kpi_shared_inputs:  Record<string, unknown>;
  kpi_input_tag_bank: Record<string, unknown>;
  composition_components: CompositionComponent[];
  kpi_catalog:        KpiCatalogEntry[];
  kpi_mappings:       Record<string, unknown>;
  kpi_conditions:     Record<string, KpiCondition>;
  engine_defaults:    EngineDefaults;
  raw_pi_tags:        RawPiTag[];
}

// ── Python Bridge Payload (sent to cgc_eff_bridge.py) ────────────────────────

export interface BridgeStage {
  stage:                     number;
  suc_T_col:                 string;
  suc_P_col:                 string;
  dis_T_col:                 string;
  dis_P_col:                 string;
  cooler_T_col:              string;
  cooler_P_col:              string;
  bfw_flow_col:              string | null;
  discharge_flow_col:        string | null;
  discharge_flow_unit_factor: number;
  cap_threshold:             number | null;
  T_bfw_degC:                number | null;
  floor_degC:                number | null;
  label:                     string;
}

export interface BridgePayload {
  stage_count:             number;
  components:              string[];
  feed_composition_cols:   Record<string, string>;
  inlet_flow_col:          string;
  water_mass_frac?:        number;
  water_mass_frac_col?:    string;
  stages:                  BridgeStage[];
  additional_streams?:     AdditionalStream[];
  primary_flow_transmitter?: PrimaryFlowTransmitter;
  unit_conversions?:       Record<string, { input_uom: string; output_uom: string; conversion_factor: number }>;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function ordinal(n: number): string {
  return (['1st', '2nd', '3rd', '4th', '5th'] as const)[n - 1] ?? `${n}th`;
}

export function makeDefaultStage(n: number, total: number): StageConfig {
  return {
    stage_number:       n,
    _visited:           false,
    _confirmed:         false,
    equipment_tags:     {
      suction_drum:      `V-${n}01`,
      compressor:        `K-${n}01`,
      aftercooler:       `E-${n}01`,
      downstream_drum:   `V-${n + 1}01`,
    },
    has_suction_drum:   true,
    has_aftercooler:    n < total,
    has_discharge_drum: true,
    bfw_injection:      { enabled: false, location: 'compressor_internal', injection_point: 'compressor_internal_nozzle' },
    wash_oil_injection: { enabled: false, location: 'compressor_internal', injection_point: 'compressor_internal_nozzle' },
    stream_tags:        {
      bfw:      { flow: {}, temperature: {}, pressure: {} },
      wash_oil: { flow: {}, temperature: {}, pressure: {}, mw: {} },
    },
    additional_streams: [],
    interstage_after:   { caustic_tower: false, caustic_outlet_separator: false, pressure_drop_vessel: false },
    design: {
      ac_dp_baseline_kgcm2:  0,
      ac_design_duty_kw:     0,
      ac_design_ua_kw_c:     0,
      t_outlier_threshold:   5.5,
      bfw_design_flow_kg_h:  0,
      wo_design_flow_kg_h:   0,
      interstage_dp_kgcm2:   0,
    },
  };
}

export const DEFAULT_COMPOSITION_COMPONENTS: CompositionComponent[] = [
  { id: 'H2',    label: 'H₂',       mw: 2.016  },
  { id: 'CH4',   label: 'CH₄',      mw: 16.043 },
  { id: 'C2H2',  label: 'C₂H₂',     mw: 26.038 },
  { id: 'C2H4',  label: 'C₂H₄',     mw: 28.054 },
  { id: 'C2H6',  label: 'C₂H₆',     mw: 30.07  },
  { id: 'C3H6',  label: 'C₃H₆',     mw: 42.081 },
  { id: 'C3H8',  label: 'C₃H₈',     mw: 44.097 },
  { id: 'C4_lmp',label: 'C₄ lumps', mw: 56     },
  { id: 'C5plus',label: 'C₅+',      mw: 72.15  },
  { id: 'CO',    label: 'CO',        mw: 28.01  },
  { id: 'CO2',   label: 'CO₂',       mw: 44.01  },
  { id: 'N2',    label: 'N₂',        mw: 28.014 },
  { id: 'H2S',   label: 'H₂S',       mw: 34.081 },
  { id: 'H2O',   label: 'H₂O',       mw: 18.015 },
];

export function makeDefaultConfig(): CgcConfig {
  return JSON.parse(JSON.stringify(defaultConfigJson)) as CgcConfig;
}

