import { atom } from "jotai";
import { SYSTEM_NAME } from "../Constants";
import type {
  BlueprintState,
  HierarchyState,
  SensorsState,
  KpiState,
  AttributeRow,
  UomRow,
  ConstraintRow,
  QuestionRow,
  CalcAlternativeGroup,
  BlueprintResponse,
  SensorMappingRow,
  DraftConfigPayload,
  UomCatalog,
} from "../types/Index";
import {
  loadCurrentBlueprintAction,
  uploadBlueprintAction,
  createBlueprintAction,
  updateAttributesAction,
  updateUomAction,
  updateConstraintsAction,
  updateQuestionsAction,
  validateBlueprintAction,
  listSavedBlueprintsAction,
  saveBlueprintAsAction,
  loadSavedBlueprintAction,
  getWizardStateAction,
  navigateWizardAction,
  submitWizardAnswerAction,
  updateWizardCountAction,
  configureElementAction,
  deleteElementAction,
  buildHierarchyAction,
  loadHierarchyAction,
  resetHierarchyAction,
  newPlantResetAction,
  uploadHierarchyConfigAction,
  getSensorMappingAction,
  updateSensorMappingAction,
  uploadSensorMappingAction,
  uploadPipelineInputAction,
  updateCalcOverridesAction,
  getCalcBlueprintAction,
  getCalcOptionalityAction,
  getCalcRequirementsAction,
  getKpiPackagesAction,
  hydrateConfigAction,
  serializeConfigAction,
  saveDraftAction,
  submitFinalConfigAction,
} from "../actions/Index";

// ── Instance ID atom (set by Shell.tsx on mount) ───────────────────────────────
export const instanceIdAtom = atom<number>(0);

// ── Default states ─────────────────────────────────────────────────────────────

const defaultBlueprintState: BlueprintState = {
  attributes: [],
  uom: [],
  constraints: [],
  questions: [],
  summary: null,
  errors: [],
  warnings: [],
  isLoaded: false,
  isLoading: true,
};

const defaultHierarchyState: HierarchyState = {
  root: null,
  flatNodes: [],
  wizardState: null,
  databaseName: "",
};

const defaultSensorsState: SensorsState = {
  mappingRows: [],
  coverage: { total: 0, mapped: 0, unmapped: 0 },
  selectedNodeLabel: "",
};

