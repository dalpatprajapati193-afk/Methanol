// Server-only helper for reading/writing the Input Sheet (imported by the
// "use server" wrappers in InputSheetActions.ts). This is NOT a "use server"
// module — it exports constants and synchronous helpers too — so it must never
// be imported by a Client Component; only the server actions touch it.
//
// JSON-PRIMARY MODEL (ported from the single-app reference api/input-sheet/io.ts):
// the Input Sheet is driven entirely by JSON — Excel is NEVER required on disk and
// is NEVER the edit base. A stray/0-byte `.xlsx` can therefore never break a read
// or a save.
//
//   <name>.ui.json        — the UI read-model (values + presentation metadata:
//                           dropdown option-sets + tooltips). What the browser
//                           renders and what Save/Confirm/Revert read & write.
//   <name>.json           — the PLAIN json_mirror the Python pipeline reads
//                           (`json_mirror.read_records`): one key per sheet, each a
//                           list of row-records keyed by the display-name headers.
//                           Save/Confirm/Upload write this so the pipeline sees the
//                           user's values.
//   <name>.confirmed.json — the confirmed snapshot (Confirm baseline + Revert
//                           source). Per-instance DB persistence lives one layer up
//                           in InputSheetActions.ts; this is the on-disk baseline.
//   <name>.xlsx           — a SECONDARY mirror, written ONLY when helper.py is
//                           INACTIVE (helper active ⇒ JSON-only, stale xlsx deleted;
//                           helper inactive ⇒ dual JSON+xlsx, matching the reference
//                           and actions.ts's UI_Export rule). Download always builds
//                           an xlsx on demand from the .ui.json regardless of the
//                           flag; Upload consumes an xlsx and converts it to JSON.
//
// There is NO frontend version history: prefill-from-previous is the pipeline's job
// (Input_Sheet_Generator._prefill_from_previous reads a single `_Version_-1`).
//
// PER-INSTANCE (doc 02): every path is scoped to `instanceId` — the same layout the
// bridges seed at pipeline/_instances/<id>/KPI_calc_DB_B/... — so two instances
// never share a workbook on disk. A null instanceId falls back to the shared default
// root (degraded single-tenant mode / pre-instance callers).
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// Base (extension-less) name of the artifacts in every location.
const BASE_NAME = 'input_data_from_user';

// The Package_Processor pipeline lives under services/app/routers/PeOlfFur/...;
// its data root is the shared KPI_calc_DB_B, or a per-instance sibling under
// _instances/<id>/KPI_calc_DB_B (seeded by the bridges' instance_env.py).
const PIPELINE_DIR = path.join(
  process.cwd(),
  'services', 'app', 'routers', 'PeOlfFur', 'furnaceProductApp', 'pipeline',
);

// The KPI_calc_DB_B/database root for an instance (or the shared default).
function databaseDir(instanceId: number | null): string {
  const kpiRoot = instanceId != null
    ? path.join(PIPELINE_DIR, '_instances', String(instanceId), 'KPI_calc_DB_B')
    : path.join(PIPELINE_DIR, 'KPI_calc_DB_B');
  return path.join(kpiRoot, 'database');
}

// The Current dir (Hub / Package-KPI Confirm write UI_Export.xlsx here). Exported
// so actions.ts writes the pipeline-consumed artifacts to the SAME instance dir.
export function currentDir(instanceId: number | null): string {
  return path.join(databaseDir(instanceId), 'Current');
}

// The outputs/user_input dir the Package_Processor scripts (paths.py → DATA_DIR)
// read and write. Override with USER_INPUT_DIR only for the shared (no-instance)
// case, preserving the legacy single-app escape hatch.
export function userInputDir(instanceId: number | null): string {
  if (instanceId == null && process.env.USER_INPUT_DIR) return process.env.USER_INPUT_DIR;
  return path.join(databaseDir(instanceId), 'outputs', 'user_input');
}

