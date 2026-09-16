import { atom } from 'jotai';

export type PageKey =
  | 'landing' | 'packages' | 'pkgSelection' | 'inputSheet'
  | 'basicinfo' | 'hub'
  | 'fms' | 'ffi' | 'hwcfg' | 'hwsec' | 'hwdefine' | 'hwapply';

export interface FurnaceInfo {
  name: string;
  licensor: string;
  coilType: string;
  cells: string;
  passPerCell: string;
  tubesPerPass: string;
  designRunlength: string;
  copyFrom: number | null;
  _autoCopy: boolean;
  _cascadeFrom: number | null;
  _ownValues: {
    licensor: string; coilType: string; cells: string;
    passPerCell: string; tubesPerPass: string; designRunlength: string;
  };
}

export interface UomState {
  massFlow: string;
  temperature: string;
  temperatureDrop: string;
  pressure: string;
  pressureDrop: string;
  work: string;
  specificEnergy: string;
  composition: string;
  moleWeight: string;
  humidity: string;
  pH: string;
}

export interface ActiveFeed { key: string; label: string; }

export type PidVars = Record<string, 0 | 1 | null>;

export interface SatVars { [key: string]: 0 | 1 | null; }

// ── Hardware Template types ──
export interface ConvFields {
  draft: string;
  numBanks: string;
  banks: string[];
  bankAliases: Record<string, string>;
  attemperator: 0 | 1;
  fphSeries: 0 | 1;
}

export interface TleSection {
  INLET_TEMPERATURE: string;
  OUTLET_TEMPERATURE: string;
  MASS_FLOW: string;
  MOLE_WEIGHT: string;
  INLET_PRESSURE: string;
  OUTLET_PRESSURE: string;
  [key: string]: string;
}

export interface TleFields {
  stle: 0 | 1;
  ttle: 0 | 1;
  designData: 0 | 1;
  massFlowConst: 0 | 1;
  moleWeightConst: 0 | 1;
  tempCont: 0 | 1;
  pressCont: 0 | 1;
  ptleName: string;
  stleName: string;
  ttleName: string;
  ptleColdFluid: string;
  stleColdFluid: string;
  ttleColdFluid: string;
  ptleOrientation: string;
  stleOrientation: string;
  ttleOrientation: string;
  pressTagAt: string;  // V418 — 'PTLE_OUTLET' | 'STLE_OUTLET' | 'TTLE_OUTLET' | 'DOWNSTREAM' (default)
  sections: Record<string, TleSection>;
}

export interface RadCell {
  hearthExists: boolean | null;
  hearthBurnerCount: string;
  hearthBurnerType: string;
  hearthFgrPercent: number;
  wallExists: boolean | null;
  wallBurnerCount: string;
  wallBurnerType: string;
  wallFgrPercent: number;
  burnerDesignSame: boolean | null;
  separateFlowTag: boolean | null;
  wallDesignFlowRate: string;
  wallDesignFlowRateUom: string;
  hearthDesignFlowRate: string;
  hearthDesignFlowRateUom: string;
  passesPerCell: string;
  tubesPerPass: string;
  tubeOrientation: string;
  flowEntry: 'top' | 'bottom';
  feedType: 'venturi' | 'control_valve';
  cellBends: number[];
  cotAfterAdiaMerge: 0 | 1;
  cotSensorTubes: boolean[];
}

export interface RadFields {
  numCells: string;
  cells: RadCell[];
  passMap: Array<{ cell: number; group: number } | null>;
  passNames: Record<number, string>;
  cellNames: Record<number, string>;
  identicalCells: boolean | null;
}

export type HwTileState = 'not_started' | 'incomplete' | 'faulty' | 'complete';

export interface HwSectionTemplate<F = Record<string, unknown>> {
  id: string;
  name: string;
  fields: F;
  saved: boolean;
  /** Home-page grouping root (furnace index) this template was seeded from.
   *  Used to reconcile templates when basic-info grouping changes. */
  _rootFi?: number;
}

