import {
  FmsState,
  defaultFmsState, defaultFurnaceInfo,
  convEmptyFields, tleEmptyFields, radEmptyFields, radEmptyCell,
  ffiDefaultOptions,
  PidVars, FfiTemplate, FfiOptions, FfiFeedData, FfiLmfData, FfiHmfData,
  ConvFields, TleFields, RadFields,
  HwSection,
} from '../store/FmsAtoms';
import { FuelState, defaultFuelState } from '../store/FuelAtoms';
import { FIXED_COMPONENTS, FIXED_OFFSET } from './Components';
import { reapplyFixedDefaults, inferPidVars } from './PidLogic';

type RowMap = Map<string, string | number | null>;

function g(map: RowMap, key: string): string | null {
  const v = map.get(key);
  return (v !== undefined && v !== null) ? String(v) : null;
}
function gStr(map: RowMap, key: string): string {
  const v = g(map, key);
  return (v !== null && v !== '—' && v !== 'EMPTY') ? v : '';
}
function gNum(map: RowMap, key: string): number | null {
  const v = g(map, key);
  if (v === null || v === '—') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function gBool(map: RowMap, key: string): 0 | 1 | null {
  const v = g(map, key);
  return v === '1' ? 1 : v === '0' ? 0 : null;
}

const FFI_FEED_IDX: Record<string, number> = { eth: 1, pro: 2, but: 3, nap: 4, gen_fr: 5, gen_tf: 6 };
const FFI_FEED_IDX_REV: Record<number, string> = Object.fromEntries(
  Object.entries(FFI_FEED_IDX).map(([k, v]) => [v, k])
);
const FEED_KEYS = ['eth', 'pro', 'but', 'nap', 'gen_fr', 'gen_tf'];

const TLE_PARAMS = ['INLET_TEMPERATURE','OUTLET_TEMPERATURE','MASS_FLOW','MOLE_WEIGHT','INLET_PRESSURE','OUTLET_PRESSURE'];
const SEC_EXPORT: Record<string, string> = {
  PTLE: 'TLE_1', STLE: 'TLE_2', TTLE: 'TLE_3',
  PTLE_STLE_PIPING: 'TLE_Piping_1', STLE_TTLE_PIPING: 'TLE_Piping_2',
};

function groupByContent<F>(items: F[]): { fields: F; furnaces: number[] }[] {
  const groups: { fields: F; furnaces: number[] }[] = [];
  items.forEach((f, fi) => {
    const sig = JSON.stringify(f);
    const existing = groups.find(g => JSON.stringify(g.fields) === sig);
    if (existing) existing.furnaces.push(fi);
    else groups.push({ fields: f, furnaces: [fi] });
  });
  return groups;
}

function buildHwSection<F>(
  groups: { fields: F; furnaces: number[] }[],
  idPrefix: string,
  savedFn: (f: F) => boolean,
): HwSection<F> {
  const sec: HwSection<F> = {
    sameForAll: groups.length === 1 ? 1 : 0,
    templates: [],
    selectedIdx: 0,
    applyMap: {},
    defineDone: false,
    applyDone: false,
  };
  groups.forEach((grp, ti) => {
    const tpl = { id: `${idPrefix}-T${ti + 1}`, name: `Template ${ti + 1}`, fields: grp.fields, saved: savedFn(grp.fields) };
    sec.templates.push(tpl);
    grp.furnaces.forEach(fi => { sec.applyMap[fi] = tpl.id; });
  });
  sec.defineDone = sec.templates.every(t => t.saved);
  sec.applyDone  = sec.defineDone; // all furnaces mapped by construction
  return sec;
}

export function importFromRows(
  rows: { Variable: string; Value: string | number }[]
): { fms: FmsState; fuel: FuelState } {
  const map: RowMap = new Map(rows.map(r => [r.Variable, r.Value ?? null]));

  const fms  = defaultFmsState();
  const fuel = defaultFuelState();

  /* ══════════════════════════════════════════════
     STEP 1 — Furnace Count & Info
  ══════════════════════════════════════════════ */
  const fc = gNum(map, 'Furnace_Count') ?? 0;
  if (fc < 1) return { fms, fuel };

  fms.furnaceCount    = fc;
  fms.homeSameForAll  = g(map, 'Home_Same_For_All') === '1';
  fms.furnaceInfo     = [];
  const notDash = (v: string | null) => (v && v !== '—') ? v : '';

  for (let i = 0; i < fc; i++) {
    const n    = i + 1;
    const info = defaultFurnaceInfo(i);
    // Export prefixes "Furnace " via furnaceName(); strip it on import to recover the raw name (mirrors V418)
    info.name         = ((gStr(map, `Furnace_${n}_Name`) || String(n)).replace(/^Furnace\s+/i, '').trim()) || String(n);
    info.licensor     = notDash(g(map, `Furnace_${n}_Licensor`));
    info.coilType     = notDash(g(map, `Furnace_${n}_Coil_Type`));
    info.cells        = notDash(g(map, `Furnace_${n}_Cells`));
    info.passPerCell  = notDash(g(map, `Furnace_${n}_Pass_Per_Cell`));
    info.tubesPerPass = notDash(g(map, `Furnace_${n}_Tubes_Per_Pass`));
    info.designRunlength = notDash(g(map, `Furnace_${n}_Design_Runlength`));
    info._ownValues   = {
      licensor:       info.licensor,
      coilType:       info.coilType,
      cells:          info.cells,
      passPerCell:    info.passPerCell,
      tubesPerPass:   info.tubesPerPass,
      designRunlength: info.designRunlength,
    };
    fms.furnaceInfo.push(info);
  }
  // Resolve Copy_From names → indices after all entries built
  for (let i = 0; i < fc; i++) {
    const n       = i + 1;
    const copyRaw = g(map, `Furnace_${n}_Copy_From`);
    if (copyRaw && copyRaw !== 'Original' && copyRaw !== '—' && copyRaw !== '') {
      const srcIdx = fms.furnaceInfo.findIndex((src, si) => si < i && src.name === copyRaw);
      if (srcIdx >= 0) {
        fms.furnaceInfo[i].copyFrom = srcIdx;
      } else {
        // fallback: parse "Furnace N" format
        const m = copyRaw.match(/Furnace (\d+)/i);
        if (m) fms.furnaceInfo[i].copyFrom = parseInt(m[1]) - 1;
      }
    }
  }
  fms.basicInfoDone = true;

  /* ══════════════════════════════════════════════
     STEP 2 — P&ID Variables
  ══════════════════════════════════════════════ */
  const PID_V411_MAP: Record<string, string> = {
    ff_eth:'Furnace_System_Fresh_Feed_1_Exists', ff_pro:'Furnace_System_Fresh_Feed_2_Exists',
    ff_but:'Furnace_System_Fresh_Feed_3_Exists', ff_nap:'Furnace_System_Fresh_Feed_4_Exists',
    rcy_eth:'Furnace_System_Recycle_Feed_1_Exists', rcy_pro:'Furnace_System_Recycle_Feed_2_Exists',
    rcy_but:'Furnace_System_Recycle_Feed_3_Exists', rcy_nap:'Furnace_System_Recycle_Feed_4_Exists',
    rcy_eth_to_eth:'Furnace_System_Recycle_Feed_1_To_Feed_1_Header_Exists',
    rcy_eth_to_pro:'Furnace_System_Recycle_Feed_1_To_Feed_2_Header_Exists',
    rcy_eth_to_but:'Furnace_System_Recycle_Feed_1_To_Feed_3_Header_Exists',
    rcy_eth_to_nap:'Furnace_System_Recycle_Feed_1_To_Feed_4_Header_Exists',
    rcy_pro_to_eth:'Furnace_System_Recycle_Feed_2_To_Feed_1_Header_Exists',
    rcy_pro_to_pro:'Furnace_System_Recycle_Feed_2_To_Feed_2_Header_Exists',
    rcy_pro_to_but:'Furnace_System_Recycle_Feed_2_To_Feed_3_Header_Exists',
    rcy_pro_to_nap:'Furnace_System_Recycle_Feed_2_To_Feed_4_Header_Exists',
    rcy_but_to_eth:'Furnace_System_Recycle_Feed_3_To_Feed_1_Header_Exists',
    rcy_but_to_pro:'Furnace_System_Recycle_Feed_3_To_Feed_2_Header_Exists',
    rcy_but_to_but:'Furnace_System_Recycle_Feed_3_To_Feed_3_Header_Exists',
    rcy_but_to_nap:'Furnace_System_Recycle_Feed_3_To_Feed_4_Header_Exists',
    eth_exists:'Furnace_System_Feed_1_Exists', pro_exists:'Furnace_System_Feed_2_Exists',
    but_exists:'Furnace_System_Feed_3_Exists', nap_exists:'Furnace_System_Feed_4_Exists',
    gen_fr_exists:'Furnace_System_Feed_5_Exists', gen_tf_exists:'Furnace_System_Feed_6_Exists',
    eth_spill_eth:'Furnace_System_Feed_1_To_Feed_1_Spillover_Exists',
    eth_spill_pro:'Furnace_System_Feed_1_To_Feed_2_Spillover_Exists',
    eth_spill_but:'Furnace_System_Feed_1_To_Feed_3_Spillover_Exists',
    eth_spill_nap:'Furnace_System_Feed_1_To_Feed_4_Spillover_Exists',
    pro_spill_eth:'Furnace_System_Feed_2_To_Feed_1_Spillover_Exists',
    pro_spill_pro:'Furnace_System_Feed_2_To_Feed_2_Spillover_Exists',
    pro_spill_but:'Furnace_System_Feed_2_To_Feed_3_Spillover_Exists',
    pro_spill_nap:'Furnace_System_Feed_2_To_Feed_4_Spillover_Exists',
    but_spill_eth:'Furnace_System_Feed_3_To_Feed_1_Spillover_Exists',
    but_spill_pro:'Furnace_System_Feed_3_To_Feed_2_Spillover_Exists',
    but_spill_but:'Furnace_System_Feed_3_To_Feed_3_Spillover_Exists',
    but_spill_nap:'Furnace_System_Feed_3_To_Feed_4_Spillover_Exists',
    nap_spill_eth:'Furnace_System_Feed_4_To_Feed_1_Spillover_Exists',
    nap_spill_pro:'Furnace_System_Feed_4_To_Feed_2_Spillover_Exists',
    nap_spill_but:'Furnace_System_Feed_4_To_Feed_3_Spillover_Exists',
    nap_spill_nap:'Furnace_System_Feed_4_To_Feed_4_Spillover_Exists',
    eth_to_gen_fr:'Furnace_System_Feed_1_To_Feed_5_Spillover_Exists',
    pro_to_gen_fr:'Furnace_System_Feed_2_To_Feed_5_Spillover_Exists',
    but_to_gen_fr:'Furnace_System_Feed_3_To_Feed_5_Spillover_Exists',
    nap_to_gen_fr:'Furnace_System_Feed_4_To_Feed_5_Spillover_Exists',
    eth_to_gen_tf:'Furnace_System_Feed_1_To_Feed_6_Spillover_Exists',
    pro_to_gen_tf:'Furnace_System_Feed_2_To_Feed_6_Spillover_Exists',
    but_to_gen_tf:'Furnace_System_Feed_3_To_Feed_6_Spillover_Exists',
    nap_to_gen_tf:'Furnace_System_Feed_4_To_Feed_6_Spillover_Exists',
  };
  const pidVars: PidVars = reapplyFixedDefaults({ ...fms.pidVars });
  Object.entries(PID_V411_MAP).forEach(([vKey, exportKey]) => {
    const v = gBool(map, exportKey);
    if (v !== null) pidVars[vKey] = v;
  });
  fms.pidVars = inferPidVars(pidVars);
  const pidAllAnswered = Object.values(fms.pidVars).every(v => v !== null);
  fms.pidDone      = pidAllAnswered;
  fms.pidConfirmed = pidAllAnswered;
  fms.pctPid       = pidAllAnswered ? 100 : 0;
  fms.visitedPid   = fms.pidDone;
  fms.visitedComp  = fms.pidDone;

  /* ══════════════════════════════════════════════
     STEP 3 — Saturator Variables
  ══════════════════════════════════════════════ */
  const SAT_V411_MAP: Record<string, string> = {
    sat_dsg:    'Furnace_System_Dilution_Steam_Generator_Exists',
    sat_exists: 'Furnace_System_Saturator_Exists',
    sat_eth:    'Furnace_System_Saturator_For_Feed_1_Exists',
    sat_pro:    'Furnace_System_Saturator_For_Feed_2_Exists',
    sat_but:    'Furnace_System_Saturator_For_Feed_3_Exists',
    sat_nap:    'Furnace_System_Saturator_For_Feed_4_Exists',
    sat_gen_fr: 'Furnace_System_Saturator_For_Feed_5_Exists',
    sat_gen_tf: 'Furnace_System_Saturator_For_Feed_6_Exists',
  };
  Object.entries(SAT_V411_MAP).forEach(([vKey, exportKey]) => {
    const v = gBool(map, exportKey);
    if (v !== null) fms.satVars[vKey] = v;
  });
  const satComplete = fms.satVars['sat_dsg'] !== null && fms.satVars['sat_exists'] !== null;
  fms.satDone      = satComplete;
  fms.satConfirmed = satComplete;
  fms.pctSat       = satComplete ? 100 : 0;
  fms.visitedSat   = satComplete;

  /* ══════════════════════════════════════════════
     STEP 4 — Feed Allocation
  ══════════════════════════════════════════════ */
  const FEED_DEFS = [
    { key: 'eth',    label: 'Ethane',             existsKey: 'eth_exists' },
    { key: 'pro',    label: 'Propane',            existsKey: 'pro_exists' },
    { key: 'but',    label: 'Butane',             existsKey: 'but_exists' },
    { key: 'nap',    label: 'Naphtha',            existsKey: 'nap_exists' },
    { key: 'gen_fr', label: 'Gen F+R',            existsKey: 'gen_fr_exists' },
    { key: 'gen_tf', label: 'General Total Feed', existsKey: 'gen_tf_exists' },
  ];
  fms.activeFeeds = FEED_DEFS
    .filter(d => fms.pidVars[d.existsKey] === 1)
    .map(d => ({ key: d.key, label: d.label }));

  const nH = fms.activeFeeds.length;
  fms.allocTable = Array.from({ length: fc }, () => Array(nH).fill(0)) as (0|1|2|3)[][];
  for (let fi = 0; fi < fc; fi++) {
    for (let hi = 0; hi < nH; hi++) {
      if (g(map, `Feed${hi+1}_To_Furnace_${fi+1}`) === '1') fms.allocTable[fi][hi] = 1;
    }
    const prim = gNum(map, `Primary_Feed_To_Furnace_${fi+1}`);
    const sec  = gNum(map, `Secondary_Feed_To_Furnace_${fi+1}`);
    if (prim && prim > 0 && prim <= nH) fms.allocTable[fi][prim - 1] = 2;
    if (sec  && sec  > 0 && sec  <= nH) fms.allocTable[fi][sec  - 1] = 3;
  }
  /* ══════════════════════════════════════════════
     STEP 5 — Feed Components
  ══════════════════════════════════════════════ */
  const totalComp = gNum(map, 'Feed_Component_Total_Count') ?? 0;
  const userCount = Math.max(0, totalComp - FIXED_COMPONENTS.length);
  fms.compComponents = [];
  for (let i = 0; i < userCount; i++) {
    const v = gStr(map, `Furnace_System_Feed_Component_${FIXED_OFFSET + i + 1}`)
           || gStr(map, `Feed_Component_${FIXED_OFFSET + i + 1}`);
    fms.compComponents.push(v);
  }
  fms.compCount        = fms.compComponents.length;
  fms.compConfirmPhase = fms.compCount > 0 ? 2 : 0;
  fms.visitedComp      = fms.compConfirmPhase >= 2;
  fms.pctComp          = fms.compConfirmPhase >= 2 ? 100 : 0;

  /* ══════════════════════════════════════════════
     STEP 5b — Fuel Components
  ══════════════════════════════════════════════ */
  const fuelCount = gNum(map, 'Fuel_Component_Count') ?? 0;
  if (fuelCount > 0) {
    fuel.fuelCount = fuelCount;
    fuel.fuelComponents = [];
    for (let i = 0; i < fuelCount; i++) {
      const v = gStr(map, `Fuel_Component_${i + 1}`);
      fuel.fuelComponents.push(v);
    }
    fuel.fuelConfirmed = true;
    fuel.visitedFuel   = true;
    fuel.pctFuel       = 100;
  }
  const fuelHeaderCount = gNum(map, 'Fuel_Header_Count');
  fuel.fuelHeaderCount = (fuelHeaderCount && fuelHeaderCount >= 1) ? Math.round(fuelHeaderCount) : 1;

  /* ══════════════════════════════════════════════
     STEP 5c — Feed Selector Switch
  ══════════════════════════════════════════════ */
  fms.selectorChars  = { eth: [], pro: [], but: [], nap: [], gen_fr: [], gen_tf: [] };
  fms.mixedChars     = [];
  fms.dualChars      = [];
  fms.mixedFeedOp    = 0;
  fms.dualFeedOp     = 0;
  let anySelData = false;

  [{ key:'eth',idx:1 },{ key:'pro',idx:2 },{ key:'but',idx:3 },
   { key:'nap',idx:4 },{ key:'gen_fr',idx:5 },{ key:'gen_tf',idx:6 }].forEach(d => {
    const cnt = gNum(map, `Feed_${d.idx}_Selector_Character_Count`);
    if (cnt !== null && cnt > 0) {
      const arr: string[] = [];
      for (let i = 1; i <= cnt; i++) {
        const v = g(map, `Feed_${d.idx}_Selector_Value_${i}_Character`);
        if (v !== null && v !== '99.99' && v !== '99') arr.push(v);
      }
      if (arr.length > 0) { (fms.selectorChars as Record<string,string[]>)[d.key] = arr; anySelData = true; }
    }
  });

  const mixActive = gBool(map, 'Mixed_Feed_Operation_Active');
  if (mixActive !== null) { fms.mixedFeedOp = mixActive as 0|1; anySelData = true; }
  if (fms.mixedFeedOp === 1) {
    const mixCnt = gNum(map, 'Feed_Mix_Selector_Character_Count') ?? 0;
    for (let i = 1; i <= mixCnt; i++) {
      const v = g(map, `Feed_Mix_Selector_Value_${i}_Character`);
      if (v !== null && v !== '99' && v !== '99.99') fms.mixedChars.push(v);
    }
  }
  const dualActive = gBool(map, 'Dual_Feed_Operation_Active');
  if (dualActive !== null) { fms.dualFeedOp = dualActive as 0|1; anySelData = true; }
  if (fms.dualFeedOp === 1) {
    const dualCnt = gNum(map, 'Feed_Dual_Selector_Character_Count') ?? 0;
    for (let i = 1; i <= dualCnt; i++) {
      const v = g(map, `Feed_Dual_Selector_Value_${i}_Character`);
      if (v !== null && v !== '99' && v !== '99.99') fms.dualChars.push(v);
    }
  }
  fms.visitedSelector = anySelData;

  /* ══════════════════════════════════════════════
     STEP 6 — UOM
  ══════════════════════════════════════════════ */
  const UOM_MAP: Record<string, string> = {
    massFlow:'Mass_Flow_Sensor_Tag', temperature:'Temperature_Sensor_Tag',
    temperatureDrop:'Temperature_Drop_Sensor_Tag', pressure:'Pressure_Sensor_Tag',
    pressureDrop:'Pressure_Drop_Sensor_Tag', work:'Work_Sensor_Tag',
    specificEnergy:'Specific_Energy_Sensor_Tag', composition:'Composition_Sensor_Tag',
    moleWeight:'Mole_Weight_Sensor_Tag', humidity:'Humidity_Sensor_Tag', pH:'Ph_Sensor_Tag',
  };
  (Object.keys(UOM_MAP) as Array<keyof typeof fms.uom>).forEach(k => {
    const v = gStr(map, UOM_MAP[k]);
    if (v) (fms.uom as unknown as Record<string,string>)[k] = v;
  });
  // 'confirmed' is no longer exported; an imported project has UOM configured → mark confirmed.
  fms.uomConfirmed = true;
  fms.visitedUom   = true; // always mark visited on import

  /* ══════════════════════════════════════════════
     STEP 7 — FFI (Feed & Furnace Interaction)
  ══════════════════════════════════════════════ */
  const ffiOptionsMap: Record<number, FfiOptions> = {};
  const ffiDataMap:    Record<number, Record<string, FfiFeedData>> = {};
  const ffiLmfMap:     Record<number, FfiLmfData> = {};
  const ffiHmfMap:     Record<number, FfiHmfData> = {};

  // We need radiation pass counts for HMF pass assignment — defer rad import first via a lazy lookup
  // For now build rad fields per furnace (they'll be built again in Step 10; this is just for HMF pass map)
  function getRadPassCount(fi: number): number {
    const n  = fi + 1;
    const nc = gNum(map, `Furnace_${n}_Cell_Count`) ?? 0;
    let total = 0;
    for (let c = 0; c < nc; c++) {
      total += gNum(map, `Furnace_${n}_Cell_${c+1}_Pass_Count`) ?? 0;
    }
    return total;
  }
  function getRadPassMap(fi: number): Array<{ cell: number; group: number } | null> {
    const n  = fi + 1;
    const nc = gNum(map, `Furnace_${n}_Cell_Count`) ?? 0;
    const total = getRadPassCount(fi);
    const pm: Array<{ cell: number; group: number } | null> = Array(total).fill(null);
    for (let c = 0; c < nc; c++) {
      for (let p = 0; p < total; p++) {
        if (gBool(map, `Furnace_${n}_Cell_${c+1}_Pass_${p+1}_Exists`) === 1) {
          const g1 = gBool(map, `Furnace_${n}_Cell_${c+1}_Group_1_Pass_${p+1}_Exists`);
          const g2 = gBool(map, `Furnace_${n}_Cell_${c+1}_Group_2_Pass_${p+1}_Exists`);
          pm[p] = { cell: c, group: g1 === 1 ? 1 : (g2 === 1 ? 2 : 1) };
        }
      }
    }
    return pm;
  }

  for (let fi = 0; fi < fc; fi++) {
    const n = fi + 1;
    const opt: FfiOptions = ffiDefaultOptions();

    const dilSteam        = gBool(map, `Furnace_${n}_Dilution_Steam_Header_Active`);
    const archO2Exists    = gBool(map, `Furnace_${n}_Arch_O2_Exists`);
    const archO2PerCell   = gBool(map, `Furnace_${n}_Arch_O2_Per_Cell`);
    const archO2WetBasis  = gBool(map, `Furnace_${n}_Arch_O2_Wet_Basis`);
    const stackO2Exists   = gBool(map, `Furnace_${n}_Stack_O2_Exists`);
    const stackO2WetBasis = gBool(map, `Furnace_${n}_Stack_O2_Wet_Basis`);
    const airIngression   = gNum(map,  `Furnace_${n}_Delta_Stack_Arch_O2`);
    const localAmbientTemp= gBool(map, `Furnace_${n}_Local_Ambient_Temp_Available`);
    const localHumidity   = gBool(map, `Furnace_${n}_Local_Humidity_Tag_Available`);
    const dsBeforeVapor   = gBool(map, `Furnace_${n}_DS_Before_Vapor_Feed_Flowmeter`);
    const dsBeforeLiquid  = gBool(map, `Furnace_${n}_DS_Before_Liquid_Feed_Flowmeter`);
    const stackNoxAvail   = gBool(map, `Furnace_${n}_Stack_NOx_Available`);
    const stackSoxAvail   = gBool(map, `Furnace_${n}_Stack_SOx_Available`);
    const pwDecokeAir     = gBool(map, `Furnace_${n}_Passwise_Decoke_Air_Available`);
    const pwDecokeSteam   = gBool(map, `Furnace_${n}_Passwise_Decoke_Steam_Available`);

    if (dilSteam        !== null) opt.dilSteam        = dilSteam === 1;
    if (archO2Exists    !== null) opt.archO2Exists     = archO2Exists === 1;
    if (archO2PerCell   !== null) opt.archO2PerCell    = archO2PerCell === 1;
    if (archO2WetBasis  !== null) opt.archO2WetBasis   = archO2WetBasis === 1;
    if (stackO2Exists   !== null) opt.stackO2Exists    = stackO2Exists === 1;
    if (stackO2WetBasis !== null) opt.stackO2WetBasis  = stackO2WetBasis === 1;
    if (airIngression   !== null) opt.airIngression    = airIngression;
    if (localAmbientTemp!== null) opt.localAmbientTemp = localAmbientTemp === 1;
    if (localHumidity   !== null) opt.localHumidity    = localHumidity === 1;
    if (dsBeforeVapor   !== null) opt.dsBeforeVaporFlowmeter  = dsBeforeVapor === 1;
    if (dsBeforeLiquid  !== null) opt.dsBeforeLiquidFlowmeter = dsBeforeLiquid === 1;
    if (stackNoxAvail   !== null) opt.stackNoxAvailable            = stackNoxAvail === 1;   // else default NO
    if (stackSoxAvail   !== null) opt.stackSoxAvailable            = stackSoxAvail === 1;   // else default NO
    if (pwDecokeAir     !== null) opt.passwiseDecokeAirAvailable   = pwDecokeAir === 1;     // else default YES
    if (pwDecokeSteam   !== null) opt.passwiseDecokeSteamAvailable = pwDecokeSteam === 1;   // else default YES

    const data: Record<string, FfiFeedData> = {};
    FEED_KEYS.forEach(fk => {
      const idx  = FFI_FEED_IDX[fk];
      const act  = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Active`);
      const fph1 = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Flows_Through_FPH1`);
      const fph2 = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Flows_Through_FPH2`);
      const stle = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Flows_Through_STLE`);
      const ttle = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Flows_Through_TTLE`);
      const htc  = gBool(map, `Furnace_${n}_Master_Feed_${idx}_Flows_Through_HTC`);
      if (act !== null) opt[`feed_active_${fk}`] = act === 1;
      data[fk] = { fph1: fph1 === 1, fph2: fph2 === 1, htc: htc === 1, stle: stle === 1, ttle: ttle === 1 };
    });
    ['decoke_steam','decoke_air','dilution_steam'].forEach(fk => {
      const base = fk === 'decoke_steam' ? 'Decoke_Steam' : fk === 'decoke_air' ? 'Decoke_Air' : 'Dilution_Steam';
      const fph1 = gBool(map, `Furnace_${n}_${base}_Flows_Through_FPH1`);
      const fph2 = gBool(map, `Furnace_${n}_${base}_Flows_Through_FPH2`);
      const stle = gBool(map, `Furnace_${n}_${base}_Flows_Through_STLE`);
      const ttle = gBool(map, `Furnace_${n}_${base}_Flows_Through_TTLE`);
      const htc  = gBool(map, `Furnace_${n}_${base}_Flows_Through_HTC`);
      data[fk] = { fph1: fph1 === 1, fph2: fph2 === 1, htc: htc === 1, stle: stle === 1, ttle: ttle === 1 };
    });

    // LMF
    const lmfActive = gBool(map, `Furnace_${n}_LMF_Active`);
    const lmfData: FfiLmfData = { selectedFeeds: [], rows: {} };
    if (lmfActive === 1) {
      opt.localMixed = true;
      const feedAIdx = gNum(map, `Furnace_${n}_LMF_Feed_A_Index`);
      const feedBIdx = gNum(map, `Furnace_${n}_LMF_Feed_B_Index`);
      const sel: string[] = [];
      if (feedAIdx && FFI_FEED_IDX_REV[feedAIdx]) sel.push(FFI_FEED_IDX_REV[feedAIdx]);
      if (feedBIdx && FFI_FEED_IDX_REV[feedBIdx]) sel.push(FFI_FEED_IDX_REV[feedBIdx]);
      lmfData.selectedFeeds = sel;
      sel.forEach(fk => {
        const idx  = FFI_FEED_IDX[fk];
        const fph1 = gBool(map, `Furnace_${n}_LMF_Feed_${idx}_Flows_Through_FPH1`);
        const fph2 = gBool(map, `Furnace_${n}_LMF_Feed_${idx}_Flows_Through_FPH2`);
        lmfData.rows[fk] = { fph1: fph1 === 1, fph2: fph2 === 1, htc: true };
      });
      const dsFph1 = gBool(map, `Furnace_${n}_LMF_Dilution_Steam_Flows_Through_FPH1`);
      const dsFph2 = gBool(map, `Furnace_${n}_LMF_Dilution_Steam_Flows_Through_FPH2`);
      lmfData.rows['_ds'] = { fph1: dsFph1 === 1, fph2: dsFph2 === 1, htc: true };
    }

    // HMF
    const hmfActive = gBool(map, `Furnace_${n}_Cocracking_Active`);
    const hmfData: FfiHmfData = {
      selectedFeeds: [], passMap: {},
      rows: { '_hybrid': { fph1: false, fph2: false, htc: false }, '_ds': { fph1: false, fph2: false, htc: false } },
    };
    if (hmfActive === 1) {
      opt.hybrid = true;
      const hmfAIdx = gNum(map, `Furnace_${n}_Cocracking_Feed_A_Index`);
      const hmfBIdx = gNum(map, `Furnace_${n}_Cocracking_Feed_B_Index`);
      const hmfSel: string[] = [];
      if (hmfAIdx && FFI_FEED_IDX_REV[hmfAIdx]) hmfSel.push(FFI_FEED_IDX_REV[hmfAIdx]);
      if (hmfBIdx && FFI_FEED_IDX_REV[hmfBIdx]) hmfSel.push(FFI_FEED_IDX_REV[hmfBIdx]);
      hmfData.selectedFeeds = hmfSel;
      const totalPasses = getRadPassCount(fi);
      const passMapRad  = getRadPassMap(fi);
      const cellPassCtr: Record<number, number> = {};
      for (let p = 0; p < totalPasses; p++) {
        const cellIdx = passMapRad[p]?.cell ?? 0;
        cellPassCtr[cellIdx] = (cellPassCtr[cellIdx] || 0) + 1;
        const feedIdxRaw = gNum(map, `Furnace_${n}_Cell_${cellIdx+1}_Cocracking_Pass_${cellPassCtr[cellIdx]}_Feed_Index`)
                        ?? gNum(map, `Furnace_${n}_Cocracking_Pass_${p+1}_Feed_Index`);
        if (feedIdxRaw === hmfAIdx) hmfData.passMap[p] = 'A';
        else if (feedIdxRaw === hmfBIdx) hmfData.passMap[p] = 'B';
      }
      const hFph1 = gBool(map, `Furnace_${n}_Cocracking_Hybrid_Feed_Flows_Through_FPH1`);
      const hFph2 = gBool(map, `Furnace_${n}_Cocracking_Hybrid_Feed_Flows_Through_FPH2`);
      hmfData.rows['_hybrid'] = { fph1: hFph1 === 1, fph2: hFph2 === 1, htc: true };
    }

    ffiOptionsMap[fi] = opt;
    ffiDataMap[fi]    = data;
    ffiLmfMap[fi]     = lmfData;
    ffiHmfMap[fi]     = hmfData;
  }

  // Group into templates (same content → one template)
  const ffiSigs = Array.from({ length: fc }, (_, fi) =>
    JSON.stringify({ options: ffiOptionsMap[fi], data: ffiDataMap[fi], lmfData: ffiLmfMap[fi], hmfData: ffiHmfMap[fi] })
  );
  const allSame = fc <= 1 || ffiSigs.every(s => s === ffiSigs[0]);
  const ffiTemplates: FfiTemplate[] = [];
  const ffiApplyMap: Record<number, string> = {};

  if (allSame) {
    const tpl: FfiTemplate = {
      id: 'ffi-import-1', name: 'Template 1',
      furnaces: Array.from({ length: fc }, (_, i) => i),
      options:  ffiOptionsMap[0] ?? ffiDefaultOptions(),
      data:     ffiDataMap[0]    ?? {},
      lmfData:  ffiLmfMap[0]    ?? { selectedFeeds: [], rows: {} },
      hmfData:  ffiHmfMap[0]    ?? { selectedFeeds: [], passMap: {}, rows: {} },
    };
    ffiTemplates.push(tpl);
    for (let fi = 0; fi < fc; fi++) ffiApplyMap[fi] = tpl.id;
  } else {
    for (let fi = 0; fi < fc; fi++) {
      const tpl: FfiTemplate = {
        id: `ffi-import-${fi + 1}`, name: `Template ${fi + 1}`,
        furnaces: [fi],
        options:  ffiOptionsMap[fi] ?? ffiDefaultOptions(),
        data:     ffiDataMap[fi]    ?? {},
        lmfData:  ffiLmfMap[fi]    ?? { selectedFeeds: [], rows: {} },
        hmfData:  ffiHmfMap[fi]    ?? { selectedFeeds: [], passMap: {}, rows: {} },
      };
      ffiTemplates.push(tpl);
      ffiApplyMap[fi] = tpl.id;
    }
  }
  fms.ffiTemplates     = ffiTemplates;
  fms.ffiApplyMap      = ffiApplyMap;
  fms.ffiSameForAll    = allSame ? 1 : 0;
  fms.ffiSelectedTplId = ffiTemplates[0]?.id ?? null;
  fms.ffiDone          = ffiTemplates.some(t =>
    FEED_KEYS.some(fk => { const d = t.data[fk]; return d && (d.fph1 || d.fph2 || d.htc); })
  );

  /* ══════════════════════════════════════════════
     STEP 8 — Hardware: Convection
  ══════════════════════════════════════════════ */
  const convFields: ConvFields[] = Array.from({ length: fc }, (_, fi) => {
    const n = fi + 1;
    const draft    = gStr(map, `Furnace_${n}_Draft_Type`);
    const numBanks = gNum(map, `Furnace_${n}_Convection_Section_Count`) ?? 0;
    const atmp     = gBool(map, `Furnace_${n}_Attemperator_Exists`);
    const fphSer   = gBool(map, `Furnace_${n}_Convection_Section_FPH_In_Series`);
    const banks: string[] = [];
    const bankAliases: Record<string, string> = {};
    for (let b = 1; b <= numBanks; b++) {
      const code = gStr(map, `Furnace_${n}_Convection_Section_${b}_Code`);
      const name = gStr(map, `Furnace_${n}_Convection_Section_${b}_Name`);
      const bankCode = (code && code !== 'EMPTY') ? code : '';
      banks.push(bankCode);
      if (name && name !== 'EMPTY' && name !== bankCode && bankCode) bankAliases[bankCode] = name;
    }
    return {
      draft, numBanks: numBanks ? String(numBanks) : '',
      banks, bankAliases,
      attemperator: atmp === 1 ? 1 : 0,
      fphSeries:    fphSer === 0 ? 0 : 1,
    };
  });
  fms.hwConv = buildHwSection(groupByContent(convFields), 'conv', f => !!f.draft);

  /* ══════════════════════════════════════════════
     STEP 9 — Hardware: TLE
  ══════════════════════════════════════════════ */
  const tleFields: TleFields[] = Array.from({ length: fc }, (_, fi) => {
    const n = fi + 1;
    const f = tleEmptyFields();
    const stleExists = gBool(map, `Furnace_${n}_TLE_2_Exists`);
    const ttleExists = gBool(map, `Furnace_${n}_TLE_3_Exists`);
    f.stle = stleExists === 1 ? 1 : 0;
    f.ttle = (stleExists === 1 && ttleExists === 1) ? 1 : 0;
    const pName = gStr(map, `Furnace_${n}_TLE_1_Name`);
    const sName = gStr(map, `Furnace_${n}_TLE_2_Name`);
    const tName = gStr(map, `Furnace_${n}_TLE_3_Name`);
    if (pName) f.ptleName = pName;
    if (sName) f.stleName = sName;
    if (tName) f.ttleName = tName;
    const sCf  = gStr(map, `Furnace_${n}_TLE_2_Cold_Fluid`);
    const tCf  = gStr(map, `Furnace_${n}_TLE_3_Cold_Fluid`);
    const sOri = gStr(map, `Furnace_${n}_TLE_2_Orientation`);
    const tOri = gStr(map, `Furnace_${n}_TLE_3_Orientation`);
    if (sCf  && sCf  !== 'EMPTY') f.stleColdFluid   = sCf;
    if (tCf  && tCf  !== 'EMPTY') f.ttleColdFluid   = tCf;
    if (sOri && sOri !== 'EMPTY' && sOri !== 'N/A') f.stleOrientation = sOri;
    if (tOri && tOri !== 'EMPTY' && tOri !== 'N/A') f.ttleOrientation = tOri;
    const dd  = gBool(map, `Furnace_${n}_TLE_Design_Data_Selected`);
    const mfc = gBool(map, `Furnace_${n}_TLE_Mass_Flow_Constant`);
    const mwc = gBool(map, `Furnace_${n}_TLE_Mole_Weight_Constant`);
    const tc  = gBool(map, `Furnace_${n}_TLE_Temperature_Continuity`);
    const pc  = gBool(map, `Furnace_${n}_TLE_Pressure_Continuity`);
    f.designData     = dd  === 1 ? 1 : 0;
    if (mfc !== null) f.massFlowConst   = mfc as 0|1;
    if (mwc !== null) f.moleWeightConst = mwc as 0|1;
    if (tc  !== null) f.tempCont        = tc  as 0|1;
    f.pressCont = pc !== null ? pc as 0|1 : 1;
    // V418 — reference pressure tag location. (V418 exports UPPER_CASE; its own importer
    // reads Title_Case — a V418 bug. We read the UPPER_CASE name V418 actually writes, with
    // the Title_Case spelling as a fallback, so genuine V418 files round-trip.)
    const ptAtRaw = (gStr(map, `Furnace_${n}_TLE_PRESSURE_TAG_AT`)
                  || gStr(map, `Furnace_${n}_TLE_Pressure_Tag_At`) || '').toUpperCase();
    const VALID_PT_AT = ['PTLE_OUTLET', 'STLE_OUTLET', 'TTLE_OUTLET', 'DOWNSTREAM'];
    f.pressTagAt = VALID_PT_AT.includes(ptAtRaw) ? ptAtRaw : 'DOWNSTREAM';
    if (f.designData) {
      Object.entries(SEC_EXPORT).forEach(([sec, ek]) => {
        TLE_PARAMS.forEach(p => {
          const paramExp = p.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join('_');
          const val = g(map, `Furnace_${n}_${ek}_${paramExp}`);
          const uom = g(map, `Furnace_${n}_${ek}_${paramExp}_Uom`);
          if (val !== null && val !== '0' && val !== 'EMPTY') f.sections[sec][p] = val;
          if (uom !== null && uom !== 'EMPTY') f.sections[sec][p + '_UOM'] = uom;
        });
      });
    }
    return f;
  });
  fms.hwTle = buildHwSection(groupByContent(tleFields), 'tle', () => true);

  /* ══════════════════════════════════════════════
     STEP 10 — Hardware: Radiation
  ══════════════════════════════════════════════ */
  const radFields: RadFields[] = Array.from({ length: fc }, (_, fi) => {
    const n  = fi + 1;
    const f  = radEmptyFields();
    const nc = gNum(map, `Furnace_${n}_Cell_Count`) ?? 0;
    if (nc <= 0) return f;
    f.numCells   = String(nc);
    f.cells      = [];
    const total  = gNum(map, `Furnace_${n}_Pass_Count`) ?? 0;
    f.passMap    = Array(total).fill(null);

    for (let c = 0; c < nc; c++) {
      const ppc      = gNum(map, `Furnace_${n}_Cell_${c+1}_Pass_Count`)           ?? 0;
      const tp       = gNum(map, `Furnace_${n}_Cell_${c+1}_Tubes_Per_Pass_Count`) ?? 0;
      const hbExists = gBool(map, `Furnace_${n}_Cell_${c+1}_Hearth_Burner_Exists`);
      const wbExists = gBool(map, `Furnace_${n}_Cell_${c+1}_Wall_Burner_Exists`);
      const hb       = gNum(map,  `Furnace_${n}_Cell_${c+1}_Hearth_Burners_Count`) ?? 0;
      const wb       = gNum(map,  `Furnace_${n}_Cell_${c+1}_Wall_Burners_Count`)   ?? 0;
      const orient   = gStr(map,  `Furnace_${n}_Cell_${c+1}_Tube_Orientation`);
      const flowEnt  = gStr(map,  `Furnace_${n}_Cell_${c+1}_Flow_Entry`);
      const feedTyp  = gStr(map,  `Furnace_${n}_Cell_${c+1}_Feed_Type`);
      const hearthBT  = gStr(map, `Furnace_${n}_Cell_${c+1}_Hearth_Burner_Type`) || 'Conventional';
      const hearthFGR = gNum(map, `Furnace_${n}_Cell_${c+1}_Hearth_FGR_Percent`) ?? 0;
      const wallBT    = gStr(map, `Furnace_${n}_Cell_${c+1}_Wall_Burner_Type`)   || 'Conventional';
      const wallFGR   = gNum(map, `Furnace_${n}_Cell_${c+1}_Wall_FGR_Percent`)   ?? 0;
      const dsRaw     = gBool(map, `Furnace_${n}_Cell_${c+1}_Burner_Design_Same`);
      const sfRaw     = gBool(map, `Furnace_${n}_Cell_${c+1}_Separate_Flow_Tag`);
      const wfr       = gNum(map,  `Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate`);
      const wfrUom    = gStr(map,  `Furnace_${n}_Cell_${c+1}_Wall_Design_Flow_Rate_Uom`);
      const hfr       = gNum(map,  `Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate`);
      const hfrUom    = gStr(map,  `Furnace_${n}_Cell_${c+1}_Hearth_Design_Flow_Rate_Uom`);

      // Bends
      const hasAMid = orient.includes('-A-');
      const hasAEnd = !hasAMid && orient.endsWith('-A');
      const cp      = hasAEnd ? orient.slice(0, -2) : hasAMid ? orient.split('-A-')[0] : orient;
      const nums    = (cp && cp !== '—') ? cp.split('-').map(Number) : [1];
      const cellBends: number[] = nums.map((_, bi) => gNum(map, `Furnace_${n}_Cell_${c+1}_Bend_${bi+1}`) ?? 0);

      const cotAM  = gNum(map, `Furnace_${n}_Cell_${c+1}_COT_After_Adia_Merge`) ?? 0;
      const cotCnt = gNum(map, `Furnace_${n}_Cell_${c+1}_COT_Tube_Count`) ?? 0;
      const cotSensorTubes: boolean[] = [];
      for (let ti = 0; ti < cotCnt; ti++) {
        cotSensorTubes.push(gBool(map, `Furnace_${n}_Cell_${c+1}_COT_Tube_${ti+1}_Has_Sensor`) === 1);
      }

      f.cells.push({
        ...radEmptyCell(),
        hearthExists:     hbExists === 1 ? true : hbExists === 0 ? false : (hb > 0 ? true : null),
        hearthBurnerCount: String(hb),
        hearthBurnerType:  hearthBT,
        hearthFgrPercent:  hearthFGR,
        wallExists:       wbExists === 1 ? true : wbExists === 0 ? false : (wb > 0 ? true : null),
        wallBurnerCount:   String(wb),
        wallBurnerType:    wallBT,
        wallFgrPercent:    wallFGR,
        burnerDesignSame:  dsRaw === 1 ? true : dsRaw === 0 ? false : null,
        separateFlowTag:   sfRaw === 1 ? true : sfRaw === 0 ? false : null,
        wallDesignFlowRate:      wfr !== null ? String(wfr) : '',
        wallDesignFlowRateUom:   wfrUom,
        hearthDesignFlowRate:    hfr !== null ? String(hfr) : '',
        hearthDesignFlowRateUom: hfrUom,
        passesPerCell:   String(ppc),
        tubesPerPass:    String(tp),
        tubeOrientation: (orient && orient !== '—') ? orient : '',
        flowEntry:       flowEnt === 'bottom' ? 'bottom' : 'top',
        feedType:        feedTyp === 'venturi' ? 'venturi' : 'control_valve',
        cellBends,
        cotAfterAdiaMerge: cotAM === 1 ? 1 : 0,
        cotSensorTubes,
      });

      // Rebuild passMap
      for (let p = 0; p < total; p++) {
        if (gBool(map, `Furnace_${n}_Cell_${c+1}_Pass_${p+1}_Exists`) === 1) {
          const g1 = gBool(map, `Furnace_${n}_Cell_${c+1}_Group_1_Pass_${p+1}_Exists`);
          const g2 = gBool(map, `Furnace_${n}_Cell_${c+1}_Group_2_Pass_${p+1}_Exists`);
          f.passMap[p] = { cell: c, group: g1 === 1 ? 1 : (g2 === 1 ? 2 : 1) };
        }
      }
    }

    // Pass / cell names
    f.passNames = {};
    f.cellNames = {};
    for (let p = 0; p < total; p++) {
      const cellIdx = f.passMap[p]?.cell ?? 0;
      const nm = gStr(map, `Furnace_${n}_Cell_${cellIdx+1}_Pass_${p+1}_Name`);
      if (nm && nm !== `Pass ${p + 1}`) f.passNames[p] = nm;
    }
    for (let c = 0; c < nc; c++) {
      const nm = gStr(map, `Furnace_${n}_Cell_${c+1}_Name`);
      if (nm && nm !== `Cell ${c + 1}`) f.cellNames[c] = nm;
    }
    if (nc > 1) {
      const sig0 = JSON.stringify(f.cells[0]);
      f.identicalCells = f.cells.every(cl => JSON.stringify(cl) === sig0);
    }
    return f;
  });
  fms.hwRad = buildHwSection(groupByContent(radFields), 'rad', f => !!f.numCells);

  /* ══════════════════════════════════════════════
     STEP 11 — Gate Flags
  ══════════════════════════════════════════════ */
  if (fms.compComponents.length > 0 && fms.compConfirmPhase < 2) fms.compConfirmPhase = 2;

  return { fms, fuel };
}
