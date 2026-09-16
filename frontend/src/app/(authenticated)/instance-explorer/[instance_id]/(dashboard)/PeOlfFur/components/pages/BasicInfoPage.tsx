'use client';
import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { fmsStateAtom, FurnaceInfo, defaultFurnaceInfo, basicInfoTabAtom, BASICINFO_TAB_TITLES, type BasicInfoTabKey } from '../../store/FmsAtoms';
import { FI_LICENSORS, COIL_TYPES } from '../../constants/Components';
import { syncHwTemplatesFromGroups } from '../../constants/HwGroupLogic';
import SvPanel from '../SvPanel';
import SegYesNo from './hw/SegYesNo';
import { usePanelRows } from '../usePanelRows';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT, CARD, TABLE, FIELD, BUTTON, MODAL, SEGMENT, InfoLabel, InfoTip } from '../../theme/Index';
import { useFmsSave } from '../../constants/SaveState';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

const BASICINFO_TABS: BasicInfoTabKey[] = ['fleet', 'uom'];

function furnaceName(info: FurnaceInfo, idx: number) {
  return info.name?.trim() ? `Furnace ${info.name.trim()}` : `Furnace ${idx + 1}`;
}

// All furnaces have valid, complete details (Pass/Cell must be a positive even
// number; Design Runlength is a positive number that may be fractional).
function furnacesValid(info: FurnaceInfo[], count: number): boolean {
  if (count < 1) return false; // no furnaces entered yet → Basic Information not done
  return info.slice(0, count).every(f => {
    const cv = parseInt(f.cells), pv = parseInt(f.passPerCell), tv = parseInt(f.tubesPerPass);
    const rv = parseFloat(f.designRunlength);
    return !!f.licensor && !!f.coilType &&
      Number.isInteger(cv) && cv >= 1 &&
      Number.isInteger(pv) && pv >= 1 && pv % 2 === 0 &&
      Number.isInteger(tv) && tv >= 1 &&
      Number.isFinite(rv) && rv > 0;
  });
}

// Numeric column config for the furnace table. `decimal` fields (design runlength)
// accept fractional input; the others are positive integers (pass/cell also even).
const NUM_FIELDS = [
  { key: 'cells', decimal: false },
  { key: 'passPerCell', decimal: false },
  { key: 'tubesPerPass', decimal: false },
  { key: 'designRunlength', decimal: true },
] as const;

// Furnace table column headers. Each carries a tooltip (registered in
// TooltipRegistry.ts). `wide` columns take 2× the base column width; the base
// (X) columns are the four numeric ones. `lines` forces a header to wrap onto
// exactly the given lines (rendered verbatim); single-label headers go through
// <InfoLabel> so the Tooltips.xlsx Title cell can still rename them.
const TABLE_HEADERS: { id: string; label: string; lines?: string[]; wide?: boolean }[] = [
  { id: 'basicinfo.name',             label: 'Name',            wide: true },
  { id: 'basicinfo.licensor',         label: 'Licensor',        wide: true },
  { id: 'basicinfo.design',           label: 'Design',          wide: true },
  { id: 'basicinfo.cells',            label: 'Cells' },
  { id: 'basicinfo.pass-per-cell',    label: 'Pass Per Cell',   lines: ['Pass Per', 'Cell'] },
  { id: 'basicinfo.tubes-per-pass',   label: 'Tubes Per Pass',  lines: ['Tubes Per', 'Pass'] },
  { id: 'basicinfo.design-runlength', label: 'Design Runlength', lines: ['Design', 'Runlength'] },
  { id: 'basicinfo.copy-setup-from',  label: 'Copy Setup From', lines: ['Copy Setup', 'From'], wide: true },
];

