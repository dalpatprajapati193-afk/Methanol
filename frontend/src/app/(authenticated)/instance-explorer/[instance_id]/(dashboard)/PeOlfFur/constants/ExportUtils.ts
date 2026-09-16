import {
  FmsState, ConvFields, RadFields, TleFields,
  FfiTemplate, HwSection,
} from '../store/FmsAtoms';
import { FuelState } from '../store/FuelAtoms';
import { FIXED_COMPONENTS, FIXED_OFFSET } from './Components';
import { tleDroppedSections } from './TleLogic';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportRow = {
  variable: string;
  value: string | number;
  section: string;
  standardVar: string;
};

export type TreeRow = {
  nodeId: string;
  nodeType: string;
  index: string;
  parentId: string;
  label: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FFI_FEED_IDX: Record<string, number> = { eth: 1, pro: 2, but: 3, nap: 4, gen_fr: 5, gen_tf: 6 };

const FFI_AREA_FEED_DEFS = [
  { key: 'eth',    existsKey: 'eth_exists' },
  { key: 'pro',    existsKey: 'pro_exists' },
  { key: 'but',    existsKey: 'but_exists' },
  { key: 'nap',    existsKey: 'nap_exists' },
  { key: 'gen_fr', existsKey: 'gen_fr_exists' },
  { key: 'gen_tf', existsKey: 'gen_tf_exists' },
];

const FFI_UNCONDITIONAL = ['decoke_steam', 'decoke_air', 'dilution_steam'];

const SEL_FEED_DEFS = [
  { key: 'eth',    idx: 1, label: 'ETH',             existsKey: 'eth_exists' },
  { key: 'pro',    idx: 2, label: 'PRO',             existsKey: 'pro_exists' },
  { key: 'but',    idx: 3, label: 'BUT',             existsKey: 'but_exists' },
  { key: 'nap',    idx: 4, label: 'NAP',             existsKey: 'nap_exists' },
  { key: 'gen_fr', idx: 5, label: 'Fresh & Recycle', existsKey: 'gen_fr_exists' },
  { key: 'gen_tf', idx: 6, label: 'Total Feed',      existsKey: 'gen_tf_exists' },
];

const TLE_PARAMS = ['INLET_TEMPERATURE','OUTLET_TEMPERATURE','MASS_FLOW','MOLE_WEIGHT','INLET_PRESSURE','OUTLET_PRESSURE'];
const TLE_SECTIONS_ORDER = ['PTLE','PTLE_STLE_PIPING','STLE','STLE_TTLE_PIPING','TTLE'];

// ─── Variable Name Map (mirrors v411 VAR_NAME_MAP + _varRename patterns) ─────

const VAR_NAME_MAP: Record<string, string> = {
  // P&ID
  ff_eth: 'Furnace_System_Fresh_Feed_1_Exists',
  ff_pro: 'Furnace_System_Fresh_Feed_2_Exists',
  ff_but: 'Furnace_System_Fresh_Feed_3_Exists',
  ff_nap: 'Furnace_System_Fresh_Feed_4_Exists',
  rcy_eth: 'Furnace_System_Recycle_Feed_1_Exists',
  rcy_pro: 'Furnace_System_Recycle_Feed_2_Exists',
  rcy_but: 'Furnace_System_Recycle_Feed_3_Exists',
  rcy_nap: 'Furnace_System_Recycle_Feed_4_Exists',
  rcy_eth_to_eth: 'Furnace_System_Recycle_Feed_1_To_Feed_1_Header_Exists',
  rcy_eth_to_pro: 'Furnace_System_Recycle_Feed_1_To_Feed_2_Header_Exists',
  rcy_eth_to_but: 'Furnace_System_Recycle_Feed_1_To_Feed_3_Header_Exists',
  rcy_eth_to_nap: 'Furnace_System_Recycle_Feed_1_To_Feed_4_Header_Exists',
  rcy_pro_to_eth: 'Furnace_System_Recycle_Feed_2_To_Feed_1_Header_Exists',
  rcy_pro_to_pro: 'Furnace_System_Recycle_Feed_2_To_Feed_2_Header_Exists',
  rcy_pro_to_but: 'Furnace_System_Recycle_Feed_2_To_Feed_3_Header_Exists',
  rcy_pro_to_nap: 'Furnace_System_Recycle_Feed_2_To_Feed_4_Header_Exists',
  rcy_but_to_eth: 'Furnace_System_Recycle_Feed_3_To_Feed_1_Header_Exists',
  rcy_but_to_pro: 'Furnace_System_Recycle_Feed_3_To_Feed_2_Header_Exists',
  rcy_but_to_but: 'Furnace_System_Recycle_Feed_3_To_Feed_3_Header_Exists',
  rcy_but_to_nap: 'Furnace_System_Recycle_Feed_3_To_Feed_4_Header_Exists',
  eth_exists: 'Furnace_System_Feed_1_Exists',
  pro_exists: 'Furnace_System_Feed_2_Exists',
  but_exists: 'Furnace_System_Feed_3_Exists',
  nap_exists: 'Furnace_System_Feed_4_Exists',
  gen_fr_exists: 'Furnace_System_Feed_5_Exists',
  gen_tf_exists: 'Furnace_System_Feed_6_Exists',
  eth_spill_eth: 'Furnace_System_Feed_1_To_Feed_1_Spillover_Exists',
  eth_spill_pro: 'Furnace_System_Feed_1_To_Feed_2_Spillover_Exists',
  eth_spill_but: 'Furnace_System_Feed_1_To_Feed_3_Spillover_Exists',
  eth_spill_nap: 'Furnace_System_Feed_1_To_Feed_4_Spillover_Exists',
  pro_spill_eth: 'Furnace_System_Feed_2_To_Feed_1_Spillover_Exists',
  pro_spill_pro: 'Furnace_System_Feed_2_To_Feed_2_Spillover_Exists',
  pro_spill_but: 'Furnace_System_Feed_2_To_Feed_3_Spillover_Exists',
  pro_spill_nap: 'Furnace_System_Feed_2_To_Feed_4_Spillover_Exists',
  but_spill_eth: 'Furnace_System_Feed_3_To_Feed_1_Spillover_Exists',
  but_spill_pro: 'Furnace_System_Feed_3_To_Feed_2_Spillover_Exists',
  but_spill_but: 'Furnace_System_Feed_3_To_Feed_3_Spillover_Exists',
  but_spill_nap: 'Furnace_System_Feed_3_To_Feed_4_Spillover_Exists',
  nap_spill_eth: 'Furnace_System_Feed_4_To_Feed_1_Spillover_Exists',
  nap_spill_pro: 'Furnace_System_Feed_4_To_Feed_2_Spillover_Exists',
  nap_spill_but: 'Furnace_System_Feed_4_To_Feed_3_Spillover_Exists',
  nap_spill_nap: 'Furnace_System_Feed_4_To_Feed_4_Spillover_Exists',
  eth_to_gen_fr: 'Furnace_System_Feed_1_To_Feed_5_Spillover_Exists',
  pro_to_gen_fr: 'Furnace_System_Feed_2_To_Feed_5_Spillover_Exists',
  but_to_gen_fr: 'Furnace_System_Feed_3_To_Feed_5_Spillover_Exists',
  nap_to_gen_fr: 'Furnace_System_Feed_4_To_Feed_5_Spillover_Exists',
  eth_to_gen_tf: 'Furnace_System_Feed_1_To_Feed_6_Spillover_Exists',
  pro_to_gen_tf: 'Furnace_System_Feed_2_To_Feed_6_Spillover_Exists',
  but_to_gen_tf: 'Furnace_System_Feed_3_To_Feed_6_Spillover_Exists',
  nap_to_gen_tf: 'Furnace_System_Feed_4_To_Feed_6_Spillover_Exists',
  // Saturator (V418 fixed the legacy "Furnce" typo → "Furnace")
  sat_dsg:    'Furnace_System_Dilution_Steam_Generator_Exists',
  sat_exists: 'Furnace_System_Saturator_Exists',
  sat_eth:    'Furnace_System_Saturator_For_Feed_1_Exists',
  sat_pro:    'Furnace_System_Saturator_For_Feed_2_Exists',
  sat_but:    'Furnace_System_Saturator_For_Feed_3_Exists',
  sat_nap:    'Furnace_System_Saturator_For_Feed_4_Exists',
  sat_gen_fr: 'Furnace_System_Saturator_For_Feed_5_Exists',
  sat_gen_tf: 'Furnace_System_Saturator_For_Feed_6_Exists',
  // UOM
  massFlow:       'Mass_Flow_Sensor_Tag',
  temperature:    'Temperature_Sensor_Tag',
  temperatureDrop:'Temperature_Drop_Sensor_Tag',
  pressure:       'Pressure_Sensor_Tag',
  pressureDrop:   'Pressure_Drop_Sensor_Tag',
  work:           'Work_Sensor_Tag',
  specificEnergy: 'Specific_Energy_Sensor_Tag',
  composition:    'Composition_Sensor_Tag',
  moleWeight:     'Mole_Weight_Sensor_Tag',
  humidity:       'Humidity_Sensor_Tag',
  pH:             'Ph_Sensor_Tag',
};

function varRename(k: string): string {
  if (VAR_NAME_MAP[k]) return VAR_NAME_MAP[k];

  // Feed Component N → Furnace_System_Feed_Component_N
  let m: RegExpMatchArray | null;
  m = k.match(/^Feed_Component_(\d+)$/);
  if (m) return `Furnace_System_Feed_Component_${m[1]}`;

  // FFI options: F{n}.key → Furnace_{n}_Key
  m = k.match(/^F(\d+)\.(dilSteam|archO2Exists|archO2PerCell|archO2WetBasis|stackO2Exists|stackO2WetBasis|airIngression|localAmbientTemp|localHumidity|dsBeforeVaporFlowmeter|dsBeforeLiquidFlowmeter|stackNoxAvailable|stackSoxAvailable|passwiseDecokeAirAvailable|passwiseDecokeSteamAvailable)$/);
  if (m) {
    const map: Record<string, string> = {
      dilSteam:                'Dilution_Steam_Header_Active',
      archO2Exists:            'Arch_O2_Exists',
      archO2PerCell:           'Arch_O2_Per_Cell',
      archO2WetBasis:          'Arch_O2_Wet_Basis',
      stackO2Exists:           'Stack_O2_Exists',
      stackO2WetBasis:         'Stack_O2_Wet_Basis',
      airIngression:           'Delta_Stack_Arch_O2',
      localAmbientTemp:        'Local_Ambient_Temp_Available',
      localHumidity:           'Local_Humidity_Tag_Available',
      dsBeforeVaporFlowmeter:  'DS_Before_Vapor_Feed_Flowmeter',
      dsBeforeLiquidFlowmeter: 'DS_Before_Liquid_Feed_Flowmeter',
      stackNoxAvailable:            'Stack_NOx_Available',
      stackSoxAvailable:            'Stack_SOx_Available',
      passwiseDecokeAirAvailable:   'Passwise_Decoke_Air_Available',
      passwiseDecokeSteamAvailable: 'Passwise_Decoke_Steam_Available',
    };
    return `Furnace_${m[1]}_${map[m[2]]}`;
  }

  // F{n}.{feedKey}.active/fph1/fph2/htc/stle/ttle
  m = k.match(/^F(\d+)\.(eth|pro|but|nap|gen_fr|gen_tf)\.(active|fph1|fph2|htc|stle|ttle)$/);
  if (m) {
    const colMap: Record<string, string> = { active:'Active', fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2', htc:'Flows_Through_HTC', stle:'Flows_Through_STLE', ttle:'Flows_Through_TTLE' };
    return `Furnace_${m[1]}_Master_Feed_${FFI_FEED_IDX[m[2]]}_${colMap[m[3]]}`;
  }

  // V418 — F{n}.{primary_feed|secondary_feed|mix_feed|hybrid_feed}.{fph1|fph2|htc}
  m = k.match(/^F(\d+)\.(primary_feed|secondary_feed|mix_feed|hybrid_feed)\.(fph1|fph2|htc)$/);
  if (m) {
    const nameMap: Record<string, string> = { primary_feed:'Primary_Feed', secondary_feed:'Secondary_Feed', mix_feed:'Mix_Feed', hybrid_feed:'Hybrid_Feed' };
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2', htc:'Flows_Through_HTC' };
    return `Furnace_${m[1]}_${nameMap[m[2]]}_${colMap[m[3]]}`;
  }

  // F{n}.decoke_steam/decoke_air/dilution_steam
  m = k.match(/^F(\d+)\.(decoke_steam|decoke_air|dilution_steam)\.(fph1|fph2|htc|stle|ttle)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2', htc:'Flows_Through_HTC', stle:'Flows_Through_STLE', ttle:'Flows_Through_TTLE' };
    const nameMap: Record<string, string> = { decoke_steam:'Decoke_Steam', decoke_air:'Decoke_Air', dilution_steam:'Dilution_Steam' };
    return `Furnace_${m[1]}_${nameMap[m[2]]}_${colMap[m[3]]}`;
  }

  // LMF patterns
  m = k.match(/^F(\d+)\.lmf\.active$/);
  if (m) return `Furnace_${m[1]}_LMF_Active`;
  m = k.match(/^F(\d+)\.lmf\.(feed_a|feed_b)$/);
  if (m) return `Furnace_${m[1]}_LMF_${m[2] === 'feed_a' ? 'Feed_A' : 'Feed_B'}_Index`;
  m = k.match(/^F(\d+)\.lmf\.(eth|pro|but|nap|gen_fr|gen_tf)\.(fph1|fph2|htc)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2', htc:'Flows_Through_HTC' };
    return `Furnace_${m[1]}_LMF_Feed_${FFI_FEED_IDX[m[2]]}_${colMap[m[3]]}`;
  }
  m = k.match(/^F(\d+)\.lmf\.ds\.(fph1|fph2)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2' };
    return `Furnace_${m[1]}_LMF_Dilution_Steam_${colMap[m[2]]}`;
  }
  m = k.match(/^F(\d+)\.lmf\.dry_junc_(fph1|fph2|htc)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'At_FPH1_Inlet', fph2:'At_FPH2_Inlet', htc:'At_HTC_Inlet' };
    return `Furnace_${m[1]}_LMF_Dry_Junction_${colMap[m[2]]}`;
  }
  m = k.match(/^F(\d+)\.lmf\.wet_junc_(fph1|fph2|htc)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'At_FPH1_Inlet', fph2:'At_FPH2_Inlet', htc:'At_HTC_Inlet' };
    return `Furnace_${m[1]}_LMF_Wet_Junction_${colMap[m[2]]}`;
  }
  m = k.match(/^F(\d+)\.lmf\.(primary_feed|secondary_feed)$/);
  if (m) return `Furnace_${m[1]}_LMF_${m[2] === 'primary_feed' ? 'Primary' : 'Secondary'}_Feed_Code`;
  m = k.match(/^F(\d+)\.(operates_solo|solo_feed_code)$/);
  if (m) return `Furnace_${m[1]}_${m[2] === 'operates_solo' ? 'Operates_On_Solo_Feed' : 'Solo_Feed_Code'}`;
  m = k.match(/^F(\d+)\.is_secondary_feed_solo_op$/);
  if (m) return `Furnace_${m[1]}_Is_Secondary_Feed_Solo_Operation`;

  // HMF patterns
  m = k.match(/^F(\d+)\.hmf\.active$/);
  if (m) return `Furnace_${m[1]}_Cocracking_Active`;
  m = k.match(/^F(\d+)\.hmf\.(feed_a|feed_b)$/);
  if (m) return `Furnace_${m[1]}_Cocracking_${m[2] === 'feed_a' ? 'Feed_A' : 'Feed_B'}_Index`;
  m = k.match(/^F(\d+)\.hmf\.cell_(\d+)\.pass_(\d+)\.feed$/);
  if (m) return `Furnace_${m[1]}_Cell_${m[2]}_Cocracking_Pass_${m[3]}_Feed_Index`;
  m = k.match(/^F(\d+)\.hmf\.hybrid\.(fph1|fph2|htc)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2', htc:'Flows_Through_HTC' };
    return `Furnace_${m[1]}_Cocracking_Hybrid_Feed_${colMap[m[2]]}`;
  }
  m = k.match(/^F(\d+)\.hmf\.ds\.(fph1|fph2)$/);
  if (m) {
    const colMap: Record<string, string> = { fph1:'Flows_Through_FPH1', fph2:'Flows_Through_FPH2' };
    return `Furnace_${m[1]}_Cocracking_Dilution_Steam_${colMap[m[2]]}`;
  }
  m = k.match(/^F(\d+)\.hmf\.cell_(\d+)\.pass_(\d+)\.hybrid_feed_code$/);
  if (m) return `Furnace_${m[1]}_Cell_${m[2]}_Pass_${m[3]}_Hybrid_Feed_Code`;

  // Convection patterns: Furnace_N_Convection_Bank_M_Code → Furnace_N_Convection_Section_M_Code
  m = k.match(/^(Furnace_\d+)_Convection_Draft_Type$/);
  if (m) return `${m[1]}_Draft_Type`;
  m = k.match(/^(Furnace_\d+)_Convection_Bank_Count$/);
  if (m) return `${m[1]}_Convection_Section_Count`;
  m = k.match(/^(Furnace_\d+)_Convection_Bank_(\d+)_(Code|Name)$/);
  if (m) return `${m[1]}_Convection_Section_${m[2]}_${m[3]}`;
  m = k.match(/^(Furnace_\d+)_Convection_Attemperator$/);
  if (m) return `${m[1]}_Attemperator_Exists`;
  m = k.match(/^(Furnace_\d+)_Convection_FPH_Series$/);
  if (m) return `${m[1]}_Convection_Section_FPH_In_Series`;

  // TLE patterns
  const TLE_MAP: Record<string, string> = { PTLE:'TLE_1', STLE:'TLE_2', TTLE:'TLE_3', PTLE_STLE_PIPING:'TLE_Piping_1', STLE_TTLE_PIPING:'TLE_Piping_2' };
  const TLE_CTRL_MAP: Record<string, string> = {
    MASS_FLOW_CONSTANT:'TLE_Mass_Flow_Constant', MOLE_WEIGHT_CONSTANT:'TLE_Mole_Weight_Constant',
    TEMPERATURE_CONTINUITY:'TLE_Temperature_Continuity', PRESSURE_CONTINUITY:'TLE_Pressure_Continuity',
    TLE_DESIGN_DATA_SELECTED:'TLE_Design_Data_Selected',
  };
  m = k.match(/^(Furnace_\d+)_(MASS_FLOW_CONSTANT|MOLE_WEIGHT_CONSTANT|TEMPERATURE_CONTINUITY|PRESSURE_CONTINUITY|TLE_DESIGN_DATA_SELECTED)$/);
  if (m && TLE_CTRL_MAP[m[2]]) return `${m[1]}_${TLE_CTRL_MAP[m[2]]}`;

  m = k.match(/^(Furnace_\d+)_(PTLE|STLE|TTLE|PTLE_STLE_PIPING|STLE_TTLE_PIPING)_(EXISTS|NAME|COLD_FLUID|ORIENTATION)$/);
  if (m && TLE_MAP[m[2]]) {
    // Title-case each word: COLD_FLUID → Cold_Fluid (matches V418 + the importer's spelling)
    const prop = m[3].split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join('_');
    return `${m[1]}_${TLE_MAP[m[2]]}_${prop}`;
  }

  m = k.match(/^(Furnace_\d+)_(PTLE|STLE|TTLE|PTLE_STLE_PIPING|STLE_TTLE_PIPING)_(INLET_TEMPERATURE|OUTLET_TEMPERATURE|MASS_FLOW|MOLE_WEIGHT|INLET_PRESSURE|OUTLET_PRESSURE)(_UOM)?$/);
  if (m && TLE_MAP[m[2]]) {
    const param = m[3].split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join('_');
    return `${m[1]}_${TLE_MAP[m[2]]}_${param}${m[4] ? '_Uom' : ''}`;
  }

  return k;
}