export interface HwSection<F = Record<string, unknown>> {
  sameForAll: 0 | 1;
  templates: HwSectionTemplate<F>[];
  selectedIdx: number;
  applyMap: Record<number, string>;
  defineDone: boolean;
  applyDone: boolean;
  _wasForced?: boolean;
}

export function defaultHwSection<F>(emptyFields: () => F): HwSection<F> {
  return { sameForAll: 0, templates: [], selectedIdx: -1, applyMap: {}, defineDone: false, applyDone: false };
}

export function convEmptyFields(): ConvFields {
  return { draft: '', numBanks: '', banks: [], bankAliases: {}, attemperator: 0, fphSeries: 1 };
}

export function tleEmptyFields(): TleFields {
  const TLE_PARAMS = ['INLET_TEMPERATURE','OUTLET_TEMPERATURE','MASS_FLOW','MOLE_WEIGHT','INLET_PRESSURE','OUTLET_PRESSURE'];
  const TLE_SECS   = ['PTLE','PTLE_STLE_PIPING','STLE','STLE_TTLE_PIPING','TTLE'];
  const sections: Record<string, TleSection> = {};
  TLE_SECS.forEach(s => {
    sections[s] = {} as TleSection;
    TLE_PARAMS.forEach(p => { sections[s][p] = ''; sections[s][p+'_UOM'] = ''; });
  });
  return {
    stle:0, ttle:0, designData:0, massFlowConst:1, moleWeightConst:1, tempCont:1, pressCont:1,
    ptleName:'', stleName:'', ttleName:'',
    ptleColdFluid:'BFW_STEAM_DRUM', stleColdFluid:'', ttleColdFluid:'',
    ptleOrientation:'N/A', stleOrientation:'', ttleOrientation:'',
    pressTagAt:'DOWNSTREAM',
    sections,
  };
}

export function radEmptyFields(): RadFields {
  return { numCells: '', cells: [], passMap: [], passNames: {}, cellNames: {}, identicalCells: null };
}

export function radEmptyCell(): RadCell {
  return {
    hearthExists: null, hearthBurnerCount: '', hearthBurnerType: 'Conventional', hearthFgrPercent: 0,
    wallExists: null, wallBurnerCount: '', wallBurnerType: 'Conventional', wallFgrPercent: 0,
    burnerDesignSame: null, separateFlowTag: null,
    wallDesignFlowRate: '', wallDesignFlowRateUom: '', hearthDesignFlowRate: '', hearthDesignFlowRateUom: '',
    passesPerCell: '', tubesPerPass: '', tubeOrientation: '', flowEntry: 'top', feedType: 'control_valve',
    cellBends: [], cotAfterAdiaMerge: 0, cotSensorTubes: [],
  };
}

export interface HwTemplate {
  id: string;
  name: string;
  fields: Record<string, string>;
}

// ── FFI types ──
export interface FfiFeedData {
  fph1: boolean;
  fph2: boolean;
  htc: boolean;
  // Dedicated TLE routing stages (used by the feed-routing table when a single FPH bank
  // exists and an STLE/TTLE carries the HC feed in series with it). Optional for back-compat
  // with previously-persisted rows; treated as false when absent.
  stle?: boolean;
  ttle?: boolean;
}

export interface FfiLmfData {
  selectedFeeds: string[];
  rows: Record<string, FfiFeedData>;  // '_ds' for dilution steam row
}

export interface FfiHmfData {
  selectedFeeds: string[];
  passMap: Record<number, 'A' | 'B'>;
  rows: Record<string, FfiFeedData>;
}

