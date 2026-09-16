import { atom } from "jotai";
import type { EgConfigData, EgConfigRecord, ExpandedKpi, AdditionalInput, SoftSensor, ModelFileEntry } from "./Types";

const defaultConfig: EgConfigData = {
  // General
  configName: "",
  plantCapacity: "",
  commissioningYear: "",
  techLicensor: "",
  waterToEORatio: "",

  // Steam headers
  numSteamHeaders: 1,
  steamHeaders: [{ headerLabel: "HP Steam", isSuperheated: "no" }],

  // Equipment selection
  eq_hasGFS: "no",
  eq_gfsArrangement: "",

  // Stripping Column
  sc_columnType: "",
  sc_hasReboiler: "no",
  sc_reboilerFreshSteam: "no",
  sc_reboilerMedium: "",
  sc_hasDirectSteam: "no",
  sc_directSteamFreshSteam: "no",
  sc_numDirectSteam: 0,
  sc_directSteamInputs: [],
  sc_hasBottomBleed: "no",

  // Reabsorber
  ra_columnType: "",
  ra_absorptionMedium: "",
  ra_absorptionMediumOther: "",
  ra_hasIntercooler: "no",
  ra_intercoolerMedium: "",
  ra_intercoolerMediumOther: "",
  ra_hasAftercooler: "no",
  ra_aftercoolerFreshSteam: "no",
  ra_aftercoolerSource: "",
  ra_aftercoolerSourceOther: "",

  // Integrated Column
  int_columnType: "",
  int_absorptionMedium: "",
  int_absorptionMediumOther: "",
  int_hasIntercooler: "no",
  int_intercoolerMedium: "",
  int_intercoolerMediumOther: "",
  int_hasReboiler: "no",
  int_reboilerFreshSteam: "no",
  int_reboilerMedium: "",
  int_hasDirectSteam: "no",
  int_directSteamFreshSteam: "no",
  int_numDirectSteam: 0,
  int_directSteamInputs: [],
  int_strippingPurpose: "",
  int_overheadVent: "",

  // GFS Separate
  gfs_columnType: "",
  gfs_hasReboiler: "no",
  gfs_reboilerFreshSteam: "no",
  gfs_reboilerMedium: "",
  gfs_hasDirectSteam: "no",
  gfs_directSteamFreshSteam: "no",
  gfs_numDirectSteam: 0,
  gfs_directSteamInputs: [],
  gfs_strippingPurpose: "",
  gfs_overheadVent: "",

  // Feed Preheat Exchangers
  fpe_numExchangers: 1,
  fpe_exchangers: [{ freshSteam: "no", heatSource: "", heatSourceOther: "", exchangerType: "" }],

  // Glycol Reactor
  gr_reactorType: "",
  gr_numReactors: 1,
  gr_heatRecovered: "no",
  gr_heatRecoverySinks: [],
  gr_numInterstage: 0,

  // Evaporation System
  ev_numEffects: 1,
  ev_flowArrangement: "",
  ev_firstEffectFreshSteam: "no",
  ev_firstEffectSource: "",
  ev_hasMVR: "no",
  ev_mvrEffect: 1,
  ev_hasTVR: "no",
  ev_tvrEffect: 1,
  ev_condensateFlash: "no",

  // Other Energy Sensitive Equipment
  oe_hasOther: "no",
  oe_numEquipment: 0,
  oe_equipment: [],

  // Mappings
  output_kpis: {},
  additional_inputs: {},
  soft_sensor_mappings: {},
  forecast_config: {},
};

export const currentStepAtom = atom<string>("general");

export const expandedKpiIdAtom = atom<string | null>(null);

export const configIdAtom = atom<number | null>(null);

export const configDataAtom = atom<EgConfigData>(defaultConfig);

export const configRecordAtom = atom<EgConfigRecord | null>(null);

export const kpiListAtom = atom<ExpandedKpi[]>([]);

export const additionalInputsListAtom = atom<AdditionalInput[]>([]);

export const softSensorsListAtom = atom<SoftSensor[]>([]);

export const wizardDirtyAtom = atom<boolean>(false);

export const wizardSavingAtom = atom<boolean>(false);

export const kpiMtimeAtom = atom<number>(0);

// ── Draft autosave state ───────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Drives the header save-status chip. */
export const saveStatusAtom = atom<SaveStatus>("idle");

/** True once the draft/snapshot has been hydrated into configData on mount. */
export const draftLoadedAtom = atom<boolean>(false);

/** ISO timestamp of the restored draft (for a "Restored from …" note); null if none. */
export const draftUpdatedAtAtom = atom<string | null>(null);

/** Set to true after final step "Submit & Finish" succeeds — drives sidebar completion and success modal. */
export const wizardCompletedAtom = atom<boolean>(false);

/** ISO timestamp of the final submission — shown in the success modal. */
export const wizardCompletedAtAtom = atom<string | null>(null);

/** UOM bank loaded from FastAPI on wizard mount — { symbol, category }[] */
export const uomBankAtom = atom<{ symbol: string; category: string }[]>([]);

/** Registry of .pkl file entries — serialisable metadata (no binary).
 *  Entries with state "new" are pushed to output.model_files_registry on Step 5 submit. */
export const modelFilesRegistryAtom = atom<ModelFileEntry[]>([]);

/** Actual File objects keyed by file_name — session-only, not serialisable. */
export const pklFilesAtom = atom<Record<string, File>>({});

/** LBM sheet data loaded (and optionally edited) in Step 5.
 *  Set by ExportConfig; read by WizardShell at Submit & Finish to write into config_data. */
export type LbmSheetData = { headers: string[]; rows: Record<string, string | number | boolean | null>[] };
export const lbmOverridesAtom = atom<Record<string, LbmSheetData> | null>(null);