const defaultKpiState: KpiState = {
  calcBlueprintData: null,
  packages: [],
  calcOptionality: [],
  calcRequirements: {},
  calcRequirementsLoading: false,
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function applyBlueprintResponse(data: BlueprintResponse): Partial<BlueprintState> {
  return {
    attributes: data.attributes ?? [],
    uom: data.uom ?? [],
    constraints: data.constraints ?? [],
    questions: data.questions ?? [],
    summary: data.summary ?? null,
    errors: data.errors ?? [],
    warnings: data.warnings ?? [],
    isLoaded: true,
    isLoading: false,
  };
}

// ── Base atoms ─────────────────────────────────────────────────────────────────

export const activeTabAtom = atom<number>(0);

// Instance's Plant name (resolved server-side from the hierarchy_master chain in page.tsx
// and seeded by the Shell). The single source for the "Plant:" label across the dashboard.
export const plantNameAtom = atom<string>("");

export const blueprintAtom = atom<BlueprintState>(defaultBlueprintState);
export const hierarchyAtom = atom<HierarchyState>(defaultHierarchyState);
export const sensorsAtom = atom<SensorsState>(defaultSensorsState);
export const kpiAtom = atom<KpiState>(defaultKpiState);

export const savedBlueprintsAtom = atom<string[]>([]);
export const requiresHierarchyConfirmationAtom = atom<boolean>(false);

// Active UOM catalog (grouped by category), fetched via Prisma in page.tsx and seeded by
// the Shell. An attribute's selectable units are `uomCatalogAtom[category]`, where the
// category is the attribute's row in `blueprintAtom.uom` (the 2-col UOM Reference sheet).
export const uomCatalogAtom = atom<UomCatalog>({});

// ── Draft autosave state ────────────────────────────────────────────────────────
// `dirtyAtom` is flipped true by every atom that mutates persisted config (hierarchy
// tree, sensor mapping, calc overrides). `useDraftAutosave` flushes when dirty and
// resets it. `saveStatusAtom` drives the "Saving…/Saved" indicator in the tabs.
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export const dirtyAtom = atom<boolean>(false);
export const saveStatusAtom = atom<SaveStatus>("idle");

/**
 * Persist the live config to the instance's draft row. Single source of the save
 * logic — `useDraftAutosave` calls it (dirty-guarded, debounced, on tab hide) and
 * the "Save now" button calls it with `force` to save on demand. Snapshots the
 * FastAPI session via serialize, then upserts `instance_configuration_drafts`.
 */
export const flushDraftAtom = atom(null, async (get, set, force?: boolean) => {
  const id = get(instanceIdAtom);
  if (!id) return;
  if (!force && !get(dirtyAtom)) return; // dirty-guard (autosave path only)
  set(dirtyAtom, false);
  try {
    set(saveStatusAtom, "saving");
    const payload = await serializeConfigAction(id);
    if (!payload.systemConfig) {
      // Nothing built yet — nothing worth persisting.
      set(saveStatusAtom, "idle");
      return;
    }
    await saveDraftAction(id, payload as unknown as Record<string, unknown>);
    set(saveStatusAtom, "saved");
  } catch {
    set(dirtyAtom, true); // leave dirty so the next tick retries
    set(saveStatusAtom, "error");
  }
});
/**
 * Final submission (snapshot). Per doc `05`: flush the live draft first so the
 * snapshot reflects the latest state, then upsert `instance_configurations`
 * (system-config JSON + EFF-output Excel bytes) and clear the draft. Drives the
 * "Submit / Finalize" control in the info bar.
 */
export type SubmitStatus = "idle" | "submitting" | "submitted" | "error";
export const submitStatusAtom = atom<SubmitStatus>("idle");
export const submitFinalConfigAtom = atom(null, async (get, set): Promise<boolean> => {
  const id = get(instanceIdAtom);
  if (!id) return false;
  try {
    set(submitStatusAtom, "submitting");
    // Doc `05`: flush the draft first so submit uses the latest edits.
    await set(flushDraftAtom, true);
    await submitFinalConfigAction(id);
    set(submitStatusAtom, "submitted");
    return true;
  } catch {
    set(submitStatusAtom, "error");
    return false;
  }
});
// ── Mapping fulfilment (shared by the mandatory-KPI flag and the Model Config
// per-attribute readiness) ───────────────────────────────────────────────────────
const hasMappedValue = (row: SensorMappingRow): boolean => {
  const hasText = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
  return hasText(row.sensor_name) || hasText(row.constant_value) || hasText(row.formula);
};

const mappedAttrSet = (sensors: SensorsState): Set<string> =>
  new Set(
    sensors.mappingRows
      .filter(hasMappedValue)
      .map((row) => String(row.attribute ?? "").trim())
      .filter(Boolean)
  );

/** Is a single calc's mandatory input set satisfied? The same rule the KPI
 *  Applicability tab uses: a calc-override row counts when it has any value;
 *  otherwise every required sensor attribute must be mapped, with each
 *  auto-alternative group satisfied by ≥1 fully-mapped option. Returns false when
 *  the calc's requirements haven't loaded yet. */
const isCalcFulfilled = (
  calcName: string,
  kpi: KpiState,
  sensors: SensorsState,
  mappedAttrs: Set<string>,
): boolean => {
  const req = kpi.calcRequirements[calcName];
  if (!req) return false;

  const overrideRows = sensors.mappingRows.filter(
    (row) => !!row._is_calc_override && String(row.attribute ?? "").trim() === calcName
  );
  if (overrideRows.length > 0) return overrideRows.some(hasMappedValue);

  const requiredPaths = req.required_sensor_paths ?? [];
  const autoAlternatives = req.auto_sensor_alternatives ?? [];
  if (req.required.length === 0 && requiredPaths.length === 0 && autoAlternatives.length === 0) return true;

  const altAttrs = new Set<string>();
  for (const group of autoAlternatives) {
    const optionSatisfied = (group.options ?? []).some((opt) =>
      (opt.sensors ?? []).every((attr) => mappedAttrs.has(String(attr).trim()))
    );
    if (!optionSatisfied) return false;
    for (const opt of group.options ?? []) {
      for (const attr of opt.sensors ?? []) altAttrs.add(String(attr).trim());
    }
  }

  const requiredAttrs = [...new Set(requiredPaths.map((sp) => String(sp.attr).trim()))].filter(
    (attr) => attr && !altAttrs.has(attr)
  );
  return requiredAttrs.every((attr) => mappedAttrs.has(attr));
};

export const mandatoryKpiPackageStatusAtom = atom<{ fulfilled: boolean; readyCount: number; total: number } | null>(null);
export const mandatoryKpiFulfilledAtom = atom((get) => {
  const kpi = get(kpiAtom);
  const sensors = get(sensorsAtom);
  const mandatoryCalcs = kpi.packages.flatMap((p) => p.mandatory_calcs ?? []);
  if (mandatoryCalcs.length === 0) return true;
  if (Object.keys(kpi.calcRequirements).length === 0) return false;
  const mappedAttrs = mappedAttrSet(sensors);
  return mandatoryCalcs.every((calcName) => isCalcFulfilled(calcName, kpi, sensors, mappedAttrs));
});

/** Per-calc readiness, published verbatim by the KPI Applicability tab (its own
 *  computed `calcStatus`, which folds in level groups, alternatives, cross-level
 *  verdicts and absent elements). Other views read this so their status MATCHES that
 *  tab exactly instead of re-deriving it. Empty until that tab has computed once. */
export type CalcStatus = "ready" | "partial" | "insufficient" | "no_data";
export const calcStatusAtom = atom<Record<string, CalcStatus>>({});

/** Per-attribute readiness resolver for the Model Config "model ready" boxes — one
 *  layer beyond resolution. A computed attribute reflects the KPI Applicability tab's
 *  calc status verbatim (via calcStatusAtom); a raw input attribute is "mapped" when it
 *  has a value. "na" = nothing to map/fulfil (a pure constant/derived tag, a calc with
 *  no required sensors, or an attribute the KPI tab hasn't computed yet). */
export type AttrFulfillment = "mapped" | "unmapped" | "fulfilled" | "partial" | "inputs-missing" | "na";
export const attributeFulfillmentAtom = atom((get) => {
  const sensors = get(sensorsAtom);
  const calcStatus = get(calcStatusAtom);
  const mappedAttrs = mappedAttrSet(sensors);
  const inputAttrs = new Set(
    sensors.mappingRows.map((row) => String(row.attribute ?? "").trim()).filter(Boolean)
  );
  return (attribute: string): AttrFulfillment => {
    const a = String(attribute ?? "").trim();
    if (!a) return "na";
    // Computed attribute → mirror the KPI Applicability tab's calc status verbatim.
    const cs = calcStatus[a];
    if (cs) {
      return cs === "ready" ? "fulfilled"
        : cs === "partial" ? "partial"
        : cs === "insufficient" ? "inputs-missing"
        : "na"; // no_data → the calc has no required sensors to fulfil
    }
    // Raw input attribute → mapped when it has a value.
    if (inputAttrs.has(a)) return mappedAttrs.has(a) ? "mapped" : "unmapped";
    return "na";
  };
});

// ── Blueprint write atoms ──────────────────────────────────────────────────────

const safeName = (s: string) => s.replace(/[^\w\-]/g, "_").replace(/^_+|_+$/g, "");

export const loadDefaultBlueprintAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  set(blueprintAtom, (prev) => ({ ...prev, isLoading: true }));
  try {
    const data = await loadSavedBlueprintAction(id, `Blueprint_${safeName(SYSTEM_NAME)}.xlsx`);
    set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(data) }));
  } catch {
    try {
      const data = await loadCurrentBlueprintAction(id);
      set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(data) }));
    } catch (e) {
      console.error("Failed to load blueprint", e);
      set(blueprintAtom, (prev) => ({ ...prev, isLoading: false }));
    }
  }
});