// ── Default UOM Manager (second tab) — lifted verbatim from the former UomManagerPage ──
const UOM_FIELD_OPTIONS = {
  massFlow:        ['kg/s','kg/h','t/h','t/s','lb/h','lb/s','MMlb/h'],
  temperature:     ['deg C','deg F'],
  temperatureDrop: ['deg C','deg F'],
  pressure:        ['Pag','barg','kPag','MPag','kg/cm2g','atmg','Pa','bar','kPa','MPa','kg/cm2','atm'],
  pressureDrop:    ['bar','kPa','mbar','kg/cm2'],
  work:            ['MW','kW','kcal/hr','GJ/hr','MMBtu/hr','J/s'],
  specificEnergy:  ['J/kg','kJ/kg','kcal/kg'],
  composition:     ['ppm(w)','ppm(v)','mol%','wt%'],
};

const UOM_FIELDS: { id: keyof typeof UOM_FIELD_OPTIONS; label: string }[] = [
  { id: 'massFlow',        label: 'Mass Flow Rate' },
  { id: 'temperature',     label: 'Temperature' },
  { id: 'temperatureDrop', label: 'Temperature Drop' },
  { id: 'pressure',        label: 'Pressure' },
  { id: 'pressureDrop',    label: 'Pressure Drop' },
  { id: 'work',            label: 'Work' },
  { id: 'specificEnergy',  label: 'Specific Energy' },
  { id: 'composition',     label: 'Composition' },
];

const UOM_FIXED_ROWS = [
  { label: 'Mole Weight', value: 'g/gmol' },
  { label: 'Humidity',    value: '%' },
  { label: 'pH',          value: 'pH' },
];