function getStandardVar(renamed: string): string {
  let m: RegExpMatchArray | null;
  m = renamed.match(/^(Furnace)_(\d+)_(.+)$/);
  if (m) {
    const suffix = m[3].replace(/_([\d]+)_/g, '_N_').replace(/_([\d]+)$/, '_N');
    return `Furnace_${suffix}`;
  }
  m = renamed.match(/^Feed(\d+)_To_Furnace_(\d+)$/);
  if (m) return 'Feed_N_To_Furnace_N';
  m = renamed.match(/^(Primary_Feed_To_Furnace|Secondary_Feed_To_Furnace)_(\d+)$/);
  if (m) return `${m[1]}_N`;
  m = renamed.match(/^((?:Furnace_System_)?Feed_Component)_(\d+)$/);
  if (m) return `${m[1]}_N`;
  m = renamed.match(/^(Fuel_Component)_(\d+)$/);
  if (m) return `${m[1]}_N`;
  return renamed;
}

export { varRename };

function row(key: string, value: string | number, section: string): ExportRow {
  const variable = varRename(key);
  return { variable, value, section, standardVar: getStandardVar(variable) };
}

function rawRow(variable: string, value: string | number, section: string): ExportRow {
  return { variable, value, section, standardVar: getStandardVar(variable) };
}

