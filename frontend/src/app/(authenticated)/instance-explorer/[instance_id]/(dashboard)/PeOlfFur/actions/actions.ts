"use server";

import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/shared/libs/Prisma";
import type { ExportRow, TreeRow } from "../constants/ExportUtils";

// JSON is the primary, authoritative source for everything the app reads and
// relays. UI_Export.xlsx is written too, but only as a backend mirror so the
// (xlsx-consuming) Package_Processor tooling keeps working. The canonical data
// folder is the new pipeline's Part B KPI_calc_DB_B that paths.py → DATA_DIR resolves:
//   services/app/routers/PeOlfFur/furnaceProductApp/pipeline/KPI_calc_DB_B/database/Current/
// Per-instance data dir (doc 02): the Current/ dir under this instance's private
// KPI_calc_DB_B (_instances/<id>/...) — the same layout instance_env.py seeds and
// inputSheetIo.ts uses, so the UI writes case data where the per-instance pipeline
// reads it. A null instanceId falls back to the shared single-tenant KPI_calc_DB_B.
const PIPELINE_SEG = ["services", "app", "routers", "PeOlfFur", "furnaceProductApp", "pipeline"];
function currentDir(instanceId: number | null): string {
  const kpiRoot = instanceId != null
    ? path.join(process.cwd(), ...PIPELINE_SEG, "_instances", String(instanceId), "KPI_calc_DB_B")
    : path.join(process.cwd(), ...PIPELINE_SEG, "KPI_calc_DB_B");
  return path.join(kpiRoot, "database", "Current");
}
const FILE_NAME = "UI_Export.xlsx";
const DRAFT_FILE_NAME = "UI_Export_Draft.xlsx";

// ── instance_id validation (doc 02) ───────────────────────────────────────────
// URL-sourced + user-editable, so validate before any DB call. A null instanceId
// means no instance is in context (single-tenant local fallback): DB reads report
// "nothing recorded" and DB writes are skipped, so the disk path still works.
const InstanceIdSchema = z.number().int().positive();
function validInstance(instanceId: number | null): number | null {
  if (instanceId == null) return null;
  return InstanceIdSchema.parse(instanceId);
}

// ── Per-instance DB persistence (docs 04/05/07) ───────────────────────────────
// The UI-owned config sections live in the ONE draft row
// (instance_configuration_drafts.draft_data.<key>) and, on Confirm, the ONE
// snapshot row (instance_configurations.ui_config_data.<key>). Mirrors
// InputSheetActions.ts: writes are surgical (read row → set only <key> → write
// back) so the hub / pkgKpi / inputSheet sections never clobber one another. Disk
// (UI_Export.json/.xlsx) stays the pipeline's input; the DB is the UI's source of
// truth — the read actions below are DB-only (doc 04 resume precedence).
interface HubSection { fms: UserSetupRow[]; tree: Record<string, unknown>[] }

async function upsertDraftSection(instanceId: number, key: string, data: unknown): Promise<void> {
  const existing = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: instanceId } });
  const current = (existing?.draft_data as Record<string, unknown> | null) || {};
  const merged = { ...current, [key]: data } as unknown as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      data: { draft_data: merged },
    });
  } else {
    await prisma.instance_configuration_drafts.create({ data: { instance_id: instanceId, draft_data: merged } });
  }
}

async function readDraftSection<T>(instanceId: number, key: string): Promise<T | null> {
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: instanceId } });
  const section = (draft?.draft_data as Record<string, unknown> | null)?.[key];
  return (section as T | undefined) ?? null;
}

async function upsertConfigSection(instanceId: number, key: string, data: unknown): Promise<void> {
  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId } });
  const current = (existing?.ui_config_data as Record<string, unknown> | null) || {};
  const merged = { ...current, [key]: data } as unknown as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data: { ui_config_data: merged },
    });
  } else {
    // pipeline_config_data is non-null bytes: seed from the on-disk UI_Export.xlsx
    // the disk path wrote just above (mirrors InputSheetActions.ts).
    const uiExport = path.join(currentDir(instanceId), FILE_NAME);
    const bytes = fs.existsSync(uiExport) ? await fs.promises.readFile(uiExport) : Buffer.alloc(0);
    await prisma.instanceConfiguration.create({
      data: { instanceId, pipeline_config_data: new Uint8Array(bytes), ui_config_data: merged },
    });
  }
}

