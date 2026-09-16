'use client';
import { useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useAtom } from 'jotai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT } from '../../theme/TextTypes';
import {
  inputSheetDataAtom, dirtyEditsAtom, pageAtom, pageSizeAtom, searchAtom, pkgFilterAtom,
  nameColWidthAtom, editKey, type TabData, type RowData, type ColumnMeta, type CellValue,
} from '../../store/InputSheetAtoms';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

const PKG_COL = 'package type';

function colByLabel(columns: ColumnMeta[], label: string): ColumnMeta | undefined {
  return columns.find(c => c.label === label);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a case-insensitive matcher for the search box.
// `*` is a wildcard matching any run of characters (including none); multiple
// stars are supported, e.g. `*abc*def*k` matches any name containing "abc",
// then "def", then "k" in that order. The match is unanchored, so `*Feed_1`,
// `Feed_1*`, and `Feed_1` all behave as "contains Feed_1". A query with no `*`
// is a plain substring match.
function makeMatcher(query: string): (value: string) => boolean {
  const q = query.trim().toLowerCase();
  if (!q) return () => true;
  if (!q.includes('*')) return v => v.toLowerCase().includes(q);
  const re = new RegExp(q.split('*').map(escapeRegExp).join('.*'));
  return v => re.test(v.toLowerCase());
}

export default function InputSheetTable({ tab }: { tab: TabData }) {
  const [data] = useAtom(inputSheetDataAtom);
  const [dirty, setDirty] = useAtom(dirtyEditsAtom);
  const [page, setPage] = useAtom(pageAtom);
  const [pageSize, setPageSize] = useAtom(pageSizeAtom);
  const [search, setSearch] = useAtom(searchAtom);
  const [pkgFilter, setPkgFilter] = useAtom(pkgFilterAtom);
  const [nameW, setNameW] = useAtom(nameColWidthAtom);

  const optionSets = useMemo(() => data?.optionSets ?? [], [data]);
  const descriptions = data?.descriptions ?? {};
  const syncLabel = data?.syncColumn ?? 'User_Display_Name';

  const visibleCols = useMemo(() => tab.columns.filter(c => !c.hidden), [tab]);
  const pkgCol = colByLabel(tab.columns, PKG_COL);

  // Distinct package-type values for the filter dropdown.
  const pkgValues = useMemo(() => {
    if (!pkgCol) return [];
    const set = new Set<string>();
    for (const r of tab.rows) {
      const v = r.cells[pkgCol.key];
      if (v != null && String(v).length) set.add(String(v));
    }
    return Array.from(set).sort();
  }, [tab, pkgCol]);

  // Per-column layout: content-sized width + alignment. Only User_Display_Name and
  // a literal "Value" column are left-aligned; everything else is centered. Widths
  // are derived from the header label and (for dropdowns) the longest option text,
  // so this stays correct as the schema changes.
  const layout = useMemo(() => {
    const res = new Map<number, { width: number; center: boolean }>();
    const optIdxs = new Map<number, Set<number>>();
    for (const c of visibleCols) optIdxs.set(c.key, new Set());
    for (const r of tab.rows) {
      for (const c of visibleCols) {
        const oi = r.opts[c.key];
        if (oi !== undefined) optIdxs.get(c.key)!.add(oi);
      }
    }
    for (const c of visibleCols) {
      const center = c.label !== syncLabel && c.label !== 'Value';
      let chars = c.label.length;
      for (const i of optIdxs.get(c.key)!) {
        for (const o of optionSets[i] ?? []) chars = Math.max(chars, o.length);
      }
      let width: number;
      if (c.label === syncLabel) width = nameW;       // user-resizable (long tag names)
      else if (c.label === 'Value') width = 120;
      else width = Math.min(240, Math.max(64, Math.round(chars * 6.8) + 28));
      res.set(c.key, { width, center });
    }
    return res;
  }, [tab, visibleCols, optionSets, syncLabel, nameW]);

  // Exact table width = index column + sum of all visible column widths. Applied
  // explicitly so the fixed layout never overflows into dead scroll space.
  const totalWidth = useMemo(
    () => 44 + visibleCols.reduce((s, c) => s + (layout.get(c.key)?.width ?? 0), 0),
    [visibleCols, layout],
  );

  // Effective value = dirty override if present, else original cell value.
  const effective = (sheet: string, row: RowData, col: ColumnMeta): CellValue => {
    const k = editKey(sheet, row.id, col.key);
    return dirty.has(k) ? dirty.get(k)! : (row.cells[col.key] ?? null);
  };

  // Filtered rows: search matches User_Display_Name only (supports `*` wildcards);
  // pkg filter is an exact match on the package-type column.
  const nameCol = colByLabel(tab.columns, syncLabel);
  const filtered = useMemo(() => {
    const matches = makeMatcher(search);
    return tab.rows.filter(r => {
      if (pkgCol && pkgFilter && String(r.cells[pkgCol.key] ?? '') !== pkgFilter) return false;
      const name = nameCol ? r.cells[nameCol.key] : null;
      return matches(name != null ? String(name) : '');
    });
  }, [tab, search, pkgFilter, pkgCol, nameCol]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  // Drag-to-resize the User_Display_Name column.
  function startNameResize(e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = nameW;
    const onMove = (ev: MouseEvent) => setNameW(Math.max(120, Math.min(640, startW + ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  function setCell(col: ColumnMeta, row: RowData, value: CellValue) {
    setDirty(prev => {
      const next = new Map(prev);
      const k = editKey(tab.sheet, row.id, col.key);
      const orig = row.cells[col.key] ?? null;
      if (norm(value) === norm(orig)) next.delete(k); else next.set(k, value);

      // Mirror User_Display_Name edits to every other tab's same row so both tabs
      // reflect the change immediately (the server mirrors on save too).
      if (col.label === syncLabel && data) {
        for (const otherTab of data.tabs) {
          if (otherTab.sheet === tab.sheet) continue;
          const oc = colByLabel(otherTab.columns, syncLabel);
          if (!oc) continue;
          const orow = otherTab.rows.find(rr => rr.id === row.id);
          const oorig = orow ? (orow.cells[oc.key] ?? null) : null;
          const ok = editKey(otherTab.sheet, row.id, oc.key);
          if (norm(value) === norm(oorig)) next.delete(ok); else next.set(ok, value);
        }
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name… (* wildcard)"
          title="Search User_Display_Name. Use * as a wildcard, e.g. *abc*def*k"
          className={cn(TEXT.breadcrumb, 'bg-surface border border-border rounded px-3 py-1.5 text-text-primary outline-none focus:border-accent-blue w-56')}
        />
        {pkgCol && (
          <select
            value={pkgFilter}
            onChange={e => { setPkgFilter(e.target.value); setPage(1); }}
            className={cn(TEXT.breadcrumb, 'bg-surface border border-border rounded px-2 py-1.5 text-text-primary outline-none focus:border-accent-blue max-w-[280px]')}
          >
            <option value="">All package types</option>
            {pkgValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        <span className={cn(TEXT.annotation, 'text-text-secondary')}>
          {total.toLocaleString()} row{total === 1 ? '' : 's'}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-border rounded-lg min-h-0">
        <table style={{ width: totalWidth, tableLayout: 'fixed' }} className={cn(TEXT.tableCell, 'border-collapse')}>
          <colgroup>
            <col style={{ width: 44 }} />
            {visibleCols.map(col => <col key={col.key} style={{ width: layout.get(col.key)!.width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-header">
              {/* Row index header: annotation — micro-index, not a content header */}
              <th className={cn(TEXT.annotation, 'sticky left-0 z-20 bg-table-header border-b border-r border-border px-2 py-2 font-medium text-text-secondary text-left')}>#</th>
              {visibleCols.map(col => {
                const center = layout.get(col.key)!.center;
                const resizable = col.label === syncLabel;
                return (
                  <th key={col.key} className={cn(TEXT.tableHeader, 'relative border-b border-r border-border px-2 py-2 font-medium text-text-primary whitespace-nowrap', center ? 'text-center' : 'text-left')}>
                    <span className={clsx('inline-flex items-center gap-1', center && 'justify-center')}>
                      {col.label}
                      {descriptions[col.label] && <InfoTip text={descriptions[col.label]} />}
                    </span>
                    {resizable && (
                      <span
                        onMouseDown={startNameResize}
                        title="Drag to resize column"
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-accent-blue/60 active:bg-accent-blue"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              return (
              <tr key={row.id} className="bg-table-body hover:bg-surface-hover">
                <td className={cn(TEXT.annotation, 'sticky left-0 z-10 bg-table-body border-b border-r border-border px-2 py-1 text-text-secondary text-right tabular-nums')}>
                  {row.id - 1}
                </td>
                {visibleCols.map(col => {
                  const k = editKey(tab.sheet, row.id, col.key);
                  const isDirty = dirty.has(k);
                  const val = effective(tab.sheet, row, col);
                  const optIdx = row.opts[col.key];
                  const center = layout.get(col.key)!.center;
                  // "NA" marks a cell that is locked for user intervention — show it
                  // greyed and non-editable (its value is preserved untouched on save).
                  const locked = val != null && String(val) === 'NA';
                  return (
                    <td key={col.key} className={clsx('border-b border-r border-border px-1 py-0.5', !locked && isDirty && 'bg-accent-yellow/15')}>
                      {locked
                        ? <div className="w-full px-2 py-1 rounded bg-border/25 cursor-not-allowed select-none" aria-disabled title="Locked — not editable">&nbsp;</div>
                        : optIdx !== undefined
                          ? <SelectCell value={val} options={optionSets[optIdx] ?? []} dirty={isDirty} center={center} onChange={v => setCell(col, row, v)} />
                          : <TextCell value={val} dirty={isDirty} center={center} onChange={v => setCell(col, row, v)} />}
                    </td>
                  );
                })}
              </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr><td colSpan={visibleCols.length + 1} className={cn(TEXT.breadcrumb, 'px-4 py-8 text-center text-text-secondary')}>No rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — Rows/page (left) · Page nav (right). Confirm/Revert lives in
          the page-level bar (InputSheetPage), not here. */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 justify-start">
          <span className={cn(TEXT.annotation, 'text-text-secondary')}>Rows/page</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className={cn(TEXT.breadcrumb, 'bg-surface border border-border rounded px-2 py-1 text-text-primary outline-none focus:border-accent-blue')}
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <PageBtn disabled={safePage <= 1} onClick={() => setPage(1)}>«</PageBtn>
          <PageBtn disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</PageBtn>
          <span className={cn(TEXT.breadcrumb, 'text-text-primary px-2')}>
            Page {safePage} / {pageCount}
          </span>
          <PageBtn disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>›</PageBtn>
          <PageBtn disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>»</PageBtn>
        </div>
      </div>
    </div>
  );
}

// Treat null/'' as equal for dirty comparison; compare loosely as strings.
function norm(v: CellValue): string { return v == null ? '' : String(v); }

function TextCell({ value, dirty, center, onChange }: { value: CellValue; dirty: boolean; center: boolean; onChange: (v: string) => void }) {
  return (
    <input
      value={value == null ? '' : String(value)}
      onChange={e => onChange(e.target.value)}
      className={cn(
        TEXT.tableCell,
        'w-full bg-transparent px-2 py-1 outline-none rounded',
        'border border-transparent hover:border-border focus:border-accent-blue focus:bg-surface',
        center && 'text-center',
        dirty && 'text-accent-orange',
      )}
    />
  );
}

function SelectCell({ value, options, dirty, center, onChange }: { value: CellValue; options: string[]; dirty: boolean; center: boolean; onChange: (v: string) => void }) {
  const cur = value == null ? '' : String(value);
  const known = options.includes(cur);
  return (
    <select
      value={cur}
      onChange={e => onChange(e.target.value)}
      className={cn(
        TEXT.tableCell,
        'w-full bg-transparent px-1 py-1 outline-none rounded cursor-pointer',
        'border border-transparent hover:border-border focus:border-accent-blue focus:bg-surface',
        center && 'text-center',
        dirty ? 'text-accent-orange' : 'text-text-primary',
      )}
    >
      {cur === '' && <option value=""></option>}
      {!known && cur !== '' && <option value={cur}>{cur}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PageBtn({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        TEXT.tableCell,
        'w-7 h-7 rounded border flex items-center justify-center transition',
        disabled
          ? 'border-border text-text-secondary opacity-40 cursor-not-allowed'
          : 'border-border text-text-primary hover:border-accent-blue cursor-pointer',
      )}
    >
      {children}
    </button>
  );
}

function InfoTip({ text }: { text: string }) {
  // The tooltip is `hidden` (display:none) until hover — an absolutely-positioned
  // element kept in the DOM with only opacity:0 still expands the scroll
  // container's scrollWidth, which was creating phantom horizontal scroll space.
  return (
    <span className="relative inline-flex group align-middle">
      {/* The "i" glyph icon: keep text-[8px] as it is an icon glyph, not text content */}
      <span className={clsx(styles.mono, 'inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold cursor-default bg-border text-text-secondary')}>i</span>
      <span className={cn(
        TEXT.annotation,
        'hidden group-hover:block absolute top-[calc(100%+6px)] right-0 z-30',
        'bg-surface border border-border rounded px-2.5 py-2 leading-relaxed text-text-primary normal-case font-normal',
        'w-[260px] max-w-[260px] pointer-events-none shadow-xl whitespace-normal',
      )}>
        {text}
      </span>
    </span>
  );
}
