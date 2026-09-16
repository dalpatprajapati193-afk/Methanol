'use client';
import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import {
  fmsStateAtom, FmsState,
  FfiTemplate, FfiFeedData, FfiOptions,
  ffiDefaultOptions, ffiDefaultFeedData, ffiBuildTplData,
  ConvFields, RadFields, TleFields,
} from '../../store/FmsAtoms';
import SvPanel from '../SvPanel';
import { usePanelRows } from '../usePanelRows';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT, TABLE, FIELD, BUTTON, BADGE } from '../../theme/Index';
import { bankDisplayCode } from '../../constants/Components';
import ConvBankSvg, { ConvModeCfg, ConvModeStream } from './hw/ConvBankSvg';
import SegYesNo from './hw/SegYesNo';
import HwTemplateList from './hw/HwTemplateList';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

// ── Feed definitions ──
const AREA_FEED_DEFS = [
  { key: 'eth',    label: 'Ethane',          existsKey: 'eth_exists'    },
  { key: 'pro',    label: 'Propane',         existsKey: 'pro_exists'    },
  { key: 'but',    label: 'Butane',          existsKey: 'but_exists'    },
  { key: 'nap',    label: 'Liquid',          existsKey: 'nap_exists'    },
  { key: 'gen_fr', label: 'Fresh & Recycle', existsKey: 'gen_fr_exists' },
  { key: 'gen_tf', label: 'Total Feed',      existsKey: 'gen_tf_exists' },
];

// ── Cell state ──
type CellState =
  | { type: 'auto';   value: boolean }   // locked / inferred
  | { type: 'user';   value: boolean }   // user-editable
  | { type: 'absent' };                  // bank not in template

function CellSwitch({ state, onSet }: { state: CellState; onSet?: (v: boolean) => void }) {
  if (state.type === 'absent') {
    return <span className={cn(TEXT.annotation, 'text-text-secondary opacity-30')}>N/A</span>;
  }
  // Auto-filled / locked → shared SegYesNo renders a single centered BLUE label (just the value).
  if (state.type === 'auto') {
    return <SegYesNo value={state.value ? 1 : 0} locked />;
  }
  // Editable → green YES / red NO via the same shared component as the rest of the app.
  return (
    <SegYesNo
      value={state.value ? 1 : 0}
      onYes={() => onSet?.(true)}
      onNo={() => onSet?.(false)}
    />
  );
}

export default function FeedFurnaceInteractionPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);

  // All 6 area feeds always used; areaActive flag marks which exist in P&ID
  const allAreaFeeds    = AREA_FEED_DEFS.map(d => ({ ...d, areaActive: fms.pidVars[d.existsKey] === 1 }));
  const activeAreaFeeds = allAreaFeeds.filter(d => d.areaActive);
  const allFeedKeys     = activeAreaFeeds.map(d => d.key);

  // ── Conv+Rad combo key — one FFI template per unique combo ──
  function ffiComboKey(prev: typeof fms, fi: number): string {
    const convSec = prev.hwConv;
    const radSec  = prev.hwRad;
    const single2 = prev.furnaceCount === 1;
    const convId = (convSec?.sameForAll === 1 || single2)
      ? (convSec?.templates[0]?.id || 'conv-0')
      : (convSec?.applyMap[fi] || 'conv-0');
    const radId  = (radSec?.sameForAll  === 1 || single2)
      ? (radSec?.templates[0]?.id  || 'rad-0')
      : (radSec?.applyMap[fi]  || 'rad-0');
    return `${convId}::${radId}`;
  }

  // ── Init ──
  useEffect(() => {
    setFms(prev => {
      if (prev.ffiTemplates.length > 0) return prev;
      const nF = prev.furnaceCount;
      if (nF === 0) return prev;
      const tplData = ffiBuildTplData(allFeedKeys);
      const applyMap: Record<number, string> = {};
      let templates: FfiTemplate[];

      if (nF === 1 || prev.ffiSameForAll === 1) {
        // Single furnace or forced same-for-all: one template
        const t: FfiTemplate = { id: 'ffi-1', name: 'Template 1', furnaces: Array.from({ length: nF }, (_, i) => i), ...tplData };
        templates = [t];
        for (let fi = 0; fi < nF; fi++) applyMap[fi] = 'ffi-1';
      } else {
        // Group furnaces by unique (conv template, rad template) combination
        const groups: Record<string, number[]> = {};
        for (let fi = 0; fi < nF; fi++) {
          const k = ffiComboKey(prev, fi);
          if (!groups[k]) groups[k] = [];
          groups[k].push(fi);
        }
        templates = [];
        let idx = 1;
        for (const furnaces of Object.values(groups)) {
          // Follow the generic template-bar naming: Template 1, Template 2, …
          const t: FfiTemplate = { id: `ffi-${idx}`, name: `Template ${idx}`, furnaces, ...tplData };
          templates.push(t);
          furnaces.forEach(fi => { applyMap[fi] = t.id; });
          idx++;
        }
        // If every furnace lands in a single template, that's effectively "all furnaces same"
        if (templates.length === 1) {
          return { ...prev, ffiSameForAll: 1, ffiTemplates: templates, ffiApplyMap: applyMap, ffiSelectedTplId: templates[0].id };
        }
      }
      return { ...prev, ffiTemplates: templates, ffiApplyMap: applyMap, ffiSelectedTplId: templates[0]?.id || null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tpls    = fms.ffiTemplates;
  const selId   = fms.ffiSelectedTplId;
  const selTpl  = tpls.find(t => t.id === selId) || null;
  const single  = fms.furnaceCount === 1;
  const sameAll = fms.ffiSameForAll === 1 || single;

  function patchTpl(id: string, patch: Partial<FfiTemplate>) {
    setFms(prev => ({ ...prev, ffiTemplates: prev.ffiTemplates.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }

  function patchOptions(id: string, patch: Partial<FfiOptions>) {
    const tpl = tpls.find(t => t.id === id);
    if (!tpl) return;
    patchTpl(id, { options: { ...tpl.options, ...patch } as FfiOptions });
  }

  function patchFeedData(id: string, feedKey: string, patch: Partial<FfiFeedData>) {
    const tpl = tpls.find(t => t.id === id);
    if (!tpl) return;
    const old = tpl.data[feedKey] || ffiDefaultFeedData();
    // The caller (setStageCol) already includes any series auto-follow in `patch`, so this
    // is a plain merge — the dedicated stage fields are written exactly as supplied.
    const updated = { ...old, ...patch };
    patchTpl(id, { data: { ...tpl.data, [feedKey]: updated } });
  }

  function addTemplate() {
    if (sameAll) return;
    const id = `ffi-${Date.now()}`;
    const t: FfiTemplate = { id, name: `Template ${tpls.length + 1}`, furnaces: [], ...ffiBuildTplData(allFeedKeys) };
    setFms(prev => ({ ...prev, ffiTemplates: [...prev.ffiTemplates, t], ffiSelectedTplId: id }));
  }

  function removeTemplate() {
    if (tpls.length <= 1) return;
    const idx = tpls.findIndex(t => t.id === selId);
    const removed = tpls[idx];
    const newTpls = tpls.filter(t => t.id !== selId);
    const newMap  = { ...fms.ffiApplyMap };
    removed.furnaces.forEach(fi => delete newMap[fi]);
    const newSel = newTpls[Math.min(idx, newTpls.length - 1)]?.id || null;
    setFms(prev => ({ ...prev, ffiTemplates: newTpls, ffiApplyMap: newMap, ffiSelectedTplId: newSel }));
  }

  function toggleFurnaceChip(fi: number) {
    if (!selTpl || sameAll) return;
    const owner = fms.ffiApplyMap[fi];
    const newMap = { ...fms.ffiApplyMap };
    const tpl = { ...selTpl };
    if (owner === selId) {
      if (tpl.furnaces.length <= 1) return;
      delete newMap[fi];
      tpl.furnaces = tpl.furnaces.filter(f => f !== fi);
    } else if (!owner) {
      newMap[fi] = selId!;
      tpl.furnaces = [...tpl.furnaces, fi];
    }
    setFms(prev => ({ ...prev, ffiApplyMap: newMap, ffiTemplates: prev.ffiTemplates.map(t => t.id === selId ? tpl : t) }));
  }

  function setSameForAll(val: 0 | 1) {
    if (single) return;
    const nF = fms.furnaceCount;
    if (val === 1) {
      const first = tpls[0] || { id: 'ffi-1', name: 'Template 1', furnaces: [], ...ffiBuildTplData(allFeedKeys) };
      const merged: FfiTemplate = { ...first, furnaces: Array.from({ length: nF }, (_, i) => i) };
      const applyMap: Record<number, string> = {};
      for (let fi = 0; fi < nF; fi++) applyMap[fi] = merged.id;
      setFms(prev => ({ ...prev, ffiSameForAll: 1, ffiTemplates: [merged], ffiApplyMap: applyMap, ffiSelectedTplId: merged.id }));
    } else {
      setFms(prev => ({ ...prev, ffiSameForAll: 0 }));
    }
  }

  // ── Conv template helpers ──
  function getConvTemplate(fi: number) {
    const sec = fms.hwConv;
    if (!sec?.templates.length) return null;
    if (sec.sameForAll === 1 || single) return sec.templates[0];
    const id = sec.applyMap[fi];
    return (id ? sec.templates.find(t => t.id === id) : null) || sec.templates[0];
  }

  function getConvNumBanks(fi: number): number {
    const t = getConvTemplate(fi);
    return parseInt((t?.fields as ConvFields)?.numBanks || '0') || 0;
  }

  function getConvIsFphSeries(fi: number): boolean {
    const t = getConvTemplate(fi);
    if (!t) return false;
    const f = t.fields as ConvFields;
    return !!(f.banks?.includes('FPH1') && f.banks?.includes('FPH2') && f.fphSeries !== 0);
  }

  function getTleTemplate(fi: number) {
    const sec = fms.hwTle;
    if (!sec?.templates.length) return null;
    if (sec.sameForAll === 1 || single) return sec.templates[0];
    const id = sec.applyMap[fi];
    return (id ? sec.templates.find(t => t.id === id) : null) || sec.templates[0];
  }

  // A single-FPH furnace whose HC feed passes through a TLE (STLE/TTLE) in series with the
  // FPH bank routes the two stages exactly like FPH1→FPH2 series: the upstream stage (stored
  // in the fph1 slot) is the control, the downstream stage (fph2 slot) auto-follows.
  function getTleHcFeedSeries(fi: number): boolean {
    const c = getConvTemplate(fi);
    if (!c) return false;
    const banks = (c.fields as ConvFields).banks || [];
    const hasF1 = banks.includes('FPH1'), hasF2 = banks.includes('FPH2');
    if (hasF1 === hasF2) return false;   // needs exactly one FPH bank
    const tt = getTleTemplate(fi);
    if (!tt) return false;
    const t = tt.fields as TleFields;
    return (t.stle === 1 && t.ttle !== 1 && t.stleColdFluid === 'HC_FEED')
        || (t.ttle === 1 && t.ttleColdFluid === 'HC_FEED');
  }

  // Effective series: real FPH1→FPH2 series, or the single-FPH + TLE-in-series case above.
  const stageSeries = (fi: number) => getConvIsFphSeries(fi) || getTleHcFeedSeries(fi);

  function templateHasBank(fi: number, bank: string): boolean {
    const t = getConvTemplate(fi);
    return !!(t && (t.fields as ConvFields).banks?.includes(bank));
  }

  function getBankAlias(fi: number, bank: string): string {
    const t = getConvTemplate(fi);
    if (!t) return bank;
    const cf = t.fields as ConvFields;
    // Column/stage labels: custom alias wins, else the display code (solo paired bank
    // → "FPH", not "FPH1"). Routing keys elsewhere still use the canonical codes.
    return cf.bankAliases?.[bank] || bankDisplayCode(bank, cf.banks);
  }

  function getRadTemplate(fi: number) {
    const sec = fms.hwRad;
    if (!sec?.templates.length) return null;
    if (sec.sameForAll === 1 || single) return sec.templates[0];
    const id = sec.applyMap[fi];
    return (id ? sec.templates.find(t => t.id === id) : null) || sec.templates[0];
  }

  function getPassLabel(fi: number, passIdx: number): string {
    const radTpl = getRadTemplate(fi);
    const passNames = (radTpl?.fields as RadFields)?.passNames;
    return passNames?.[passIdx] || `P${passIdx + 1}`;
  }

  function getHmfPassCount(fi: number): number {
    const radTpl = getRadTemplate(fi);
    const f = radTpl?.fields as RadFields;
    return f?.cells?.reduce((sum, c) => sum + (parseInt(c.passesPerCell) || 0), 0) || 0;
  }

  function getRadNumCells(fi: number): number {
    const radTpl = getRadTemplate(fi);
    return parseInt((radTpl?.fields as RadFields)?.numCells || '1') || 1;
  }

  const furnaceName = (fi: number) => {
    const n = fms.furnaceInfo[fi]?.name?.trim();
    return n ? `Furnace ${n}` : `Furnace ${fi + 1}`;
  };

  // ── Validation ──
  const unassigned = Array.from({ length: fms.furnaceCount }, (_, fi) => fi).filter(fi => !fms.ffiApplyMap[fi]);
  const canSave    = unassigned.length === 0;

  // Completion is implicit now (the manual Save & Complete bar was removed): the tile is
  // done once every furnace is assigned to a template, and reverts if that stops holding.
  useEffect(() => {
    setFms(prev => prev.ffiDone === canSave ? prev : { ...prev, ffiDone: canSave });
  }, [canSave, setFms]);

  // ── SV rows: full FFI section from the export serializer ──
  // Must be called before any early return so hook order stays stable (Rules of Hooks).
  const svRows = usePanelRows((s: string) => s.startsWith('FFI ›'));

  if (!selTpl && tpls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className={cn(TEXT.annotation, 'text-text-secondary')}>Initializing…</div>
      </div>
    );
  }

  const fi0 = selTpl?.furnaces[0] ?? 0;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <SvPanel rows={svRows} />
      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Template sidebar — shared component, identical to Convection / TLE
                 (default Saved/Unsaved subtitle; furnace assignment is shown via the chips below) ── */}
          <HwTemplateList
            templates={tpls.map(t => ({ id: t.id, name: t.name, saved: fms.ffiDone }))}
            selectedIdx={tpls.findIndex(t => t.id === selId)}
            onSelect={(i) => setFms(prev => ({ ...prev, ffiSelectedTplId: tpls[i].id }))}
            onAdd={addTemplate}
            onRemove={removeTemplate}
            onRename={(i, name) => patchTpl(tpls[i].id, { name })}
            sameForAll={sameAll}
            furnaceCount={fms.furnaceCount}
            applyMap={fms.ffiApplyMap}
            isConv={false}
            onSameForAll={setSameForAll}
            single={single}
            seamlessSelect
          />

          {/* ── Editor ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Furnace chips */}
            {!sameAll && selTpl && (
              <div className="flex-shrink-0 px-4 py-2 bg-surface border-b border-border">
                <div className={cn(TEXT.annotation, 'text-text-secondary mb-1.5')}>
                  Assign <span className="text-accent-blue">"{selTpl.name}"</span> to furnaces:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: fms.furnaceCount }, (_, fi) => {
                    const owner  = fms.ffiApplyMap[fi];
                    const isThis = owner === selId;
                    const isOther = owner && !isThis;
                    return (
                      <button key={fi} onClick={() => !isOther && toggleFurnaceChip(fi)}
                        className={cn(TEXT.button, BUTTON.ghost,
                          'px-2.5 py-1',
                          isThis  ? 'bg-accent-blue border-accent-blue text-white hover:border-accent-blue hover:text-white' :
                          isOther ? 'text-text-secondary opacity-40 cursor-not-allowed hover:border-border hover:text-text-secondary' :
                                    'cursor-pointer',
                        )}>
                        {furnaceName(fi)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selTpl && (selTpl.furnaces.length > 0 || sameAll) ? (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <FfiEditorContent
                  tpl={selTpl}
                  fi={fi0}
                  fms={fms}
                  activeAreaFeeds={activeAreaFeeds}
                  allAreaFeeds={allAreaFeeds}
                  hasFPH1={templateHasBank(fi0, 'FPH1')}
                  hasFPH2={templateHasBank(fi0, 'FPH2')}
                  hasHTC1={templateHasBank(fi0, 'HTC1')}
                  hasHTC2={templateHasBank(fi0, 'HTC2')}
                  fph1Alias={getBankAlias(fi0, 'FPH1')}
                  fph2Alias={getBankAlias(fi0, 'FPH2')}
                  htc1Alias={getBankAlias(fi0, 'HTC1')}
                  htc2Alias={getBankAlias(fi0, 'HTC2')}
                  series={stageSeries(fi0)}
                  convTemplate={getConvTemplate(fi0)}
                  convNumBanks={getConvNumBanks(fi0)}
                  satVars={fms.satVars}
                  radNumCells={getRadNumCells(fi0)}
                  getPassLabel={(pi) => getPassLabel(fi0, pi)}
                  getHmfPassCount={() => getHmfPassCount(fi0)}
                  patchOptions={patch => selId && patchOptions(selId, patch)}
                  patchFeedData={(fk, patch) => selId && patchFeedData(selId, fk, patch)}
                  patchTpl={patch => selId && patchTpl(selId, patch)}
                  setFms={setFms}
                  selId={selId}
                />
              </div>
            ) : selTpl ? (
              <div className="flex-1 flex items-center justify-center">
                <div className={cn(TEXT.annotation, 'text-accent-yellow')}>Assign furnaces above to configure this template</div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className={cn(TEXT.annotation, 'text-text-secondary')}>Select or create a template</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  FFI Editor Content
// ─────────────────────────────────────────────────────────────────
type AreaFeedWithActive = (typeof AREA_FEED_DEFS)[number] & { areaActive: boolean };

interface EditorProps {
  tpl: FfiTemplate;
  fi: number;
  fms: FmsState;
  activeAreaFeeds: AreaFeedWithActive[];
  allAreaFeeds: AreaFeedWithActive[];
  hasFPH1: boolean; hasFPH2: boolean; hasHTC1: boolean; hasHTC2: boolean;
  fph1Alias: string; fph2Alias: string; htc1Alias: string; htc2Alias: string;
  series: boolean;
  convTemplate: { fields: unknown } | null;
  convNumBanks: number;
  satVars: Record<string, 0 | 1 | null>;
  radNumCells: number;
  getPassLabel: (passIdx: number) => string;
  getHmfPassCount: () => number;
  patchOptions: (patch: Partial<FfiOptions>) => void;
  patchFeedData: (feedKey: string, patch: Partial<FfiFeedData>) => void;
  patchTpl: (patch: Partial<FfiTemplate>) => void;
  setFms: (fn: (prev: FmsState) => FmsState) => void;
  selId: string | null;
}

function FfiEditorContent({
  tpl, fi, fms, activeAreaFeeds, allAreaFeeds,
  hasFPH1, hasFPH2, hasHTC1, hasHTC2,
  fph1Alias, fph2Alias, htc1Alias, htc2Alias,
  series, convTemplate, convNumBanks, satVars, radNumCells,
  getPassLabel, getHmfPassCount,
  patchOptions, patchFeedData, patchTpl, setFms, selId,
}: EditorProps) {
  const opt  = tpl.options;
  const hasHTC = hasHTC1 || hasHTC2;
  const htcAlias = hasHTC1 && hasHTC2 ? `${htc1Alias} & ${htc2Alias}` : hasHTC1 ? htc1Alias : htc2Alias;

  // Is dilution steam globally blocked (sat_dsg=0)?
  const dsgLocked = satVars['sat_dsg'] === 0;

  // If only one area feed exists in the P&ID, the furnace must take it → auto-active (locked YES).
  const soleAreaFeedKey = activeAreaFeeds.length === 1 ? activeAreaFeeds[0].key : null;

  // ── TLE template for this furnace (drives the topology-aware routing columns) ──
  const tleSec   = fms.hwTle;
  const tleTpl   = tleSec?.templates.length
    ? (tleSec.sameForAll === 1 || fms.furnaceCount === 1 ? tleSec.templates[0] : (tleSec.templates.find(t => t.id === tleSec.applyMap[fi]) || tleSec.templates[0]))
    : null;
  const tleFields = tleTpl ? (tleTpl.fields as TleFields) : null;

  // ── Topology-aware routing columns ──
  // The feed-routing table's two heating-stage columns each map to a DEDICATED field
  // (fph1 / fph2 / stle / ttle), ordered [upstream, downstream]:
  //   both FPH banks               → FPH1 , FPH2
  //   single FPH + TLE upstream    → <TLE> , FPH1     (HC feed flows TLE → FPH1)
  //   single FPH + TLE downstream  → FPH1 , <TLE>     (HC feed flows FPH1 → TLE)
  //   single FPH, no HC-feed TLE   → FPH1
  // The upstream column is the control; in series the downstream column auto-follows it —
  // identical to FPH1→FPH2 series. HTC is unchanged.
  type StageField = 'fph1' | 'fph2' | 'stle' | 'ttle';
  const fphCode    = hasFPH1 ? 'FPH1' : hasFPH2 ? 'FPH2' : null;
  const singleFph  = hasFPH1 !== hasFPH2;
  const fphField: StageField = hasFPH1 ? 'fph1' : 'fph2';
  const fphColAlias = hasFPH1 ? fph1Alias : fph2Alias;
  const tleStage = (() => {
    if (!singleFph || !fphCode || !tleFields) return null;
    const t = tleFields;
    let field: StageField, ori = '', name = '';
    if (t.stle === 1 && t.ttle !== 1 && t.stleColdFluid === 'HC_FEED') { field = 'stle'; ori = t.stleOrientation || ''; name = t.stleName || 'STLE'; }
    else if (t.ttle === 1 && t.ttleColdFluid === 'HC_FEED')           { field = 'ttle'; ori = t.ttleOrientation || ''; name = t.ttleName || 'TTLE'; }
    else return null;
    return { field, label: name.toUpperCase(), upstream: ori !== `SERIES_DOWNSTREAM_${fphCode}` };
  })();

  const routingCols: { field: StageField; label: string }[] = (() => {
    if (hasFPH1 && hasFPH2) return [{ field: 'fph1', label: fph1Alias }, { field: 'fph2', label: fph2Alias }];
    if (singleFph && tleStage) {
      return tleStage.upstream
        ? [{ field: tleStage.field, label: tleStage.label }, { field: fphField, label: fphColAlias }]
        : [{ field: fphField, label: fphColAlias }, { field: tleStage.field, label: tleStage.label }];
    }
    if (singleFph) return [{ field: fphField, label: fphColAlias }];
    return [];
  })();
  const showHtc   = hasHTC;
  const routingColCount = 2 + routingCols.length + (showHtc ? 1 : 0);

  // LMF/HMF tables keep the plain FPH1/FPH2 columns (TLE staging applies to the solo
  // routing table only).
  const showFph1 = hasFPH1;
  const showFph2 = hasFPH2;

  // ── Derive active state for each feed key ──
  function isActive(feedKey: string): boolean {
    if (feedKey === 'decoke_steam' || feedKey === 'decoke_air') return true;
    if (feedKey === 'dilution_steam') return opt.dilSteam && !dsgLocked;
    if (feedKey === soleAreaFeedKey) return true;
    return !!(opt['feed_active_' + feedKey]);
  }

  // ── Cell state for a routing-table stage column (by column index) ──
  function stageCellState(feedKey: string, ci: number): CellState {
    const col = routingCols[ci];
    if (!col) return { type: 'absent' };
    const active = isActive(feedKey);
    if (!active) return { type: 'auto', value: false };
    const fd = tpl.data[feedKey] || ffiDefaultFeedData();
    // Downstream column (index 1) auto-follows the upstream column in series.
    if (ci === 1 && series && fd[routingCols[0].field]) return { type: 'auto', value: true };
    return { type: 'user', value: !!fd[col.field] };
  }

  function htcCellState(feedKey: string): CellState {
    return !hasHTC ? { type: 'absent' } : { type: 'auto', value: isActive(feedKey) };
  }

  // Toggle a routing stage column; the upstream column drives the downstream one in series.
  function setStageCol(feedKey: string, ci: number, v: boolean) {
    const patch: Partial<FfiFeedData> = { [routingCols[ci].field]: v };
    if (ci === 0 && series && routingCols[1]) patch[routingCols[1].field] = v;
    patchFeedData(feedKey, patch);
  }

  // ── Active cell state ──
  function activeState(feedKey: string): CellState {
    if (feedKey === 'decoke_steam' || feedKey === 'decoke_air') return { type: 'auto', value: true };
    if (feedKey === 'dilution_steam') {
      if (dsgLocked) return { type: 'auto', value: false };
      return { type: 'user', value: opt.dilSteam };
    }
    if (feedKey === soleAreaFeedKey) return { type: 'auto', value: true };
    return { type: 'user', value: !!(opt['feed_active_' + feedKey]) };
  }

  function onActiveSet(feedKey: string, v: boolean) {
    if (feedKey === 'dilution_steam') patchOptions({ dilSteam: v });
    else if (feedKey !== 'decoke_steam' && feedKey !== 'decoke_air') patchOptions({ ['feed_active_' + feedKey]: v });
  }

  // ── Column header ──
  function ColHeader({ alias }: { alias: string }) {
    return (
      <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center last:border-r-0 whitespace-nowrap')}>
        {alias}
      </th>
    );
  }

  // ── Feed row ──
  function FeedRow({ feedKey, label }: { feedKey: string; label: string }) {
    const aState  = activeState(feedKey);
    const rowDim  = !((aState.type === 'auto' || aState.type === 'user') && aState.value);
    return (
      <tr className={cn(TABLE.row, 'border-b border-border last:border-0', rowDim && 'opacity-50')}>
        <td className={cn(TEXT.annotation, 'px-3 py-2 text-text-primary whitespace-nowrap text-left')}>
          {label}
        </td>
        <td className="px-3 py-2 text-center">
          <CellSwitch state={aState} onSet={v => onActiveSet(feedKey, v)} />
        </td>
        {routingCols.map((col, ci) => (
          <td key={col.field} className="px-3 py-2 text-center">
            <CellSwitch state={stageCellState(feedKey, ci)} onSet={v => setStageCol(feedKey, ci, v)} />
          </td>
        ))}
        {showHtc && (
          <td className="px-3 py-2 text-center">
            <CellSwitch state={htcCellState(feedKey)} />
          </td>
        )}
      </tr>
    );
  }

  // ── Section separator row ──
  function SectionRow({ label }: { label: string }) {
    return (
      <tr className={TABLE.header}>
        <td colSpan={routingColCount} className={cn(TEXT.eyebrow, 'px-3 py-1 text-text-secondary tracking-widest')}>
          {label}
        </td>
      </tr>
    );
  }

  // ── LMF / HMF availability (v418 parity) ──
  // Feeds activated in the solo table (used for LMF solo-lock logic)
  const soloActiveKeys = activeAreaFeeds.filter(d => !!(opt['feed_active_' + d.key])).map(d => d.key);
  // Multi-feed = more than one area feed header active in the P&ID
  const multiActive = activeAreaFeeds.length > 1;
  const hasSoloFeed = soloActiveKeys.length > 0;
  // Feed Selector Switch gates (Feed Management System): mixed feed op → LMF, dual feed op → HMF
  const mixedFeedOp = fms.mixedFeedOp === 1;
  const dualFeedOp  = fms.dualFeedOp === 1;
  // LMF/HMF are only in scope when multi-feed + ≥1 active solo feed + the Feed Selector Switch
  // operation is YES. Out of scope → the whole section is hidden (variables still export as gated).
  const lmfLocked   = !multiActive || !hasSoloFeed || !mixedFeedOp;
  const hmfLocked   = !multiActive || !hasSoloFeed || !dualFeedOp;
  const lmfActive   = opt.localMixed && !lmfLocked;

  // LMF
  const lmfSel = tpl.lmfData?.selectedFeeds || [];
  // When the solo (main routing) table has exactly ONE active solo feed, that feed is the
  // only valid mixing anchor — it is auto-selected here and cannot be deselected until a
  // second solo feed is activated in the routing table (soloActiveKeys.length >= 2).
  const soleSoloKey = soloActiveKeys.length === 1 ? soloActiveKeys[0] : null;

  // Effective LMF selection — seeds the locked solo feed / the 2-feed auto-pick when the
  // user hasn't explicitly chosen, so the chips and routing table reflect the live state.
  const lmfEffSel = (() => {
    if (lmfSel.length > 0) {
      // Always keep the sole-solo anchor present and first.
      if (soleSoloKey && !lmfSel.includes(soleSoloKey)) return [soleSoloKey, ...lmfSel].slice(0, 2);
      return lmfSel;
    }
    if (soleSoloKey) return [soleSoloKey];
    if (activeAreaFeeds.length === 2) return activeAreaFeeds.map(d => d.key);
    return [];
  })();

  function toggleLmfFeed(key: string) {
    const cur   = lmfEffSel;
    const isSel = cur.includes(key);
    // Can't deselect the sole locked solo anchor, nor the last solo feed in the selection.
    if (isSel && soloActiveKeys.includes(key) && cur.filter(k => soloActiveKeys.includes(k)).length <= 1) return;
    // Can't add if already 2 selected
    if (!isSel && cur.length >= 2) return;
    // Can't add a non-solo feed if no solo feed is already selected
    if (!isSel && !soloActiveKeys.includes(key) && cur.filter(k => soloActiveKeys.includes(k)).length === 0) return;
    const newSel = isSel ? cur.filter(k => k !== key) : [...cur, key];
    patchTpl({ lmfData: { ...tpl.lmfData, selectedFeeds: newSel } });
  }

  // HMF
  const hmfSel       = tpl.hmfData?.selectedFeeds || [];
  const hmfPassCount = getHmfPassCount();
  const hmfPassMap   = tpl.hmfData?.passMap || {};
  const hmfCountA    = Object.values(hmfPassMap).filter(v => v === 'A').length;
  const hmfCountB    = Object.values(hmfPassMap).filter(v => v === 'B').length;
  const hmfBalanced  = hmfSel.length === 2 && hmfCountA > 0 && hmfCountA === hmfCountB;

  // Auto-select HMF feeds when exactly 2 active area feeds
  const hmfEffSel = (() => {
    if (hmfSel.length > 0) return hmfSel;
    if (activeAreaFeeds.length === 2) return activeAreaFeeds.map(d => d.key);
    return [];
  })();

  // ── Convection template info for SVG (tleFields/tleTpl computed above) ──
  const convFields  = convTemplate ? (convTemplate.fields as ConvFields) : null;

  const selectedMode = fms.ffiModeState[fi]?.selectedMode || '';

  // ── Feed-mode overlay config for the convection SVG (ported from v418 ffiBuildModeCfg) ──
  // Maps the selected Feed Mode View to inlet labels + dimmed FPH banks + a badge. Returns
  // null for the default ("— select mode —") view, leaving the diagram untouched.
  const FEED_TAG_COLORS: Record<string, string> = {
    eth: '#60a5fa', pro: '#a78bfa', but: '#fbbf24', nap: '#34c472', gen_fr: '#f472b6', gen_tf: '#22d3ee',
  };
  function buildModeCfg(): ConvModeCfg | null {
    if (!selectedMode) return null;
    const dataOf = (k: string) => tpl.data[k] || ffiDefaultFeedData();
    const fphRouted = (d: FfiFeedData) => ({
      f1: !!d.fph1,
      f2: (!!d.fph1 && series) || !!d.fph2,
    });
    const dimFor = (...routes: { f1: boolean; f2: boolean }[]): string[] => {
      const dim: string[] = [];
      if (hasFPH1 && !routes.some(r => r.f1)) dim.push('FPH1');
      if (hasFPH2 && !routes.some(r => r.f2)) dim.push('FPH2');
      return dim;
    };
    // A stream for the fork/injection overlay engine, built from raw routing data. Every
    // active stream has merged by HTC1 (the HTC routing cell is always-on), so htc is
    // always true; `tle` reflects the HC-feed TLE column for single-FPH + TLE templates.
    const tleField = tleStage?.field;   // 'stle' | 'ttle' | undefined
    const mkStream = (label: string, d: FfiFeedData): ConvModeStream => {
      const f1 = !!d.fph1;
      return { label, f1, f2: (f1 && series) || !!d.fph2, htc: true, tle: tleField ? !!d[tleField] : false };
    };

    if (selectedMode === 'hot_steam_standby') {
      const r = fphRouted(dataOf('decoke_steam'));
      return { fphStreams: [{ label: 'Decoke Steam' }], htcStreams: null, dimBanks: dimFor(r), modeLabel: 'HOT STEAM STANDBY', tagColor: '#a78bfa', streams: [mkStream('Decoke Steam', dataOf('decoke_steam'))] };
    }
    if (selectedMode === 'decoke') {
      const steam = fphRouted(dataOf('decoke_steam'));
      const air   = fphRouted(dataOf('decoke_air'));
      return {
        fphStreams: [{ label: 'Decoke Steam' }],
        htcStreams: hasHTC ? [{ label: 'Decoke Air' }] : null,
        dimBanks: dimFor(steam, air), modeLabel: 'DECOKE', tagColor: '#34c472',
        streams: [mkStream('Decoke Steam', dataOf('decoke_steam')), mkStream('Decoke Air', dataOf('decoke_air'))],
      };
    }
    if (selectedMode.startsWith('solo_')) {
      const feedKey = selectedMode.slice(5);
      const def = AREA_FEED_DEFS.find(d => d.key === feedKey);
      if (!def) return null;
      const feed = fphRouted(dataOf(feedKey));
      const dsOn = !!opt.dilSteam && !dsgLocked;
      const ds   = dsOn ? fphRouted(dataOf('dilution_steam')) : { f1: false, f2: false };
      return {
        fphStreams: [{ label: def.label }],
        htcStreams: null,
        dimBanks: dimFor(feed, ds),
        modeLabel: def.label.toUpperCase() + (dsOn ? ' + DS' : ''),
        tagColor: FEED_TAG_COLORS[feedKey] || '#34c472',
        streams: dsOn ? [mkStream(def.label, dataOf(feedKey)), mkStream('Dilution Steam', dataOf('dilution_steam'))] : [mkStream(def.label, dataOf(feedKey))],
      };
    }
    if (selectedMode === 'lmf') {
      const picks = lmfEffSel.slice(0, 2);
      const labels = picks.map(k => AREA_FEED_DEFS.find(d => d.key === k)?.label || k);
      const rows = picks.map(k => soloActiveKeys.includes(k) ? dataOf(k) : (tpl.lmfData?.rows?.[k] || ffiDefaultFeedData()));
      const routes = rows.map(fphRouted);
      const streams = picks.map((_, i) => mkStream(labels[i], rows[i]));
      return { fphStreams: labels.length ? labels.map(label => ({ label })) : null, htcStreams: null, dimBanks: dimFor(...routes), modeLabel: 'LOCAL MIXED FEED', tagColor: '#f59e0b', streams: streams.length ? streams : null };
    }
    return null;
  }
  const modeCfg = buildModeCfg();

  // Feed mode options
  const modeOptions = [
    { value: '',                 label: '— select mode —' },
    { value: 'hot_steam_standby', label: 'Hot Steam Standby' },
    { value: 'decoke',           label: 'Decoke' },
    ...activeAreaFeeds.map(d => ({
      value: 'solo_' + d.key,
      label: d.label + (!(opt['feed_active_' + d.key]) ? ' (inactive)' : ''),
      disabled: !(opt['feed_active_' + d.key]),
    })),
    { value: 'lmf', label: 'Local Mixed Feed' + (lmfActive && soloActiveKeys.length >= 2 ? '' : ' (inactive)'), disabled: !(lmfActive && soloActiveKeys.length >= 2) },
  ];

  return (
    <div className="flex gap-4 items-start">
      {/* LEFT column — options, routing, mixing */}
      <div className="flex flex-col gap-5 flex-1 min-w-0 max-w-[480px]">

      {/* ── Furnace Options (v418 order / labels) ── */}
      <Section title="Furnace Options">
        {/* Arch O₂ — turning OFF forces Stack ON (at least one analyser must exist) */}
        <OptionRow label="Does Arch O₂ tag exist?"
          val={opt.archO2Exists}
          onToggle={() => patchOptions(opt.archO2Exists ? { archO2Exists: false, stackO2Exists: true } : { archO2Exists: true })} />
        {opt.archO2Exists && <>
          {/* Per-cell question only when it's a real choice (multi-cell). Single-cell is auto-implied
              and dropped from view — the variable is still stored/exported unchanged. */}
          {radNumCells > 1 && (
            <OptionRow label="Does Arch O₂ tag exist per individual cell?"
              val={opt.archO2PerCell}
              onToggle={() => patchOptions({ archO2PerCell: !opt.archO2PerCell })} />
          )}
          <OptionRow label="Is Arch O₂ measured on a wet basis?"
            val={opt.archO2WetBasis}
            onToggle={() => patchOptions({ archO2WetBasis: !opt.archO2WetBasis })} />
        </>}
        {/* Stack O₂ — turning OFF forces Arch ON */}
        <OptionRow label="Does Stack O₂ tag exist?"
          val={opt.stackO2Exists}
          onToggle={() => patchOptions(opt.stackO2Exists ? { stackO2Exists: false, archO2Exists: true } : { stackO2Exists: true })} />
        {opt.stackO2Exists && <OptionRow label="Is Stack O₂ measured on a wet basis?"
          val={opt.stackO2WetBasis}
          onToggle={() => patchOptions({ stackO2WetBasis: !opt.stackO2WetBasis })} />}
        {/* Delta between stack & arch O₂ — only asked when exactly one of the two analysers exists (v418) */}
        {(opt.archO2Exists !== opt.stackO2Exists) && (
          <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <div className={cn(TEXT.tableRowLabel, 'text-text-primary')}>Delta between stack O₂ and arch O₂</div>
            </div>
            <PercentBox
              value={opt.airIngression}
              onChange={n => patchOptions({ airIngression: Math.max(0, Math.min(100, n)) })}
            />
          </div>
        )}
        <OptionRow label="Is local ambient temperature available?"
          val={opt.localAmbientTemp} onToggle={() => patchOptions({ localAmbientTemp: !opt.localAmbientTemp })} />
        <OptionRow label="Is local humidity tag available?"
          val={opt.localHumidity} onToggle={() => patchOptions({ localHumidity: !opt.localHumidity })} />
        <OptionRow label="Is Stack NOx tag available?"
          val={!!opt.stackNoxAvailable}
          onToggle={() => patchOptions({ stackNoxAvailable: !opt.stackNoxAvailable })} />
        <OptionRow label="Is Stack SOx tag available?"
          val={!!opt.stackSoxAvailable}
          onToggle={() => patchOptions({ stackSoxAvailable: !opt.stackSoxAvailable })} />
        <OptionRow label="Is pass-wise decoke air available?"
          val={opt.passwiseDecokeAirAvailable !== false}
          onToggle={() => patchOptions({ passwiseDecokeAirAvailable: !(opt.passwiseDecokeAirAvailable !== false) })} />
        <OptionRow label="Is pass-wise decoke steam available?"
          val={opt.passwiseDecokeSteamAvailable !== false}
          onToggle={() => patchOptions({ passwiseDecokeSteamAvailable: !(opt.passwiseDecokeSteamAvailable !== false) })} />
      </Section>

      {/* ── Feed Routing Table ── */}
      <Section title="Feed Routing">
        {series && (
          <div className={cn(TEXT.annotation, 'mx-0 mb-2 px-3 py-1.5 text-accent-blue bg-accent-blue/15 border border-accent-blue rounded')}>
            FPH series mode active — enabling FPH1 automatically enables FPH2
          </div>
        )}
        <div className={cn(TABLE.wrap, 'overflow-x-auto')}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={TABLE.header}>
                <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>Feed Header</th>
                <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center min-w-[72px]')}>Active</th>
                {routingCols.map(col => <ColHeader key={col.field} alias={col.label} />)}
                {showHtc && <ColHeader alias={htcAlias} />}
              </tr>
            </thead>
            <tbody>
              {/* Unconditional feeds first, then area headers — matches v418 ordering.
                  Area headers not present in the P&ID are dropped entirely (variables still export). */}
              <FeedRow feedKey="decoke_steam"   label="Decoke Steam"   />
              <FeedRow feedKey="decoke_air"     label="Decoke Air"     />
              {/* Dilution Steam only exists if the sat config provides a DS header (sat_dsg≠0).
                  When absent it's dropped from view; the variable still exports as 0. */}
              {!dsgLocked && <FeedRow feedKey="dilution_steam" label="Dilution Steam" />}
              <SectionRow label="Area Feed Headers" />
              {activeAreaFeeds.map(d => (
                <FeedRow key={d.key} feedKey={d.key} label={d.label} />
              ))}
            </tbody>
          </table>
        </div>
        <div className={cn(TEXT.annotation, 'mt-1.5 text-text-secondary')}>
          HTC temperature is always measured when feed is active — cannot be manually overridden.
        </div>
      </Section>

      {/* ── Dilution Steam Injection — only when the Dilution Steam header is YES in the feed table
              (and DSG exists with a vapor/liquid feed active). Variable still stored when hidden. ── */}
      {satVars['sat_dsg'] === 1 && opt.dilSteam && (() => {
        const hasVaporFeed  = ['eth','pro','but','gen_fr','gen_tf'].some(k => !!opt['feed_active_' + k]);
        const hasLiquidFeed = !!opt['feed_active_nap'];
        if (!hasVaporFeed && !hasLiquidFeed) return null;
        return (
          <Section title="Dilution Steam Injection">
            {hasVaporFeed && (
              <OptionRow label="Is dilution steam added before vapor feed pass flow meter?"
                sub="Applies to active vapor feeds (ETH / PRO / BUT / Fresh & Recycle / Total Feed)"
                val={opt.dsBeforeVaporFlowmeter}
                onToggle={() => patchOptions({ dsBeforeVaporFlowmeter: !opt.dsBeforeVaporFlowmeter })} />
            )}
            {hasLiquidFeed && (
              <OptionRow label="Is dilution steam added before liquid feed pass flow meter?"
                sub="Applies to active liquid feed (NAP)"
                val={opt.dsBeforeLiquidFlowmeter}
                onToggle={() => patchOptions({ dsBeforeLiquidFlowmeter: !opt.dsBeforeLiquidFlowmeter })} />
            )}
          </Section>
        );
      })()}

      {/* ── LMF — only rendered when in scope (multi-feed + ≥1 solo feed + Mixed Feed Op = YES) ── */}
      {!lmfLocked && (
        <Section
          title="Mixed Header Routing (LMF)"
          right={<SegYesNo value={opt.localMixed ? 1 : 0} onYes={() => !opt.localMixed && patchOptions({ localMixed: true })} onNo={() => opt.localMixed && patchOptions({ localMixed: false })} />}
        >
          {opt.localMixed && (
          <div className="flex flex-col gap-3">
            {/* Feed chip selector */}
            <div>
              <div className={cn(TEXT.annotation, 'text-text-secondary mb-2')}>
                Select 2 feed headers to mix
                <span className={cn(TEXT.annotation, 'ml-2 text-text-secondary opacity-60')}>(at least 1 must be active in solo table)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {allAreaFeeds.map(d => {
                  const isSel    = lmfEffSel.includes(d.key);
                  const isSolo   = soloActiveKeys.includes(d.key);
                  const isPidActive = d.areaActive;
                  const isAutoSel = activeAreaFeeds.length === 2;
                  const canDesel = isSel && !(isSolo && lmfEffSel.filter(k => soloActiveKeys.includes(k)).length <= 1);
                  const canAdd   = !isSel && lmfEffSel.length < 2 && isPidActive && (isSolo || lmfEffSel.filter(k => soloActiveKeys.includes(k)).length > 0);
                  const disabled = !isPidActive || isAutoSel || (!isSel && !canAdd) || (isSel && !canDesel);
                  return (
                    <button key={d.key}
                      onClick={() => !disabled && toggleLmfFeed(d.key)}
                      title={!isPidActive ? 'Not active in P&ID' : isAutoSel ? 'Auto-selected — only 2 feeds available' : isSolo && isSel ? 'Solo feed — path locked' : undefined}
                      className={cn(TEXT.button, BUTTON.ghost,
                        'px-3 py-1',
                        isSel && isPidActive ? 'bg-accent-blue border-accent-blue text-white hover:border-accent-blue hover:text-white' :
                        disabled             ? 'text-text-secondary opacity-30 cursor-not-allowed hover:border-border hover:text-text-secondary' :
                                               'cursor-pointer',
                      )}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {lmfEffSel.length === 0 && <div className={cn(TEXT.annotation, 'text-accent-yellow mt-1.5')}>Select 2 feeds to configure mixed header routing</div>}
              {lmfEffSel.length === 1 && <div className={cn(TEXT.annotation, 'text-accent-yellow mt-1.5')}>Select 1 more feed</div>}
            </div>

            {/* Routing table */}
            {lmfEffSel.length === 2 && (
              <div className={cn(TABLE.wrap, 'overflow-x-auto')}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-hover border-b border-border">
                      <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-left')}>Feed Header</th>
                      {showFph1 && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>{fph1Alias}</th>}
                      {showFph2 && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>{fph2Alias}</th>}
                      {showHtc && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary text-center')}>{htcAlias}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lmfEffSel.map(fk => {
                      const def     = AREA_FEED_DEFS.find(d => d.key === fk);
                      const isSoloR = soloActiveKeys.includes(fk); // path locked — mirrors solo table
                      // Solo feeds inherit their path live from the solo (main routing) table; only
                      // non-solo feeds keep an independent, editable LMF path.
                      const r       = isSoloR
                        ? (tpl.data?.[fk] || ffiDefaultFeedData())
                        : (tpl.lmfData?.rows?.[fk] || ffiDefaultFeedData());
                      return (
                        <tr key={fk} className={cn(TABLE.row, 'border-b border-border last:border-0')}>
                          <td className={cn(TEXT.tableCell, 'px-3 py-2 text-text-primary')}>
                            {def?.label || fk}
                          </td>
                          {showFph1 && (
                            <td className="px-3 py-2 text-center">
                              {isSoloR  ? <CellSwitch state={{ type: 'auto', value: r.fph1 }} /> :
                               <CellSwitch state={{ type: 'user', value: r.fph1 }} onSet={v => patchTpl({ lmfData: { ...tpl.lmfData, rows: { ...tpl.lmfData.rows, [fk]: { ...r, fph1: v, fph2: series ? v : r.fph2 } } } })} />}
                            </td>
                          )}
                          {showFph2 && (
                            <td className="px-3 py-2 text-center">
                              {series && r.fph1 ? <CellSwitch state={{ type: 'auto', value: true }} /> :
                               isSoloR ? <CellSwitch state={{ type: 'auto', value: r.fph2 }} /> :
                               <CellSwitch state={{ type: 'user', value: r.fph2 }} onSet={v => patchTpl({ lmfData: { ...tpl.lmfData, rows: { ...tpl.lmfData.rows, [fk]: { ...r, fph2: v } } } })} />}
                            </td>
                          )}
                          {showHtc && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'auto', value: opt.localMixed }} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {/* DS row in LMF */}
                    {opt.dilSteam && !dsgLocked && (() => {
                      const r2 = tpl.lmfData?.rows?.['_ds'] || ffiDefaultFeedData();
                      return (
                        <tr className="border-t-2 border-border bg-surface-hover/20">
                          <td className={cn(TEXT.tableCell, 'px-3 py-2 text-text-secondary italic')}>Dilution Steam</td>
                          {showFph1 && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'user', value: r2.fph1 }} onSet={v => patchTpl({ lmfData: { ...tpl.lmfData, rows: { ...tpl.lmfData.rows, _ds: { ...r2, fph1: v, fph2: series ? v : r2.fph2 } } } })} />
                            </td>
                          )}
                          {showFph2 && (
                            <td className="px-3 py-2 text-center">
                              {series && r2.fph1 ? <CellSwitch state={{ type: 'auto', value: true }} /> :
                               <CellSwitch state={{ type: 'user', value: r2.fph2 }} onSet={v => patchTpl({ lmfData: { ...tpl.lmfData, rows: { ...tpl.lmfData.rows, _ds: { ...r2, fph2: v } } } })} />}
                            </td>
                          )}
                          {showHtc && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'auto', value: true }} />
                            </td>
                          )}
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </Section>
      )}

      {/* ── HMF — only rendered when in scope (multi-feed + ≥1 solo feed + Dual Feed Op = YES) ── */}
      {!hmfLocked && (
        <Section
          title="Hybrid Co-cracking (HMF)"
          right={<SegYesNo value={opt.hybrid ? 1 : 0} onYes={() => !opt.hybrid && patchOptions({ hybrid: true })} onNo={() => opt.hybrid && patchOptions({ hybrid: false })} />}
        >
          {opt.hybrid && (
          <div className="flex flex-col gap-4">
            {/* Feed chip selector */}
            <div>
              <div className={cn(TEXT.annotation, 'text-text-secondary mb-2')}>Select 2 feeds for co-cracking (Feed A + Feed B):</div>
              <div className="flex flex-wrap gap-2">
                {allAreaFeeds.map(d => {
                  const curSel   = tpl.hmfData?.selectedFeeds?.length ? tpl.hmfData.selectedFeeds : hmfEffSel;
                  const idx      = curSel.indexOf(d.key);
                  const isSel    = idx !== -1;
                  const autoSel  = activeAreaFeeds.length === 2;
                  const notInPid = !d.areaActive;
                  const dis      = notInPid || (!isSel && curSel.length >= 2) || autoSel;
                  return (
                    <button key={d.key}
                      onClick={() => {
                        if (dis) return;
                        const ns = isSel ? curSel.filter(k => k !== d.key) : [...curSel, d.key];
                        patchTpl({ hmfData: { ...tpl.hmfData, selectedFeeds: ns } });
                      }}
                      title={notInPid ? 'Not active in P&ID' : autoSel ? 'Auto-selected' : undefined}
                      className={cn(TEXT.button, BUTTON.ghost, 'px-3 py-1',
                        isSel && idx === 0 ? 'bg-accent-blue/15 border-accent-blue text-accent-blue hover:border-accent-blue hover:text-accent-blue' :
                        isSel && idx === 1 ? 'bg-accent-purple/15 border-accent-purple text-accent-purple hover:border-accent-purple hover:text-accent-purple' :
                        dis ? 'text-text-secondary opacity-30 cursor-not-allowed hover:border-border hover:text-text-secondary' :
                              'hover:border-accent-purple cursor-pointer',
                      )}>
                      {isSel ? <span className="mr-1 font-bold">{idx === 0 ? 'A:' : 'B:'}</span> : null}{d.label}
                    </button>
                  );
                })}
              </div>
              {hmfEffSel.length === 2
                ? <div className={cn(TEXT.annotation, 'text-accent-green mt-1.5')}>✓ Feed A: {AREA_FEED_DEFS.find(d => d.key === hmfEffSel[0])?.label} &nbsp;|&nbsp; Feed B: {AREA_FEED_DEFS.find(d => d.key === hmfEffSel[1])?.label}</div>
                : <div className={cn(TEXT.annotation, 'text-accent-yellow mt-1.5')}>Select 2 feeds for co-cracking</div>}
            </div>

            {/* Pass assignment — click to cycle: unassigned → A → B → unassigned */}
            {hmfEffSel.length === 2 && hmfPassCount > 0 && (
              <div>
                <div className={cn(TEXT.annotation, 'text-text-secondary mb-1')}>
                  Click each pass to cycle assignment &nbsp;
                  <span className="text-accent-blue">■ Feed A</span>
                  <span className="mx-2 text-accent-purple">■ Feed B</span>
                  <span className="text-text-secondary opacity-50">■ Unassigned</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Array.from({ length: hmfPassCount }, (_, pi) => {
                    const asgn = hmfPassMap[pi] as 'A' | 'B' | undefined;
                    return (
                      <button key={pi}
                        onClick={() => {
                          // Cycle: undefined/null → 'A' → 'B' → undefined
                          const next = !asgn ? 'A' : asgn === 'A' ? 'B' : undefined;
                          const newMap = { ...hmfPassMap };
                          if (next) newMap[pi] = next; else delete newMap[pi];
                          patchTpl({ hmfData: { ...tpl.hmfData, passMap: newMap } });
                        }}
                        className={cn(TEXT.annotation, BUTTON.ghost, 'flex flex-col items-center px-3 py-1.5 cursor-pointer select-none',
                          asgn === 'A' ? 'bg-accent-blue/15 border-accent-blue text-accent-blue hover:border-accent-blue hover:text-accent-blue' :
                          asgn === 'B' ? 'bg-accent-purple/15 border-accent-purple text-accent-purple hover:border-accent-purple hover:text-accent-purple' :
                                         'hover:border-border hover:text-text-secondary',
                        )}>
                        <span className="opacity-60">{getPassLabel(pi)}</span>
                        <span>{asgn ?? '—'}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={cn(TEXT.annotation, hmfBalanced ? 'text-accent-green' : 'text-accent-yellow')}>
                  Feed A: {hmfCountA} pass{hmfCountA !== 1 ? 'es' : ''} &nbsp;|&nbsp; Feed B: {hmfCountB} pass{hmfCountB !== 1 ? 'es' : ''}
                  {hmfBalanced ? ' — balanced ✓' : ' — balance passes to unlock routing table'}
                </div>
              </div>
            )}

            {/* Hybrid routing table — only when balanced */}
            {hmfEffSel.length === 2 && hmfBalanced && (
              <div className={cn(TABLE.wrap, 'overflow-x-auto')}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={TABLE.header}>
                      <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>Stream</th>
                      {showFph1 && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>{fph1Alias}</th>}
                      {showFph2 && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary border-r border-border text-center')}>{fph2Alias}</th>}
                      {showHtc && <th className={cn(TEXT.tableHeader, 'px-3 py-2 text-text-secondary text-center')}>{htcAlias}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Combined hybrid stream row */}
                    {(() => {
                      const hRow = tpl.hmfData?.rows?.['_hybrid'] || ffiDefaultFeedData();
                      return (
                        <tr className={cn(TABLE.row, 'border-b border-border')}>
                          <td className={cn(TEXT.tableCell, 'px-3 py-2 text-text-primary text-left')}>
                            <span className="text-accent-blue">{hmfEffSel[0]}</span>
                            <span className="text-text-secondary mx-1.5">+</span>
                            <span className="text-accent-purple">{hmfEffSel[1]}</span>
                            <span className={cn(TEXT.annotation, 'ml-2 text-text-secondary')}>(A+B combined)</span>
                          </td>
                          {showFph1 && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'user', value: hRow.fph1 }} onSet={v => patchTpl({ hmfData: { ...tpl.hmfData, rows: { ...tpl.hmfData.rows, _hybrid: { ...hRow, fph1: v, fph2: series ? v : hRow.fph2 } } } })} />
                            </td>
                          )}
                          {showFph2 && (
                            <td className="px-3 py-2 text-center">
                              {series && hRow.fph1 ? <CellSwitch state={{ type: 'auto', value: true }} /> :
                               <CellSwitch state={{ type: 'user', value: hRow.fph2 }} onSet={v => patchTpl({ hmfData: { ...tpl.hmfData, rows: { ...tpl.hmfData.rows, _hybrid: { ...hRow, fph2: v } } } })} />}
                            </td>
                          )}
                          {showHtc && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'auto', value: true }} />
                            </td>
                          )}
                        </tr>
                      );
                    })()}
                    {/* DS row in HMF */}
                    {opt.dilSteam && !dsgLocked && (() => {
                      const dsRow = tpl.hmfData?.rows?.['_ds'] || ffiDefaultFeedData();
                      return (
                        <tr className="border-t-2 border-border bg-surface-hover/20">
                          <td className={cn(TEXT.tableCell, 'px-3 py-2 text-text-secondary italic')}>Dilution Steam</td>
                          {showFph1 && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'user', value: dsRow.fph1 }} onSet={v => patchTpl({ hmfData: { ...tpl.hmfData, rows: { ...tpl.hmfData.rows, _ds: { ...dsRow, fph1: v, fph2: series ? v : dsRow.fph2 } } } })} />
                            </td>
                          )}
                          {showFph2 && (
                            <td className="px-3 py-2 text-center">
                              {series && dsRow.fph1 ? <CellSwitch state={{ type: 'auto', value: true }} /> :
                               <CellSwitch state={{ type: 'user', value: dsRow.fph2 }} onSet={v => patchTpl({ hmfData: { ...tpl.hmfData, rows: { ...tpl.hmfData.rows, _ds: { ...dsRow, fph2: v } } } })} />}
                            </td>
                          )}
                          {showHtc && (
                            <td className="px-3 py-2 text-center">
                              <CellSwitch state={{ type: 'auto', value: true }} />
                            </td>
                          )}
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </Section>
      )}
      </div>

      {/* RIGHT column — sticky convection / feed-mode panel (v418 two-column layout) */}
      <div className={cn(TABLE.wrap, 'flex-1 min-w-0 sticky top-0 flex flex-col')} style={{ maxHeight: 'calc(100vh - 150px)' }}>
        <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 bg-surface-hover border-b border-border">
          <span className={cn(TEXT.eyebrow, 'text-text-secondary tracking-widest whitespace-nowrap')}>Feed Mode View</span>
          <select
            value={selectedMode}
            onChange={e => setFms(prev => ({ ...prev, ffiModeState: { ...prev.ffiModeState, [fi]: { selectedMode: e.target.value } } }))}
            className={cn(TEXT.tableCell, styles.fiSel, FIELD.input, 'flex-1 px-2')}
          >
            {modeOptions.map(o => (
              <option key={o.value} value={o.value} disabled={(o as { disabled?: boolean }).disabled}>{o.label}</option>
            ))}
          </select>
        </div>
        {/* Scrollable diagram — horizontal scrollbar is intentional so the full convection bank fits */}
        <div className="overflow-auto flex-1 p-2">
          {convFields && convNumBanks > 0 ? (
            <div style={{ minWidth: 930 }}>
              <ConvBankSvg
                fields={convFields}
                tleFields={tleFields}
                numBanks={convNumBanks}
                satDsgValue={(satVars['sat_dsg'] ?? null) as 0 | 1 | null}
                modeCfg={modeCfg}
              />
            </div>
          ) : (
            <div className={cn(TEXT.annotation, 'text-text-secondary py-6 text-center')}>
              Convection section diagram — available after Convection &amp; TLE template is configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ──
function Section({ title, children, badge, badgeColor, right }: {
  title: string; children: React.ReactNode;
  badge?: string; badgeColor?: string; right?: React.ReactNode;
}) {
  return (
    <div className={TABLE.wrap}>
      <div className={cn(TABLE.header, 'flex items-center justify-between px-3.5 py-2')}>
        <div className="flex items-center gap-2">
          <span className={cn(TEXT.annotation, 'font-semibold text-text-primary')}>{title}</span>
          {badge && (
            <span className={cn(TEXT.annotation, BADGE.base)}
              style={{ color: badgeColor, borderColor: badgeColor }}>
              {badge}
            </span>
          )}
        </div>
        {right && <div>{right}</div>}
      </div>
      <div className="bg-table-body px-3.5 py-3">{children}</div>
    </div>
  );
}

// ── Option row ──
function OptionRow({ label, sub, val, onToggle, disabled }: {
  label: string; sub?: string; val: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <div className={clsx('flex items-center justify-between py-2 border-b border-border last:border-0', disabled && 'opacity-50')}>
      <div>
        <div className={cn(TEXT.tableRowLabel, 'text-text-primary')}>{label}</div>
        {sub && <div className={cn(TEXT.annotation, 'text-accent-yellow')}>{sub}</div>}
      </div>
      <SegYesNo
        value={val ? 1 : 0}
        disabled={disabled}
        onYes={() => !val && onToggle()}
        onNo={() => val && onToggle()}
      />
    </div>
  );
}

// ── Percent input (same footprint as the YES|NO seg control) ──
// Idle: shows "<value>%" with the % suffix inside the box. While editing the suffix
// is dropped so only the raw number is shown; it reappears on blur.
function PercentBox({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? draft : `${value}%`}
      onFocus={() => { setDraft(String(value)); setEditing(true); }}
      onChange={e => {
        const t = e.target.value.replace('%', '');
        setDraft(t);
        const n = parseFloat(t);
        if (!isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        const n = parseFloat(draft);
        onChange(isNaN(n) ? 0 : n);
        setEditing(false);
      }}
      className={cn(styles.mono, FIELD.input,
        'flex-shrink-0 text-center')}
      style={{ width: 62, height: 22, fontSize: 10, padding: 0, fontWeight: 500, letterSpacing: '.06em' }}
    />
  );
}