/**
 * Rehydrate the session from a stored draft/snapshot payload (resume loader).
 * Replays the payload into the FastAPI session then mirrors the restored tree into
 * the hierarchy atom. This is a LOAD, not an edit — it deliberately does not set
 * `dirtyAtom`, so resuming a draft never triggers a redundant autosave.
 */
export const hydrateFromDraftAtom = atom(null, async (get, set, payload: DraftConfigPayload) => {
  const id = get(instanceIdAtom);
  const res = await hydrateConfigAction(id, payload);
  if (!res.hydrated || !res.root) return;
  const wizardData = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({
    ...prev,
    root: res.root as HierarchyState["root"],
    flatNodes: (res.flatNodes ?? []) as HierarchyState["flatNodes"],
    databaseName: res.databaseName || "",
    wizardState: wizardData as HierarchyState["wizardState"],
  }));
});

/**
 * Build a downloadable system-config JSON for the current instance. Returns the
 * `systemConfig` object (`{database, systemName, exportedAt, hierarchy}`) — the
 * exact shape `upload-config` accepts — plus a derived filename, so a downloaded
 * file round-trips back in via the Load control. Returns null if nothing is built.
 */
export const downloadSystemConfigAtom = atom(null, async (get): Promise<{ json: string; filename: string } | null> => {
  const id = get(instanceIdAtom);
  if (!id) return null;
  const payload = await serializeConfigAction(id);
  if (!payload.systemConfig) return null;
  const sc = payload.systemConfig as Record<string, unknown>;
  const slug = (s: unknown) => String(s ?? "").replace(/[^\w\-]/g, "_").replace(/^_+|_+$/g, "");
  const filename = `system_config_${slug(sc.systemName) || "config"}_${slug(sc.database)}.json`;
  return { json: JSON.stringify(sc, null, 2), filename };
});