// V418 furnaceName(): always "Furnace " + (trimmed name || index). Used for the Name var + tree label.
function furnaceDisplayName(name: string | undefined, n: number): string {
  return name && name.trim() ? `Furnace ${name.trim()}` : `Furnace ${n}`;
}

// ─── Hardware helpers ─────────────────────────────────────────────────────────

function getHwTpl<F>(section: HwSection<F>, fi: number): F | null {
  if (!section.templates.length) return null;
  if (section.sameForAll === 1) return section.templates[0]?.fields ?? null;
  const id = section.applyMap[fi];
  const tpl = id ? section.templates.find(t => t.id === id) : null;
  return tpl?.fields ?? null;
}

function rzTotalPasses(f: RadFields): number {
  if (!f.cells) return 0;
  return f.cells.reduce((s, c) => s + (parseInt(c.passesPerCell) || 0), 0);
}

function rzPassLabel(f: RadFields, p: number): string {
  return (f.passNames && f.passNames[p]) ? f.passNames[p] : `Pass ${p + 1}`;
}

function rzCellLabel(f: RadFields, c: number): string {
  return (f.cellNames && f.cellNames[c]) ? f.cellNames[c] : `Cell ${c + 1}`;
}

function tleExistsMap(f: TleFields): Record<string, boolean> {
  return {
    PTLE:             true,
    PTLE_STLE_PIPING: f.stle === 1,
    STLE:             f.stle === 1,
    STLE_TTLE_PIPING: f.stle === 1 && f.ttle === 1,
    TTLE:             f.stle === 1 && f.ttle === 1,
  };
}

// ─── Convection vars ──────────────────────────────────────────────────────────

function cbComputeVars(fms: FmsState): Record<string, string | number> {
  const vars: Record<string, string | number> = {};
  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    const f = getHwTpl<ConvFields>(fms.hwConv, fi);
    const n = fi + 1;
    if (f) {
      const numBanks = parseInt(f.numBanks) || 0;
      vars[`Furnace_${n}_Convection_Draft_Type`]  = f.draft || 'EMPTY';
      vars[`Furnace_${n}_Convection_Bank_Count`]  = numBanks;
      for (let m = 1; m <= 9; m++) {
        const code = (f.banks[m - 1] && f.banks[m - 1] !== '') ? f.banks[m - 1] : 'EMPTY';
        vars[`Furnace_${n}_Convection_Bank_${m}_Code`] = code;
        vars[`Furnace_${n}_Convection_Bank_${m}_Name`] =
          code === 'EMPTY' ? 'EMPTY' : ((f.bankAliases && f.bankAliases[code]) || code);
      }
      vars[`Furnace_${n}_Convection_Attemperator`] = f.attemperator ?? 0;
      vars[`Furnace_${n}_Convection_FPH_Series`]   = f.fphSeries !== undefined ? f.fphSeries : 1;
    } else {
      vars[`Furnace_${n}_Convection_Draft_Type`]  = 'EMPTY';
      vars[`Furnace_${n}_Convection_Bank_Count`]  = '—';
      for (let m = 1; m <= 9; m++) {
        vars[`Furnace_${n}_Convection_Bank_${m}_Code`] = 'EMPTY';
        vars[`Furnace_${n}_Convection_Bank_${m}_Name`] = 'EMPTY';
      }
      vars[`Furnace_${n}_Convection_Attemperator`] = 0;
      vars[`Furnace_${n}_Convection_FPH_Series`]   = 1;
    }
  }
  return vars;
}

// ─── Radiation vars ───────────────────────────────────────────────────────────

