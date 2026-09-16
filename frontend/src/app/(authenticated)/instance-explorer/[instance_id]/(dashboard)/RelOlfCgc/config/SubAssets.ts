// ─── Derive the sub-asset list + their sensor templates from MachineConfig ──
// Ported verbatim from buildStageGroups() and generateSubAssets() in
// asset_config_ui/index.html (lines ~1294-1544).

import type { Casing, MachineConfig, StageEquipmentConfig, Turbine, SubAssetItem } from "./ConfigTypes";
import {
  AUX_MAP,
  BEARING_MAP,
  DGS_COMP_MAP,
  DGS_MAP,
  OIL_MAP,
  STAGE_EQ_MAP,
  TREAT_MAP,
  TURB_MAP,
} from "./ConfigCatalog";
import {
  COND_TPL,
  DGS_TPL,
  MECH_TPL,
  OIL_TPL,
  STAGE_TPL,
  TURB_TPL,
  condTplForPumpCount,
  type SensorTemplateItem,
  type ShowWhenKey,
} from "./SensorTemplates";
import {
  OEM_COND_TPL,
  OEM_DGS_TPL,
  OEM_MECH_TPL,
  OEM_OIL_TPL,
  OEM_STAGE_TPL,
  OEM_TURB_TPL,
  oemCondTplForPumpCount,
  type OemLimitTemplateItem,
} from "./OemLimitTemplates";
import {
  TRIP_COND_TPL,
  TRIP_DGS_TPL,
  TRIP_MECH_TPL,
  TRIP_OIL_TPL,
  TRIP_STAGE_TPL,
  TRIP_TURB_TPL,
  type TripLimitTemplateItem,
} from "./TripLimitTemplates";

export interface GeneratedSubAsset extends SubAssetItem {
  sensorTemplate: SensorTemplateItem[];
  oemTemplate: OemLimitTemplateItem[];
  tripLimitTemplate: TripLimitTemplateItem[];
}

/** Union-find over a casing's stages, merged by its internalConnections pairs.
 * Returns groups of stage numbers, e.g. [[1],[2,3]] for a 3-stage casing where
 * stages 2-3 are internally connected. */