export interface FfiOptions {
  dilSteam: boolean;
  archO2Exists: boolean;
  archO2PerCell: boolean;
  archO2WetBasis: boolean;
  stackO2Exists: boolean;
  stackO2WetBasis: boolean;
  airIngression: number;   // V418 — Delta between stack O₂ and arch O₂ (%), 0–100
  localAmbientTemp: boolean;
  localHumidity: boolean;
  localMixed: boolean;
  hybrid: boolean;
  dsBeforeVaporFlowmeter: boolean;
  dsBeforeLiquidFlowmeter: boolean;
  stackNoxAvailable: boolean;            // V418 — default NO
  stackSoxAvailable: boolean;            // V418 — default NO
  passwiseDecokeAirAvailable: boolean;   // V418 — default YES
  passwiseDecokeSteamAvailable: boolean; // V418 — default YES
  [key: string]: boolean | number;  // feed_active_{key}
}

export interface FfiTemplate {
  id: string;
  name: string;
  furnaces: number[];
  options: FfiOptions;
  data: Record<string, FfiFeedData>;   // per feed key
  lmfData: FfiLmfData;
  hmfData: FfiHmfData;
}

export function ffiDefaultOptions(): FfiOptions {
  return {
    dilSteam: false, archO2Exists: true, archO2PerCell: false, archO2WetBasis: false,
    stackO2Exists: true, stackO2WetBasis: false, airIngression: 0,
    localAmbientTemp: false, localHumidity: false,
    localMixed: false, hybrid: false,
    dsBeforeVaporFlowmeter: false, dsBeforeLiquidFlowmeter: false,
    stackNoxAvailable: false, stackSoxAvailable: false,
    passwiseDecokeAirAvailable: true, passwiseDecokeSteamAvailable: true,
  };
}

export function ffiDefaultFeedData(): FfiFeedData { return { fph1: false, fph2: false, htc: false, stle: false, ttle: false }; }

export function ffiBuildTplData(activeFeeds: string[]): Pick<FfiTemplate, 'options' | 'data' | 'lmfData' | 'hmfData'> {
  const data: Record<string, FfiFeedData> = {};
  const unconditional = ['decoke_steam','decoke_air','dilution_steam'];
  [...activeFeeds, ...unconditional].forEach(k => { data[k] = ffiDefaultFeedData(); });
  return {
    options: ffiDefaultOptions(), data,
    lmfData: { selectedFeeds: [], rows: {} },
    hmfData: { selectedFeeds: [], passMap: {}, rows: {} },
  };
}

export interface FmsState {
  furnaceCount: number;
  furnaceInfo: FurnaceInfo[];
  homeSameForAll: boolean;
  activeFeeds: ActiveFeed[];
  allocTable: (0 | 1 | 2 | 3)[][];

  pctPid: number;
  pctSat: number;
  pctComp: number;

  pidConfirmed: boolean;
  satConfirmed: boolean;
  pidDone: boolean;

  compComponents: string[];
  compCount: number;
  compConfirmPhase: 0 | 1 | 2;

  satDone: boolean;
  basicInfoDone: boolean;

  visitedUom: boolean;
  visitedPid: boolean;
  visitedComp: boolean;
  visitedSat: boolean;
  visitedSelector: boolean;

  // P&ID variables
  pidVars: PidVars;
  pidVarsUser: PidVars;
  satVars: SatVars;

  // Feed Selector
  selectorChars: { eth: string[]; pro: string[]; but: string[]; nap: string[]; gen_fr: string[]; gen_tf: string[]; };
  mixedFeedOp: 0 | 1;
  dualFeedOp: 0 | 1;
  mixedChars: string[];
  dualChars: string[];

  uom: UomState;
  uomConfirmed: boolean;

  hwTemplates: HwTemplate[];
  hwApply: Record<number, string>;

  // ── FFI State ──
  ffiTemplates: FfiTemplate[];
  ffiApplyMap: Record<number, string>;
  ffiSelectedTplId: string | null;
  ffiSameForAll: 0 | 1;
  ffiModeState: Record<number, { selectedMode: string }>;

  // ── Hardware sections ──
  hwConv: HwSection<ConvFields>;
  hwTle:  HwSection<TleFields>;
  hwRad:  HwSection<RadFields>;
  hwCurSec: 'conv' | 'rad' | null;
  ffiDone: boolean;
}