async function readConfigSection<T>(instanceId: number, key: string): Promise<T | null> {
  const config = await prisma.instanceConfiguration.findFirst({ where: { instanceId } });
  const section = (config?.ui_config_data as Record<string, unknown> | null)?.[key];
  return (section as T | undefined) ?? null;
}

// ── The consolidated JSON "workbook" ─────────────────────────────────────────
// Instead of one JSON file per section (the old User_Setup_Response.json /
// Entity_Tree.json / Package_KPI_Selection.json split), the UI now writes ONE
// JSON that mirrors the multi-sheet UI_Export.xlsx: a single object whose keys
// are the SAME section names as the workbook's sheets. UI_Export.json is the
// primary read-model; UI_Export.xlsx is the secondary mirror. There is a draft
// counterpart (UI_Export_Draft.json) exactly as there is a draft xlsx.
//
// Sections are written SURGICALLY (upsertJsonSection): saving one section only
// replaces that key and leaves every other section byte-for-byte intact — the
// JSON analogue of editing one Excel sheet without disturbing the rest.
//
// Python is unaffected: Current_Packages.py regenerates the split
// User_Setup_Response.json / Entity_Tree.json from UI_Export.xlsx at pipeline
// start, so those remain pipeline-internal artifacts the UI no longer owns.
const JSON_FILE_NAME = "UI_Export.json";
const JSON_DRAFT_FILE_NAME = "UI_Export_Draft.json";

// Section keys — kept identical to the xlsx sheet names so the JSON is a literal
// 1:1 mirror of the workbook.
const SEC_FMS = "FMS State";
const SEC_TREE = "Entity_Tree";
const SEC_PKG = "Package_KPI_Selection";

// The mirrored xlsx sheet for the Package/KPI selection (flat Category|Item|Value).
const PKG_KPI_SHEET = "Package_KPI_Selection";

// A row of the FMS State section — the shape importFromRows consumes on Revert
// (it only needs Variable + Value, but we persist the full sheet schema).
export interface UserSetupRow {
  Variable: string;
  Value: string | number;
  Section: string;
  "Standard Variable": string;
}

type ExportResult =
  | { success: true; path: string }
  | { success: false; error: string };

type ReadRowsResult =
  | { success: true; rows: UserSetupRow[] }
  | { success: false; error: string };

// ── Consolidated-JSON helpers ────────────────────────────────────────────────
type JsonWorkbook = Record<string, unknown>;

// Read the whole consolidated JSON object (or {} when absent / malformed). A
// missing or corrupt file must never take down a section write.
function readJsonWorkbook(file: string): JsonWorkbook {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonWorkbook)
      : {};
  } catch {
    return {};
  }
}

// Surgical per-section write — the JSON analogue of upsertSheet(): read the whole
// workbook object, replace ONLY the named section, write it back. Every other
// section is preserved untouched, so saving one section never disturbs another
// (exactly how editing one Excel sheet leaves the rest intact).
function upsertJsonSection(file: string, section: string, data: unknown): void {
  const wb = readJsonWorkbook(file);
  wb[section] = data;
  fs.writeFileSync(file, JSON.stringify(wb, null, 2));
}

// Replace SEVERAL sections in a single pass, still preserving every other section.
function upsertJsonSections(file: string, sections: Record<string, unknown>): void {
  const wb = readJsonWorkbook(file);
  for (const [k, v] of Object.entries(sections)) wb[k] = v;
  fs.writeFileSync(file, JSON.stringify(wb, null, 2));
}