export function buildStageGroups(casing: Casing): number[][] {
  const stageNums = (casing.stages || [])
    .map((s) => parseInt(s.replace("stage_", ""), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  if (!stageNums.length) return [];

  const parent: Record<number, number> = {};
  stageNums.forEach((n) => {
    parent[n] = n;
  });
  const find = (n: number): number => {
    if (parent[n] !== n) parent[n] = find(parent[n]);
    return parent[n];
  };
  const unite = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  (casing.internalConnections || []).forEach((conn) => {
    const parts = conn.split("-");
    if (parts.length === 2) {
      const a = parseInt(parts[0].replace("stage_", ""), 10);
      const b = parseInt(parts[1].replace("stage_", ""), 10);
      if (!isNaN(a) && !isNaN(b) && parent[a] !== undefined && parent[b] !== undefined) unite(a, b);
    }
  });

  const groups: Record<number, number[]> = {};
  stageNums.forEach((n) => {
    const r = find(n);
    (groups[r] ??= []).push(n);
  });
  return Object.values(groups).map((g) => [...g].sort((a, b) => a - b));
}

export function stageGroupLabel(grp: number[]): string {
  return grp.length === 1 ? `Stage ${grp[0]}` : `Stage ${grp[0]}-${grp[grp.length - 1]}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** Matches StepMachineConfig's stageEquipment key for a stage group — kept in
 * sync here since both sides must agree on the same key format. */
export function stageGroupEquipmentKey(grp: number[]): string {
  return grp.length === 1 ? `stage_${grp[0]}` : grp.map((n) => `stage_${n}`).join("-");
}

export interface ShowWhenContext {
  stageEquipment?: StageEquipmentConfig;
  casing?: Casing;
  mc?: MachineConfig;
  turbine?: Turbine;
}

/** Resolves one Sensor Mapping template item's "Show only when" condition
 * (Static Input/Parameter_Mapping_Sheet_ui.xlsx) against the actual Machine
 * Config selections for the sub-asset instance it belongs to. */
function checkShowWhen(key: ShowWhenKey | undefined, ctx: ShowWhenContext): boolean {
  switch (key) {
    case undefined:
      return true;
    case "intercooler_or_aftercooler":
      return !!ctx.stageEquipment?.equipment.includes("intercooler") || !!ctx.stageEquipment?.equipment.includes("aftercooler");
    case "kod":
      return !!ctx.stageEquipment?.equipment.includes("kod");
    case "de_dgs":
      return !!ctx.casing?.dgsSupport.includes("de_dgs");
    case "nde_dgs":
      return !!ctx.casing?.dgsSupport.includes("nde_dgs");
    case "seal_gas_filter":
      return !!ctx.casing?.dgsSupport.includes("seal_gas_filter");
    case "de_dgs_primary_vent":
      return !!ctx.casing?.dgsSupport.includes("de_dgs") && !!ctx.casing?.deDgsComponents.includes("primary_vent");
    case "nde_dgs_primary_vent":
      return !!ctx.casing?.dgsSupport.includes("nde_dgs") && !!ctx.casing?.ndeDgsComponents.includes("primary_vent");
    case "de_dgs_secondary_vent":
      return !!ctx.casing?.dgsSupport.includes("de_dgs") && !!ctx.casing?.deDgsComponents.includes("secondary_vent");
    case "nde_dgs_secondary_vent":
      return !!ctx.casing?.dgsSupport.includes("nde_dgs") && !!ctx.casing?.ndeDgsComponents.includes("secondary_vent");
    case "de_dgs_separation_gas":
      return !!ctx.casing?.dgsSupport.includes("de_dgs") && !!ctx.casing?.deDgsComponents.includes("separation_gas");
    case "nde_dgs_separation_gas":
      return !!ctx.casing?.dgsSupport.includes("nde_dgs") && !!ctx.casing?.ndeDgsComponents.includes("separation_gas");
    case "de_or_nde_dgs_separation_gas":
      return checkShowWhen("de_dgs_separation_gas", ctx) || checkShowWhen("nde_dgs_separation_gas", ctx);
    case "thrust_bearing":
      return !!ctx.casing?.bearings.includes("thrust_bearing") || !!ctx.turbine?.turbineCondMonitoring.includes("thrust_bearing");
    case "de_journal_bearing":
      return !!ctx.casing?.bearings.includes("de_journal") || !!ctx.turbine?.turbineCondMonitoring.includes("de_journal");
    case "nde_journal_bearing":
      return !!ctx.casing?.bearings.includes("nde_journal") || !!ctx.turbine?.turbineCondMonitoring.includes("nde_journal");
    case "main_oil_pump":
      return !!ctx.mc?.oilEquipment.includes("main_oil_pump");
    case "standby_oil_pump":
      return !!ctx.mc?.oilEquipment.includes("standby_oil_pump");
    case "oil_console":
      return !!ctx.mc?.oilEquipment.includes("oil_console");
    case "oil_filter":
      return !!ctx.mc?.oilEquipment.includes("oil_filter");
    case "oil_cooler":
      return !!ctx.mc?.oilEquipment.includes("oil_cooler");
    case "extraction_condensing_turbine":
      return ctx.turbine?.type === "extraction_condensing";
    case "surface_condenser_steam_ejector":
      // "Steam Ejector System" / "Surface Condenser Pump" are chosen in the
      // Surface Condenser Aux Systems sub-selection (scAuxSystems), not the
      // turbine's top-level Auxiliary Systems list (auxiliarySystems).
      return !!ctx.turbine?.scAuxSystems.includes("steam_ejector");
    case "surface_condenser_pump":
      return !!ctx.turbine?.scAuxSystems.includes("surface_condenser_pump");
    default:
      return true;
  }
}

function filterByShowWhen<T extends { showWhen?: ShowWhenKey }>(template: T[], ctx: ShowWhenContext): T[] {
  return template.filter((t) => checkShowWhen(t.showWhen, ctx));
}

/** Every known composite/multi-field "show only when" phrase used in
 * Master_KPI_Calc_File.xlsx, mapped to the existing ShowWhenKey that already
 * evaluates it correctly. Simple single-equipment phrases (e.g. "Oil
 * Console", "DE Journal Bearing") don't need an entry here — they're
 * resolved generically in computeShowWhenSatisfied() via the *_MAP display
 * names directly, so adding a new piece of equipment to any of those maps
 * automatically works without touching this file again. Only genuinely new
 * composite AND/OR conditions need a new line here. */
const SHOW_WHEN_PHRASES: Record<string, ShowWhenKey> = {
  "Intercooler or Aftercooler": "intercooler_or_aftercooler",
  "DE DGS + Separation Gas System": "de_dgs_separation_gas",
  "NDE DGS + Separation Gas System": "nde_dgs_separation_gas",
  "DE DGS or NDE DGS + Separation Gas System": "de_or_nde_dgs_separation_gas",
  "DE DGS + Primary Vent Monitoring": "de_dgs_primary_vent",
  "NDE DGS + Primary Vent Monitoring": "nde_dgs_primary_vent",
  "DE DGS + Secondary Vent Monitoring": "de_dgs_secondary_vent",
  "NDE DGS + Secondary Vent Monitoring": "nde_dgs_secondary_vent",
  // Surface Condenser's own equipment lives in turbine.scAuxSystems, a
  // different field than turbine.auxiliarySystems (which EQUIPMENT_CHECKS'
  // AUX_MAP lookup reads) — these two need their named ShowWhenKey, the
  // generic equipment-map lookup can't see scAuxSystems.
  "Steam Ejector System": "surface_condenser_steam_ejector",
  "Surface Condenser Pump": "surface_condenser_pump",
};

/** (display-name map, selected-keys getter) pairs — generic coverage for any
 * simple "is this one piece of equipment selected" phrase. Bearing checks
 * combine casing.bearings + turbine.turbineCondMonitoring, matching
 * checkShowWhen()'s own thrust_bearing/de_journal_bearing/nde_journal_bearing
 * cases (a bearing can be tracked at either the casing or the turbine). */
const EQUIPMENT_CHECKS: { map: Record<string, string>; selected: (ctx: ShowWhenContext) => string[] }[] = [
  { map: OIL_MAP, selected: (ctx) => ctx.mc?.oilEquipment || [] },
  { map: BEARING_MAP, selected: (ctx) => [...(ctx.casing?.bearings || []), ...(ctx.turbine?.turbineCondMonitoring || [])] },
  { map: DGS_MAP, selected: (ctx) => ctx.casing?.dgsSupport || [] },
  { map: DGS_COMP_MAP, selected: (ctx) => [...(ctx.casing?.deDgsComponents || []), ...(ctx.casing?.ndeDgsComponents || [])] },
  { map: STAGE_EQ_MAP, selected: (ctx) => ctx.stageEquipment?.equipment || [] },
  { map: AUX_MAP, selected: (ctx) => ctx.turbine?.auxiliarySystems || [] },
  { map: TREAT_MAP, selected: (ctx) => ctx.mc?.processTreatment || [] },
  { map: TURB_MAP, selected: (ctx) => (ctx.turbine?.type ? [ctx.turbine.type] : []) },
];

/** Every "show only when" phrase that's actually true for one sub-asset's
 * own Machine Config context — handed to the backend as a single
 * `show_when_satisfied` macro (see BuildWorkbook.ts) so
 * Master_KPI_Calc_File-driven PI tags can gate on it with one exact-phrase
 * lookup, no macro-juggling or composite-condition parsing needed there. */
export function computeShowWhenSatisfied(ctx: ShowWhenContext): string[] {
  const satisfied = new Set<string>();

  for (const { map, selected } of EQUIPMENT_CHECKS) {
    for (const key of selected(ctx)) {
      if (map[key]) satisfied.add(map[key]);
    }
  }

  for (const [phrase, key] of Object.entries(SHOW_WHEN_PHRASES)) {
    if (checkShowWhen(key, ctx)) satisfied.add(phrase);
  }

  return Array.from(satisfied);
}

/** The full sub-asset list for the current Machine Config — casings' stage
 * groups, DGS, Mechanical, Oil System, Turbines, Surface Condensers. */
export function generateSubAssets(mc: MachineConfig): GeneratedSubAsset[] {
  const items: GeneratedSubAsset[] = [];

  (mc.casings || []).slice(0, mc.numCasings || 0).forEach((casing, ci) => {
    const casingName = casing.name || `Casing ${ci + 1}`;
    const slug = slugify(casingName);
    buildStageGroups(casing).forEach((grp) => {
      const seq = casing.stageEquipment[stageGroupEquipmentKey(grp)];
      items.push({
        id: "stage_" + grp.join("_"),
        label: stageGroupLabel(grp),
        groupId: "process_stages",
        groupLabel: "Process Stages",
        sensorTemplate: filterByShowWhen(STAGE_TPL, { stageEquipment: seq }),
        oemTemplate: filterByShowWhen(OEM_STAGE_TPL, { stageEquipment: seq }),
        tripLimitTemplate: filterByShowWhen(TRIP_STAGE_TPL, { stageEquipment: seq }),
      });
    });
    items.push({
      id: "dgs_" + slug,
      label: `${casingName} DGS`,
      groupId: "dgs",
      groupLabel: "Dry Gas Seal",
      sensorTemplate: filterByShowWhen(DGS_TPL, { casing }),
      oemTemplate: filterByShowWhen(OEM_DGS_TPL, { casing }),
      tripLimitTemplate: filterByShowWhen(TRIP_DGS_TPL, { casing }),
    });
    items.push({
      id: "mech_" + slug,
      label: `${casingName} Mechanical`,
      groupId: "mechanical",
      groupLabel: "Mechanical",
      sensorTemplate: filterByShowWhen(MECH_TPL, { casing }),
      oemTemplate: filterByShowWhen(OEM_MECH_TPL, { casing }),
      tripLimitTemplate: filterByShowWhen(TRIP_MECH_TPL, { casing }),
    });
  });

  items.push({
    id: "oil_system",
    label: "Oil System",
    groupId: "oil_system",
    groupLabel: "Oil System",
    sensorTemplate: filterByShowWhen(OIL_TPL, { mc }),
    oemTemplate: filterByShowWhen(OEM_OIL_TPL, { mc }),
    tripLimitTemplate: filterByShowWhen(TRIP_OIL_TPL, { mc }),
  });

  if (mc.driverType === "steam_turbine" && (mc.numTurbines || 0) > 0) {
    let condenserCount = 0;
    (mc.turbines || []).slice(0, Number(mc.numTurbines)).forEach((tb, ti) => {
      items.push({
        id: "turbine_" + (ti + 1),
        label: `Turbine ${ti + 1}`,
        groupId: "turbine",
        groupLabel: "Turbine",
        sensorTemplate: filterByShowWhen(TURB_TPL, { turbine: tb }),
        oemTemplate: filterByShowWhen(OEM_TURB_TPL, { turbine: tb }),
        tripLimitTemplate: filterByShowWhen(TRIP_TURB_TPL, { turbine: tb }),
      });
      if ((tb.auxiliarySystems || []).includes("surface_condenser") && tb.surfaceCondenserCount) {
        const cnt =
          typeof tb.surfaceCondenserCount === "number"
            ? tb.surfaceCondenserCount
            : parseInt(String(tb.surfaceCondenserCount), 10) || 1;
        const pumpCnt =
          typeof tb.surfaceCondenserPumpCount === "number"
            ? tb.surfaceCondenserPumpCount
            : parseInt(String(tb.surfaceCondenserPumpCount), 10) || 0;
        const scTpl = filterByShowWhen(pumpCnt > 0 ? condTplForPumpCount(pumpCnt) : COND_TPL, { turbine: tb });
        const scOemTpl = filterByShowWhen(pumpCnt > 0 ? oemCondTplForPumpCount(pumpCnt) : OEM_COND_TPL, { turbine: tb });
        const scTripTpl = filterByShowWhen(TRIP_COND_TPL, { turbine: tb });
        for (let sci = 0; sci < cnt; sci++) {
          condenserCount++;
          items.push({
            id: "surface_condenser_" + condenserCount,
            label: `Surface Condenser ${condenserCount}`,
            groupId: "surface_condenser",
            groupLabel: "Surface Condenser",
            sensorTemplate: scTpl,
            oemTemplate: scOemTpl,
            tripLimitTemplate: scTripTpl,
          });
        }
      }
    });
  }

  return items;
}
