// Status helpers for the Input Sheet — the input-sheet twin of PkgSelectionStatus.
// They drive the Confirm button's blue/green/yellow state (via the shared
// `confirmVisual`) and the Revert button.
//
// The Input Sheet is never "incomplete" (it always has content), so only three of
// confirmVisual's four states apply:
//   blue   — nothing generated/confirmed yet (no baseline)
//   green  — the draft matches the canonical (confirmed) copy
//   yellow — the draft differs from the canonical (confirmed) copy
import type { InputSheetPayload, CellValue } from '../store/InputSheetAtoms';
import { editKey } from '../store/InputSheetAtoms';

function strHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Deterministic content hash of a workbook payload. Optional `dirty` overrides
// bake the in-memory (unsaved) edits into the hash so the live hash reflects what
// Confirm would record. Sheets/rows/columns are visited in a stable order so two
// payloads with identical values always hash the same.
export function payloadHash(
  payload: InputSheetPayload | null,
  dirty?: Map<string, CellValue>,
): string {
  if (!payload) return '';
  const parts: string[] = [];
  const tabs = [...payload.tabs].sort((a, b) => (a.sheet < b.sheet ? -1 : a.sheet > b.sheet ? 1 : 0));
  for (const tab of tabs) {
    const cols = [...tab.columns].sort((a, b) => a.key - b.key);
    const rows = [...tab.rows].sort((a, b) => a.id - b.id);
    for (const r of rows) {
      for (const c of cols) {
        const k = editKey(tab.sheet, r.id, c.key);
        const v = dirty?.has(k) ? dirty.get(k)! : (r.cells[c.key] ?? null);
        parts.push(`${k}=${v == null ? '' : String(v)}`);
      }
    }
  }
  return strHash(parts.join(''));
}