// ── helper.py activation ─────────────────────────────────────────────────────
// helper.py (pipeline/Package_Processor_Interaction) is the single source of
// truth for whether the .xlsx mirrors are written. When it is active the UI keeps
// JSON as the SOLE artifact — the .xlsx mirrors are transient files the Python
// helper materialises on demand — so Save/Confirm/Revert here write JSON only and
// delete any stale .xlsx. The env var PP_HELPER_ACTIVE overrides the file flag.
const HELPER_PY = [
  "services", "app", "routers", "furnaceProductApp",
  "pipeline", "Package_Processor_Interaction", "helper.py",
];
function isTruthyFlag(v: string): boolean {
  return ["yes", "1", "true", "on"].includes(v.trim().toLowerCase());
}
function isHelperActive(): boolean {
  const override = process.env.PP_HELPER_ACTIVE;
  if (override != null) return isTruthyFlag(override);
  try {
    const src = fs.readFileSync(path.join(process.cwd(), ...HELPER_PY), "utf-8");
    const m = src.match(/^\s*STATUS_ACTIVE\s*=\s*["']([^"']*)["']/m);
    if (m) return isTruthyFlag(m[1]);
  } catch {
    // helper.py absent/unreadable → treat as inactive (legacy dual-write behaviour).
  }
  return false;
}

// Delete a file if it exists (used to drop stale .xlsx mirrors when the helper is
// active). Never throws — a locked/absent mirror must not fail a JSON write.
function removeIfExists(file: string): void {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (e) {
    console.error(`Failed to remove ${path.basename(file)}:`, e);
  }
}

// Write one sheet into a workbook UNLESS the helper is active, in which case the
// .xlsx is transient — drop any existing copy and skip the write (JSON is primary).
function maybeUpsertSheet(file: string, sheetName: string, ws: XLSX.WorkSheet): void {
  if (isHelperActive()) {
    removeIfExists(file);
    return;
  }
  upsertSheet(file, sheetName, ws);
}

/**
 * Returns the recorded FMS state from the FMS State section of UI_Export.json
 * (the PRIMARY source) so the client can revert to the last recorded setup
 * without a file-picker dialog. Self-heals from the "FMS State" sheet of
 * UI_Export.xlsx if the JSON section is missing.
 */