export const uploadBlueprintAtom = atom(null, async (get, set, file: File) => {
  const id = get(instanceIdAtom);
  const formData = new FormData();
  formData.append("file", file);
  const data = await uploadBlueprintAction(id, formData);
  set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(data) }));
});

export const createBlueprintAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const data = await createBlueprintAction(id);
  set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(data) }));
});

export const updateAttributesAtom = atom(null, async (get, set, rows: AttributeRow[]) => {
  const id = get(instanceIdAtom);
  await updateAttributesAction(id, rows);
  set(blueprintAtom, (prev) => ({ ...prev, attributes: rows }));
  const validation = await validateBlueprintAction(id);
  set(blueprintAtom, (prev) => ({ ...prev, ...validation }));
});

export const updateUomAtom = atom(null, async (get, set, rows: UomRow[]) => {
  const id = get(instanceIdAtom);
  await updateUomAction(id, rows);
  set(blueprintAtom, (prev) => ({ ...prev, uom: rows }));
});

export const updateConstraintsAtom = atom(null, async (get, set, rows: ConstraintRow[]) => {
  const id = get(instanceIdAtom);
  await updateConstraintsAction(id, rows);
  set(blueprintAtom, (prev) => ({ ...prev, constraints: rows }));
  const validation = await validateBlueprintAction(id);
  set(blueprintAtom, (prev) => ({ ...prev, ...validation }));
});

export const updateQuestionsAtom = atom(null, async (get, set, rows: QuestionRow[]) => {
  const id = get(instanceIdAtom);
  await updateQuestionsAction(id, rows);
  set(blueprintAtom, (prev) => ({ ...prev, questions: rows }));
});

export const refreshSavedBlueprintsAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  try {
    const data = await listSavedBlueprintsAction(id);
    set(savedBlueprintsAtom, data.files);
  } catch { /* ignore */ }
});

export const saveCurrentBlueprintAtom = atom(null, async (get, set): Promise<{ filename: string; systemName: string }[]> => {
  const id = get(instanceIdAtom);
  const res = await saveBlueprintAsAction(id);
  try {
    const data = await listSavedBlueprintsAction(id);
    set(savedBlueprintsAtom, data.files);
  } catch { /* ignore */ }
  return res.saved;
});

export const loadSavedBlueprintAtom = atom(null, async (get, set, args: { filename: string; opts?: { system?: string; merge?: boolean } }) => {
  const id = get(instanceIdAtom);
  const data = await loadSavedBlueprintAction(id, args.filename, args.opts);
  set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(data) }));
});

// ── Hierarchy write atoms ──────────────────────────────────────────────────────