// ── helper.py activation (same source of truth the pipeline uses) ─────────────
// helper.py's `STATUS_ACTIVE = "yes"` line is the single flag for whether the
// .xlsx mirrors are written. When ACTIVE the .xlsx files are transient (the
// pipeline materialises them on demand), so here we write JSON only and delete any
// stale .xlsx. PP_HELPER_ACTIVE overrides.
const HELPER_PY = path.join(PIPELINE_DIR, 'Package_Processor_Interaction', 'helper.py');
function isTruthyFlag(v: string): boolean {
  return ['yes', '1', 'true', 'on'].includes(v.trim().toLowerCase());
}
function isHelperActive(): boolean {
  const override = process.env.PP_HELPER_ACTIVE;
  if (override != null) return isTruthyFlag(override);
  try {
    const src = fs.readFileSync(HELPER_PY, 'utf-8');
    const m = src.match(/^\s*STATUS_ACTIVE\s*=\s*["']([^"']*)["']/m);
    if (m) return isTruthyFlag(m[1]);
  } catch {
    // helper.py absent/unreadable → treat as inactive (legacy dual-write behaviour).
  }
  return false;
}
function removeIfExists(file: string): void {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (e) {
    console.error(`[input-sheet] failed to remove ${path.basename(file)}:`, e);
  }
}

// ── Per-instance artifact paths, computed once per action call ────────────────
interface IoPaths {
  dir: string;
  json: string;            // <name>.ui.json — PRIMARY UI read-model (live/canonical)
  plainJson: string;       // <name>.json    — the pipeline's json_mirror
  workbook: string;        // <name>.xlsx    — SECONDARY mirror (helper-gated)
  confirmedJson: string;   // <name>.confirmed.json — Confirm baseline + Revert source
  confirmedXlsx: string;   // <name>.confirmed.xlsx — only when helper inactive
}

function ioPaths(instanceId: number | null): IoPaths {
  const dir = userInputDir(instanceId);
  return {
    dir,
    json: path.join(dir, `${BASE_NAME}.ui.json`),
    plainJson: path.join(dir, `${BASE_NAME}.json`),
    workbook: path.join(dir, `${BASE_NAME}.xlsx`),
    confirmedJson: path.join(dir, `${BASE_NAME}.confirmed.json`),
    confirmedXlsx: path.join(dir, `${BASE_NAME}.confirmed.xlsx`),
  };
}

// ── Types + schema constants ──────────────────────────────────────────────────
// Columns that always exist and must never be rendered as editable table columns.
export const HIDDEN_COLUMNS = ['package type', 'input data list', 'Default_Display_Name'];
// The column whose value is shared across both tabs for a given tag.
export const SYNC_COLUMN = 'User_Display_Name';
// The plain-json / xlsx sheet names, in tab order (details, config).
const DATA_SHEETS = ['input_data_from_user', 'input_data_from_user_ccp'];
// The informational descriptions sheet (Column Name | Description).
const INFO_SHEET = 'Column Information';
const DESC_HEADER = ['Column Name', 'Description'];
// Row-identity columns (independent of the editable User_Display_Name).
const IDENTITY_COLUMNS = ['input data list', 'Default_Display_Name'];
// Fixed tab labels (the data sheets map by order: 1st -> details, 2nd -> config).
export const TAB_LABELS = ['Tag Details', 'Tag Configuration'];

export interface ColumnMeta { key: number; label: string; hidden: boolean; }
export interface RowData { id: number; cells: Record<number, CellValue>; opts: Record<number, number>; }
export interface TabData { id: string; label: string; sheet: string; columns: ColumnMeta[]; rows: RowData[]; }
export interface InputSheetPayload {
  tabs: TabData[];
  optionSets: string[][];
  descriptions: Record<string, string>;
  hiddenColumns: string[];
  syncColumn: string;
}
export type CellValue = string | number | boolean | null;
export interface Edit { sheet: string; row: number; col: number; value: CellValue; }

const FS_LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
function rethrowLock(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code && FS_LOCK_CODES.has(code)) {
    throw new Error('The workbook is open in Excel or locked by another program. Close it and try again.');
  }
  throw err;
}

const NOT_AVAILABLE = 'Input sheet not available — it has not been generated yet.';

// ── Excel cell helpers ────────────────────────────────────────────────────────
function cellToValue(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    // exceljs rich text / formula / hyperlink shapes — fall back to text/result.
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map(t => t.text).join('');
    if (o.text !== undefined) return o.text as CellValue;
    if (o.result !== undefined) return o.result as CellValue;
    return String(v);
  }
  return v as CellValue;
}