const defaultPidVars = (): PidVars => {
  const keys = [
    'ff_eth','ff_pro','ff_but','ff_nap',
    'rcy_eth','rcy_pro','rcy_but','rcy_nap',
    'rcy_eth_to_eth','rcy_eth_to_pro','rcy_eth_to_but','rcy_eth_to_nap',
    'rcy_pro_to_eth','rcy_pro_to_pro','rcy_pro_to_but','rcy_pro_to_nap',
    'rcy_but_to_eth','rcy_but_to_pro','rcy_but_to_but','rcy_but_to_nap',
    'nap_to_gen_fr','nap_to_gen_tf',
    'eth_exists','pro_exists','but_exists','nap_exists',
    'eth_to_gen_fr','eth_to_gen_tf',
    'pro_to_gen_fr','pro_to_gen_tf',
    'but_to_gen_fr','but_to_gen_tf',
    'eth_spill_eth','eth_spill_pro','eth_spill_but','eth_spill_nap',
    'pro_spill_eth','pro_spill_pro','pro_spill_but','pro_spill_nap',
    'but_spill_eth','but_spill_pro','but_spill_but','but_spill_nap',
    'nap_spill_eth','nap_spill_pro','nap_spill_but','nap_spill_nap',
    'gen_fr_exists','gen_tf_exists',
  ];
  const v: PidVars = {};
  keys.forEach(k => v[k] = null);
  // Fixed-NO defaults
  v['rcy_eth_to_nap']=0; v['rcy_pro_to_nap']=0; v['rcy_but_to_nap']=0;
  v['nap_to_gen_fr']=0;  v['nap_to_gen_tf']=0;
  v['eth_spill_eth']=0;  v['pro_spill_pro']=0;  v['but_spill_but']=0;
  v['eth_spill_nap']=0;  v['pro_spill_nap']=0;  v['but_spill_nap']=0;
  v['nap_spill_eth']=0;  v['nap_spill_pro']=0;  v['nap_spill_but']=0;  v['nap_spill_nap']=0;
  return v;
};

const defaultSatVars = (): SatVars => {
  const keys = ['sat_dsg','sat_exists','sat_eth','sat_pro','sat_but','sat_gen_fr','sat_gen_tf','sat_nap'];
  const v: SatVars = {};
  keys.forEach(k => v[k] = null);
  return v;
};

const defaultFurnaceInfo = (idx: number): FurnaceInfo => ({
  name: String(idx + 1),
  licensor: '', coilType: '', cells: '', passPerCell: '', tubesPerPass: '', designRunlength: '',
  copyFrom: null, _autoCopy: false, _cascadeFrom: null,
  _ownValues: { licensor: '', coilType: '', cells: '', passPerCell: '', tubesPerPass: '', designRunlength: '' },
});

export const defaultFmsState = (): FmsState => ({
  furnaceCount: 0,
  furnaceInfo: [],
  homeSameForAll: false,
  activeFeeds: [],
  allocTable: [],
  pctPid: 0, pctSat: 0, pctComp: 0,
  pidConfirmed: false, satConfirmed: false, pidDone: false,
  compComponents: [], compCount: 0, compConfirmPhase: 0,
  satDone: false,
  basicInfoDone: false,
  visitedUom: false, visitedPid: false, visitedComp: false,
  visitedSat: false, visitedSelector: false,
  pidVars: defaultPidVars(),
  pidVarsUser: {},
  satVars: defaultSatVars(),
  selectorChars: { eth: [], pro: [], but: [], nap: [], gen_fr: [], gen_tf: [] },
  mixedFeedOp: 0, dualFeedOp: 0, mixedChars: [], dualChars: [],
  uom: {
    massFlow: 't/h', temperature: 'deg C', temperatureDrop: 'deg C',
    pressure: 'barg', pressureDrop: 'mbar', work: 'MW',
    specificEnergy: 'kJ/kg', composition: 'mol%',
    moleWeight: 'g/gmol', humidity: '%', pH: 'pH',
  },
  uomConfirmed: false,
  hwTemplates: [], hwApply: {},
  ffiTemplates: [], ffiApplyMap: {}, ffiSelectedTplId: null, ffiSameForAll: 0, ffiModeState: {},
  hwConv: defaultHwSection(convEmptyFields),
  hwTle:  defaultHwSection(tleEmptyFields),
  hwRad:  defaultHwSection(radEmptyFields),
  hwCurSec: null,
  ffiDone: false,
});

