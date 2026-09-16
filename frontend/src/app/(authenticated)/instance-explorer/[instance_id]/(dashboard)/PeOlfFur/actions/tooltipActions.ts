"use server";

import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import {
  REGISTERED_TOOLTIPS,
  TOOLTIP_COLUMNS,
  type TooltipMap,
  type TooltipRow,
} from "../constants/TooltipRegistry";

// The user-editable tooltip copy lives as an Excel file at the root of the
// mini-app (capability) folder itself (it is UI copy, not pipeline data, so it
// does NOT go in the shared database/ folder). Editing a Tooltip_Text/Title cell
// is all it takes to change a tooltip; the app re-reads the file on every open.
const TARGET_DIR = [
  "src", "app", "(authenticated)", "instance-explorer", "[instance_id]",
  "(dashboard)", "PeOlfFur",
];
const FILE_NAME = "Tooltips.xlsx";
const SHEET_NAME = "Tooltips";

type ReadTooltipsResult =
  | { success: true; tooltips: TooltipMap }
  | { success: false; error: string };

// NOTE: read/write via Node's fs (not XLSX.readFile/writeFile) — when bundled
// for a Server Action, SheetJS' internal require('fs') is stripped and its
// file helpers throw "Cannot access file". Same workaround as actions.ts.
function writeWorkbook(file: string, rows: TooltipRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TOOLTIP_COLUMNS] });
  ws["!cols"] = [{ wch: 32 }, { wch: 64 }, { wch: 24 }, { wch: 100 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(file, buf);
}

/**
 * Reads Tooltips.xlsx into the id → copy map the UI consumes.
 *
 * Self-heals so the Excel is always the complete, editable catalog:
 *   - file missing → created with every registered default;
 *   - a registered id missing from the sheet (a tooltip newly added in code) →
 *     its default row is APPENDED. Existing rows are never modified, so user
 *     edits — including a deliberately blanked Tooltip_Text — always win.
 */
export async function readTooltips(): Promise<ReadTooltipsResult> {
  try {
    const dir = path.join(process.cwd(), ...TARGET_DIR);
    const file = path.join(dir, FILE_NAME);

    let rows: TooltipRow[] = [];
    if (fs.existsSync(file)) {
      const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
      const ws = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
      if (ws) rows = XLSX.utils.sheet_to_json<TooltipRow>(ws, { defval: "" });
    }

    // Migrate older sheets that predate a column (e.g. Status): any row missing
    // the key gets it backfilled — Status defaults to "Active" so existing
    // tooltips keep showing. sheet_to_json omits keys for columns absent from
    // the file, so `!("Status" in r)` reliably detects the old 4-column layout.
    let migrated = false;
    for (const r of rows) {
      if (!("Status" in r) || String(r.Status ?? "").trim() === "") {
        r.Status = "Active";
        migrated = true;
      }
    }

    const present = new Set(rows.map(r => String(r.Tooltip_ID ?? "").trim()));
    const missing = REGISTERED_TOOLTIPS.filter(r => !present.has(r.Tooltip_ID));
    if (missing.length || migrated) {
      rows = [...rows, ...missing];
      fs.mkdirSync(dir, { recursive: true });
      writeWorkbook(file, rows);
    }

    const tooltips: TooltipMap = {};
    for (const r of rows) {
      const id = String(r.Tooltip_ID ?? "").trim();
      if (!id) continue;
      const text = String(r.Tooltip_Text ?? "").trim();
      const status = String(r.Status ?? "").trim().toLowerCase();
      // The icon shows only when the row is active AND has body copy; a blank
      // Tooltip_Text or Status=Inactive hides it. We still keep the row (with
      // its Title) so <InfoLabel> can rename the field regardless of the icon.
      const active = status !== "inactive" && text.length > 0;
      tooltips[id] = {
        location: String(r.Location ?? "").trim(),
        title: String(r.Title ?? "").trim() || undefined,
        text,
        active,
      };
    }
    return { success: true, tooltips };
  } catch (error) {
    console.error("Failed to read Tooltips.xlsx:", error);
    return { success: false, error: String(error) };
  }
}
