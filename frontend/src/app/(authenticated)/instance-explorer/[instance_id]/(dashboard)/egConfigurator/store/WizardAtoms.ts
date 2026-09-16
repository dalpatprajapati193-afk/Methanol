/**
 * Jotai atoms for the egConfigurator wizard.
 *
 * Scope: feature-local (lives in app/egConfigurator/store per AGENTS.md)
 * Each wizard step has its own atom so components only re-render when
 * their specific slice changes.
 */

import { atom } from 'jotai';

// ---------------------------------------------------------------------------
// Step tracking
// ---------------------------------------------------------------------------

export const currentStepAtom = atom<number>(1);
export const isSavingAtom = atom<boolean>(false);

// ---------------------------------------------------------------------------
// Step 1 — Plant Configuration
// ---------------------------------------------------------------------------

export interface SteamHeader {
  headerLabel: string;
  isSuperheated: 'Yes' | 'No' | '';
}

export interface DirectSteamInput {
  freshSteam: 'yes' | 'no' | '';
  mediaSource: string;
  otherLabel?: string;
}

export interface FeedPreheatExchanger {
  freshSteam: 'yes' | 'no' | '';
  heatSource: string;
  heatSourceOther?: string;
  exchangerType: string;
}

export interface OtherEquipment {
  oe_name: string;
  oe_type: string;
  oe_freshSteam: 'yes' | 'no' | '';
  oe_heatSource: string;
  oe_heatSourceOther?: string;
}

export interface Step1Data {
  // General
  configName: string;
  plantCapacity: string;
  commissioningYear: string;
  techLicensor: string;
  waterToEORatio: string;
  // Steam
  numSteamHeaders: string;
  steamHeaders: SteamHeader[];
  // Equipment
  eq_hasGFS: 'yes' | 'no' | '';
  eq_gfsArrangement: string;
  // Stripping Column
  sc_columnType: string;
  sc_hasReboiler: 'yes' | 'no' | '';
  sc_reboilerFreshSteam: 'yes' | 'no' | '';
  sc_reboilerMedium: string;
  sc_hasDirectSteam: 'yes' | 'no' | '';
  sc_directSteamFreshSteam: 'yes' | 'no' | '';
  sc_numDirectSteam: string;
  sc_directSteamInputs: DirectSteamInput[];
  sc_hasBottomBleed: 'yes' | 'no' | '';
  // Reabsorber
  ra_columnType: string;
  ra_absorptionMedium: string;
  ra_absorptionMediumOther: string;
  ra_hasIntercooler: 'yes' | 'no' | '';
  ra_intercoolerMedium: string;
  ra_intercoolerMediumOther: string;
  ra_hasAftercooler: 'yes' | 'no' | '';
  ra_aftercoolerFreshSteam: 'yes' | 'no' | '';
  ra_aftercoolerSource: string;
  ra_aftercoolerSourceOther: string;
  // GFS (separate columns)
  gfs_columnType: string;
  gfs_hasReboiler: 'yes' | 'no' | '';
  gfs_reboilerFreshSteam: 'yes' | 'no' | '';
  gfs_reboilerMedium: string;
  gfs_hasDirectSteam: 'yes' | 'no' | '';
  gfs_directSteamFreshSteam: 'yes' | 'no' | '';
  gfs_numDirectSteam: string;
  gfs_directSteamInputs: DirectSteamInput[];
  gfs_strippingPurpose: string;
  gfs_overheadVent: string;
  // Integrated column (when eq_gfsArrangement = 'Integrated Single Column')
  int_columnType: string;
  int_absorptionMedium: string;
  int_absorptionMediumOther: string;
  int_hasIntercooler: 'yes' | 'no' | '';
  int_intercoolerMedium: string;
  int_intercoolerMediumOther: string;
  int_hasReboiler: 'yes' | 'no' | '';
  int_reboilerFreshSteam: 'yes' | 'no' | '';
  int_reboilerMedium: string;
  int_hasDirectSteam: 'yes' | 'no' | '';
  int_directSteamFreshSteam: 'yes' | 'no' | '';
  int_numDirectSteam: string;
  int_directSteamInputs: DirectSteamInput[];
  int_strippingPurpose: string;
  int_overheadVent: string;
  // Feed Preheat
  fpe_numExchangers: string;
  fpe_exchangers: FeedPreheatExchanger[];
  // Reactor
  gr_reactorType: string;
  gr_numReactors: string;
  gr_heatRecovered: 'yes' | 'no' | '';
  gr_heatRecoverySinks: string[];
  gr_numInterstage: string;
  // Evaporation
  ev_numEffects: string;
  ev_flowArrangement: string;
  ev_firstEffectFreshSteam: 'yes' | 'no' | '';
  ev_firstEffectSource: string;
  ev_hasMVR: 'yes' | 'no' | '';
  ev_mvrEffect: string;
  ev_hasTVR: 'yes' | 'no' | '';
  ev_tvrEffect: string;
  ev_condensateFlash: 'yes' | 'no' | '';
  // Other equipment
  oe_hasOther: 'yes' | 'no' | '';
  oe_numEquipment: string;
  oe_equipment: OtherEquipment[];
}