export async function readUserSetupResponse(instanceId: number | null): Promise<ReadRowsResult> {
  try {
    const id = validInstance(instanceId);
    if (id == null) return { success: false, error: "No instance in context." };
    const hub = await readConfigSection<HubSection>(id, "hub");
    if (hub?.fms) return { success: true, rows: hub.fms };
    return { success: false, error: "No confirmed setup recorded for this instance yet." };
  } catch (error) {
    console.error("Failed to read confirmed FMS State from DB:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Writes the FMS State + Entity_Tree sections of one consolidated set — the JSON
 * (primary, only those two sections replaced, Package_KPI_Selection preserved)
 * plus the `.xlsx` mirror (FMS State + Entity_Tree sheets rebuilt, every OTHER
 * sheet preserved). Shared by the confirmed path (exportUiWorkbook) and the draft
 * path (saveDraftWorkbook) so both stay byte-for-byte consistent.
 *
 * NOTE: read/write via Node's fs (not XLSX.readFile/writeFile). When this module
 * is bundled for a Server Action, SheetJS' internal require('fs') is stripped, so
 * its file helpers throw "Cannot access file". The buffer-based XLSX.read/write
 * APIs work regardless of bundling.
 */
function writeWorkbookArtifacts(
  dir: string,
  xlsxName: string,
  jsonName: string,
  fmsRows: ExportRow[],
  treeRows: TreeRow[],
): string {
  // ── PRIMARY: the FMS State + Entity_Tree sections of the consolidated JSON ──
  const setupRecords: UserSetupRow[] = fmsRows.map((r) => ({
    Variable: r.variable,
    Value: r.value ?? "—",
    Section: r.section,
    "Standard Variable": r.standardVar,
  }));
  const treeRecords = treeRows.map((r) => ({
    Node_ID: r.nodeId,
    Node_Type: r.nodeType,
    Index: r.index,
    Parent_Node_ID: r.parentId,
    Label: r.label,
  }));
  const jsonFile = path.join(dir, jsonName);
  upsertJsonSections(jsonFile, {
    [SEC_FMS]: setupRecords,
    [SEC_TREE]: treeRecords,
  });

  // When the helper is active the .xlsx is a transient artifact it materialises on
  // demand — the UI writes JSON only and drops any stale mirror.
  if (isHelperActive()) {
    removeIfExists(path.join(dir, xlsxName));
    return jsonFile;
  }

  // ── SECONDARY: the xlsx mirror (FMS State + Entity_Tree sheets) ──
  const wsData: (string | number)[][] = [["Variable", "Value", "Section", "Standard Variable"]];
  fmsRows.forEach((r) => wsData.push([r.variable, r.value ?? "—", r.section, r.standardVar]));
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 48 }, { wch: 28 }, { wch: 34 }, { wch: 48 }];

  const treeData: (string | number)[][] = [["Node_ID", "Node_Type", "Index", "Parent_Node_ID", "Label"]];
  treeRows.forEach((r) => treeData.push([r.nodeId, r.nodeType, r.index, r.parentId, r.label]));
  const wsTree = XLSX.utils.aoa_to_sheet(treeData);
  wsTree["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];

  const file = path.join(dir, xlsxName);
  let wb: XLSX.WorkBook;
  if (fs.existsSync(file)) {
    // Preserve any other sheets; drop the two we are about to rewrite.
    wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
    for (const name of [SEC_FMS, SEC_TREE]) {
      if (wb.SheetNames.includes(name)) {
        delete wb.Sheets[name];
        wb.SheetNames = wb.SheetNames.filter((n) => n !== name);
      }
    }
  } else {
    wb = XLSX.utils.book_new();
  }
  XLSX.utils.book_append_sheet(wb, ws, SEC_FMS);
  XLSX.utils.book_append_sheet(wb, wsTree, SEC_TREE);
  fs.writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return file;
}

/**
 * Records the confirmed setup.
 *
 * PRIMARY (authoritative, what everything downstream reads):
 *   - UI_Export.json — its "FMS State" + "Entity_Tree" sections rebuilt, the
 *     "Package_KPI_Selection" section preserved.
 * SECONDARY (backend mirror for xlsx-consuming tooling):
 *   - UI_Export.xlsx with the "FMS State" + "Entity_Tree" sheets rebuilt, every
 *     other sheet preserved.
 * Confirm also SYNCS the draft set (UI_Export_Draft.json + .xlsx) to the same
 * data, so after a Confirm the draft and confirmed copies match.
 */
export async function exportUiWorkbook(
  instanceId: number | null,
  fmsRows: ExportRow[],
  treeRows: TreeRow[],
  hash?: string,
): Promise<ExportResult> {
  try {
    if (!Array.isArray(fmsRows) || !Array.isArray(treeRows)) {
      return { success: false, error: "Invalid export payload." };
    }

    const dir = currentDir(instanceId);
    fs.mkdirSync(dir, { recursive: true });

    // Confirmed set (what the pipeline + Revert read).
    const file = writeWorkbookArtifacts(dir, FILE_NAME, JSON_FILE_NAME, fmsRows, treeRows);
    // Sync the draft set so draft == confirmed after a Confirm.
    writeWorkbookArtifacts(dir, DRAFT_FILE_NAME, JSON_DRAFT_FILE_NAME, fmsRows, treeRows);

    // Record the entries signature on the server alongside the workbook, so the
    // confirmed copy carries the hash that was current when Confirm was pressed.
    if (hash) {
      try {
        fs.writeFileSync(
          path.join(dir, "UI_Export.confirmed.json"),
          JSON.stringify({ hash, at: new Date().toISOString() }, null, 2),
        );
      } catch (e) {
        // Non-fatal: the JSON artifacts are the source of truth; the marker is auxiliary.
        console.error("Failed to write UI_Export.confirmed.json:", e);
      }
    }

    // Per-instance DB (docs 04/05): confirmed → ui_config_data.hub, and sync the
    // draft section so draft == confirmed after a Confirm. Skipped when no instance.
    const id = validInstance(instanceId);
    if (id != null) {
      const hub: HubSection = {
        fms: fmsRows.map((r) => ({
          Variable: r.variable, Value: r.value ?? "—", Section: r.section, "Standard Variable": r.standardVar,
        })),
        tree: treeRows.map((r) => ({
          Node_ID: r.nodeId, Node_Type: r.nodeType, Index: r.index, Parent_Node_ID: r.parentId, Label: r.label,
        })),
      };
      await upsertConfigSection(id, "hub", hub);
      await upsertDraftSection(id, "hub", hub);
    }

    return { success: true, path: file };
  } catch (error) {
    console.error("Failed to write confirmed setup:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Saves the DRAFT setup (the "Save" button in Know-Your-Case). Writes ONLY the
 * draft set — the "FMS State" + "Entity_Tree" sections of UI_Export_Draft.json
 * (primary) and UI_Export_Draft.xlsx (mirror). The confirmed copy is left
 * untouched; a later Confirm promotes the draft into it. Unlike Confirm, Save has
 * no completeness gate — a work-in-progress draft can be saved at any time.
 */
export async function saveDraftWorkbook(
  instanceId: number | null,
  fmsRows: ExportRow[],
  treeRows: TreeRow[],
): Promise<ExportResult> {
  try {
    if (!Array.isArray(fmsRows) || !Array.isArray(treeRows)) {
      return { success: false, error: "Invalid draft payload." };
    }
    const dir = currentDir(instanceId);
    fs.mkdirSync(dir, { recursive: true });
    const file = writeWorkbookArtifacts(dir, DRAFT_FILE_NAME, JSON_DRAFT_FILE_NAME, fmsRows, treeRows);

    // Per-instance DB (doc 04): draft → draft_data.hub. Skipped when no instance.
    const id = validInstance(instanceId);
    if (id != null) {
      const hub: HubSection = {
        fms: fmsRows.map((r) => ({
          Variable: r.variable, Value: r.value ?? "—", Section: r.section, "Standard Variable": r.standardVar,
        })),
        tree: treeRows.map((r) => ({
          Node_ID: r.nodeId, Node_Type: r.nodeType, Index: r.index, Parent_Node_ID: r.parentId, Label: r.label,
        })),
      };
      await upsertDraftSection(id, "hub", hub);
    }

    return { success: true, path: file };
  } catch (error) {
    console.error("Failed to write draft setup:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Returns the DRAFT FMS state from the "FMS State" section of UI_Export_Draft.json
 * (primary). On app open the setup is auto-filled from this draft, falling back to
 * the confirmed copy (readUserSetupResponse) when no draft exists yet. Self-heals
 * from the "FMS State" sheet of UI_Export_Draft.xlsx if the JSON section is missing.
 */
export async function readUserSetupDraft(instanceId: number | null): Promise<ReadRowsResult> {
  try {
    const id = validInstance(instanceId);
    if (id == null) return { success: false, error: "No instance in context." };
    const hub = await readDraftSection<HubSection>(id, "hub");
    if (hub?.fms) return { success: true, rows: hub.fms };
    return { success: false, error: "No draft setup recorded for this instance yet." };
  } catch (error) {
    console.error("Failed to read draft FMS State from DB:", error);
    return { success: false, error: String(error) };
  }
}

// ── Package / KPI selection persistence ──────────────────────────────────────
export interface PkgKpiSelectionData {
  selectedPackages: string[];
  kpiStates: Record<string, "none" | "sensor" | "calculate">;
  pkgOrigin: Record<string, "manual" | "kpi">;
}

type ReadSelectionResult =
  | { success: true; selection: PkgKpiSelectionData | null }
  | { success: false; error: string };

// Parse the structured Package/KPI selection stored as the JSON section value.
function parsePkgKpiFromObject(data: unknown): PkgKpiSelectionData {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    selectedPackages: Array.isArray(d.selectedPackages) ? d.selectedPackages.map(String) : [],
    kpiStates: (typeof d.kpiStates === "object" && d.kpiStates ? d.kpiStates : {}) as PkgKpiSelectionData["kpiStates"],
    pkgOrigin: (typeof d.pkgOrigin === "object" && d.pkgOrigin ? d.pkgOrigin : {}) as PkgKpiSelectionData["pkgOrigin"],
  };
}

/**
 * Read the recorded Package/KPI selection from the "Package_KPI_Selection" section
 * of UI_Export.json (the PRIMARY artifact). Self-heals from the mirrored sheet in
 * UI_Export.xlsx if the section is missing (Current_Packages.py can wipe it
 * mid-pipeline, but the workbook survives). Returns `selection: null` when nothing
 * has been recorded yet. Feeds the app-open autofill and the Revert button.
 */
export async function readPackageKpiSelection(instanceId: number | null): Promise<ReadSelectionResult> {
  try {
    const id = validInstance(instanceId);
    if (id == null) return { success: true, selection: null };
    const record = await readConfigSection<PkgKpiSelectionData>(id, "pkgKpi");
    return { success: true, selection: record ? parsePkgKpiFromObject(record) : null };
  } catch (error) {
    console.error("Failed to read confirmed Package/KPI selection from DB:", error);
    return { success: false, error: String(error) };
  }
}

// Persist only non-'none' KPI states — defaults are implicit on read-back.
function normalizeSelection(selection: PkgKpiSelectionData): PkgKpiSelectionData {
  const kpiStates: Record<string, "none" | "sensor" | "calculate"> = {};
  for (const [k, v] of Object.entries(selection.kpiStates || {})) {
    if (v && v !== "none") kpiStates[k] = v;
  }
  return {
    selectedPackages: [...(selection.selectedPackages || [])],
    kpiStates,
    pkgOrigin: selection.pkgOrigin || {},
  };
}

// The flat "Package_KPI_Selection" worksheet (Category | Item | Value) mirrored into
// both the confirmed and the draft workbooks.
function pkgKpiSheet(record: PkgKpiSelectionData): XLSX.WorkSheet {
  const rows: string[][] = [["Category", "Item", "Value"]];
  for (const p of record.selectedPackages) rows.push(["Package", p, record.pkgOrigin[p] || "manual"]);
  for (const [k, v] of Object.entries(record.kpiStates)) rows.push(["KPI", k, String(v)]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 56 }, { wch: 12 }];
  return ws;
}

// Write ONE sheet into a workbook file, preserving every other sheet — the surgical
// per-section write both the confirmed and draft workbooks rely on so that saving one
// section never disturbs another's sheet (FMS State / Entity_Tree / Exclusion_Rule).
// Uses buffer-based XLSX.read/write (see writeWorkbookArtifacts note on bundling).
function upsertSheet(file: string, sheetName: string, ws: XLSX.WorkSheet): void {
  let wb: XLSX.WorkBook;
  if (fs.existsSync(file)) {
    wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
    if (wb.SheetNames.includes(sheetName)) {
      delete wb.Sheets[sheetName];
      wb.SheetNames = wb.SheetNames.filter((n) => n !== sheetName);
    }
  } else {
    wb = XLSX.utils.book_new();
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  fs.writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/**
 * Record the confirmed Package/KPI selection.
 *
 * PRIMARY:   the "Package_KPI_Selection" section of UI_Export.json (selected
 *            packages + non-'none' KPI states + per-package origin) — the FMS
 *            State + Entity_Tree sections are preserved.
 * SECONDARY: a "Package_KPI_Selection" sheet in UI_Export.xlsx — Category | Item |
 *            Value — with every OTHER sheet preserved.
 * Also syncs the draft set (UI_Export_Draft.json + .xlsx) so draft == confirmed.
 */
export async function exportPackageKpiSelection(
  instanceId: number | null,
  selection: PkgKpiSelectionData,
): Promise<ExportResult> {
  try {
    const dir = currentDir(instanceId);
    const file = path.join(dir, FILE_NAME);
    fs.mkdirSync(dir, { recursive: true });

    const record = normalizeSelection(selection);

    // ── PRIMARY: the Package_KPI_Selection section of UI_Export.json (others kept) ──
    upsertJsonSection(path.join(dir, JSON_FILE_NAME), SEC_PKG, record);
    // ── SECONDARY: mirror the flat sheet into UI_Export.xlsx (other sheets kept) —
    //    skipped (mirror dropped) when the helper is active. ──
    maybeUpsertSheet(file, PKG_KPI_SHEET, pkgKpiSheet(record));

    // Sync the DRAFT set so draft == confirmed after a Confirm (mirrors exportUiWorkbook).
    // Only the Package_KPI_Selection section/sheet is touched — FMS State / Entity_Tree
    // in the draft copies are preserved; Exclusion_Rule is never part of the draft.
    upsertJsonSection(path.join(dir, JSON_DRAFT_FILE_NAME), SEC_PKG, record);
    maybeUpsertSheet(path.join(dir, DRAFT_FILE_NAME), PKG_KPI_SHEET, pkgKpiSheet(record));

    // Per-instance DB (docs 04/05): confirmed → ui_config_data.pkgKpi + sync draft.
    const id = validInstance(instanceId);
    if (id != null) {
      await upsertConfigSection(id, "pkgKpi", record);
      await upsertDraftSection(id, "pkgKpi", record);
    }

    return { success: true, path: file };
  } catch (error) {
    console.error("Failed to write Package/KPI selection:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Saves the DRAFT Package/KPI selection (the "Save" button on the KPI/Package page).
 * Writes ONLY the draft set — the "Package_KPI_Selection" section of
 * UI_Export_Draft.json (primary) + the mirrored sheet of UI_Export_Draft.xlsx —
 * preserving the FMS State / Entity_Tree sections already in the draft copies. The
 * confirmed copy is left untouched; a later Confirm promotes the draft into it. No
 * completeness gate.
 */
export async function savePkgKpiDraft(
  instanceId: number | null,
  selection: PkgKpiSelectionData,
): Promise<ExportResult> {
  try {
    const dir = currentDir(instanceId);
    fs.mkdirSync(dir, { recursive: true });
    const record = normalizeSelection(selection);
    upsertJsonSection(path.join(dir, JSON_DRAFT_FILE_NAME), SEC_PKG, record);
    maybeUpsertSheet(path.join(dir, DRAFT_FILE_NAME), PKG_KPI_SHEET, pkgKpiSheet(record));

    // Per-instance DB (doc 04): draft → draft_data.pkgKpi. Skipped when no instance.
    const id = validInstance(instanceId);
    if (id != null) await upsertDraftSection(id, "pkgKpi", record);

    return { success: true, path: path.join(dir, DRAFT_FILE_NAME) };
  } catch (error) {
    console.error("Failed to write Package/KPI draft:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Read the DRAFT Package/KPI selection from the "Package_KPI_Selection" section of
 * UI_Export_Draft.json (primary). Self-heals from the mirrored sheet of
 * UI_Export_Draft.xlsx if the section is missing. Returns `selection: null` when no
 * draft exists yet (caller falls back to the confirmed copy). Feeds the app-open autofill.
 */
export async function readPkgKpiDraft(instanceId: number | null): Promise<ReadSelectionResult> {
  try {
    const id = validInstance(instanceId);
    if (id == null) return { success: true, selection: null };
    const record = await readDraftSection<PkgKpiSelectionData>(id, "pkgKpi");
    return { success: true, selection: record ? parsePkgKpiFromObject(record) : null };
  } catch (error) {
    console.error("Failed to read draft Package/KPI selection from DB:", error);
    return { success: false, error: String(error) };
  }
}