// Parse an exceljs list-validation formula into discrete options.
// Inline lists look like: "Yes,No"  (a single quoted, comma-joined string).
function parseListOptions(formulae: string[] | undefined): string[] | null {
  if (!formulae || !formulae.length) return null;
  let f = String(formulae[0]).trim();
  if (f.startsWith('"') && f.endsWith('"')) f = f.slice(1, -1);
  // Range references (e.g. =Sheet!$A$1:$A$5) are not inline lists — skip.
  if (f.includes('!') || f.startsWith('=')) return null;
  return f.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function isDescSheet(ws: ExcelJS.Worksheet): boolean {
  const a = ws.getCell(1, 1).value;
  const b = ws.getCell(1, 2).value;
  return String(a ?? '').trim() === DESC_HEADER[0] && String(b ?? '').trim() === DESC_HEADER[1];
}

// ── xlsx → payload (Upload, and rebuilding from a newer pipeline xlsx) ─────────
function buildPayloadFromWorkbook(wb: ExcelJS.Workbook): InputSheetPayload {
  const descriptions: Record<string, string> = {};
  const dataSheets: ExcelJS.Worksheet[] = [];
  for (const ws of wb.worksheets) {
    if (isDescSheet(ws)) {
      for (let r = 2; r <= ws.rowCount; r++) {
        const name = cellToValue(ws.getCell(r, 1).value);
        const desc = cellToValue(ws.getCell(r, 2).value);
        if (name != null && desc != null && String(desc).length) descriptions[String(name)] = String(desc);
      }
    } else {
      dataSheets.push(ws);
    }
  }

  // Dedup dropdown option-sets across all cells to keep the payload small.
  const optionSets: string[][] = [];
  const optionIndex = new Map<string, number>();
  const internOptions = (opts: string[]): number => {
    const k = opts.join('');
    let i = optionIndex.get(k);
    if (i === undefined) { i = optionSets.length; optionSets.push(opts); optionIndex.set(k, i); }
    return i;
  };

  const tabs: TabData[] = dataSheets.slice(0, 2).map((ws, ti) => {
    const headerRow = ws.getRow(1);
    const columns: ColumnMeta[] = [];
    const colCount = ws.columnCount;
    for (let c = 1; c <= colCount; c++) {
      const label = String(cellToValue(headerRow.getCell(c).value) ?? '').trim();
      if (!label) continue;
      columns.push({ key: c, label, hidden: HIDDEN_COLUMNS.includes(label) });
    }

    const rows: RowData[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const cells: Record<number, CellValue> = {};
      const opts: Record<number, number> = {};
      let any = false;
      for (const col of columns) {
        const cell = ws.getCell(r, col.key);
        const val = cellToValue(cell.value);
        if (val !== null) any = true;
        cells[col.key] = val;
        const dv = cell.dataValidation;
        if (dv && dv.type === 'list') {
          const list = parseListOptions(dv.formulae as string[] | undefined);
          if (list && list.length) opts[col.key] = internOptions(list);
        }
      }
      // Skip fully-empty trailing rows.
      if (!any && r > 2) continue;
      rows.push({ id: r, cells, opts });
    }

    return {
      id: ti === 0 ? 'details' : 'config',
      label: TAB_LABELS[ti] ?? ws.name,
      sheet: ws.name,
      columns,
      rows,
    };
  });

  return { tabs, optionSets, descriptions, hiddenColumns: HIDDEN_COLUMNS, syncColumn: SYNC_COLUMN };
}

// ── plain json → payload (rebuild when only the pipeline's json is present) ────
// The plain json carries values only (no dropdowns/tooltips), so option-sets,
// descriptions and per-cell dropdown indices are carried forward from the previous
// .ui.json (matched by row identity) when its schema still lines up.
function buildPayloadFromPlainJson(
  data: Record<string, Record<string, CellValue>[]>,
  prev: InputSheetPayload | null,
): InputSheetPayload {
  const optionSets = prev?.optionSets ?? [];

  // descriptions: prefer the previous .ui.json; else derive from the info sheet.
  const descriptions: Record<string, string> = prev?.descriptions ?? {};
  if (!Object.keys(descriptions).length && Array.isArray(data[INFO_SHEET])) {
    for (const rec of data[INFO_SHEET]) {
      const name = rec['Column Name'];
      const desc = rec['Description'];
      if (name != null && desc != null && String(desc).length) descriptions[String(name)] = String(desc);
    }
  }

  // prevOpts: sheet -> identityValue -> { columnLabel -> optionSet index }
  const prevOpts = new Map<string, Map<string, Record<string, number>>>();
  if (prev) {
    for (const t of prev.tabs) {
      const idCol = t.columns.find(c => c.label === IDENTITY_COLUMNS[0]);
      const m = new Map<string, Record<string, number>>();
      for (const r of t.rows) {
        const idv = idCol ? String(r.cells[idCol.key] ?? '') : String(r.id);
        const byLabel: Record<string, number> = {};
        for (const c of t.columns) if (r.opts?.[c.key] != null) byLabel[c.label] = r.opts[c.key];
        m.set(idv, byLabel);
      }
      prevOpts.set(t.sheet, m);
    }
  }

  const tabs: TabData[] = DATA_SHEETS.map((sheet, ti) => {
    const records = data[sheet] ?? [];
    const labels = records.length
      ? Object.keys(records[0])
      : (prev?.tabs[ti]?.columns.map(c => c.label) ?? []);
    const columns: ColumnMeta[] = labels.map((label, i) => ({
      key: i + 1,
      label,
      hidden: HIDDEN_COLUMNS.includes(label),
    }));
    const prevByIdentity = prevOpts.get(sheet);
    const rows: RowData[] = records.map((rec, ri) => {
      const cells: Record<number, CellValue> = {};
      for (const c of columns) cells[c.key] = rec[c.label] ?? null;
      const idv = String(rec[IDENTITY_COLUMNS[0]] ?? (ri + 2));
      const carried = prevByIdentity?.get(idv) ?? {};
      const opts: Record<number, number> = {};
      for (const c of columns) if (carried[c.label] != null) opts[c.key] = carried[c.label];
      return { id: ri + 2, cells, opts };
    });
    return { id: ti === 0 ? 'details' : 'config', label: TAB_LABELS[ti] ?? sheet, sheet, columns, rows };
  });

  return { tabs, optionSets, descriptions, hiddenColumns: HIDDEN_COLUMNS, syncColumn: SYNC_COLUMN };
}

// ── payload → plain json (what the pipeline reads) ─────────────────────────────
function payloadToPlainSheets(payload: InputSheetPayload): Record<string, Record<string, CellValue>[]> {
  const out: Record<string, Record<string, CellValue>[]> = {};
  for (const tab of payload.tabs) {
    const cols = [...tab.columns].sort((a, b) => a.key - b.key);
    out[tab.sheet] = [...tab.rows]
      .sort((a, b) => a.id - b.id)
      .map(r => {
        const rec: Record<string, CellValue> = {};
        for (const c of cols) rec[c.label] = r.cells[c.key] ?? null;
        return rec;
      });
  }
  // Informational Column Information sheet (parity with the pipeline's export; the
  // pipeline reads only the two data sheets, but keeping it makes the plain json a
  // faithful mirror).
  const info = Object.entries(payload.descriptions ?? {});
  if (info.length) {
    out[INFO_SHEET] = info.map(([name, desc]) => ({ 'Column Name': name, Description: desc }));
  }
  return out;
}

// ── payload → xlsx (Download, and the helper-gated mirror) ─────────────────────
// Reconstruct each tab as a sheet with header tooltips (cell notes), hidden system
// columns, and per-cell dropdowns from the option-sets. Plus the informational
// Column Information sheet. (Mirrors Code_Helper._rebuild_input_xlsx_from_ui.)
function buildWorkbookFromPayload(payload: InputSheetPayload): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const optionSets = payload.optionSets ?? [];
  const descriptions = payload.descriptions ?? {};

  for (const tab of payload.tabs) {
    const ws = wb.addWorksheet(tab.sheet);
    const cols = [...tab.columns].sort((a, b) => a.key - b.key);
    const rows = [...tab.rows].sort((a, b) => a.id - b.id);

    // header + per-column tooltip note + hidden system columns
    ws.addRow(cols.map(c => c.label));
    cols.forEach((c, i) => {
      const cell = ws.getRow(1).getCell(i + 1);
      const desc = descriptions[c.label];
      if (desc) cell.note = String(desc);
      if (c.hidden) ws.getColumn(i + 1).hidden = true;
    });

    // data rows
    for (const r of rows) ws.addRow(cols.map(c => r.cells[c.key] ?? null));

    // dropdowns: the same column may use different option-sets on different rows
    // (e.g. UOM per family), so apply per cell using each row's opts index.
    cols.forEach((c, ci) => {
      rows.forEach((r, ri) => {
        const oi = r.opts?.[c.key];
        if (oi == null) return;
        const options = optionSets[oi];
        if (!options || !options.length) return;
        ws.getCell(ri + 2, ci + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"' + options.map(String).join(',') + '"'],
        };
      });
    });
  }

  const info = Object.entries(descriptions);
  if (info.length) {
    const ws = wb.addWorksheet(INFO_SHEET);
    ws.addRow(DESC_HEADER);
    for (const [name, desc] of info) ws.addRow([name, String(desc)]);
  }
  return wb;
}