function rzComputeVars(fms: FmsState): Record<string, string | number> {
  const vars: Record<string, string | number> = {};
  const defMfUom = fms.uom.massFlow || 't/h';

  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    const f = getHwTpl<RadFields>(fms.hwRad, fi);
    const n = fi + 1;

    if (f && f.numCells) {
      const nc = parseInt(f.numCells);
      const total = rzTotalPasses(f);
      vars[`Furnace_${n}_Cell_Count`] = nc;
      vars[`Furnace_${n}_Pass_Count`] = total;
      let totalTubes = 0, totalHearth = 0, totalWall = 0;

      for (let c = 0; c < nc; c++) {
        const cell = f.cells[c];
        if (!cell) continue;
        const ppc = parseInt(cell.passesPerCell) || 0;
        const tp  = parseInt(cell.tubesPerPass)  || 0;
        const hb  = cell.hearthExists === true ? (parseInt(cell.hearthBurnerCount) || 0) : 0;
        const wb  = cell.wallExists   === true ? (parseInt(cell.wallBurnerCount)   || 0) : 0;

        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burner_Exists`]    = cell.hearthExists === true ? 1 : 0;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burners_Count`]    = hb;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Burner_Type`]      = cell.hearthExists === true ? (cell.hearthBurnerType || 'Conventional') : 'Conventional';
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_FGR_Percent`]      = cell.hearthExists === true && (cell.hearthBurnerType === 'Low NOx' || cell.hearthBurnerType === 'Ultra Low NOx') ? (cell.hearthFgrPercent || 0) : 0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burner_Exists`]      = cell.wallExists === true ? 1 : 0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burners_Count`]      = wb;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Burner_Type`]        = cell.wallExists === true ? (cell.wallBurnerType || 'Conventional') : 'Conventional';
        vars[`Furnace_${n}_Cell_${c+1}_Wall_FGR_Percent`]        = cell.wallExists === true && (cell.wallBurnerType === 'Low NOx' || cell.wallBurnerType === 'Ultra Low NOx') ? (cell.wallFgrPercent || 0) : 0;
        const bothOn = cell.hearthExists === true && cell.wallExists === true;
        vars[`Furnace_${n}_Cell_${c+1}_Burner_Design_Same`]      = bothOn ? (cell.burnerDesignSame === true ? 1 : 0) : 0;
        vars[`Furnace_${n}_Cell_${c+1}_Separate_Flow_Tag`]       = (bothOn && cell.burnerDesignSame === false) ? (cell.separateFlowTag === true ? 1 : 0) : 0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate`]       = parseFloat(cell.wallDesignFlowRate) || 0;
        vars[`Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate_Uom`]   = cell.wallDesignFlowRateUom || defMfUom;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate`]     = parseFloat(cell.hearthDesignFlowRate) || 0;
        vars[`Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate_Uom`] = cell.hearthDesignFlowRateUom || defMfUom;
        vars[`Furnace_${n}_Cell_${c+1}_Pass_Count`]              = ppc;
        vars[`Furnace_${n}_Cell_${c+1}_Tubes_Per_Pass_Count`]    = tp;
        vars[`Furnace_${n}_Cell_${c+1}_Tube_Orientation`]        = cell.tubeOrientation || '—';
        vars[`Furnace_${n}_Cell_${c+1}_Flow_Entry`]              = cell.flowEntry || 'top';
        vars[`Furnace_${n}_Cell_${c+1}_Feed_Type`]               = cell.feedType || 'control_valve';

        // Cell exit and adiabatic exit tubes
        const orient = cell.tubeOrientation || '';
        let cellExitTubes = tp;
        let adiaExitTubes = 0;
        if (orient && tp > 0) {
          const hasAMid = orient.includes('-A-');
          const hasAEnd = !hasAMid && orient.endsWith('-A');
          const cellPart = hasAEnd ? orient.slice(0, -2) : hasAMid ? orient.split('-A-')[0] : orient;
          const cnums = cellPart.split('-').map(Number);
          const cfirst = cnums[0];
          const cellLastRatio = cnums[cnums.length - 1];
          cellExitTubes = Math.round(tp * cellLastRatio / cfirst);
          if (hasAMid)       adiaExitTubes = Math.round(cellExitTubes / cellLastRatio);
          else if (hasAEnd)  adiaExitTubes = cellExitTubes;
        }
        vars[`Furnace_${n}_Cell_${c+1}_Cell_Exit_Tubes_Per_Pass`] = cellExitTubes;

        // Bends
        const bends = cell.cellBends || [];
        const hasAMidB = orient.includes('-A-');
        const hasAEndB = !hasAMidB && orient.endsWith('-A');
        const cpB = hasAEndB ? orient.slice(0, -2) : hasAMidB ? orient.split('-A-')[0] : (orient || '1');
        const numsB = cpB ? cpB.split('-').map(Number) : [1];
        for (let bi = 0; bi < numsB.length; bi++) {
          vars[`Furnace_${n}_Cell_${c+1}_Bend_${bi+1}`] = bends[bi] || 0;
        }

        vars[`Furnace_${n}_Cell_${c+1}_Adia_Exit_Tubes_Per_Pass`] = adiaExitTubes;
        const cotAM = cell.cotAfterAdiaMerge || 0;
        vars[`Furnace_${n}_Cell_${c+1}_COT_After_Adia_Merge`] = cotAM;
        const cotCount = (cotAM === 1 && adiaExitTubes > 0) ? adiaExitTubes : cellExitTubes;
        vars[`Furnace_${n}_Cell_${c+1}_COT_Tube_Count`] = cotCount;
        const cotSensors = Array.isArray(cell.cotSensorTubes) ? cell.cotSensorTubes : [];
        for (let ti = 0; ti < cotCount; ti++) {
          vars[`Furnace_${n}_Cell_${c+1}_COT_Tube_${ti+1}_Has_Sensor`] = cotSensors[ti] ? 1 : 0;
        }

        totalTubes  += ppc * tp;
        totalHearth += hb;
        totalWall   += wb;
      }

      vars[`Furnace_${n}_Tube_Count`]          = totalTubes;
      vars[`Furnace_${n}_Hearth_Burner_Count`] = totalHearth;
      vars[`Furnace_${n}_Wall_Count`]           = totalWall;

      // Per-pass membership
      for (let p = 0; p < total; p++) {
        const pm = f.passMap[p] || {};
        const passCell = (pm as { cell?: number }).cell ?? -1;
        const passGrp  = (pm as { group?: number }).group ?? 0;
        vars[`Furnace_${n}_Cell_${passCell+1}_Pass_${p+1}_Name`] = rzPassLabel(f, p);
        for (let c = 0; c < nc; c++) {
          const belongs = passCell === c ? 1 : 0;
          vars[`Furnace_${n}_Cell_${c+1}_Pass_${p+1}_Exists`]          = belongs;
          vars[`Furnace_${n}_Cell_${c+1}_Group_1_Pass_${p+1}_Exists`]  = (belongs && passGrp === 1) ? 1 : 0;
          vars[`Furnace_${n}_Cell_${c+1}_Group_2_Pass_${p+1}_Exists`]  = (belongs && passGrp === 2) ? 1 : 0;
        }
      }
      for (let c = 0; c < nc; c++) {
        vars[`Furnace_${n}_Cell_${c+1}_Name`] = rzCellLabel(f, c);
      }
    } else {
      vars[`Furnace_${n}_Cell_Count`] = 0;
      vars[`Furnace_${n}_Pass_Count`] = 0;
      // V418 parity — emit zero counts even when no radiation template exists
      vars[`Furnace_${n}_Tube_Count`]          = 0;
      vars[`Furnace_${n}_Hearth_Burner_Count`] = 0;
      vars[`Furnace_${n}_Wall_Count`]          = 0;
    }
  }
  return vars;
}

// ─── TLE vars ─────────────────────────────────────────────────────────────────

function tleComputeVars(fms: FmsState): Record<string, string | number> {
  const vars: Record<string, string | number> = {};

  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    const f = getHwTpl<TleFields>(fms.hwTle, fi);
    const convF = getHwTpl<ConvFields>(fms.hwConv, fi);
    const n = fi + 1;

    if (f) {
      const exists = tleExistsMap(f);
      vars[`Furnace_${n}_MASS_FLOW_CONSTANT`]       = f.massFlowConst;
      vars[`Furnace_${n}_MOLE_WEIGHT_CONSTANT`]     = f.moleWeightConst;
      vars[`Furnace_${n}_TEMPERATURE_CONTINUITY`]   = f.tempCont;
      vars[`Furnace_${n}_PRESSURE_CONTINUITY`]      = f.pressCont !== undefined ? f.pressCont : 1;
      vars[`Furnace_${n}_TLE_DESIGN_DATA_SELECTED`] = f.designData;
      vars[`Furnace_${n}_PTLE_EXISTS`] = 1;
      vars[`Furnace_${n}_STLE_EXISTS`] = f.stle === 1 ? 1 : 0;
      vars[`Furnace_${n}_TTLE_EXISTS`] = (f.stle === 1 && f.ttle === 1) ? 1 : 0;
      vars[`Furnace_${n}_PTLE_NAME`] = f.ptleName || 'PTLE';
      vars[`Furnace_${n}_STLE_NAME`] = f.stleName || 'STLE';
      vars[`Furnace_${n}_TTLE_NAME`] = f.ttleName || 'TTLE';
      vars[`Furnace_${n}_PTLE_COLD_FLUID`] = 'BFW_STEAM_DRUM';
      vars[`Furnace_${n}_STLE_COLD_FLUID`] = f.stle === 1 ? (f.ttle === 1 ? 'BFW_STEAM_DRUM' : (f.stleColdFluid || 'BFW_STEAM_DRUM')) : 'EMPTY';
      vars[`Furnace_${n}_TTLE_COLD_FLUID`] = (f.stle === 1 && f.ttle === 1) ? (f.ttleColdFluid || 'COLD_BFW') : 'EMPTY';
      vars[`Furnace_${n}_PTLE_ORIENTATION`] = 'N/A';

      // STLE orientation
      const stleCf = vars[`Furnace_${n}_STLE_COLD_FLUID`] as string;
      if (stleCf === 'EMPTY') vars[`Furnace_${n}_STLE_ORIENTATION`] = 'EMPTY';
      else if (stleCf === 'BFW_STEAM_DRUM') vars[`Furnace_${n}_STLE_ORIENTATION`] = 'N/A';
      else if (stleCf === 'COLD_BFW') {
        const hasEco1 = (convF?.banks || []).includes('ECO1');
        // V418 — default value uses canonical bank code (not alias)
        vars[`Furnace_${n}_STLE_ORIENTATION`] = !hasEco1 ? 'N/A' : (f.stleOrientation || 'SERIES_UPSTREAM_ECO1');
      } else vars[`Furnace_${n}_STLE_ORIENTATION`] = f.stleOrientation || 'N/A';

      // TTLE orientation
      const ttleCf = vars[`Furnace_${n}_TTLE_COLD_FLUID`] as string;
      if (ttleCf === 'EMPTY') vars[`Furnace_${n}_TTLE_ORIENTATION`] = 'EMPTY';
      else if (ttleCf === 'BFW_STEAM_DRUM') vars[`Furnace_${n}_TTLE_ORIENTATION`] = 'N/A';
      else if (ttleCf === 'COLD_BFW') {
        const hasEco1 = (convF?.banks || []).includes('ECO1');
        // V418 — default value uses canonical bank code (not alias)
        vars[`Furnace_${n}_TTLE_ORIENTATION`] = !hasEco1 ? 'N/A' : (f.ttleOrientation || 'SERIES_UPSTREAM_ECO1');
      } else vars[`Furnace_${n}_TTLE_ORIENTATION`] = f.ttleOrientation || 'N/A';

      // V418 — reference pressure tag location
      vars[`Furnace_${n}_TLE_PRESSURE_TAG_AT`] = f.pressTagAt || 'DOWNSTREAM';

      // V418 — sections dropped by the press-tag answer export as 0/EMPTY (like absent sections)
      const droppedSecs = tleDroppedSections(f);

      for (const sec of TLE_SECTIONS_ORDER) {
        if (!exists[sec] || droppedSecs.has(sec)) {
          for (const p of TLE_PARAMS) {
            vars[`Furnace_${n}_${sec}_${p}`]       = 0;
            vars[`Furnace_${n}_${sec}_${p}_UOM`]   = 'EMPTY';
          }
          continue;
        }
        if (!f.designData) {
          for (const p of TLE_PARAMS) {
            vars[`Furnace_${n}_${sec}_${p}`]       = 0;
            vars[`Furnace_${n}_${sec}_${p}_UOM`]   = 'EMPTY';
          }
          continue;
        }
        const sd = f.sections[sec] || {};
        for (const p of TLE_PARAMS) {
          const val = sd[p] !== '' && sd[p] !== undefined ? sd[p] : 0;
          vars[`Furnace_${n}_${sec}_${p}`]     = val;
          vars[`Furnace_${n}_${sec}_${p}_UOM`] = sd[p + '_UOM'] || 'EMPTY';
        }
      }
    } else {
      vars[`Furnace_${n}_MASS_FLOW_CONSTANT`]       = 1;
      vars[`Furnace_${n}_MOLE_WEIGHT_CONSTANT`]     = 1;
      vars[`Furnace_${n}_TEMPERATURE_CONTINUITY`]   = 1;
      vars[`Furnace_${n}_PRESSURE_CONTINUITY`]      = 1;
      vars[`Furnace_${n}_TLE_DESIGN_DATA_SELECTED`] = 0;
      vars[`Furnace_${n}_PTLE_EXISTS`]   = 1;
      vars[`Furnace_${n}_STLE_EXISTS`]   = 0;
      vars[`Furnace_${n}_TTLE_EXISTS`]   = 0;
      vars[`Furnace_${n}_PTLE_NAME`]     = 'PTLE';
      vars[`Furnace_${n}_STLE_NAME`]     = 'STLE';
      vars[`Furnace_${n}_TTLE_NAME`]     = 'TTLE';
      vars[`Furnace_${n}_PTLE_COLD_FLUID`]     = 'BFW_STEAM_DRUM';
      vars[`Furnace_${n}_STLE_COLD_FLUID`]     = 'EMPTY';
      vars[`Furnace_${n}_TTLE_COLD_FLUID`]     = 'EMPTY';
      vars[`Furnace_${n}_PTLE_ORIENTATION`]    = 'N/A';
      vars[`Furnace_${n}_STLE_ORIENTATION`]    = 'EMPTY';
      vars[`Furnace_${n}_TTLE_ORIENTATION`]    = 'EMPTY';
      vars[`Furnace_${n}_TLE_PRESSURE_TAG_AT`] = 'DOWNSTREAM';
      for (const sec of TLE_SECTIONS_ORDER) {
        for (const p of TLE_PARAMS) {
          vars[`Furnace_${n}_${sec}_${p}`]     = 0;
          vars[`Furnace_${n}_${sec}_${p}_UOM`] = 'EMPTY';
        }
      }
    }
  }
  return vars;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function serializeFmsState(fms: FmsState, fuel: FuelState): { fmsRows: ExportRow[]; treeRows: TreeRow[] } {
  const fmsRows: ExportRow[] = [];

  const pid = fms.pidVars || {};

  // ── 0. Furnace Info ──────────────────────────────────────────────────────────
  fmsRows.push(rawRow('Furnace_Count', fms.furnaceCount, 'Furnace Info'));
  fmsRows.push(rawRow('Home_Same_For_All', fms.homeSameForAll ? 1 : 0, 'Furnace Info'));
  fms.furnaceInfo.forEach((info, fi) => {
    const n = fi + 1;
    const copyVal = info.copyFrom === null ? 'Original' : `Furnace ${info.copyFrom + 1}`;
    fmsRows.push(rawRow(`Furnace_${n}_Name`,          furnaceDisplayName(info.name, n), 'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Licensor`,       info.licensor || '—',          'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Coil_Type`,      info.coilType || '—',          'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Cells`,          info.cells || '—',             'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Pass_Per_Cell`,  info.passPerCell || '—',       'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Tubes_Per_Pass`, info.tubesPerPass || '—',      'Furnace Info'));
    // Standard var Furnace_Design_Runlength (via getStandardVar) — required by the
    // Coilsim processor (AVG_CRACKING_RUNLENGTH) in Build_Instance_Configs.
    fmsRows.push(rawRow(`Furnace_${n}_Design_Runlength`, info.designRunlength || '—', 'Furnace Info'));
    fmsRows.push(rawRow(`Furnace_${n}_Copy_From`,      copyVal,                        'Furnace Info'));
  });

  // ── 1. P&ID ──────────────────────────────────────────────────────────────────
  fmsRows.push(rawRow('Furnace_System_Area_Incoming_Header_Count', 4, 'P&ID'));
  fmsRows.push(rawRow('Furnace_System_Area_Outgoing_Header_Count', 6, 'P&ID'));
  const PID_KEYS = Object.keys(fms.pidVars);
  PID_KEYS.forEach(k => {
    const v = pid[k];
    fmsRows.push(row(k, v === 1 ? 1 : v === 0 ? 0 : '—', 'P&ID'));
  });

  // ── 2. Saturator ─────────────────────────────────────────────────────────────
  const SAT_KEYS = ['sat_dsg','sat_exists','sat_eth','sat_pro','sat_but','sat_gen_fr','sat_gen_tf','sat_nap'];
  const sat = fms.satVars || {};
  SAT_KEYS.forEach(k => {
    const v = sat[k];
    fmsRows.push(row(k, v === 1 ? 1 : v === 0 ? 0 : '—', 'Saturator'));
  });

  // ── 3. Feed Allocation ───────────────────────────────────────────────────────
  const nF = fms.furnaceCount;
  const nH = fms.activeFeeds.length;
  for (let fi = 0; fi < nF; fi++) {
    let prim = 0, sec = 0;
    for (let hi = 0; hi < nH; hi++) {
      const s = fms.allocTable[fi]?.[hi] ?? 0;
      fmsRows.push(rawRow(`Feed${hi+1}_To_Furnace_${fi+1}`, s > 0 ? 1 : 0, 'Feed Allocation'));
      if (s === 2) prim = hi + 1;
      if (s === 3) sec  = hi + 1;
    }
    fmsRows.push(rawRow(`Primary_Feed_To_Furnace_${fi+1}`,   prim, 'Feed Allocation'));
    fmsRows.push(rawRow(`Secondary_Feed_To_Furnace_${fi+1}`, sec,  'Feed Allocation'));
  }

  // ── 4. Feed Components ───────────────────────────────────────────────────────
  FIXED_COMPONENTS.forEach((name, i) => {
    fmsRows.push(row(`Feed_Component_${i+1}`, name, 'Feed Components'));
  });
  fms.compComponents.forEach((name, i) => {
    fmsRows.push(row(`Feed_Component_${FIXED_OFFSET + i + 1}`, name || '—', 'Feed Components'));
  });
  fmsRows.push(rawRow('Feed_Component_Fixed_Count', FIXED_COMPONENTS.length, 'Feed Components'));
  fmsRows.push(rawRow('Feed_Component_Total_Count', FIXED_COMPONENTS.length + fms.compComponents.length, 'Feed Components'));

  // ── 4b. Fuel Components ──────────────────────────────────────────────────────
  fuel.fuelComponents.forEach((name, i) => {
    fmsRows.push(rawRow(`Fuel_Component_${i+1}`, name || '—', 'Fuel Components'));
  });
  fmsRows.push(rawRow('Fuel_Component_Count',  fuel.fuelCount || 0,      'Fuel Components'));
  fmsRows.push(rawRow('Fuel_Header_Count',      fuel.fuelHeaderCount || 1, 'Fuel Components'));

  // ── 5. UOM ───────────────────────────────────────────────────────────────────
  const uomPairs: [string, string][] = [
    ['massFlow',       fms.uom.massFlow],
    ['temperature',    fms.uom.temperature],
    ['temperatureDrop',fms.uom.temperatureDrop],
    ['pressure',       fms.uom.pressure],
    ['pressureDrop',   fms.uom.pressureDrop],
    ['work',           fms.uom.work],
    ['specificEnergy', fms.uom.specificEnergy],
    ['composition',    fms.uom.composition],
    ['moleWeight',     fms.uom.moleWeight],
    ['humidity',       fms.uom.humidity],
    ['pH',             fms.uom.pH],
  ];
  uomPairs.forEach(([k, v]) => fmsRows.push(row(k, v, 'UOM')));
  // NOTE: 'confirmed' (uomConfirmed) intentionally NOT exported — it's a UI completion flag,
  // not an engineering variable. (Diverges from V418, which emitted it; product decision.)

  // ── 6. FFI (per furnace) ─────────────────────────────────────────────────────
  const areaFeedDefs = FFI_AREA_FEED_DEFS.map(d => ({
    ...d, areaActive: pid[d.existsKey] === 1,
  }));

  function ffiGetTpl(fi: number): FfiTemplate | null {
    const id = fms.ffiApplyMap[fi];
    if (!id) return null;
    return fms.ffiTemplates.find(t => t.id === id) ?? null;
  }

  function ffiHmfGetPassCount(fi: number): number {
    const radF = getHwTpl<RadFields>(fms.hwRad, fi);
    if (radF) return rzTotalPasses(radF);
    // V418 parity — no radiation template: fall back to furnace cells × passes/cell (default 4)
    const info = fms.furnaceInfo[fi];
    const nc  = parseInt(info?.cells || '') || 1;
    const ppc = parseInt(info?.passPerCell || '') || 4;
    return nc * ppc;
  }

  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    const tpl = ffiGetTpl(fi);
    const opt = tpl ? tpl.options : {} as Record<string, boolean | number>;
    const sec = `FFI › F${fi + 1}`;

    // Options
    fmsRows.push(row(`F${fi+1}.dilSteam`,                opt.dilSteam                ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.archO2Exists`,             opt.archO2Exists            ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.archO2PerCell`,            opt.archO2PerCell           ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.archO2WetBasis`,           opt.archO2WetBasis          ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.stackO2Exists`,            opt.stackO2Exists           ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.stackO2WetBasis`,          opt.stackO2WetBasis         ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.airIngression`,            Number(opt.airIngression) || 0,       sec));
    fmsRows.push(row(`F${fi+1}.localAmbientTemp`,         opt.localAmbientTemp        ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.localHumidity`,            opt.localHumidity           ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.dsBeforeVaporFlowmeter`,   opt.dsBeforeVaporFlowmeter  ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.dsBeforeLiquidFlowmeter`,  opt.dsBeforeLiquidFlowmeter ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.stackNoxAvailable`,            opt.stackNoxAvailable            ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.stackSoxAvailable`,            opt.stackSoxAvailable            ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.passwiseDecokeAirAvailable`,   opt.passwiseDecokeAirAvailable   !== false ? 1 : 0, sec));
    fmsRows.push(row(`F${fi+1}.passwiseDecokeSteamAvailable`, opt.passwiseDecokeSteamAvailable !== false ? 1 : 0, sec));

    // Area feeds (conditional). If only one area feed exists in the P&ID, the furnace must take it
    // → it is auto-active (mirrors the locked YES shown in the routing table).
    const areaActiveDefs = areaFeedDefs.filter(fd => fd.areaActive);
    const soleAreaKey = areaActiveDefs.length === 1 ? areaActiveDefs[0].key : null;
    areaFeedDefs.forEach(fd => {
      const feedActive = fd.key === soleAreaKey ? true : !!(opt[`feed_active_${fd.key}`]);
      const d = tpl ? (tpl.data[fd.key] || { fph1: false, fph2: false, htc: false, stle: false, ttle: false }) : { fph1: false, fph2: false, htc: false, stle: false, ttle: false };
      fmsRows.push(row(`F${fi+1}.${fd.key}.active`, feedActive ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.${fd.key}.fph1`,   feedActive && d.fph1 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.${fd.key}.fph2`,   feedActive && d.fph2 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.${fd.key}.stle`,   feedActive && d.stle ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.${fd.key}.ttle`,   feedActive && d.ttle ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.${fd.key}.htc`,    feedActive ? 1 : 0, sec));
    });

    // Unconditional feeds — V418 ffiMaterializeInferred parity:
    //  • decoke steam / air: always pass through HTC (htc forced 1)
    //  • dilution steam: routing only counts when the DS header (dilSteam) is enabled
    FFI_UNCONDITIONAL.forEach(fk => {
      const d = tpl ? (tpl.data[fk] || { fph1: false, fph2: false, htc: false, stle: false, ttle: false }) : { fph1: false, fph2: false, htc: false, stle: false, ttle: false };
      if (fk === 'dilution_steam') {
        const dsOn = !!opt.dilSteam;
        fmsRows.push(row(`F${fi+1}.${fk}.fph1`, dsOn && d.fph1 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.fph2`, dsOn && d.fph2 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.stle`, dsOn && d.stle ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.ttle`, dsOn && d.ttle ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.htc`,  dsOn ? 1 : 0, sec));
      } else {
        fmsRows.push(row(`F${fi+1}.${fk}.fph1`, d.fph1 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.fph2`, d.fph2 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.stle`, d.stle ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.ttle`, d.ttle ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.${fk}.htc`,  1, sec));
      }
    });

    // LMF / HMF availability gates — must mirror the FFI editor's lock logic so a stale
    // localMixed/hybrid flag never exports active=1 while the UI shows the toggle locked.
    //   multi-feed P&ID + ≥1 active solo feed + Feed Selector Switch operation = YES
    const ffiAreaActiveCount = areaFeedDefs.filter(fd => fd.areaActive).length;
    const ffiHasSolo  = areaFeedDefs.some(fd => fd.areaActive && !!(opt[`feed_active_${fd.key}`]));
    const ffiMulti    = ffiAreaActiveCount > 1;

    // LMF
    const lmfActive = !!(opt.localMixed) && ffiMulti && ffiHasSolo && fms.mixedFeedOp === 1;
    fmsRows.push(row(`F${fi+1}.lmf.active`, lmfActive ? 1 : 0, sec));
    if (lmfActive) {
      const lmf = tpl?.lmfData ?? { selectedFeeds: [], rows: {} };
      const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
      let lmfSel = lmf.selectedFeeds || [];
      if (lmfSel.length === 0 && aFeedsActive.length === 2) lmfSel = aFeedsActive.map(fd => fd.key);
      fmsRows.push(row(`F${fi+1}.lmf.feed_a`, lmfSel[0] ? (FFI_FEED_IDX[lmfSel[0]] ?? lmfSel[0]) : '—', sec));
      fmsRows.push(row(`F${fi+1}.lmf.feed_b`, lmfSel[1] ? (FFI_FEED_IDX[lmfSel[1]] ?? lmfSel[1]) : '—', sec));
      // Solo feeds inherit their path live from the solo (main routing) table — mirrors the locked UI.
      const lmfSoloKeys = aFeedsActive.filter(fd => !!(opt[`feed_active_${fd.key}`])).map(fd => fd.key);
      lmfSel.forEach(fk => {
        const r = lmfSoloKeys.includes(fk)
          ? (tpl?.data[fk] || { fph1: false, fph2: false, htc: false })
          : ((lmf.rows && lmf.rows[fk]) || { fph1: false, fph2: false, htc: false });
        fmsRows.push(row(`F${fi+1}.lmf.${fk}.fph1`, r.fph1 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.lmf.${fk}.fph2`, r.fph2 ? 1 : 0, sec));
        fmsRows.push(row(`F${fi+1}.lmf.${fk}.htc`,  1, sec));
      });
      const dsLmf = (lmf.rows && lmf.rows['_ds']) || { fph1: false, fph2: false };
      fmsRows.push(row(`F${fi+1}.lmf.ds.fph1`, dsLmf.fph1 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.lmf.ds.fph2`, dsLmf.fph2 ? 1 : 0, sec));
    }

    // Dry junction (always)
    {
      let df1 = 0, df2 = 0, dhtc = 0;
      if (lmfActive) {
        const lmf = tpl?.lmfData ?? { selectedFeeds: [], rows: {} };
        const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
        const soloKeys = aFeedsActive.filter(fd => !!(opt[`feed_active_${fd.key}`])).map(fd => fd.key);
        let sel = lmf.selectedFeeds || [];
        if (sel.length === 0 && aFeedsActive.length === 2) sel = aFeedsActive.map(fd => fd.key);
        if (sel.length === 2) {
          const rows2 = { ...lmf.rows };
          sel.forEach(fk => {
            if (soloKeys.includes(fk)) {
              const soloD = tpl?.data[fk] || { fph1: false, fph2: false };
              if (!rows2[fk]) rows2[fk] = { fph1: false, fph2: false, htc: false };
              rows2[fk].fph1 = soloD.fph1; rows2[fk].fph2 = soloD.fph2;
            }
          });
          const r0 = rows2[sel[0]] || { fph1: false, fph2: false };
          const r1 = rows2[sel[1]] || { fph1: false, fph2: false };
          if (r0.fph1 && r1.fph1)      df1 = 1;
          else if (r0.fph2 && r1.fph2) df2 = 1;
          else                         dhtc = 1;
        }
      }
      fmsRows.push(row(`F${fi+1}.lmf.dry_junc_fph1`, df1,  sec));
      fmsRows.push(row(`F${fi+1}.lmf.dry_junc_fph2`, df2,  sec));
      fmsRows.push(row(`F${fi+1}.lmf.dry_junc_htc`,  dhtc, sec));
    }

    // Wet junction (always)
    {
      let wf1 = 0, wf2 = 0, whtc = 0;
      if (lmfActive && opt.dilSteam) {
        const lmf = tpl?.lmfData ?? { rows: {} as Record<string, { fph1: boolean; fph2: boolean }> };
        const dsRw = (lmf.rows && (lmf.rows as Record<string, { fph1: boolean; fph2: boolean }>)['_ds']) || { fph1: false, fph2: false };
        if (dsRw.fph1)      wf1 = 1;
        else if (dsRw.fph2) wf2 = 1;
        else                whtc = 1;
      }
      fmsRows.push(row(`F${fi+1}.lmf.wet_junc_fph1`, wf1,  sec));
      fmsRows.push(row(`F${fi+1}.lmf.wet_junc_fph2`, wf2,  sec));
      fmsRows.push(row(`F${fi+1}.lmf.wet_junc_htc`,  whtc, sec));
    }

    // Primary/secondary feed code (always)
    {
      let primCode = 0, secCode = 0;
      if (lmfActive) {
        const lmf = tpl?.lmfData ?? { selectedFeeds: [] };
        const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
        const soloKeys = aFeedsActive.filter(fd => !!(opt[`feed_active_${fd.key}`])).map(fd => fd.key);
        let sel = lmf.selectedFeeds || [];
        if (sel.length === 0 && aFeedsActive.length === 2) sel = aFeedsActive.map(fd => fd.key);
        if (sel.length === 2) {
          const fkA = sel[0], fkB = sel[1];
          const soloA = soloKeys.includes(fkA), soloB = soloKeys.includes(fkB);
          const convScore = (fk: string) => { const d = tpl?.data[fk] || { fph1: false, fph2: false }; return d.fph1 ? 1 : d.fph2 ? 2 : 3; };
          let pk: string, sk: string;
          if (soloA && !soloB) { pk = fkA; sk = fkB; }
          else if (!soloA && soloB) { pk = fkB; sk = fkA; }
          else {
            const sA = convScore(fkA), sB = convScore(fkB);
            if (sA < sB) { pk = fkA; sk = fkB; }
            else if (sB < sA) { pk = fkB; sk = fkA; }
            else { pk = (FFI_FEED_IDX[fkA] ?? 99) <= (FFI_FEED_IDX[fkB] ?? 99) ? fkA : fkB; sk = pk === fkA ? fkB : fkA; }
          }
          primCode = FFI_FEED_IDX[pk] ?? 0;
          secCode  = FFI_FEED_IDX[sk] ?? 0;
        }
      }
      fmsRows.push(row(`F${fi+1}.lmf.primary_feed`,  primCode, sec));
      fmsRows.push(row(`F${fi+1}.lmf.secondary_feed`, secCode, sec));
    }

    // Operates solo / solo feed code
    {
      const activeSolo = areaFeedDefs.filter(fd => fd.areaActive && !!(opt[`feed_active_${fd.key}`]));
      const opSolo = activeSolo.length === 1 ? 1 : 0;
      const sfCode = opSolo ? (FFI_FEED_IDX[activeSolo[0].key] ?? 0) : 0;
      fmsRows.push(row(`F${fi+1}.operates_solo`,  opSolo, sec));
      fmsRows.push(row(`F${fi+1}.solo_feed_code`, sfCode, sec));
    }

    // Is secondary feed solo op
    {
      let isSecSolo = 0;
      if (lmfActive) {
        const lmf = tpl?.lmfData ?? { selectedFeeds: [] };
        const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
        const soloKeys = aFeedsActive.filter(fd => !!(opt[`feed_active_${fd.key}`])).map(fd => fd.key);
        let sel = lmf.selectedFeeds || [];
        if (sel.length === 0 && aFeedsActive.length === 2) sel = aFeedsActive.map(fd => fd.key);
        if (sel.length === 2) {
          const fkA = sel[0], fkB = sel[1];
          const soloA = soloKeys.includes(fkA), soloB = soloKeys.includes(fkB);
          const convScore = (fk: string) => { const d = tpl?.data[fk] || { fph1: false, fph2: false }; return d.fph1 ? 1 : d.fph2 ? 2 : 3; };
          let sk: string;
          if (soloA && !soloB) sk = fkB;
          else if (!soloA && soloB) sk = fkA;
          else {
            const sA = convScore(fkA), sB = convScore(fkB);
            if (sA < sB) sk = fkB;
            else if (sB < sA) sk = fkA;
            else sk = (FFI_FEED_IDX[fkA] ?? 99) <= (FFI_FEED_IDX[fkB] ?? 99) ? fkB : fkA;
          }
          isSecSolo = soloKeys.includes(sk) ? 1 : 0;
        }
      }
      fmsRows.push(row(`F${fi+1}.is_secondary_feed_solo_op`, isSecSolo, sec));
    }

    // HMF / Cocracking
    const hmfActive = !!(opt.hybrid) && ffiMulti && ffiHasSolo && fms.dualFeedOp === 1;
    fmsRows.push(row(`F${fi+1}.hmf.active`, hmfActive ? 1 : 0, sec));
    if (hmfActive) {
      const hmf = tpl?.hmfData ?? { selectedFeeds: [], passMap: {}, rows: {} };
      const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
      let hmfSel = hmf.selectedFeeds || [];
      if (hmfSel.length === 0 && aFeedsActive.length === 2) hmfSel = aFeedsActive.map(fd => fd.key);
      const hmfPm = hmf.passMap || {};
      fmsRows.push(row(`F${fi+1}.hmf.feed_a`, hmfSel[0] ? (FFI_FEED_IDX[hmfSel[0]] ?? hmfSel[0]) : '—', sec));
      fmsRows.push(row(`F${fi+1}.hmf.feed_b`, hmfSel[1] ? (FFI_FEED_IDX[hmfSel[1]] ?? hmfSel[1]) : '—', sec));
      const hmfTotal = ffiHmfGetPassCount(fi);
      const radF = getHwTpl<RadFields>(fms.hwRad, fi);
      const passMapH = radF?.passMap || [];
      const cellPassCtrH: Record<number, number> = {};
      for (let p = 0; p < hmfTotal; p++) {
        const assigned = hmfPm[p];
        const feedVal = assigned === 'A' ? (hmfSel[0] ? (FFI_FEED_IDX[hmfSel[0]] ?? hmfSel[0]) : 'A')
                      : assigned === 'B' ? (hmfSel[1] ? (FFI_FEED_IDX[hmfSel[1]] ?? hmfSel[1]) : 'B')
                      : '—';
        const pmEntry = passMapH[p] as { cell?: number } | null ?? {};
        const cellIdx = pmEntry?.cell ?? 0;
        cellPassCtrH[cellIdx] = (cellPassCtrH[cellIdx] || 0) + 1;
        fmsRows.push(row(`F${fi+1}.hmf.cell_${cellIdx+1}.pass_${cellPassCtrH[cellIdx]}.feed`, feedVal as string | number, sec));
      }
      const hRow = (hmf.rows && hmf.rows['_hybrid']) || { fph1: false, fph2: false, htc: false };
      fmsRows.push(row(`F${fi+1}.hmf.hybrid.fph1`, hRow.fph1 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.hmf.hybrid.fph2`, hRow.fph2 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.hmf.hybrid.htc`,  1, sec));
      const dsHmf = (hmf.rows && hmf.rows['_ds']) || { fph1: false, fph2: false };
      fmsRows.push(row(`F${fi+1}.hmf.ds.fph1`, dsHmf.fph1 ? 1 : 0, sec));
      fmsRows.push(row(`F${fi+1}.hmf.ds.fph2`, dsHmf.fph2 ? 1 : 0, sec));
    }

    // Hybrid feed code per pass (always)
    {
      const hmf = hmfActive ? (tpl?.hmfData ?? null) : null;
      const hmfSel = hmf?.selectedFeeds ?? [];
      const hmfPm  = hmf?.passMap ?? {};
      const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
      const hmfSelFinal = hmfSel.length === 0 && aFeedsActive.length === 2
        ? aFeedsActive.map(fd => fd.key) : hmfSel;
      const hmfTotal = ffiHmfGetPassCount(fi);
      const radF = getHwTpl<RadFields>(fms.hwRad, fi);
      const passMapCP = radF?.passMap || [];
      const cellPassCtrCP: Record<number, number> = {};
      for (let p = 0; p < hmfTotal; p++) {
        const pmEntry = passMapCP[p] as { cell?: number } | null ?? {};
        const cellIdx = pmEntry?.cell ?? 0;
        cellPassCtrCP[cellIdx] = (cellPassCtrCP[cellIdx] || 0) + 1;
        const assigned = hmfPm[p];
        let feedCode = 0;
        if (hmfActive && assigned === 'A') feedCode = hmfSelFinal[0] ? (FFI_FEED_IDX[hmfSelFinal[0]] ?? 0) : 0;
        else if (hmfActive && assigned === 'B') feedCode = hmfSelFinal[1] ? (FFI_FEED_IDX[hmfSelFinal[1]] ?? 0) : 0;
        fmsRows.push(row(`F${fi+1}.hmf.cell_${cellIdx+1}.pass_${cellPassCtrCP[cellIdx]}.hybrid_feed_code`, feedCode, sec));
      }
    }

    // ── V418: Primary/Secondary/Mix/Hybrid Feed Flows_Through (derived; always emitted) ──
    // Re-expresses LMF/HMF routing answers as the path each logical feed role takes
    // (FPH1, FPH2, or straight to HTC). Output-only — no import counterpart.
    {
      let primFph1 = 0, primFph2 = 0, primHtc = 0;
      let secFph1 = 0,  secFph2 = 0,  secHtc = 0;
      let mixFph1 = 0,  mixFph2 = 0,  mixHtc = 0;
      let hybFph1 = 0,  hybFph2 = 0,  hybHtc = 0;

      if (lmfActive) {
        const lmf = tpl?.lmfData ?? { selectedFeeds: [], rows: {} };
        const aFeedsActive = areaFeedDefs.filter(fd => fd.areaActive);
        const soloKeys = aFeedsActive.filter(fd => !!(opt[`feed_active_${fd.key}`])).map(fd => fd.key);
        let sel = lmf.selectedFeeds || [];
        if (sel.length === 0 && aFeedsActive.length === 2) sel = aFeedsActive.map(fd => fd.key);
        if (sel.length === 2) {
          const fkA = sel[0], fkB = sel[1];
          const soloA = soloKeys.includes(fkA), soloB = soloKeys.includes(fkB);
          const convScore = (fk: string) => { const d = tpl?.data[fk] || { fph1: false, fph2: false }; return d.fph1 ? 1 : d.fph2 ? 2 : 3; };
          let pk: string, sk: string;
          if (soloA && !soloB) { pk = fkA; sk = fkB; }
          else if (!soloA && soloB) { pk = fkB; sk = fkA; }
          else {
            const sA = convScore(fkA), sB = convScore(fkB);
            if (sA < sB) { pk = fkA; sk = fkB; }
            else if (sB < sA) { pk = fkB; sk = fkA; }
            else { pk = (FFI_FEED_IDX[fkA] ?? 99) <= (FFI_FEED_IDX[fkB] ?? 99) ? fkA : fkB; sk = pk === fkA ? fkB : fkA; }
          }
          const dPrim = (lmf.rows && lmf.rows[pk]) || { fph1: false, fph2: false };
          primFph1 = dPrim.fph1 ? 1 : 0; primFph2 = dPrim.fph2 ? 1 : 0; primHtc = 1; // primary always reaches HTC
          const dSec = (lmf.rows && lmf.rows[sk]) || { fph1: false, fph2: false };
          secFph1 = dSec.fph1 ? 1 : 0;  secFph2 = dSec.fph2 ? 1 : 0;  secHtc = 1;
        }
        // Mix feed = wet junction (dil steam present) else dry junction location
        if (opt.dilSteam) {
          const dsRow = (lmf.rows && lmf.rows['_ds']) || { fph1: false, fph2: false };
          if (dsRow.fph1)      mixFph1 = 1;
          else if (dsRow.fph2) mixFph2 = 1;
          else                 mixHtc = 1;
        } else if (sel.length === 2) {
          const r0 = (lmf.rows && lmf.rows[sel[0]]) || { fph1: false, fph2: false };
          const r1 = (lmf.rows && lmf.rows[sel[1]]) || { fph1: false, fph2: false };
          if (r0.fph1 && r1.fph1)      mixFph1 = 1;
          else if (r0.fph2 && r1.fph2) mixFph2 = 1;
          else                         mixHtc = 1;
        }
      }

      if (hmfActive) {
        const hmf = tpl?.hmfData ?? { selectedFeeds: [], passMap: {}, rows: {} };
        const hRow = (hmf.rows && hmf.rows['_hybrid']) || { fph1: false, fph2: false };
        hybFph1 = hRow.fph1 ? 1 : 0; hybFph2 = hRow.fph2 ? 1 : 0; hybHtc = 1; // hybrid always reaches HTC
      }

      fmsRows.push(row(`F${fi+1}.primary_feed.fph1`,   primFph1, sec));
      fmsRows.push(row(`F${fi+1}.primary_feed.fph2`,   primFph2, sec));
      fmsRows.push(row(`F${fi+1}.primary_feed.htc`,    primHtc,  sec));
      fmsRows.push(row(`F${fi+1}.secondary_feed.fph1`, secFph1,  sec));
      fmsRows.push(row(`F${fi+1}.secondary_feed.fph2`, secFph2,  sec));
      fmsRows.push(row(`F${fi+1}.secondary_feed.htc`,  secHtc,   sec));
      fmsRows.push(row(`F${fi+1}.mix_feed.fph1`,       mixFph1,  sec));
      fmsRows.push(row(`F${fi+1}.mix_feed.fph2`,       mixFph2,  sec));
      fmsRows.push(row(`F${fi+1}.mix_feed.htc`,        mixHtc,   sec));
      fmsRows.push(row(`F${fi+1}.hybrid_feed.fph1`,    hybFph1,  sec));
      fmsRows.push(row(`F${fi+1}.hybrid_feed.fph2`,    hybFph2,  sec));
      fmsRows.push(row(`F${fi+1}.hybrid_feed.htc`,     hybHtc,   sec));
    }
  }

  // ── 6b. Feed Selector Switch ─────────────────────────────────────────────────
  const selSec = 'Feed Selector Switch';
  SEL_FEED_DEFS.forEach(d => {
    const isActive = pid[d.existsKey] === 1;
    const chars = isActive ? (fms.selectorChars[d.key as keyof typeof fms.selectorChars] || []) : [];
    if (chars.length > 0) {
      fmsRows.push(rawRow(`Feed_${d.idx}_Selector_Character_Count`, chars.length, selSec));
      chars.forEach((v, i) => fmsRows.push(rawRow(`Feed_${d.idx}_Selector_Value_${i+1}_Character`, v, selSec)));
    } else {
      fmsRows.push(rawRow(`Feed_${d.idx}_Selector_Character_Count`, 1, selSec));
      fmsRows.push(rawRow(`Feed_${d.idx}_Selector_Value_1_Character`, 99.99, selSec));
    }
  });
  const mixChars = fms.mixedFeedOp === 1 ? (fms.mixedChars || []) : [];
  fmsRows.push(rawRow('Mixed_Feed_Operation_Active', fms.mixedFeedOp === 1 ? 1 : 0, selSec));
  if (mixChars.length > 0) {
    fmsRows.push(rawRow('Feed_Mix_Selector_Character_Count', mixChars.length, selSec));
    mixChars.forEach((v, i) => fmsRows.push(rawRow(`Feed_Mix_Selector_Value_${i+1}_Character`, v, selSec)));
  } else {
    fmsRows.push(rawRow('Feed_Mix_Selector_Character_Count', 1, selSec));
    fmsRows.push(rawRow('Feed_Mix_Selector_Value_1_Character', 99, selSec));
  }
  const dualChars = fms.dualFeedOp === 1 ? (fms.dualChars || []) : [];
  fmsRows.push(rawRow('Dual_Feed_Operation_Active', fms.dualFeedOp === 1 ? 1 : 0, selSec));
  if (dualChars.length > 0) {
    fmsRows.push(rawRow('Feed_Dual_Selector_Character_Count', dualChars.length, selSec));
    dualChars.forEach((v, i) => fmsRows.push(rawRow(`Feed_Dual_Selector_Value_${i+1}_Character`, v, selSec)));
  } else {
    fmsRows.push(rawRow('Feed_Dual_Selector_Character_Count', 1, selSec));
    fmsRows.push(rawRow('Feed_Dual_Selector_Value_1_Character', 99, selSec));
  }

  // ── 7. Hardware ──────────────────────────────────────────────────────────────

  // Convection
  const cbVars = cbComputeVars(fms);
  Object.entries(cbVars).forEach(([k, v]) => {
    const renamed = varRename(k);
    fmsRows.push({ variable: renamed, value: v, section: 'Hardware › Convection', standardVar: getStandardVar(renamed) });
  });

  // Radiation
  const rzVars = rzComputeVars(fms);
  Object.entries(rzVars).forEach(([k, v]) => {
    fmsRows.push({ variable: k, value: v, section: 'Hardware › Radiation', standardVar: getStandardVar(k) });
  });

  // TLE
  const tleVars = tleComputeVars(fms);
  Object.entries(tleVars).forEach(([k, v]) => {
    const renamed = varRename(k);
    fmsRows.push({ variable: renamed, value: v, section: 'Hardware › TLE', standardVar: getStandardVar(renamed) });
  });

  // ─── Entity_Tree sheet ───────────────────────────────────────────────────────
  const treeRows: TreeRow[] = [];
  function treeNode(nodeId: string, nodeType: string, index: string | null, parentId: string | null, label: string) {
    treeRows.push({ nodeId, nodeType, index: index ?? '—', parentId: parentId ?? '—', label });
  }

  treeNode('SYS', 'System', null, null, 'System');

  const totalFeedComps = FIXED_COMPONENTS.length + fms.compComponents.length;
  for (let i = 0; i < totalFeedComps; i++) {
    const name = i < FIXED_COMPONENTS.length
      ? FIXED_COMPONENTS[i]
      : (fms.compComponents[i - FIXED_COMPONENTS.length] || `Feed Component ${i + 1}`);
    treeNode(`SYS_FC_${i+1}`, 'Feed_Component', String(i + 1), 'SYS', name);
  }

  const totalFuelComps = fuel.fuelCount || 0;
  for (let i = 0; i < totalFuelComps; i++) {
    treeNode(`SYS_FL_${i+1}`, 'Fuel_Component', String(i + 1), 'SYS', fuel.fuelComponents[i] || `Fuel Component ${i + 1}`);
  }

  for (let i = 1; i <= 4; i++) treeNode(`SYS_IH_${i}`, 'Incoming_Header', String(i), 'SYS', `Incoming Header ${i}`);
  for (let i = 1; i <= 6; i++) treeNode(`SYS_OH_${i}`, 'Outgoing_Header', String(i), 'SYS', `Outgoing Header ${i}`);

  for (let fi = 0; fi < fms.furnaceCount; fi++) {
    const fn = fi + 1;
    const fNodeId = `F${fn}`;
    const fname = furnaceDisplayName(fms.furnaceInfo[fi]?.name, fn);
    treeNode(fNodeId, 'Furnace', String(fn), 'SYS', fname);

    // Convection banks
    const bankCount = parseInt(String(cbVars[`Furnace_${fn}_Convection_Bank_Count`])) || 0;
    for (let m = 1; m <= bankCount; m++) {
      const bankName = String(cbVars[`Furnace_${fn}_Convection_Bank_${m}_Name`] || `Bank ${m}`);
      treeNode(`${fNodeId}_CB${m}`, 'Convection_Bank', String(m), fNodeId, bankName);
    }

    // TLE
    const tleExists = [
      tleVars[`Furnace_${fn}_PTLE_EXISTS`],
      tleVars[`Furnace_${fn}_STLE_EXISTS`],
      tleVars[`Furnace_${fn}_TTLE_EXISTS`],
    ];
    const tleLabels = [
      String(tleVars[`Furnace_${fn}_PTLE_NAME`] || 'PTLE'),
      String(tleVars[`Furnace_${fn}_STLE_NAME`] || 'STLE'),
      String(tleVars[`Furnace_${fn}_TTLE_NAME`] || 'TTLE'),
    ];
    let tleIdx = 0;
    for (let t = 0; t < 3; t++) {
      if (tleExists[t]) { tleIdx++; treeNode(`${fNodeId}_TLE${tleIdx}`, 'TLE', String(tleIdx), fNodeId, tleLabels[t]); }
    }
    const stleEx = tleVars[`Furnace_${fn}_STLE_EXISTS`];
    const ttleEx = tleVars[`Furnace_${fn}_TTLE_EXISTS`];
    if (stleEx) treeNode(`${fNodeId}_TP1`, 'TLE_Piping', '1', fNodeId, 'PTLE → STLE Piping');
    if (stleEx && ttleEx) treeNode(`${fNodeId}_TP2`, 'TLE_Piping', '2', fNodeId, 'STLE → TTLE Piping');

    // Cells, passes, coil entries
    const cellCount = parseInt(String(rzVars[`Furnace_${fn}_Cell_Count`])) || 0;
    for (let ci = 0; ci < cellCount; ci++) {
      const cn = ci + 1;
      const cNodeId = `${fNodeId}_C${cn}`;
      const cName = String(rzVars[`Furnace_${fn}_Cell_${cn}_Name`] || `Cell ${cn}`);
      treeNode(cNodeId, 'Cell', String(cn), fNodeId, cName);

      const passCount = parseInt(String(rzVars[`Furnace_${fn}_Pass_Count`])) || 0;
      for (let p = 1; p <= passCount; p++) {
        if (!rzVars[`Furnace_${fn}_Cell_${cn}_Pass_${p}_Exists`]) continue;
        const passName = String(rzVars[`Furnace_${fn}_Cell_${cn}_Pass_${p}_Name`] || `Pass ${p}`);
        treeNode(`${cNodeId}_P${p}`, 'Pass', String(p), cNodeId, passName);

        const recCount  = parseInt(String(rzVars[`Furnace_${fn}_Cell_${cn}_Tubes_Per_Pass_Count`])) || 0;
        const rxecCount = parseInt(String(rzVars[`Furnace_${fn}_Cell_${cn}_Cell_Exit_Tubes_Per_Pass`])) || 0;
        const aecCount  = parseInt(String(rzVars[`Furnace_${fn}_Cell_${cn}_Adia_Exit_Tubes_Per_Pass`])) || 0;
        for (let ti = 1; ti <= recCount;  ti++) treeNode(`${cNodeId}_P${p}_REC${ti}`,  'Radiation_Entry_Coil', String(ti), `${cNodeId}_P${p}`, `Rad Entry Coil ${ti}`);
        for (let ti = 1; ti <= rxecCount; ti++) treeNode(`${cNodeId}_P${p}_RXEC${ti}`, 'Radiation_Exit_Coil',  String(ti), `${cNodeId}_P${p}`, `Rad Exit Coil ${ti}`);
        for (let ti = 1; ti <= aecCount;  ti++) treeNode(`${cNodeId}_P${p}_AEC${ti}`,  'Adiabatic_Exit_Coil',  String(ti), `${cNodeId}_P${p}`, `Adia Exit Coil ${ti}`);
      }
    }
  }

  // ── V418 — Feed Selector Switch nodes ──
  // Node ID: SYS_SEL{instance}_{suffix}. Feeds 1–6 parent to their Outgoing Header
  // (SYS_OH_{idx}); Mix and Hybrid parent to SYS. ALL nodes always emitted (active or not),
  // mirroring the selector dummy-variable logic; ≥1 instance per feed (dummy when no chars).
  {
    SEL_FEED_DEFS.forEach(d => {
      const chars = fms.selectorChars[d.key as keyof typeof fms.selectorChars] || [];
      const instances: (string | null)[] = chars.length > 0 ? chars : [null];
      instances.forEach((val, ci) => {
        const label = val !== null ? String(val) : `${d.label} Feed Selector`;
        treeNode(`SYS_SEL${ci + 1}_FEED${d.idx}`, 'Feed_Selector', String(ci + 1), `SYS_OH_${d.idx}`, label);
      });
    });
    const mixChars = fms.mixedChars || [];
    (mixChars.length > 0 ? mixChars : [null]).forEach((val, ci) => {
      treeNode(`SYS_SEL${ci + 1}_MIX`, 'Mix_Feed_Selector', String(ci + 1), 'SYS', val !== null ? String(val) : 'Mix Feed Selector');
    });
    const dualChars = fms.dualChars || [];
    (dualChars.length > 0 ? dualChars : [null]).forEach((val, ci) => {
      treeNode(`SYS_SEL${ci + 1}_HYB`, 'Hybrid_Feed_Selector', String(ci + 1), 'SYS', val !== null ? String(val) : 'Hybrid Feed Selector');
    });
  }

  return { fmsRows, treeRows };
}