export { defaultFurnaceInfo };

// Basic Information is complete when the furnace fleet has valid details AND the
// Default UOM Manager tab has been visited. Gates the rest of the Configuration
// Modules — the other tiles, the Confirm bar, and the Next → FMS button.
export function basicInfoComplete(s: FmsState): boolean {
  return s.basicInfoDone && (s.visitedUom || s.uomConfirmed);
}

// In-memory only — state resets on page refresh (no localStorage persistence).
export const fmsStateAtom = atom<FmsState>(defaultFmsState());
export const activePageAtom = atom<PageKey>('landing');

// ── Hardware-section entry (shared by HardwareConfigPage tiles + wizard nav) ──
// Sets hwCurSec and guarantees the section (and, for conv, its paired TLE) has a
// Template 1 to edit. Navigate to 'hwdefine' after applying this to the state.
export function enterHwSection(prev: FmsState, sec: 'conv' | 'rad'): FmsState {
  const single = prev.furnaceCount === 1;
  const hwSec = sec === 'conv' ? prev.hwConv : prev.hwRad;
  const newSec = { ...hwSec };
  if (single) { newSec.sameForAll = 1; newSec._wasForced = true; }
  if (newSec.templates.length === 0) {
    const id = `${sec}-T1`;
    newSec.templates = [{ id, name: 'Template 1', fields: (sec === 'conv' ? convEmptyFields() : radEmptyFields()) as unknown as never, saved: false }];
    newSec.selectedIdx = 0;
  }
  let hwTle = prev.hwTle;
  if (sec === 'conv' && hwTle.templates.length < newSec.templates.length) {
    const tleTpls = [...hwTle.templates];
    while (tleTpls.length < newSec.templates.length) {
      const i = tleTpls.length;
      tleTpls.push({ id: `tle-T${i + 1}`, name: `Template ${i + 1}`, fields: tleEmptyFields(), saved: false });
    }
    hwTle = { ...hwTle, templates: tleTpls };
  }
  return {
    ...prev, hwCurSec: sec,
    hwConv: sec === 'conv' ? newSec as HwSection<ConvFields> : prev.hwConv,
    hwRad:  sec === 'rad'  ? newSec as HwSection<RadFields>  : prev.hwRad,
    hwTle,
  };
}

// ── Hardware-section status — single source for HardwareConfig/Section pages,
//    the Hub tiles, and ModulesStatus (they must always agree). ──
type HwSecStatusInput = { defineDone: boolean; sameForAll: 0 | 1; applyDone: boolean };

// Percent-complete of one hardware section: 0 until Defined; 100 when it covers
// every furnace (single furnace or "same for all"); otherwise 50 until Applied.
export function hwSectionPct(sec: HwSecStatusInput, single: boolean): number {
  if (!sec.defineDone) return 0;
  if (sec.sameForAll === 1 || single) return 100;
  return sec.applyDone ? 100 : 50;
}
export function hwSectionDone(sec: HwSecStatusInput, single: boolean): boolean {
  return hwSectionPct(sec, single) >= 100;
}

// Tile state for a hardware section on its config tile.
export function hwTileState(sec: HwSection<unknown>): HwTileState {
  if (sec.defineDone) return 'complete';
  if (sec.templates.length > 0) return 'incomplete';
  return 'not_started';
}