// ── low-level IO ────────────────────────────────────────────────────────────
function readUiJson(file: string): InputSheetPayload | null {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.tabs) ? (parsed as InputSheetPayload) : null;
  } catch {
    return null;
  }
}

async function loadWorkbook(xlsxPath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  return wb;
}

async function writeJsonMirror(dir: string, jsonPath: string, payload: InputSheetPayload): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function writePlainJson(P: IoPaths, payload: InputSheetPayload): Promise<void> {
  await fs.promises.mkdir(P.dir, { recursive: true });
  await fs.promises.writeFile(P.plainJson, JSON.stringify(payloadToPlainSheets(payload), null, 2), 'utf-8');
}

// Write (or, when helper.py is active, delete) an xlsx mirror. Never fatal on a
// locked mirror — the JSON write is the authoritative artifact.
async function mirrorXlsx(xlsxPath: string, payload: InputSheetPayload): Promise<void> {
  if (isHelperActive()) { removeIfExists(xlsxPath); return; }
  try {
    await buildWorkbookFromPayload(payload).xlsx.writeFile(xlsxPath);
  } catch (err) {
    console.error(`[input-sheet] failed to write ${path.basename(xlsxPath)} mirror:`, err);
  }
}

// mtime of a file in ms, or -1 when absent. A 0-byte .xlsx is treated as absent
// (this is exactly the corrupt/half-written workbook that used to crash ExcelJS).
async function uiOrPlainMtime(p: string): Promise<number> {
  return fs.existsSync(p) ? (await fs.promises.stat(p)).mtimeMs : -1;
}
async function xlsxMtime(p: string): Promise<number> {
  if (!fs.existsSync(p)) return -1;
  const st = await fs.promises.stat(p);
  return st.size > 0 ? st.mtimeMs : -1;
}

