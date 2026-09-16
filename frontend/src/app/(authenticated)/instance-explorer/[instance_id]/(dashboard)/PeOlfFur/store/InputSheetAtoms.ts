import { atom } from 'jotai';

export type CellValue = string | number | boolean | null;
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

// Loaded workbook payload (null until fetched).
export const inputSheetDataAtom = atom<InputSheetPayload | null>(null);
export const inputSheetLoadingAtom = atom<boolean>(false);
export const inputSheetErrorAtom = atom<string | null>(null);

// Active tab id ('details' | 'config').
export const activeTabAtom = atom<string>('details');

// User-adjustable width (px) of the User_Display_Name column. Persists across tabs.
export const nameColWidthAtom = atom<number>(240);

// Pagination + filtering (per-tab UI state is reset when switching tabs).
export const pageAtom = atom<number>(1);
export const pageSizeAtom = atom<number>(50);
export const searchAtom = atom<string>('');
export const pkgFilterAtom = atom<string>('');

// Dirty (unsaved-to-draft) edits keyed by `${sheet}!${rowId}!${colKey}` -> new value.
export interface EditKeyParts { sheet: string; row: number; col: number; }
export const dirtyEditsAtom = atom<Map<string, CellValue>>(new Map());
export const savingAtom = atom<boolean>(false);
export const saveMsgAtom = atom<string | null>(null);

export function editKey(sheet: string, row: number, col: number): string {
  return `${sheet}!${row}!${col}`;
}

// Confirmed baseline signature = the canonical copy's hash. The Confirm button is
// green when the current draft (loaded payload + dirty edits) hashes to this.
// null → nothing generated/confirmed yet (blue). Seeded on load from the canonical
// payload, set on Confirm/Revert/Upload.
export const inputSheetBaselineAtom = atom<{ hash: string } | null>(null);