export const loadWizardStateAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const data = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const navigateWizardAtom = atom(null, async (
  get, set,
  args: { mode: string; activeElement?: string; elementStep?: number; instanceIdx?: number }
) => {
  const id = get(instanceIdAtom);
  const data = await navigateWizardAction(id, args.mode, args.activeElement, args.elementStep, args.instanceIdx);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const submitWizardAnswerAtom = atom(null, async (
  get, set,
  args: { questionId: string; elementLevel: string; answer: string; instIdx?: number }
) => {
  const id = get(instanceIdAtom);
  const data = await submitWizardAnswerAction(id, args.questionId, args.elementLevel, args.answer, args.instIdx);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const updateWizardCountAtom = atom(null, async (
  get, set,
  args: { parentLevel: string; childLevel: string; delta: number; elLevel?: string; instIdx?: number }
) => {
  const id = get(instanceIdAtom);
  await updateWizardCountAction(id, args.parentLevel, args.childLevel, args.delta, args.elLevel, args.instIdx);
  const data = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const configureElementAtom = atom(null, async (get, set, elementLevel: string) => {
  const id = get(instanceIdAtom);
  const data = await configureElementAction(id, elementLevel);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const deleteElementAtom = atom(null, async (get, set, elementLevel: string) => {
  const id = get(instanceIdAtom);
  const data = await deleteElementAction(id, elementLevel);
  set(hierarchyAtom, (prev) => ({ ...prev, wizardState: data as HierarchyState["wizardState"] }));
});

export const buildHierarchyAtom = atom(null, async (get, set, rootName?: string) => {
  const id = get(instanceIdAtom);
  const data = await buildHierarchyAction(id, rootName);
  const wizardData = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({
    ...prev,
    root: data.root,
    flatNodes: data.flatNodes,
    wizardState: wizardData as HierarchyState["wizardState"],
  }));
  set(dirtyAtom, true);
});

export const loadHierarchyAtom = atom(null, async (get, set, file: File) => {
  const id = get(instanceIdAtom);
  const formData = new FormData();
  formData.append("file", file);
  const data = await loadHierarchyAction(id, formData) as { root: HierarchyState["root"]; flatNodes: HierarchyState["flatNodes"]; databaseName?: string };
  const wizardData = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({
    ...prev,
    root: data.root,
    flatNodes: data.flatNodes,
    databaseName: data.databaseName || "",
    wizardState: wizardData as HierarchyState["wizardState"],
  }));
  set(dirtyAtom, true);
});

export const resetHierarchyAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const data = await resetHierarchyAction(id);
  set(hierarchyAtom, { ...defaultHierarchyState, wizardState: data as HierarchyState["wizardState"] });
  set(dirtyAtom, true);
});

export const newPlantResetAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const data = await newPlantResetAction(id);
  set(hierarchyAtom, { ...defaultHierarchyState, wizardState: data as HierarchyState["wizardState"] });
  set(sensorsAtom, defaultSensorsState);
  set(kpiAtom, (prev) => ({
    ...prev,
    calcRequirements: {},
    calcRequirementsLoading: false,
  }));
  set(dirtyAtom, true);
});

export const confirmHierarchyAtom = atom(null, (_get, set) => {
  set(requiresHierarchyConfirmationAtom, false);
});

export const uploadHierarchyConfigAtom = atom(null, async (
  get, set,
  file: File
): Promise<{ savedAs: string; blueprintLoaded: boolean }> => {
  const id = get(instanceIdAtom);
  const formData = new FormData();
  formData.append("file", file);
  const data = await uploadHierarchyConfigAction(id, formData);
  const wizardData = await getWizardStateAction(id);
  set(hierarchyAtom, (prev) => ({
    ...prev,
    root: data.root,
    flatNodes: data.flatNodes,
    databaseName: data.databaseName || "",
    wizardState: wizardData as HierarchyState["wizardState"],
  }));
  if (data.blueprintLoaded) {
    try {
      const bp = await loadCurrentBlueprintAction(id);
      set(blueprintAtom, (prev) => ({ ...prev, ...applyBlueprintResponse(bp) }));
    } catch { /* ignore */ }
  }
  try {
    const calcData = await getCalcBlueprintAction(id) as { data: KpiState["calcBlueprintData"]; source: string };
    set(kpiAtom, (prev) => ({ ...prev, calcBlueprintData: calcData.data }));
  } catch { /* ignore */ }
  set(requiresHierarchyConfirmationAtom, true);
  return { savedAs: data.savedAs, blueprintLoaded: data.blueprintLoaded };
});

// ── Sensor write atoms ─────────────────────────────────────────────────────────

export const loadSensorMappingAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const data = await getSensorMappingAction(id);
  set(sensorsAtom, (prev) => ({ ...prev, mappingRows: data.rows, coverage: data.coverage }));
});