export default function BasicInfoPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const save = useFmsSave();  // per-entry save-state indicator (global rule)
  const [deleteDialog, setDeleteDialog] = useState<{
    targetCount: number; current: FurnaceInfo[]; selected: Set<number>
  } | null>(null);

  const n = fms.furnaceCount;

  // Furnace-count question (moved here from the dropped Home page). The table +
  // "same for all" switch only appear once a count is set.
  const [countRaw, setCountRaw] = useState(() => n > 0 ? String(n) : '');
  const [countErr, setCountErr] = useState('');
  useEffect(() => { if (n > 0) setCountRaw(String(n)); }, [n]);

  function applyCount() {
    const d = parseInt(countRaw);
    if (countRaw === '' || isNaN(d) || !Number.isInteger(d) || d < 1) {
      setCountErr('Enter a positive whole number (e.g. 4, 8, 12…)');
      return;
    }
    setCountErr('');
    if (d === n) return;
    if (d < n) {
      // Reducing → let the user pick which furnaces to remove (reuses the dialog).
      setDeleteDialog({ targetCount: d, current: fms.furnaceInfo.slice(0, n), selected: new Set() });
      return;
    }
    // Growing (including from 0) → append blank furnaces.
    setFms(prev => {
      const info = [...prev.furnaceInfo];
      while (info.length < d) info.push(defaultFurnaceInfo(info.length));
      info.length = d;
      return { ...prev, furnaceCount: d, furnaceInfo: info };
    });
  }

  // Auto-save (replaces the old "Save & Continue" button): keep basicInfoDone in
  // sync with validity and, on any edit to the furnace setup, reseed the hardware
  // templates from the copy groups. A mere visit (first render) only reconciles
  // the done flag so it doesn't disturb existing hardware progress.
  const firstRun = useRef(true);
  const groupSig = JSON.stringify(
    fms.furnaceInfo.slice(0, n).map(i => [i.licensor, i.coilType, i.cells, i.passPerCell, i.tubesPerPass, i.designRunlength, i.copyFrom]),
  );
  useEffect(() => {
    setFms(prev => {
      const ok = furnacesValid(prev.furnaceInfo, prev.furnaceCount);
      if (firstRun.current) {
        firstRun.current = false;
        return ok === prev.basicInfoDone ? prev : { ...prev, basicInfoDone: ok };
      }
      if (ok) return { ...prev, basicInfoDone: true, ...syncHwTemplatesFromGroups(prev) };
      return prev.basicInfoDone ? { ...prev, basicInfoDone: false } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSig]);

  function sig(info: FurnaceInfo) {
    return [info.licensor, info.coilType, info.cells, info.passPerCell, info.tubesPerPass, info.designRunlength].join('||');
  }

  function autoDetectCopy(info: FurnaceInfo[], fi: number): FurnaceInfo[] {
    const row = info[fi];
    if (fi === 0 || row.copyFrom !== null) return info;
    if (!row.licensor || !row.coilType || !row.cells || !row.passPerCell || !row.tubesPerPass || !row.designRunlength) return info;
    const mySig = sig(row);
    let matchIdx: number | null = null;
    for (let si = 0; si < fi; si++) {
      if (info[si].copyFrom !== null) continue;
      if (sig(info[si]) === mySig) { matchIdx = si; break; }
    }
    if (matchIdx === null) return info;
    const src = info[matchIdx];
    // Set fi as an auto-copy AND cascade: downstream rows that copied from fi follow to fi's root (mirrors v418 _cascadeAutoDetect)
    return info.map((r, i) => {
      if (i === fi) return { ...r, copyFrom: matchIdx!, _autoCopy: true };
      if (i > fi && r.copyFrom === fi) {
        return { ...r, _cascadeFrom: fi, copyFrom: matchIdx!,
          licensor: src.licensor, coilType: src.coilType,
          cells: src.cells, passPerCell: src.passPerCell, tubesPerPass: src.tubesPerPass,
          designRunlength: src.designRunlength };
      }
      return r;
    });
  }

  function updateInfo(fi: number, field: keyof FurnaceInfo, value: string) {
    setFms(prev => {
      let info = prev.furnaceInfo.map((row, i) => {
        if (i !== fi) {
          // Live-propagate row 0 changes to all rows that copy from row 0
          if (fi === 0 && prev.homeSameForAll && row.copyFrom === 0 && field !== 'name') {
            return { ...row, [field]: value };
          }
          return row;
        }
        // Editing the target row itself
        const newRow = { ...row, [field]: value };
        // If auto-detected copy and user edits a non-name field, revert to original
        if (row._autoCopy && field !== 'name') {
          newRow.copyFrom = null; newRow._autoCopy = false;
        }
        // Maintain the own-values snapshot for ORIGINAL rows so toggle-off / revert can
        // restore the user's last entry (mirrors v418 _syncFurnaceInfoReady saving _ownValues).
        if (newRow.copyFrom === null && field !== 'name') {
          newRow._ownValues = { ...newRow._ownValues, [field]: value };
        }
        return newRow;
      });
      // Re-run auto-detect for ALL eligible rows, including the one just edited
      // (mirrors v418 _syncFurnaceInfoReady, which runs _autoDetectCopy for every row 1..n).
      // This is what makes "re-enter identical details → Copy Setup From auto-decides" work
      // on the current row, not just later rows.
      for (let i = 1; i < info.length; i++) {
        if (!info[i]._autoCopy && info[i].copyFrom === null) {
          info = autoDetectCopy(info, i);
        }
      }
      return { ...prev, furnaceInfo: info };
    });
  }

  function cascadeRevert(info: FurnaceInfo[], fi: number, oldRoot: number | null): FurnaceInfo[] {
    return info.map((row, j) => {
      if (j <= fi) return row;
      if (row._cascadeFrom === fi && row.copyFrom === oldRoot) {
        const src = info[fi];
        return { ...row, copyFrom: fi, _cascadeFrom: null,
          licensor: src.licensor, coilType: src.coilType,
          cells: src.cells, passPerCell: src.passPerCell, tubesPerPass: src.tubesPerPass,
          designRunlength: src.designRunlength };
      }
      return row;
    });
  }

  function setCopyFrom(fi: number, val: string) {
    setFms(prev => {
      const srcIdx = val === '' ? null : parseInt(val);
      const info = prev.furnaceInfo.map((row, i) => {
        if (i !== fi) return row;
        if (srcIdx === null) {
          const oldRoot = row.copyFrom;
          let newRow = { ...row, copyFrom: null, _autoCopy: false };
          // Restore own values
          newRow = { ...newRow, ...newRow._ownValues };
          return newRow;
        }
        const src = prev.furnaceInfo[srcIdx];
        return {
          ...row, copyFrom: srcIdx, _autoCopy: false,
          licensor: src.licensor, coilType: src.coilType,
          cells: src.cells, passPerCell: src.passPerCell, tubesPerPass: src.tubesPerPass,
          designRunlength: src.designRunlength,
        };
      });
      // Cascade revert for rows that pointed at fi
      const finalInfo = cascadeRevert(info, fi, info[fi]?.copyFrom ?? null);
      // Auto-derive "same for all" (mirrors v418 onFiCopyChange): true when every row >0 copies row 0
      const sameForAll = finalInfo.length > 1 && finalInfo.slice(1).every(r => r.copyFrom === 0);
      return { ...prev, furnaceInfo: finalInfo, homeSameForAll: sameForAll };
    });
  }

  function toggleSameForAll(checked: boolean) {
    setFms(prev => {
      let info = prev.furnaceInfo.map((row, i) => {
        if (i === 0) return row;
        if (checked) {
          const src = prev.furnaceInfo[0];
          // Snapshot this row's own values before mirroring (only if it's currently an original),
          // so turning the toggle back off can restore them.
          const own = row.copyFrom === null
            ? { licensor: row.licensor, coilType: row.coilType, cells: row.cells, passPerCell: row.passPerCell, tubesPerPass: row.tubesPerPass, designRunlength: row.designRunlength }
            : row._ownValues;
          return { ...row, _ownValues: own, copyFrom: 0, _autoCopy: false,
            licensor: src.licensor, coilType: src.coilType, cells: src.cells, passPerCell: src.passPerCell, tubesPerPass: src.tubesPerPass, designRunlength: src.designRunlength };
        }
        // OFF: revert to each row's own last-entered values (mirrors v418 _restoreOwnValues)
        const own = row._ownValues || { licensor: '', coilType: '', cells: '', passPerCell: '', tubesPerPass: '', designRunlength: '' };
        return { ...row, copyFrom: null, _autoCopy: false,
          licensor: own.licensor || '', coilType: own.coilType || '', cells: own.cells || '',
          passPerCell: own.passPerCell || '', tubesPerPass: own.tubesPerPass || '', designRunlength: own.designRunlength || '' };
      });
      // Mirror v418 onHomeSameToggle → _syncFurnaceInfoReady: re-run auto-detect afterwards.
      // (When OFF restores blank values, nothing matches; when values are identical, rows
      // re-detect as copies just like v418.)
      if (!checked) {
        for (let i = 1; i < info.length; i++) {
          if (!info[i]._autoCopy && info[i].copyFrom === null) info = autoDetectCopy(info, i);
        }
      }
      return { ...prev, furnaceInfo: info, homeSameForAll: checked };
    });
  }


  function FurnaceDeleteDialog() {
    if (!deleteDialog) return null;
    const { targetCount, current, selected } = deleteDialog;
    const toRemove = current.length - targetCount;
    return (
      <div className={cn(MODAL.overlay, 'fixed z-[99999]')}>
        <div className={cn(MODAL.panel, 'p-6 min-w-[380px] max-w-[500px] max-h-[80vh] gap-3')}>
          <div className={cn(TEXT.cardTitle, 'uppercase')}>Select Furnaces to Remove</div>
          <div className={cn(TEXT.caption, 'leading-relaxed')}>
            Reducing from <b className="text-text-primary">{current.length}</b> to <b className="text-text-primary">{targetCount}</b> furnaces.<br/>
            Check exactly <b className="text-accent-red">{toRemove}</b> row(s) to remove, then click Delete.
          </div>
          <div className="overflow-y-auto flex flex-col gap-1 max-h-80 pr-1">
            {current.map((info, i) => (
              <label key={i} className={cn(TEXT.tableCell, 'flex items-center gap-2.5 px-2.5 py-1.5 rounded border border-border bg-surface-hover cursor-pointer select-none')}>
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => {
                    const s = new Set(selected);
                    s.has(i) ? s.delete(i) : s.add(i);
                    setDeleteDialog(prev => prev ? { ...prev, selected: s } : null);
                  }}
                  className="w-3.5 h-3.5 accent-accent-blue cursor-pointer flex-shrink-0"
                />
                <span className={cn(TEXT.annotation, 'min-w-[28px]')}>F{i+1}</span>
                <span>{furnaceName(info, i)}</span>
              </label>
            ))}
          </div>
          <div className={cn(TEXT.annotation, selected.size === toRemove && 'text-accent-green')}>
            {selected.size} of {toRemove} selected
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setDeleteDialog(null); setCountRaw(String(fms.furnaceCount)); }}
              className={cn(TEXT.button, BUTTON.ghost, 'px-4 py-2')}
            >Cancel</button>
            <button
              onClick={() => {
                if (!deleteDialog || selected.size !== toRemove) return;
                const newInfo = current.filter((_, i) => !selected.has(i));
                setFms(prev => ({ ...prev, furnaceCount: targetCount, furnaceInfo: newInfo }));
                setDeleteDialog(null);
              }}
              disabled={selected.size !== toRemove}
              className={cn(TEXT.button, 'px-4 py-2 border rounded transition',
                selected.size === toRemove
                  ? 'bg-accent-red border-accent-red text-white hover:opacity-90'
                  : 'border-border text-text-secondary cursor-not-allowed'
              )}
            >Delete Selected</button>
          </div>
        </div>
      </div>
    );
  }

  const [tab, setTab] = useAtom(basicInfoTabAtom);

  // The UOM tab is prefilled, so reaching it once counts the module as visited
  // (mirrors the former UomManagerPage mount effect; feeds uomDone / Hub Confirm).
  useEffect(() => {
    if (tab === 'uom') setFms(prev => prev.visitedUom ? prev : { ...prev, visitedUom: true });
  }, [tab, setFms]);

  function setUom(key: string, val: string) {
    setFms(prev => ({ ...prev, uom: { ...prev.uom, [key]: val }, visitedUom: true, uomConfirmed: true }));
  }

  // The variable panel follows the active tab: furnace variables on Fleet Record,
  // UOM variables on the Default UOM Manager tab.
  const fleetRows = usePanelRows('Furnace Info');
  const uomRows = usePanelRows('UOM');

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <SvPanel rows={tab === 'uom' ? uomRows : fleetRows} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <FurnaceDeleteDialog />

      {/* Pill tabs — page tab bar ABOVE the scroll region: it never scrolls and no
          content can appear between it and the top bar (SEGMENT.bar). */}
      <div className={SEGMENT.bar}>
        <div className={SEGMENT.group}>
          {BASICINFO_TABS.map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(styles.mono, SEGMENT.item, 'min-w-[180px] px-6 py-2 text-[11px]', tab === k ? SEGMENT.active : SEGMENT.inactive)}
            >
              {BASICINFO_TAB_TITLES[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable page body */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-10 px-5 gap-6">

      {tab === 'fleet' && (
      <div className={cn(CARD.base, 'p-8 flex flex-col items-center gap-5 w-full max-w-5xl shadow-xl')}>
        {/* Single-row control strip: count question, Set, and the same-for-all switch */}
        <div className="w-full flex flex-col items-center gap-2">
          <div className="w-full flex items-center justify-center flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className={cn(TEXT.eyebrow, 'tracking-[.1em]')}>
                Total number of furnaces in complex
              </span>
              <input
                type="number" min={1} step={1}
                value={countRaw}
                onChange={e => { setCountRaw(e.target.value.replace(/[^0-9]/g, '')); setCountErr(''); }}
                onKeyDown={e => { if (['e','E','.','+',' ','-'].includes(e.key)) e.preventDefault(); if (e.key === 'Enter') applyCount(); }}
                className={cn(TEXT.numericInput, FIELD.input, styles.numInput, 'w-28 py-2 text-center', countErr && 'border-accent-red')}
              />
              <button onClick={applyCount} className={cn(TEXT.button, BUTTON.ghost, 'px-4 py-2 whitespace-nowrap')}>Set</button>
            </div>

            {n >= 2 && (
              <div className="flex items-center gap-2">
                <span className={cn(TEXT.eyebrow, 'tracking-wide')}>Same for all furnaces</span>
                <SegYesNo
                  value={fms.homeSameForAll ? 1 : 0}
                  onYes={() => toggleSameForAll(true)}
                  onNo={() => toggleSameForAll(false)}
                />
              </div>
            )}
          </div>
          {countErr && <div className={cn(TEXT.annotation, 'text-accent-red')}>{countErr}</div>}
        </div>

        {n >= 1 && (<>
        <div className="w-full h-px bg-border" />

        <div className="w-full overflow-x-auto">
          <div className={TABLE.wrap}>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className={TABLE.header}>
                {TABLE_HEADERS.map(h => (
                  <th
                    key={h.id}
                    style={{ width: h.wide ? '16.666%' : '8.333%' }}
                    className={cn(TEXT.tableHeader, 'tracking-[.06em] uppercase text-text-secondary px-1 py-2 text-center align-bottom')}
                  >
                    {h.lines ? (
                      <span className="inline-flex flex-col items-center leading-tight tracking-normal">
                        {h.lines.map((ln, i) => (
                          <span key={i} className="whitespace-nowrap">
                            {ln}
                            {i === h.lines!.length - 1 && (
                              <InfoTip id={h.id} side="bottom" className="align-super ml-px" />
                            )}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <InfoLabel id={h.id} fallback={h.label} side="bottom" className="align-super ml-px" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fms.furnaceInfo.slice(0, n).map((info, fi) => {
                const locked = fi > 0 && info.copyFrom !== null && !info._autoCopy;
                const disabledCls = locked ? 'opacity-40 pointer-events-none' : '';
                const isLast = fi === n - 1;
                return (
                  <tr key={fi} className={clsx(TABLE.row, isLast && '[&>td]:border-b-0')}>
                    {/* Name */}
                    <td className="px-2 py-1.5 border-b border-border text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn(TEXT.annotation, 'whitespace-nowrap')}>Furnace</span>
                        <input
                          type="text" maxLength={20}
                          value={info.name}
                          onChange={e => updateInfo(fi, 'name', e.target.value || String(fi+1))}
                          placeholder={String(fi+1)}
                          className={cn(TEXT.tableCell, FIELD.input, 'px-2 py-1 w-24', save(info.name, f => f.furnaceInfo[fi]?.name))}
                        />
                      </div>
                    </td>
                    {/* Licensor */}
                    <td className="px-2 py-1.5 border-b border-border">
                      <select
                        value={info.licensor}
                        onChange={e => updateInfo(fi, 'licensor', e.target.value)}
                        className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, disabledCls, 'px-2 py-1 w-full', !info.licensor && 'text-text-secondary', save(info.licensor, f => f.furnaceInfo[fi]?.licensor))}
                        style={{ textAlign: 'center', textAlignLast: 'center' }}
                      >
                        <option value="">Select licensor…</option>
                        {FI_LICENSORS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    {/* Coil Type */}
                    <td className="px-2 py-1.5 border-b border-border">
                      <select
                        value={info.coilType}
                        onChange={e => updateInfo(fi, 'coilType', e.target.value)}
                        className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, disabledCls, 'px-2 py-1 w-full', !info.coilType && 'text-text-secondary', save(info.coilType, f => f.furnaceInfo[fi]?.coilType))}
                        style={{ textAlign: 'center', textAlignLast: 'center' }}
                      >
                        <option value="">Select coil type…</option>
                        {COIL_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    {/* Cells, Pass/Cell, Tubes/Pass, Design Runlength */}
                    {NUM_FIELDS.map(({ key: field, decimal }) => {
                      const raw = info[field] as string;
                      const num = decimal ? parseFloat(raw) : parseInt(raw);
                      const fieldOk = field === 'passPerCell'
                        ? Number.isInteger(num) && num >= 1 && num % 2 === 0
                        : decimal
                          ? Number.isFinite(num) && num > 0
                          : Number.isInteger(num) && num >= 1;
                      const showErr = raw !== '' && !fieldOk;
                      // Integer fields block '.'/'-'; decimal fields allow '.' but not sign/exponent.
                      const blockedKeys = decimal ? ['e','E','+',' '] : ['e','E','.','+',' ','-'];
                      return (
                        <td key={field} className="px-2 py-1.5 border-b border-border">
                          <input
                            type="number" min={decimal ? 0 : 1} step={decimal ? 'any' : 1}
                            value={raw}
                            onChange={e => updateInfo(fi, field, e.target.value)}
                            onKeyDown={e => { if (blockedKeys.includes(e.key)) e.preventDefault(); }}
                            className={cn(TEXT.tableCell, FIELD.input, styles.numInput, disabledCls, 'px-2 py-1 w-16 text-center', showErr && 'border-accent-red', save(raw, f => f.furnaceInfo[fi]?.[field]))}
                            title={field === 'passPerCell' ? 'Even number (2, 4, 6…)' : field === 'designRunlength' ? 'Positive number (design run length)' : undefined}
                          />
                        </td>
                      );
                    })}
                    {/* Copy From */}
                    <td className="px-2 py-1.5 border-b border-border text-center">
                      {fi === 0 ? (
                        <span className={cn(TEXT.eyebrow, 'tracking-wide')}>Original</span>
                      ) : (
                        <select
                          value={info.copyFrom === null ? '' : String(info.copyFrom)}
                          onChange={e => setCopyFrom(fi, e.target.value)}
                          className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, 'px-2 py-1 w-full', save(info.copyFrom, f => f.furnaceInfo[fi]?.copyFrom))}
                          style={{ textAlign: 'center', textAlignLast: 'center' }}
                          disabled={info._autoCopy}
                        >
                          <option value="">Original</option>
                          {fms.furnaceInfo.slice(0, fi).map((src, si) =>
                            src.copyFrom === null ? (
                              <option key={si} value={String(si)}>{furnaceName(src, si)}</option>
                            ) : null
                          )}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        </>)}

      </div>
      )}

      {tab === 'uom' && (
      <div className={cn(CARD.base, 'px-8 py-6 flex flex-col w-full max-w-lg shadow-lg')}>
        <div className={cn(TABLE.wrap, TABLE.divide, 'flex flex-col')}>
        {/* Table header — Measured Property | UOM (each with an info tooltip) */}
        <div className={cn(TABLE.header, 'flex items-center justify-between px-3 py-2')}>
          <span className={cn(TEXT.tableHeader, 'tracking-[.08em] uppercase text-text-secondary')}>
            <InfoLabel id="uom.measured-property" fallback="Measured Property" className="align-super ml-px" />
          </span>
          <span className={cn(TEXT.tableHeader, 'tracking-[.08em] uppercase text-text-secondary w-28 text-center')}>
            <InfoLabel id="uom.unit" fallback="UOM" className="align-super ml-px" />
          </span>
        </div>
        {UOM_FIELDS.map(f => (
          <div key={f.id} className={cn(TABLE.row, 'flex items-center justify-between px-3 py-1.5')}>
            <div className={cn(TEXT.tableRowLabel, 'text-text-primary')}>{f.label}</div>
            <select
              value={fms.uom[f.id as keyof typeof fms.uom]}
              onChange={e => setUom(f.id, e.target.value)}
              className={cn(TEXT.tableCell, FIELD.input, styles.fiSel, 'w-28 h-8', save(fms.uom[f.id as keyof typeof fms.uom], ff => ff.uom[f.id as keyof typeof ff.uom]))}
              style={{ textAlign: 'center', textAlignLast: 'center' }}
            >
              {(UOM_FIELD_OPTIONS[f.id as keyof typeof UOM_FIELD_OPTIONS]).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}

        {UOM_FIXED_ROWS.map(r => (
          <div key={r.label} className={cn(TABLE.row, 'flex items-center justify-between px-3 py-1.5')}>
            <div className={cn(TEXT.tableRowLabel, 'text-text-primary')}>{r.label}</div>
            <span className={cn(TEXT.tableCell, 'w-28 h-8 flex items-center justify-center text-text-secondary bg-surface-hover rounded border border-border')}>
              {r.value}
            </span>
          </div>
        ))}
        </div>

      </div>
      )}

      </div>{/* scroll body */}
      </div>{/* main column */}
    </div>
  );
}