// All Feed-management sub-pages visited (the Feed Selector only matters with ≥2
// active feeds).
export function feedAllVisited(fms: FmsState): boolean {
  const v = fms.pidVars as Record<string, 0 | 1 | null>;
  const activeFeedCount = ['eth_exists', 'pro_exists', 'but_exists', 'nap_exists', 'gen_fr_exists', 'gen_tf_exists'].filter(k => v[k] === 1).length;
  const selNeeded = activeFeedCount >= 2;
  return fms.visitedPid && fms.visitedComp && fms.visitedSat && (!selNeeded || fms.visitedSelector);
}

// Feed & Furnace Interaction is unlocked once Basic Info, all Feed-management
// sub-pages, and both Convection + Radiation define steps are complete. Mirrors
// the FFI tile gate in HubPage — kept here so the wizard Next stays in sync.
export function ffiUnlocked(fms: FmsState): boolean {
  const single = fms.furnaceCount === 1;
  return fms.basicInfoDone && feedAllVisited(fms)
    && hwSectionDone(fms.hwConv, single) && hwSectionDone(fms.hwRad, single);
}

// Signature of the entries recorded the last time Confirm was pressed THIS
// session. null = not confirmed yet this session. Drives the Hub Confirm
// button's colour state and the Landing Packages/KPI lock; a page refresh wipes
// it (so the tile re-locks until the modules are completed + confirmed again).
export const confirmedBaselineAtom = atom<{ hash: string } | null>(null);

// Confirmed / draft SNAPSHOTS of the whole FMS state, used for the per-entry
// save-state text indicator (a control compares its current value to these).
// Set at the same sync points as confirmedBaselineAtom: auto-fill on open,
// Save (draft only), Confirm (both), Revert (both = confirmed). null = no such
// snapshot yet, in which case controls show no indicator.
export const confirmedFmsAtom = atom<FmsState | null>(null);
export const draftFmsAtom = atom<FmsState | null>(null);
export type FmsRowKey = 'pid' | 'comp' | 'sat' | 'sel';
export const expandedFmsRowAtom = atom<FmsRowKey | null>('pid');
export const FMS_TAB_TITLES: Record<FmsRowKey, string> = {
  pid: 'Feed Header System', comp: 'Components', sat: 'Saturator Configuration', sel: 'Feed Selector Switch',
};

// Basic Information pill tab (Fleet Record / Default UOM Manager). The Default UOM
// Manager, formerly its own hub tile + page, now lives as the second tab here;
// WizardNav's Back/Next steps through these before crossing to the hub / fms.
export type BasicInfoTabKey = 'fleet' | 'uom';
export const basicInfoTabAtom = atom<BasicInfoTabKey>('fleet');
export const BASICINFO_TAB_TITLES: Record<BasicInfoTabKey, string> = {
  fleet: 'Fleet Record', uom: 'Default UOM Manager',
};

// Convection-editor pill tab (Convection Section / Transfer Line Exchangers). Lifted to an
// atom (instead of local useState in ConvEditor) so WizardNav's Back/Next can step through
// it too.
export type ConvTabKey = 'conv' | 'tle';
export const convTabAtom = atom<ConvTabKey>('conv');
export const CONV_TAB_TITLES: Record<ConvTabKey, string> = { conv: 'Convection Section', tle: 'Transfer Line Exchangers' };

// Radiation-editor pill tab (Pass & Tube Details / Burner Configuration). Same rationale as convTabAtom.
export type RadTabKey = 'tube' | 'burner';
export const radTabAtom = atom<RadTabKey>('tube');
export const RAD_TAB_TITLES: Record<RadTabKey, string> = { tube: 'Pass & Tube Details', burner: 'Burner Configuration' };

// Area Feed Header questionnaire accordion open/closed state.
// First visit: only the top section (acc-s1) is expanded; the last user setting
// is then remembered for the rest of the session (resets on refresh, like the
// other in-memory atoms). At least one section is always open — collapsing the
// last open section instead cycles to the next one. Order matters for cycling.
export const FMS_ACC_ORDER = ['acc-s1', 'acc-s2', 'acc-s3', 'acc-s4'] as const;
export const openFmsAccsAtom = atom<Set<string>>(new Set<string>(['acc-s1']));