// Return the canonical read-model, rebuilding the .ui.json from a newer external
// source (the pipeline's xlsx or plain json) when it has fallen behind. Returns
// null only when nothing exists yet. Only rewrites the .ui.json when it actually
// rebuilt, so an up-to-date canonical keeps its mtime.
async function ensureCanonicalUi(P: IoPaths): Promise<InputSheetPayload | null> {
  const [uiM, xlsxM, plainM] = await Promise.all([
    uiOrPlainMtime(P.json), xlsxMtime(P.workbook), uiOrPlainMtime(P.plainJson),
  ]);
  if (uiM < 0 && xlsxM < 0 && plainM < 0) return null;

  // The .ui.json is current when it exists and is at least as new as both sources.
  if (uiM >= 0 && uiM >= xlsxM && uiM >= plainM) return readUiJson(P.json);

  // Rebuild from the freshest external source (xlsx = full fidelity; else plain).
  let rebuilt: InputSheetPayload | null = null;
  if (xlsxM >= 0 && xlsxM >= plainM) {
    rebuilt = buildPayloadFromWorkbook(await loadWorkbook(P.workbook));
  } else if (plainM >= 0) {
    const data = JSON.parse(fs.readFileSync(P.plainJson, 'utf-8'));
    rebuilt = buildPayloadFromPlainJson(data, readUiJson(P.json));
  } else {
    rebuilt = readUiJson(P.json);
  }
  if (rebuilt) {
    try { await writeJsonMirror(P.dir, P.json, rebuilt); } catch { /* read-only FS is fine */ }
  }
  return rebuilt;
}