export const STEP1_DEFAULTS: Step1Data = {
  configName: '', plantCapacity: '', commissioningYear: '',
  techLicensor: '', waterToEORatio: '',
  numSteamHeaders: '', steamHeaders: [],
  eq_hasGFS: '', eq_gfsArrangement: '',
  sc_columnType: '', sc_hasReboiler: '', sc_reboilerFreshSteam: '',
  sc_reboilerMedium: '', sc_hasDirectSteam: '', sc_directSteamFreshSteam: '',
  sc_numDirectSteam: '', sc_directSteamInputs: [], sc_hasBottomBleed: '',
  ra_columnType: '', ra_absorptionMedium: '', ra_absorptionMediumOther: '',
  ra_hasIntercooler: '', ra_intercoolerMedium: '', ra_intercoolerMediumOther: '',
  ra_hasAftercooler: '', ra_aftercoolerFreshSteam: '', ra_aftercoolerSource: '',
  ra_aftercoolerSourceOther: '',
  gfs_columnType: '', gfs_hasReboiler: '', gfs_reboilerFreshSteam: '',
  gfs_reboilerMedium: '', gfs_hasDirectSteam: '', gfs_directSteamFreshSteam: '',
  gfs_numDirectSteam: '', gfs_directSteamInputs: [], gfs_strippingPurpose: '',
  gfs_overheadVent: '',
  int_columnType: '', int_absorptionMedium: '', int_absorptionMediumOther: '',
  int_hasIntercooler: '', int_intercoolerMedium: '', int_intercoolerMediumOther: '',
  int_hasReboiler: '', int_reboilerFreshSteam: '', int_reboilerMedium: '',
  int_hasDirectSteam: '', int_directSteamFreshSteam: '', int_numDirectSteam: '',
  int_directSteamInputs: [], int_strippingPurpose: '', int_overheadVent: '',
  fpe_numExchangers: '', fpe_exchangers: [],
  gr_reactorType: '', gr_numReactors: '', gr_heatRecovered: '',
  gr_heatRecoverySinks: [], gr_numInterstage: '',
  ev_numEffects: '', ev_flowArrangement: '', ev_firstEffectFreshSteam: '',
  ev_firstEffectSource: '', ev_hasMVR: '', ev_mvrEffect: '',
  ev_hasTVR: '', ev_tvrEffect: '', ev_condensateFlash: '',
  oe_hasOther: '', oe_numEquipment: '', oe_equipment: [],
};

export const step1Atom = atom<Step1Data>(STEP1_DEFAULTS);

// ---------------------------------------------------------------------------
// Step 2 — KPI Selection
// Mirrors the Flask app's outputKpiDraft shape.
// ---------------------------------------------------------------------------

/** One formula variable mapping within a KPI's inputs */
export interface KpiVariableInput {
  type: 'sensor' | 'fixed' | 'not_set';
  tag: string;        // PI tag name when type = 'sensor'
  fixedValue: string; // numeric constant when type = 'fixed'
  uom: string;        // unit of measure (user-selected)
}

/**
 * Per-KPI selection entry.
 *
 * input_type:
 *   'sensor'        — user has a PI tag for this KPI directly
 *   'formula_mapped'— no PI tag; user maps formula variables to tags (calculated KPI)
 *   'soft_sensor'   — no PI tag; soft sensor model required
 *   undefined       — user hasn't answered yet (not configured)
 */
export interface KpiSelectionEntry {
  input_type?: 'sensor' | 'formula_mapped' | 'soft_sensor';
  /** PI tag when input_type = 'sensor' */
  tag?: string;
  /** UOM when input_type = 'sensor' */
  uom?: string;
  /** Variable → tag map when input_type = 'formula_mapped' */
  variables?: Record<string, KpiVariableInput>;
  /** Whether a PI tag exists when input_type = 'soft_sensor' */
  has_pi_tag?: boolean;
  /** X-variable tags when input_type = 'soft_sensor' and has_pi_tag = false */
  x_variables?: Record<string, { tag: string; uom: string }>;
}

export type KpiSelectionState = Record<string, KpiSelectionEntry>;

export const step2Atom = atom<KpiSelectionState>({});

// ---------------------------------------------------------------------------
// Step 3 — Additional Inputs (global PI tags used across multiple KPIs)
// Maps to the Excel "Additional inputs" sheet / Flask's additional-inputs API.
// ---------------------------------------------------------------------------

export interface AdditionalInputEntry {
  type: 'sensor' | 'fixed' | 'not_set';
  tag: string;
  fixedValue: string;
  uom: string;
}

export type AdditionalInputsState = Record<string, AdditionalInputEntry>;

export const step3Atom = atom<AdditionalInputsState>({});

// ---------------------------------------------------------------------------
// Step 4 — Soft Sensor / Forecast Config
// ---------------------------------------------------------------------------

export interface SoftSensorEntry {
  has_pi_tag: boolean;
  pi_tag: string;
  uom: string;
  x_variables: Record<string, { tag: string; uom: string }>;
}

export type ForecastState = Record<string, SoftSensorEntry>;

export const step4Atom = atom<ForecastState>({});

export const STEP4_SAMPLE_TAGS: Record<string, string> = {
  eg_selectivity: 'YANSAB.REACTOR.SELECTIVITY.CALC',
  steam_economy: 'YANSAB.EVAP.STEAM.ECONOMY.CALC',
  sc_sep_efficiency: 'YANSAB.SC.SEP.EFFICIENCY.CALC',
  meg_production: 'YANSAB.PLANT.MEG.PRODUCTION.CALC',
  specific_steam: 'YANSAB.PLANT.SPECIFIC.STEAM.CALC',
};