export const updateSensorMappingAtom = atom(null, async (get, set, rows: SensorsState["mappingRows"]) => {
  const id = get(instanceIdAtom);
  const res = await updateSensorMappingAction(id, rows) as { coverage?: SensorsState["coverage"] };
  set(sensorsAtom, (prev) => ({
    ...prev,
    mappingRows: rows,
    coverage: res.coverage ?? prev.coverage,
  }));
  set(dirtyAtom, true);
});

export const uploadSensorMappingAtom = atom(null, async (
  get, set,
  file: File
): Promise<{ report: { matched: number; skipped: number; total_template: number } }> => {
  const id = get(instanceIdAtom);
  const formData = new FormData();
  formData.append("file", file);
  const res = await uploadSensorMappingAction(id, formData);
  set(sensorsAtom, (prev) => ({ ...prev, mappingRows: res.rows ?? [], coverage: res.coverage ?? prev.coverage }));
  set(dirtyAtom, true);
  return { report: res.report };
});

export const uploadPipelineInputAtom = atom(null, async (
  get, set,
  file: File
): Promise<{ report: { matched: number; skipped: number; total_template: number } }> => {
  const id = get(instanceIdAtom);
  const formData = new FormData();
  formData.append("file", file);
  const res = await uploadPipelineInputAction(id, formData);
  set(sensorsAtom, (prev) => ({ ...prev, mappingRows: res.rows ?? [], coverage: res.coverage ?? prev.coverage }));
  set(dirtyAtom, true);
  return { report: res.report };
});

export const setSelectedNodeAtom = atom(null, (_get, set, label: string) => {
  set(sensorsAtom, (prev) => ({ ...prev, selectedNodeLabel: label }));
});

export const updateCalcOverridesAtom = atom(null, async (
  get, set,
  overrides: { elementPath: string; elementCode: string; outputAttrName: string; enabled: boolean }[]
) => {
  const id = get(instanceIdAtom);
  await updateCalcOverridesAction(id, overrides);
  const data = await getSensorMappingAction(id);
  set(sensorsAtom, (prev) => ({ ...prev, mappingRows: data.rows, coverage: data.coverage }));
  set(dirtyAtom, true);
});

// ── KPI / pipeline write atoms ─────────────────────────────────────────────────

export const ensureCalcBlueprintAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  if (get(kpiAtom).calcBlueprintData) return;
  try {
    const data = await getCalcBlueprintAction(id, SYSTEM_NAME) as { data: KpiState["calcBlueprintData"] };
    set(kpiAtom, (prev) => ({ ...prev, calcBlueprintData: data.data }));
  } catch { /* ignore */ }
});

export const loadCalcOptionalityAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  try {
    const resp = await getCalcOptionalityAction(id);
    const groups = Array.isArray(resp?.sensor_alternatives)
      ? (resp.sensor_alternatives as CalcAlternativeGroup[])
      : [];
    set(kpiAtom, (prev) => ({ ...prev, calcOptionality: groups }));
  } catch {
    set(kpiAtom, (prev) => ({ ...prev, calcOptionality: [] }));
  }
});

export const loadCalcRequirementsAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  const state = get(kpiAtom);
  if (state.calcRequirementsLoading) return;
  set(kpiAtom, (prev) => ({ ...prev, calcRequirementsLoading: true }));
  try {
    const data = await getCalcRequirementsAction(id);
    set(kpiAtom, (prev) => ({
      ...prev,
      calcRequirements: (data.requirements ?? {}) as KpiState["calcRequirements"],
      calcRequirementsLoading: false,
    }));
  } catch {
    set(kpiAtom, (prev) => ({ ...prev, calcRequirementsLoading: false }));
  }
});

export const loadKpiPackagesAtom = atom(null, async (get, set) => {
  const id = get(instanceIdAtom);
  await set(ensureCalcBlueprintAtom);
  const data = await getKpiPackagesAction(id);
  set(kpiAtom, (prev) => ({ ...prev, packages: data.packages }));
});