// ── Edit application (in payload space — never touches xlsx) ───────────────────
// Coerce the incoming value to match the existing cell's type where sensible.
function coerceCell(existing: CellValue, value: CellValue): CellValue {
  if (value === null || value === '') return null;
  if (typeof existing === 'number' && typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)) && existing == null) {
    return Number(value);
  }
  return value;
}

// Apply edits in place onto a payload, mirroring User_Display_Name edits to the
// same row (by excel row id) in every other tab. Returns how many edits landed.
function applyEditsToPayload(payload: InputSheetPayload, edits: Edit[]): number {
  const rowById = new Map<string, Map<number, RowData>>();
  const syncKeyBySheet = new Map<string, number>();
  for (const t of payload.tabs) {
    rowById.set(t.sheet, new Map(t.rows.map(r => [r.id, r])));
    const sc = t.columns.find(c => c.label === SYNC_COLUMN);
    if (sc) syncKeyBySheet.set(t.sheet, sc.key);
  }

  let applied = 0;
  for (const e of edits) {
    const row = rowById.get(e.sheet)?.get(e.row);
    if (!row) continue;
    row.cells[e.col] = coerceCell(row.cells[e.col] ?? null, e.value);
    applied++;

    // Mirror User_Display_Name edits to the same row in every other sheet.
    if (syncKeyBySheet.get(e.sheet) === e.col) {
      for (const t of payload.tabs) {
        if (t.sheet === e.sheet) continue;
        const ok = syncKeyBySheet.get(t.sheet);
        const orow = rowById.get(t.sheet)?.get(e.row);
        if (ok != null && orow) orow.cells[ok] = e.value;
      }
    }
  }
  return applied;
}

// ── Public reads ────────────────────────────────────────────────────────────
// Read the live input-sheet payload from the .ui.json (rebuilding it from the
// pipeline's plain json / a newer xlsx at a boundary). Pending edits are layered on
// top by the caller (readInputDraftEdits) so they survive a refresh.
export async function readInputPayload(instanceId: number | null): Promise<InputSheetPayload> {
  const payload = await ensureCanonicalUi(ioPaths(instanceId));
  if (!payload) throw new Error(NOT_AVAILABLE);
  return payload;
}

// The confirmed-snapshot payload, or null when never confirmed (blue baseline).
export async function readConfirmedPayload(instanceId: number | null): Promise<InputSheetPayload | null> {
  return readUiJson(ioPaths(instanceId).confirmedJson);
}

// ── Public writes ─────────────────────────────────────────────────────────────
// Apply dirty edits to the live .ui.json + the pipeline's plain json (JSON is
// authoritative; the xlsx mirror is written only when helper.py is inactive). No
// xlsx is ever READ, and there is no version history.
export async function writeEdits(instanceId: number | null, edits: Edit[]): Promise<{ applied: number }> {
  if (!Array.isArray(edits) || edits.length === 0) return { applied: 0 };
  const P = ioPaths(instanceId);
  const base = readUiJson(P.json) ?? (await ensureCanonicalUi(P));
  if (!base) throw new Error(NOT_AVAILABLE);
  const applied = applyEditsToPayload(base, edits);
  try {
    await writeJsonMirror(P.dir, P.json, base);  // live read-model (PRIMARY)
    await writePlainJson(P, base);               // pipeline reads THIS
    await mirrorXlsx(P.workbook, base);          // helper-gated (deletes stale/0-byte xlsx when active)
  } catch (err) {
    rethrowLock(err);
  }
  return { applied };
}

// Record the current live sheet as the confirmed snapshot (Confirm). Writes the
// .confirmed.json baseline; the confirmed xlsx is written only when helper inactive
// (and any stale one is removed when active). Returns the snapshotted payload.
export async function writeConfirmedSnapshot(instanceId: number | null): Promise<InputSheetPayload> {
  const P = ioPaths(instanceId);
  const payload = await ensureCanonicalUi(P);   // the current live payload
  if (!payload) throw new Error(NOT_AVAILABLE);
  try {
    await fs.promises.mkdir(P.dir, { recursive: true });
    await fs.promises.writeFile(P.confirmedJson, JSON.stringify(payload, null, 2), 'utf-8');
    if (isHelperActive()) {
      removeIfExists(P.confirmedXlsx);
    } else {
      await buildWorkbookFromPayload(payload).xlsx.writeFile(P.confirmedXlsx);
    }
  } catch (err) {
    rethrowLock(err);
  }
  return payload;
}

// Restore the live sheet from the confirmed snapshot (Revert, through JSON). Clears
// any xlsx mirror when helper active. Throws a clear error if nothing confirmed yet.
export async function revertToConfirmed(instanceId: number | null): Promise<InputSheetPayload> {
  const P = ioPaths(instanceId);
  const payload = readUiJson(P.confirmedJson);
  if (!payload) {
    throw new Error('Nothing to revert to — the input sheet has not been confirmed yet.');
  }
  try {
    await writeJsonMirror(P.dir, P.json, payload);  // live read-model := confirmed
    await writePlainJson(P, payload);               // pipeline := confirmed
    await mirrorXlsx(P.workbook, payload);          // helper-gated
  } catch (err) {
    rethrowLock(err);
  }
  return payload;
}

// File name suggested to the browser on download (Excel is the only user format).
export const DOWNLOAD_FILENAME = `${BASE_NAME}.xlsx`;

// Raw bytes of the workbook for the Download button, built ON DEMAND from the live
// .ui.json (never read off disk) so Download works in JSON mode with no xlsx present.
export async function readWorkbookBuffer(instanceId: number | null): Promise<Buffer> {
  const P = ioPaths(instanceId);
  const payload = readUiJson(P.json) ?? (await ensureCanonicalUi(P));
  if (!payload) throw new Error(NOT_AVAILABLE);
  const buf = await buildWorkbookFromPayload(payload).xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Upload (xlsx → JSON) ──────────────────────────────────────────────────────
// Ensure the uploaded sheets carry the same columns + row identities as the current
// live payload (the user may only change User_Display_Name + editable values).
function assertSameStructure(uploaded: InputSheetPayload, canonical: InputSheetPayload): void {
  const NOT_SAME = 'Uploaded file is not the same as the downloaded file';
  const identity = (t: TabData, r: RowData): string =>
    IDENTITY_COLUMNS.map(lbl => {
      const c = t.columns.find(col => col.label === lbl);
      return c ? String(r.cells[c.key] ?? '') : '';
    }).join('');

  for (let i = 0; i < canonical.tabs.length; i++) {
    const ct = canonical.tabs[i];
    const ut = uploaded.tabs[i];
    if (!ut) throw new Error(`${NOT_SAME} (a sheet is missing).`);
    if (ct.columns.map(c => c.label).join('') !== ut.columns.map(c => c.label).join('')) {
      throw new Error(`${NOT_SAME} (columns differ in "${ct.sheet}").`);
    }
    const expected = new Set(ct.rows.map(r => identity(ct, r)));
    const got = ut.rows.map(r => identity(ut, r));
    const gotSet = new Set(got);
    const sameRows =
      got.length === expected.size &&
      gotSet.size === expected.size &&
      [...expected].every(k => gotSet.has(k));
    if (!sameRows) throw new Error(`${NOT_SAME} (rows differ in "${ct.sheet}").`);
  }
}

// Replace the live artifacts from an uploaded .xlsx. Validates structure against the
// current live payload, then writes the .ui.json + plain json (+ xlsx mirror as
// uploaded when helper inactive). Bootstraps when nothing exists yet (first upload).
export async function saveUploadedWorkbook(instanceId: number | null, buffer: Buffer): Promise<void> {
  const P = ioPaths(instanceId);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw new Error('Uploaded file is not a valid Excel (.xlsx) workbook.');
  }
  const dataSheets = wb.worksheets.filter(ws => !isDescSheet(ws));
  if (dataSheets.length < 2) {
    throw new Error('Uploaded workbook must contain both sheets (Tag Details and Tag Configuration).');
  }

  const payload = buildPayloadFromWorkbook(wb);
  const canonical = await ensureCanonicalUi(P);
  if (canonical) assertSameStructure(payload, canonical);

  try {
    await writeJsonMirror(P.dir, P.json, payload);  // live read-model (PRIMARY)
    await writePlainJson(P, payload);               // pipeline reads THIS
    if (isHelperActive()) {
      removeIfExists(P.workbook);
    } else {
      await fs.promises.mkdir(P.dir, { recursive: true });
      await fs.promises.writeFile(P.workbook, buffer); // xlsx mirror (as uploaded)
    }
  } catch (err) {
    rethrowLock(err);
  }
}
