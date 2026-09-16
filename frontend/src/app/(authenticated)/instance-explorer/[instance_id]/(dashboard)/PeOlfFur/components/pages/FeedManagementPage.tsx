'use client';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAtom } from 'jotai';
import { fmsStateAtom, PidVars, expandedFmsRowAtom, FmsRowKey, openFmsAccsAtom, FMS_ACC_ORDER, FMS_TAB_TITLES } from '../../store/FmsAtoms';
import { MASTER_COMPONENTS, FIXED_COMPONENTS, HEADER_COMPONENTS } from '../../constants/Components';
import {
  computeAutoLocks, inferPidVars, applyLocksToVars, applyTwoFeedLinkage, computePidPct,
  reapplyFixedDefaults,
} from '../../constants/PidLogic';
import PidSvgPanel from './PidSvgPanel';
import FuelComponentsSection from './FuelComponentsSection';
import SvPanel from '../SvPanel';
import { usePanelRows } from '../usePanelRows';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT, TABLE, SEGMENT, FIELD, BUTTON, MODAL, InfoTip } from '../../theme/Index';
import { useFmsSave } from '../../constants/SaveState';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

type Val = 0 | 1 | null;
type RowKey = FmsRowKey;

// Selector is needed when ≥2 feeds are active from P&ID
export function selIsNeeded(pidVars: Record<string, Val>): boolean {
  const FEED_EXISTS_KEYS = ['eth_exists','pro_exists','but_exists','nap_exists','gen_fr_exists','gen_tf_exists'];
  const active = FEED_EXISTS_KEYS.filter(k => pidVars[k] === 1).length;
  return active >= 2;
}

const MAX_COMP = MASTER_COMPONENTS.length - FIXED_COMPONENTS.length;

function compSuggestedList(pidVars: Record<string, 0|1|null>): string[] {
  const userMaster = new Set(
    (MASTER_COMPONENTS as readonly string[]).filter(c => !(FIXED_COMPONENTS as readonly string[]).includes(c))
  );
  const seen = new Set<string>();
  const result: string[] = [];
  (['eth','pro','but','nap'] as const).forEach(key => {
    if (pidVars['ff_'+key] === 1 || pidVars['rcy_'+key] === 1) {
      (HEADER_COMPONENTS[key] || []).forEach(c => {
        if (!seen.has(c) && userMaster.has(c)) { seen.add(c); result.push(c); }
      });
    }
  });
  return result;
}

const SAT_FEED_KEYS = ['sat_eth','sat_pro','sat_but','sat_nap','sat_gen_fr','sat_gen_tf'];
// Shared first-column width for the two Saturator-Config tables so they line up
// seamlessly when stacked. Remaining columns are distributed equally per table.
const SAT_LABEL_COL_W = 200;
const SAT_EXISTENCE: Record<string,string> = {
  sat_eth:'eth_exists', sat_pro:'pro_exists', sat_but:'but_exists',
  sat_nap:'nap_exists', sat_gen_fr:'gen_fr_exists', sat_gen_tf:'gen_tf_exists',
};

export default function FeedManagementPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [expanded, setExpanded] = useAtom(expandedFmsRowAtom);
  // 1=both, 2=Questionnaire-only (sketch collapsed), 3=Sketch-only (questionnaire collapsed).
  // First load starts collapsed to the questionnaire (mode 2). The single divider bar
  // cycles 2 → 1 → 3 → 2 (Q-only → Both → Sketch-only).
  const [pidMode, setPidMode] = useState<1|2|3>(2);
  const pidWrapRef = useRef<HTMLDivElement>(null);
  const [pidHeight, setPidHeight] = useState<number | null>(null); // null = default 47vh; px once dragged
  const questScrollRef = useRef<HTMLDivElement>(null);
  const questScrollTop = useRef(0);
  const [prevLocked, setPrevLocked] = useState<Set<string>>(new Set());
  const [openAccs, setOpenAccs] = useAtom(openFmsAccsAtom);
  const [countInput, setCountInput] = useState(fms.compCount > 0 ? String(fms.compCount) : '');
  const [countErr, setCountErr] = useState('');
  // Per-entry save-state indicator (global rule) — compare a control's live value
  // to the confirmed/draft snapshots and fade/colour only its text.
  const save = useFmsSave();

  // Sync countInput when compCount changes externally (e.g. auto-populate on row open)
  useEffect(() => {
    if (fms.compCount > 0 && countInput === '') setCountInput(String(fms.compCount));
    if (fms.compCount === 0 && countInput !== '') setCountInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fms.compCount]);

  // ── _fmsAutoFill + _fmsSatDefaults on first mount ──
  useEffect(() => {
    setFms(prev => {
      const alreadyFilled = prev.pidVars['ff_eth'] !== null && prev.pidVars['ff_eth'] !== undefined;
      if (alreadyFilled) return prev;

      // Auto-fill: ETH fresh+recycle=YES, all others=NO, then cascade
      let vars: PidVars = { ...prev.pidVars,
        ff_eth:1 as 0|1, rcy_eth:1 as 0|1, ff_pro:0 as 0|1, rcy_pro:0 as 0|1,
        ff_but:0 as 0|1, rcy_but:0 as 0|1, ff_nap:0 as 0|1, rcy_nap:0 as 0|1,
      };
      vars = reapplyFixedDefaults(vars);
      const locks = computeAutoLocks(vars);
      // Apply locks and default remaining nulls to 0
      locks.forEach(({ val }, key) => { vars[key] = val; });
      Object.keys(vars).forEach(k => { if (vars[k] === null) vars[k] = 0; });
      const inferred = inferPidVars(vars);

      // Sat defaults: DSG=YES, Saturator=NO
      const satVars = { ...prev.satVars };
      if (satVars['sat_dsg'] === null) satVars['sat_dsg'] = 1;
      if (satVars['sat_exists'] === null) satVars['sat_exists'] = 0;

      // Auto-populate components from active feed headers (mirrors v411 buildCompPage first-entry + line 17606)
      const suggestedComps = compSuggestedList(inferred as Record<string, 0|1|null>);
      const autoComps = suggestedComps.length > 0 ? suggestedComps.slice() : prev.compComponents;
      const autoCount = autoComps.length;

      return {
        ...prev,
        pidVars: inferred, pidVarsUser: {},
        pidDone: true, pctPid: 100, pidConfirmed: true,
        compComponents: autoCount > 0 ? autoComps : prev.compComponents,
        compCount:      autoCount > 0 ? autoCount  : prev.compCount,
        compConfirmPhase: autoCount > 0 ? 2 : prev.compConfirmPhase,
        pctComp:          autoCount > 0 ? 100 : prev.pctComp,
        satVars, pctSat: 100, satDone: true, satConfirmed: true,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-enforce sat constraints reactively when pidVars (active feed count) changes.
  useEffect(() => {
    const SAT_FEED_MAP: { key: string; existsKey: string }[] = [
      { key: 'sat_eth',    existsKey: 'eth_exists'    },
      { key: 'sat_pro',    existsKey: 'pro_exists'    },
      { key: 'sat_but',    existsKey: 'but_exists'    },
      { key: 'sat_nap',    existsKey: 'nap_exists'    },
      { key: 'sat_gen_fr', existsKey: 'gen_fr_exists' },
      { key: 'sat_gen_tf', existsKey: 'gen_tf_exists' },
    ];
    setFms(prev => {
      const pv = prev.pidVars as Record<string, Val>;
      const activeFeedMap = SAT_FEED_MAP.filter(f => pv[f.existsKey] === 1);
      const activeCount = activeFeedMap.length;
      let newSatVars = { ...prev.satVars };

      // When single feed and mode is 'both', resolve to dsg-only or sat-only
      const dsg = newSatVars['sat_dsg'] as Val;
      const se  = newSatVars['sat_exists'] as Val;
      if (activeCount <= 1 && dsg === 1 && se === 1) {
        const remainingFeed = activeFeedMap[0];
        const feedSatVal = remainingFeed ? (newSatVars[remainingFeed.key] as Val) : 0;
        if (feedSatVal === 1) {
          newSatVars['sat_dsg']    = 0 as Val;
          newSatVars['sat_exists'] = 1 as Val;
        } else {
          newSatVars['sat_dsg']    = 1 as Val;
          newSatVars['sat_exists'] = 0 as Val;
        }
      }

      // Apply feed background for current mode (sets active/inactive feed vars correctly)
      const activeFeedKeys = activeFeedMap.map(f => f.key);
      const withBackground = applyFeedBackground(newSatVars, pv, activeFeedKeys);

      const unchanged = SAT_FEED_MAP.every(f => withBackground[f.key] === prev.satVars[f.key])
        && withBackground['sat_dsg'] === prev.satVars['sat_dsg']
        && withBackground['sat_exists'] === prev.satVars['sat_exists'];
      if (unchanged) return prev;
      return { ...prev, satVars: withBackground, pctSat: 100, satDone: true, satConfirmed: true };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fms.pidVars]);

  // Preserve the questionnaire scroll position across re-renders. (Clicking YES/NO
  // re-renders this page; because the questionnaire's sub-components are declared
  // inline they remount and the browser resets scrollTop to 0 — restore it here,
  // synchronously before paint, so there's no visible jump.)
  useLayoutEffect(() => {
    const el = questScrollRef.current;
    if (el) el.scrollTop = questScrollTop.current;
  });

  const v = fms.pidVars;
  const pct = computePidPct(v);
  const pidReady = pct >= 100;
  const compReady = fms.compConfirmPhase >= 2;
  const satReady = fms.satDone;
  const needsSelector = selIsNeeded(v);

  function toggleRow(row: RowKey) {
    // V411: "All rows always accessible — no lock check"
    const newExpanded = expanded === row ? null : row;
    setExpanded(newExpanded);
    // Opening a row marks that section visited (V411 fmsOpenRow behaviour)
    if (newExpanded !== null) {
      setFms(prev => {
        const patch: Partial<typeof prev> = {};
        if (row === 'pid')  patch.visitedPid      = true;
        if (row === 'comp') patch.visitedComp     = true;
        if (row === 'sat')  patch.visitedSat      = true;
        if (row === 'sel')  patch.visitedSelector = true;

        // V411 buildCompPage: reconcile or first-populate from active feed headers
        if (row === 'comp') {
          const pv = prev.pidVars as Record<string, 0|1|null>;
          const suggested = compSuggestedList(pv);
          const allFeedComps = new Set<string>();
          (['eth','pro','but','nap'] as const).forEach(key => {
            if (pv['ff_'+key] === 1 || pv['rcy_'+key] === 1)
              (HEADER_COMPONENTS[key] || []).forEach(c => allFeedComps.add(c));
          });
          if (prev.compCount === 0) {
            // First entry: auto-populate
            if (suggested.length > 0) {
              patch.compComponents = suggested.slice();
              patch.compCount      = suggested.length;
            }
          } else {
            // Reconcile: remove orphaned, add newly suggested
            const reconciled = prev.compComponents.filter(c => allFeedComps.has(c));
            suggested.forEach(c => { if (!reconciled.includes(c)) reconciled.push(c); });
            const changed = reconciled.length !== prev.compComponents.length || reconciled.some((c, i) => c !== prev.compComponents[i]);
            if (changed) {
              patch.compComponents   = reconciled;
              patch.compCount        = reconciled.length;
              patch.compConfirmPhase = 0;
              patch.pctComp          = 0;
            }
          }
        }

        return { ...prev, ...patch };
      });
    }
  }

  function setVar(key: string, val: Val) {
    setFms(prev => {
      const vUser = { ...prev.pidVarsUser, [key]: val };
      let vars = { ...prev.pidVars, [key]: val };
      vars = reapplyFixedDefaults(vars);
      const { vars: locked, locked: newLocked } = applyLocksToVars(vars, vUser, prevLocked);
      // V418 two-feed linkage — mirror gen_fr/gen_tf to peer feed when exactly 2 X-feeds active
      const linked = applyTwoFeedLinkage(locked, vUser, newLocked, key, val);
      const inferred = inferPidVars(linked.vars);
      const newPct = computePidPct(inferred);
      setPrevLocked(newLocked);
      return {
        ...prev,
        pidVars: inferred,
        pidVarsUser: linked.vUser,
        pctPid: newPct,
        visitedPid: true,
      };
    });
  }

  // Drag the P&ID / Questionnaire divider to resize (mode 1 only). A press without
  // movement falls through to the collapse toggle, so the bars keep both behaviours.
  function beginDividerDrag(e: React.PointerEvent, onClickToggle: () => void) {
    const wrap = pidWrapRef.current;
    const canResize = pidMode === 1 && !!wrap;
    const startY = e.clientY;
    const startH = canResize ? wrap!.offsetHeight : 0;
    const container = wrap?.parentElement;
    const maxH = container ? container.offsetHeight - 120 : 600; // keep room for bars + questionnaire
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!canResize) return;
      // Sketch sits BELOW the bar, so dragging the bar down (dy>0) shrinks the sketch.
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      setPidHeight(Math.max(140, Math.min(startH - dy, Math.max(160, maxH))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      if (!moved) onClickToggle();
    };
    if (canResize) document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onPidContinue() {
    if (!pidReady) return;
    // Orphan-recycle warning: recycle exists but not routed anywhere
    const v2 = fms.pidVars;
    const orphans: string[] = [];
    const LABELS: Record<string,string> = { eth:'Ethane', pro:'Propane', but:'Butane' };
    ['eth','pro','but'].forEach(c => {
      if (v2['rcy_'+c] !== 1) return;
      const goesNowhere = v2[`rcy_${c}_to_eth`]===0 && v2[`rcy_${c}_to_pro`]===0 && v2[`rcy_${c}_to_but`]===0;
      if (goesNowhere) orphans.push(LABELS[c]);
    });
    if (orphans.length > 0) {
      const names = orphans.join(', ');
      const proceed = window.confirm(
        `Warning: ${names} recycle stream${orphans.length > 1 ? 's are' : ' is'} marked as existing but not routed to any header.\n\nThis is inconsistent — a recycle stream must go somewhere.\n\nProceed anyway?`
      );
      if (!proceed) return;
    }
    setFms(prev => {
      // Auto-reconcile component list on P&ID completion
      const suggested = compSuggestedList(prev.pidVars);
      const allFeedComps = new Set<string>();
      (['eth','pro','but','nap'] as const).forEach(key => {
        if (prev.pidVars['ff_'+key] === 1 || prev.pidVars['rcy_'+key] === 1) {
          (HEADER_COMPONENTS[key] || []).forEach(c => allFeedComps.add(c));
        }
      });
      let reconciled = prev.compComponents;
      if (prev.compCount > 0) {
        reconciled = prev.compComponents.filter(c => allFeedComps.has(c));
        suggested.forEach(c => { if (!reconciled.includes(c)) reconciled.push(c); });
        const changed = reconciled.length !== prev.compComponents.length || reconciled.some((c, i) => c !== prev.compComponents[i]);
        if (changed) {
          return {
            ...prev, pidDone: true, pidConfirmed: true, visitedPid: true, pctPid: 100,
            compComponents: reconciled, compCount: reconciled.length, compConfirmPhase: 0, pctComp: 0,
          };
        }
      }
      return { ...prev, pidDone: true, pidConfirmed: true, visitedPid: true, pctPid: 100 };
    });
    setExpanded('comp');
  }

  function onPidReset() {
    setFms(prev => ({
      ...prev,
      pidVars: (() => {
        const fresh: PidVars = {};
        Object.keys(prev.pidVars).forEach(k => fresh[k] = null);
        return reapplyFixedDefaults(fresh);
      })(),
      pidVarsUser: {},
      pidConfirmed: false, pidDone: false, pctPid: 0,
    }));
    setPrevLocked(new Set());
  }

  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function compDragStart(idx: number) { setDragSrcIdx(idx); }
  function compDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx);
  }
  function compDragLeave() { setDragOverIdx(null); }
  function compDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) { setDragSrcIdx(null); setDragOverIdx(null); return; }
    setFms(prev => {
      const comps = [...prev.compComponents];
      const [moved] = comps.splice(dragSrcIdx, 1);
      comps.splice(targetIdx, 0, moved);
      return { ...prev, compComponents: comps, compConfirmPhase: 0 };
    });
    setDragSrcIdx(null); setDragOverIdx(null);
  }
  function compDragEnd() { setDragSrcIdx(null); setDragOverIdx(null); }

  const [deleteDialogState, setDeleteDialogState] = useState<{
    targetCount: number; current: string[]; selected: Set<number>
  } | null>(null);

  function applyCompCount(val: string) {
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > MAX_COMP) { setCountErr(`Enter 1–${MAX_COMP}`); return; }
    setCountErr('');
    const current = fms.compComponents;
    if (n < current.length && current.length > 0) {
      // Show delete dialog
      setDeleteDialogState({ targetCount: n, current: [...current], selected: new Set() });
      return;
    }
    setFms(prev => {
      const suggested = compSuggestedList(prev.pidVars);
      const comps = [...prev.compComponents];
      while (comps.length < n) comps.push(suggested[comps.length] ?? '');
      comps.length = n;
      return { ...prev, compCount: n, compComponents: comps, compConfirmPhase: 0, visitedComp: true };
    });
  }

  function confirmDeleteComps() {
    if (!deleteDialogState) return;
    const { targetCount, current, selected } = deleteDialogState;
    const toRemove = current.length - targetCount;
    if (selected.size !== toRemove) return;
    const newComps = current.filter((_, i) => !selected.has(i));
    setFms(prev => ({ ...prev, compCount: targetCount, compComponents: newComps, compConfirmPhase: 0 }));
    setCountInput(String(targetCount));
    setDeleteDialogState(null);
  }

  function CompDeleteDialog() {
    if (!deleteDialogState) return null;
    const { targetCount, current, selected } = deleteDialogState;
    const toRemove = current.length - targetCount;
    return (
      <div className={cn(MODAL.overlay, 'fixed z-[99999] p-0')}>
        <div className={cn(MODAL.panel, 'p-6 min-w-[380px] max-w-[500px] max-h-[80vh] gap-3')}>
          <div className={cn(TEXT.cardTitle, 'uppercase')}>Select Rows to Delete</div>
          <div className={cn(TEXT.annotation, 'text-text-secondary leading-relaxed')}>
            Reducing from <b className="text-text-primary">{current.length}</b> to <b className="text-text-primary">{targetCount}</b> components.<br/>
            Check exactly <b className="text-accent-red">{toRemove}</b> row(s) to remove, then click Delete.
          </div>
          <div className="overflow-y-auto flex flex-col gap-1 max-h-80 pr-1">
            {current.map((comp, i) => (
              <label key={i} className={cn(TEXT.tableCell, 'flex items-center gap-2.5 px-2.5 py-1.5 rounded border border-border bg-surface-hover cursor-pointer select-none')}>
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => {
                    const s = new Set(selected);
                    s.has(i) ? s.delete(i) : s.add(i);
                    setDeleteDialogState(prev => prev ? { ...prev, selected: s } : null);
                  }}
                  className="w-3.5 h-3.5 accent-accent-blue cursor-pointer flex-shrink-0"
                />
                <span className={cn(TEXT.annotation, 'text-text-secondary min-w-[28px]')}>C{i+1}</span>
                <span>{comp || <span className="text-text-secondary italic">(blank)</span>}</span>
              </label>
            ))}
          </div>
          <div className={cn(TEXT.annotation, selected.size === toRemove ? 'text-accent-green' : 'text-text-secondary')}>
            {selected.size} of {toRemove} selected
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setDeleteDialogState(null); setCountInput(String(fms.compComponents.length)); }}
              className={cn(TEXT.button, BUTTON.ghost, 'px-4 py-2')}
            >Cancel</button>
            <button
              onClick={confirmDeleteComps}
              disabled={selected.size !== toRemove}
              className={cn(TEXT.button, 'px-4 py-2 border rounded transition',
                selected.size === toRemove
                  ? 'bg-accent-green/15 border-accent-green text-accent-green hover:bg-accent-green/25'
                  : 'border-border text-text-secondary cursor-not-allowed'
              )}
            >Delete Selected</button>
          </div>
        </div>
      </div>
    );
  }

  function updateComp(idx: number, val: string) {
    setFms(prev => {
      const comps = [...prev.compComponents];
      comps[idx] = val;
      return { ...prev, compComponents: comps, compConfirmPhase: 0 };
    });
  }

  function compConfirm() {
    if (fms.compComponents.length === 0) return;
    if (fms.compConfirmPhase === 0) {
      // Phase 0 → 1: show "Click to Complete" (blue)
      setFms(prev => ({ ...prev, compConfirmPhase: 1 }));
    } else if (fms.compConfirmPhase === 1) {
      // Phase 1 → 2: mark done, auto-open sat row
      setFms(prev => ({ ...prev, compConfirmPhase: 2, visitedComp: true, pctComp: 100 }));
      // Collapse comp, open sat (V411: fmsCollapseRow('comp') then fmsOpenRow('sat'))
      setTimeout(() => {
        setFms(prev => ({ ...prev, visitedSat: true }));
        setExpanded('sat');
      }, 400);
    } else {
      // Phase 2: already confirmed — just open sat
      setExpanded('sat');
    }
  }

  function computeSatPct(satVars: Record<string, Val>, pidVars: Record<string, Val>): number {
    const dsg = satVars['sat_dsg'], se = satVars['sat_exists'];
    const mode = (() => {
      if (dsg===1&&se===1) return 'both';
      if (dsg===1&&se===0) return 'dsg-only';
      if (dsg===0&&se===1) return 'sat-only';
      if (se===1&&dsg===null) return 'sat-only';
      if (dsg===1&&se===null) return 'dsg-only';
      return 'incomplete';
    })();
    if (mode === 'dsg-only' || mode === 'sat-only') return 100;
    if (mode === 'both') {
      const visibleFeedKeys = SAT_FEED_KEYS.filter(k => {
        const existKey = SAT_EXISTENCE[k];
        return existKey ? pidVars[existKey] === 1 : true;
      });
      const feedAnswered = visibleFeedKeys.filter(k => satVars[k] === 0 || satVars[k] === 1).length;
      const total = 2 + visibleFeedKeys.length;
      return Math.round(((2 + feedAnswered) / total) * 100);
    }
    const topAnswered = [dsg, se].filter(x => x !== null).length;
    return Math.round((topAnswered / 2) * 50);
  }

  function applyFeedBackground(
    satVars: Record<string, Val>,
    pidVars: Record<string, Val>,
    activeFeedKeys: string[],
    prevSatVars?: Record<string, Val>,
  ): Record<string, Val> {
    const next = { ...satVars };
    const mode = satGetMode(next);
    const prevMode = prevSatVars ? satGetMode(prevSatVars) : mode;
    if (mode === 'dsg-only') {
      SAT_FEED_KEYS.forEach(k => { next[k] = 0 as Val; });
    } else if (mode === 'sat-only') {
      SAT_FEED_KEYS.forEach(k => {
        const existKey = SAT_EXISTENCE[k];
        next[k] = (!existKey || pidVars[existKey] === 1) ? 1 as Val : 0 as Val;
      });
    } else if (mode === 'both') {
      // Inactive feeds → 0
      SAT_FEED_KEYS.forEach(k => {
        const existKey = SAT_EXISTENCE[k];
        if (existKey && pidVars[existKey] !== 1) next[k] = 0 as Val;
      });
      // Always auto-default when entering 'both' from another mode (top-level toggle changed).
      // When already in 'both' (P&ID change), only auto-default if no active feed has YES yet.
      const enteringBoth = prevMode !== 'both';
      const anyYes = activeFeedKeys.some(k => next[k] === 1);
      if (enteringBoth || !anyYes) {
        activeFeedKeys.forEach((k, i) => { next[k] = (i === 0 ? 1 : 0) as Val; });
      }
    }
    return next;
  }

  function satSetVar(key: string, val: Val) {
    setFms(prev => {
      const newSatVars = { ...prev.satVars, [key]: val };
      // Mutual exclusion for single-active-feed: if both YES, flip the other to NO
      const activeFeedKeys = SAT_FEED_KEYS.filter(k => {
        const existKey = SAT_EXISTENCE[k];
        return !existKey || prev.pidVars[existKey] === 1;
      });
      const activeFeeds = activeFeedKeys.length;
      if (activeFeeds <= 1 && key === 'sat_dsg' && val === 1 && newSatVars['sat_exists'] === 1)
        newSatVars['sat_exists'] = 0;
      if (activeFeeds <= 1 && key === 'sat_exists' && val === 1 && newSatVars['sat_dsg'] === 1)
        newSatVars['sat_dsg'] = 0;
      if (key === 'sat_dsg' && val === 0 && newSatVars['sat_exists'] === 0)
        newSatVars['sat_exists'] = 1;
      if (key === 'sat_exists' && val === 0 && newSatVars['sat_dsg'] === 0)
        newSatVars['sat_dsg'] = 1;
      const withBackground = applyFeedBackground(newSatVars, prev.pidVars, activeFeedKeys, prev.satVars);
      return { ...prev, satVars: withBackground, visitedSat: true, pctSat: computeSatPct(withBackground, prev.pidVars) };
    });
  }

  function satGetMode(satVars: Record<string, Val>): 'both' | 'dsg-only' | 'sat-only' | 'incomplete' {
    const dsg = satVars['sat_dsg'], se = satVars['sat_exists'];
    if (dsg === 1 && se === 1) return 'both';
    if (dsg === 1 && se === 0) return 'dsg-only';
    if (dsg === 0 && se === 1) return 'sat-only';
    if (se === 1 && dsg === null) return 'sat-only';
    if (dsg === 1 && se === null) return 'dsg-only';
    return 'incomplete';
  }

  function satSetPerFeed(key: string, val: Val) {
    setFms(prev => {
      const newSatVars = { ...prev.satVars };
      const activeFeedKeys = SAT_FEED_KEYS.filter(k => {
        const existKey = SAT_EXISTENCE[k];
        return existKey ? prev.pidVars[existKey] === 1 : true;
      });
      const exactly2 = activeFeedKeys.length === 2;
      if (exactly2) {
        // Linked toggle: flipping one flips the other
        newSatVars[key] = val;
        const other = activeFeedKeys.find(k => k !== key);
        if (other) newSatVars[other] = val === 1 ? 0 : 1;
      } else {
        const yesCount = activeFeedKeys.filter(k => prev.satVars[k] === 1).length;
        const noCount = activeFeedKeys.filter(k => prev.satVars[k] === 0).length;
        if (val === 0 && prev.satVars[key] === 1 && yesCount === 1) return prev;
        if (val === 1 && prev.satVars[key] === 0 && noCount === 1) return prev;
        newSatVars[key] = val;
      }
      return { ...prev, satVars: newSatVars, visitedSat: true, pctSat: computeSatPct(newSatVars, prev.pidVars) };
    });
  }

  function satDone() {
    setFms(prev => ({
      ...prev, satDone: true, satConfirmed: true, visitedSat: true, pctSat: 100,
    }));
    setExpanded(null);
  }

  function satReset() {
    setFms(prev => {
      const fresh: Record<string, Val> = {};
      [...SAT_FEED_KEYS, 'sat_dsg', 'sat_exists'].forEach(k => fresh[k] = null);
      return { ...prev, satVars: fresh, satDone: false, satConfirmed: false, pctSat: 0 };
    });
  }

  const locks = computeAutoLocks(v);

  function SegBtn({ vkey, segId, label }: { vkey: string; segId: string; label: string }) {
    const val = v[vkey] as Val;
    const lockInfo = locks.get(vkey);
    const isLocked = !!lockInfo;
    // Locked = auto-filled, no choice. Render a single full-width blue button
    // showing only the fixed value, centered — signals the user cannot change it.
    if (isLocked) {
      return (
        <div className={clsx(styles.seg, styles.segLocked)}>
          <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>NO</button>
          <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>YES</button>
          <span className={styles.segLockedLabel}>{lockInfo!.val === 1 ? 'YES' : 'NO'}</span>
        </div>
      );
    }
    const isYes = val === 1;
    const isNo  = val === 0;
    // Save-state marker lands on the ACTIVE label span only (never the button fill).
    const svc = save(v[vkey], f => f.pidVars[vkey]);
    return (
      <div className={styles.seg}>
        <button
          className={clsx(styles.segBtn, isNo ? styles.segBtnNo : styles.segBtnNeutral)}
          onClick={() => setVar(vkey, 0)}
        ><span className={clsx(isNo && svc)}>NO</span></button>
        <button
          className={clsx(styles.segBtn, isYes ? styles.segBtnYes : styles.segBtnNeutral)}
          onClick={() => setVar(vkey, 1)}
        ><span className={clsx(isYes && svc)}>YES</span></button>
      </div>
    );
  }

  function SatSegBtn({ vkey }: { vkey: string }) {
    const val = fms.satVars[vkey] as Val;
    const svc = save(fms.satVars[vkey], f => f.satVars[vkey]);
    return (
      <div className={styles.seg}>
        <button className={clsx(styles.segBtn, val===0 ? styles.segBtnNo : styles.segBtnNeutral)} onClick={() => satSetVar(vkey, 0)}><span className={clsx(val===0 && svc)}>NO</span></button>
        <button className={clsx(styles.segBtn, val===1 ? styles.segBtnYes : styles.segBtnNeutral)} onClick={() => satSetVar(vkey, 1)}><span className={clsx(val===1 && svc)}>YES</span></button>
      </div>
    );
  }

  // Permanently fixed NO — rendered in the same solid-blue "no choice" style as locked toggles.
  function FixedNo() {
    return (
      <div className={clsx(styles.seg, styles.segLocked)}>
        <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>NO</button>
        <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>YES</button>
        <span className={styles.segLockedLabel}>NO</span>
      </div>
    );
  }

  function GridRow({ label, keys, tipId, children }: { label: string; keys?: string[]; tipId?: string; children: React.ReactNode }) {
    // Row is fully auto-determined (every real input cell is locked blue) — nothing left for the user to do here.
    if (keys && keys.length > 0 && keys.every(k => locks.has(k))) return null;
    return (
      <div className={cn(TABLE.row, 'grid gap-3 px-3.5 py-2 items-center')} style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}>
        <div className={cn(TEXT.tableRowLabel, 'leading-relaxed pr-3 inline-flex items-start gap-1')}>
          <span>{label}</span>
          {tipId && <InfoTip id={tipId} className="mt-0.5" />}
        </div>
        {children}
      </div>
    );
  }

  function ColHeader() {
    const cols = [
      { label:'Ethane', color:'text-accent-blue' },
      { label:'Propane', color:'text-accent-purple' },
      { label:'Butane', color:'text-accent-yellow' },
      { label:'Naphtha / Liquid', color:'text-accent-green' },
    ];
    return (
      <div className="grid gap-3 px-4 py-1.5 bg-surface border border-border rounded mb-1" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}>
        <div/>
        {cols.map(c => <div key={c.label} className={clsx(styles.mono, 'text-[11px] font-semibold text-center', c.color)}>{c.label}</div>)}
      </div>
    );
  }

  // Section key groups for status badges (matching V411 S_KEYS)
  const SECTION_STATUS_KEYS: Record<string, string[]> = {
    'acc-s1': ['ff_eth','ff_pro','ff_but','ff_nap','rcy_eth','rcy_pro','rcy_but','rcy_nap'],
    'acc-s2': ['rcy_eth_to_eth','rcy_eth_to_pro','rcy_eth_to_but','rcy_pro_to_eth','rcy_pro_to_pro','rcy_pro_to_but','rcy_but_to_eth','rcy_but_to_pro','rcy_but_to_but'],
    'acc-s3': ['eth_to_gen_fr','pro_to_gen_fr','but_to_gen_fr','eth_to_gen_tf','pro_to_gen_tf','but_to_gen_tf'],
    'acc-s4': ['eth_spill_pro','eth_spill_but','pro_spill_eth','pro_spill_but','but_spill_eth','but_spill_pro'],
  };

  function AccordionSection({ id, num, title, tipId, children }: { id: string; num: string; title: string; tipId?: string; children: React.ReactNode }) {
    const open = openAccs.has(id);
    return (
      <div className={cn(TABLE.wrap, 'rounded-md mb-1.5 flex-shrink-0')}>
        <div
          className={cn(TABLE.header, 'flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-surface-hover select-none')}
          onClick={() => setOpenAccs(prev => {
            const s = new Set(prev);
            if (!s.has(id)) { s.add(id); return s; }
            // Closing: if this is the last open section, cycle to the next one
            // instead (never collapse all). Otherwise just close it.
            if (s.size === 1) {
              const order = FMS_ACC_ORDER;
              const next = order[(order.indexOf(id as typeof order[number]) + 1) % order.length];
              s.delete(id);
              s.add(next);
            } else {
              s.delete(id);
            }
            return s;
          })}
        >
          <div className="flex items-center gap-2 flex-1">
            <span className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>{num}</span>
            <span className={clsx(styles.mono, 'text-xs font-semibold text-text-secondary')}>{title}</span>
            {tipId && (
              // Stop the icon's click from bubbling to the header toggle.
              <span onClick={e => e.stopPropagation()} className="inline-flex">
                <InfoTip id={tipId} side="bottom" />
              </span>
            )}
          </div>
          {/* Status badge: "X / Y" answered */}
          {SECTION_STATUS_KEYS[id] && (() => {
            const keys = SECTION_STATUS_KEYS[id];
            const answered = keys.filter(k => v[k] === 0 || v[k] === 1).length;
            const total = keys.length;
            const allDone = answered === total;
            return (
              <span className={clsx(styles.mono, 'text-[8px] mr-2',
                allDone ? 'text-accent-green' : answered > 0 ? 'text-accent-yellow' : 'text-text-secondary'
              )}>
                {allDone ? '' : `${answered} / ${total}`}
              </span>
            );
          })()}
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"
            className={clsx('transition-transform', open && 'rotate-180')}>
            <path d="M2 3.5L5 6.5L8 3.5"/>
          </svg>
        </div>
        {open && <div className={TABLE.divide}>{children}</div>}
      </div>
    );
  }


  const availableComps = MASTER_COMPONENTS.filter(c => !(FIXED_COMPONENTS as readonly string[]).includes(c));

  // ── Selector Switch helpers ──
  const FEED_DEFS = [
    { key:'eth',    label:'Ethane',              idx:1 },
    { key:'pro',    label:'Propane',             idx:2 },
    { key:'but',    label:'Butane',              idx:3 },
    { key:'nap',    label:'Naphtha / Liquid',    idx:4 },
    { key:'gen_fr', label:'Fresh & Recycle',     idx:5 },
    { key:'gen_tf', label:'Total Feed',          idx:6 },
  ] as const;

  function selAllValues(): string[] {
    const all: string[] = [];
    FEED_DEFS.forEach(d => (fms.selectorChars[d.key] || []).forEach(v => all.push(v)));
    (fms.mixedChars || []).forEach(v => all.push(v));
    (fms.dualChars || []).forEach(v => all.push(v));
    return all;
  }

  function selAddChar(feedKey: keyof typeof fms.selectorChars, val: string) {
    if (!val.trim()) return;
    if (selAllValues().includes(val.trim())) return;
    setFms(prev => {
      const chars = { ...prev.selectorChars, [feedKey]: [...(prev.selectorChars[feedKey] || []), val.trim()] };
      return { ...prev, selectorChars: chars };
    });
  }

  function selRemoveChar(feedKey: keyof typeof fms.selectorChars, idx: number) {
    setFms(prev => {
      const arr = [...(prev.selectorChars[feedKey] || [])];
      arr.splice(idx, 1);
      return { ...prev, selectorChars: { ...prev.selectorChars, [feedKey]: arr } };
    });
  }

  function selAddOpChar(which: 'mixed' | 'dual', val: string) {
    if (!val.trim()) return;
    if (selAllValues().includes(val.trim())) return;
    setFms(prev => {
      if (which === 'mixed') return { ...prev, mixedChars: [...(prev.mixedChars || []), val.trim()] };
      return { ...prev, dualChars: [...(prev.dualChars || []), val.trim()] };
    });
  }

  function selRemoveOpChar(which: 'mixed' | 'dual', idx: number) {
    setFms(prev => {
      if (which === 'mixed') { const a = [...(prev.mixedChars||[])]; a.splice(idx,1); return { ...prev, mixedChars: a }; }
      const a = [...(prev.dualChars||[])]; a.splice(idx,1); return { ...prev, dualChars: a };
    });
  }

  function selSetOp(which: 'mixed' | 'dual', val: 0 | 1) {
    setFms(prev => which === 'mixed' ? { ...prev, mixedFeedOp: val } : { ...prev, dualFeedOp: val });
  }

  function ChipRow({ chars, onRemove }: { chars: string[]; onRemove: (i: number) => void }) {
    return (
      <div className="flex flex-wrap gap-1 min-h-[22px]">
        {chars.length === 0
          ? <span className={clsx(styles.mono, 'text-[9px] text-text-secondary')}>No entries yet</span>
          : chars.map((v, i) => (
              <span key={i} className={clsx(styles.mono, 'inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-hover border border-border rounded-full text-[10px] text-text-primary')}>
                {v}
                <button type="button" aria-label={`Remove ${v}`} className="cursor-pointer text-text-secondary hover:text-accent-red text-[11px] leading-none outline-none focus-visible:text-accent-red" onClick={() => onRemove(i)}>×</button>
              </span>
            ))
        }
      </div>
    );
  }

  function AddInput({ onAdd }: { onAdd: (val: string) => void }) {
    const [inp, setInp] = React.useState('');
    return (
      <div className="flex gap-1.5 mt-1.5">
        <input
          className={cn(styles.mono, FIELD.input, 'w-28 px-2 py-1 text-[11px]')}
          placeholder="Enter value…" value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onAdd(inp); setInp(''); e.preventDefault(); } }}
        />
        <button
          onClick={() => { onAdd(inp); setInp(''); }}
          className={cn(styles.mono, BUTTON.ghost, 'px-2 py-1 text-[9px]')}
        >+ Add</button>
      </div>
    );
  }

  function SatFeedSection() {
    const FEED_LABELS: Record<string,string> = {
      sat_eth:'Ethane', sat_pro:'Propane', sat_but:'Butane',
      sat_nap:'Naphtha / Liquid', sat_gen_fr:'Gen F&R', sat_gen_tf:'Gen Total Feed',
    };
    const activeFeedKeys = SAT_FEED_KEYS.filter(k => {
      const existKey = SAT_EXISTENCE[k];
      return existKey ? v[existKey] === 1 : true;
    });
    const exactly2 = activeFeedKeys.length === 2;
    const yesCount = activeFeedKeys.filter(k => fms.satVars[k] === 1).length;
    const noCount  = activeFeedKeys.filter(k => fms.satVars[k] === 0).length;

    if (activeFeedKeys.length === 0) return null;

    return (
      // Borderless — stacks under FeedSatTable's bordered wrapper as one continuous grid.
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: SAT_LABEL_COL_W }} />
          {activeFeedKeys.map(k => (
            <col key={k} style={{ width: `calc((100% - ${SAT_LABEL_COL_W}px) / ${activeFeedKeys.length})` }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td
              rowSpan={2}
              className={cn(TEXT.eyebrow, 'px-4 py-2 bg-table-header tracking-widest border-r border-b border-border align-middle')}
            >
              Which header has saturator
            </td>
            {activeFeedKeys.map(k => (
              <th key={k} className={cn(TEXT.tableHeader, 'px-3 py-2 text-center border-b border-r border-border bg-table-header last:border-r-0',
                k==='sat_eth'?'text-accent-blue':k==='sat_pro'?'text-accent-purple':k==='sat_but'?'text-accent-yellow':'text-accent-green'
              )}>
                {FEED_LABELS[k]}
              </th>
            ))}
          </tr>
          <tr>
            {activeFeedKeys.map(k => {
              const val = fms.satVars[k] as Val;
              const lockNo  = !exactly2 && val === 1 && yesCount === 1;
              const lockYes = !exactly2 && val === 0 && noCount  === 1;
              return (
                <td key={k} className="px-3 py-2.5 text-center border-r border-border last:border-r-0 bg-table-body">
                  <div className={styles.seg}>
                    <button
                      className={clsx(styles.segBtn, val===0 ? styles.segBtnNo : styles.segBtnNeutral)}
                      onClick={() => satSetPerFeed(k, 0)}
                      disabled={lockNo}
                      style={lockNo ? { opacity: 0.4 } : undefined}
                    >NO</button>
                    <button
                      className={clsx(styles.segBtn, val===1 ? styles.segBtnYes : styles.segBtnNeutral)}
                      onClick={() => satSetPerFeed(k, 1)}
                      disabled={lockYes}
                      style={lockYes ? { opacity: 0.4 } : undefined}
                    >YES</button>
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    );
  }

  function SelectorBody() {
    const activeDefs = FEED_DEFS.filter(d => {
      if (d.key === 'gen_fr') return v['gen_fr_exists'] === 1;
      if (d.key === 'gen_tf') return v['gen_tf_exists'] === 1;
      if (d.key === 'nap')    return v['nap_exists'] === 1;
      return v[d.key + '_exists'] === 1;
    });

    return (
      <div className="flex flex-col overflow-hidden min-h-0 flex-1">
        <div className="flex-shrink-0 px-4 py-2.5 bg-surface border-b border-border">
          <div className={clsx(styles.mono, 'text-xs font-semibold text-text-primary')}>Feed Selector Switch Characters</div>
          <div className={clsx(styles.mono, 'text-[9px] text-text-secondary mt-0.5')}>List all character values observed on the feed selector switch for each active feed header</div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {(() => {
            const FEED_COLOR: Record<string,string> = {
              eth:'text-accent-blue', pro:'text-accent-purple', but:'text-accent-yellow',
              nap:'text-accent-green', gen_fr:'text-accent-pink', gen_tf:'text-accent-cyan',
            };
            // Columns: each active feed header, then Mixed and Dual operation columns
            type SelCol = { kind:'feed'|'mixed'|'dual'; key?: keyof typeof fms.selectorChars; idx?: number; label: string; color: string; chars: string[]; op?: 0|1; onAdd:(v:string)=>void; onRemove:(i:number)=>void };
            const cols: SelCol[] = [
              ...activeDefs.map(d => ({ kind:'feed' as const, key:d.key, idx:d.idx, label:d.label, color: FEED_COLOR[d.key] || 'text-text-primary',
                chars: fms.selectorChars[d.key] || [], onAdd:(v:string)=>selAddChar(d.key, v), onRemove:(i:number)=>selRemoveChar(d.key, i) })),
              { kind:'mixed', label:'Mixed Feed', color:'text-text-primary', chars: fms.mixedChars || [], op: fms.mixedFeedOp, onAdd:(v:string)=>selAddOpChar('mixed', v), onRemove:(i:number)=>selRemoveOpChar('mixed', i) },
              { kind:'dual',  label:'Dual Feed',  color:'text-text-primary', chars: fms.dualChars  || [], op: fms.dualFeedOp,  onAdd:(v:string)=>selAddOpChar('dual', v),  onRemove:(i:number)=>selRemoveOpChar('dual', i) },
            ];
            return (
              <div className={cn(TABLE.wrap, 'rounded-[4px]')}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <tbody>
                      {/* Row 1 — header: rowSpan label + one column per feed/operation */}
                      <tr>
                        <td rowSpan={2}
                          className={clsx(styles.mono, 'px-3.5 py-2 bg-table-header text-[9px] text-text-secondary uppercase tracking-widest border-r border-border align-middle')}
                          style={{ width: 150 }}>
                          Observed Selector Switch Values
                        </td>
                        {cols.map((c, ci) => (
                          <th key={ci} className="px-3 py-2 text-center border-b border-r border-border bg-table-header last:border-r-0 align-top" style={{ minWidth: 150 }}>
                            {c.kind === 'feed' ? (
                              <>
                                <div className={clsx(styles.mono, 'text-[8px] font-semibold uppercase tracking-wide', c.color)}>Feed {c.idx}</div>
                                <div className={clsx(styles.mono, 'text-[10px] text-text-primary')}>{c.label}</div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className={clsx(styles.mono, 'text-[10px] text-text-primary')}>{c.label}</span>
                                <div className="flex gap-1">
                                  <button onClick={() => selSetOp(c.kind === 'mixed' ? 'mixed' : 'dual', 1)} className={clsx(styles.mono, 'px-2 py-0.5 rounded border text-[8px] transition', c.op===1 ? 'bg-accent-green/15 border-accent-green text-accent-green' : 'bg-surface border-border text-text-secondary hover:border-accent-blue')}>YES</button>
                                  <button onClick={() => selSetOp(c.kind === 'mixed' ? 'mixed' : 'dual', 0)} className={clsx(styles.mono, 'px-2 py-0.5 rounded border text-[8px] transition', c.op===0 ? 'bg-accent-red/15 border-accent-red text-accent-red' : 'bg-surface border-border text-text-secondary hover:border-accent-blue')}>NO</button>
                                </div>
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                      {/* Row 2 — values: chips + add input per column */}
                      <tr>
                        {cols.map((c, ci) => {
                          const dim = (c.kind === 'mixed' || c.kind === 'dual') && c.op !== 1;
                          return (
                            <td key={ci} className={clsx('px-3 py-2.5 border-r border-border last:border-r-0 bg-table-body align-top transition', dim && 'opacity-40 pointer-events-none')}>
                              <ChipRow chars={c.chars} onRemove={c.onRemove} />
                              <AddInput onAdd={c.onAdd} />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── State Variable panels: derived from the export serializer (single source of truth) ──
  const pidPanelRows  = usePanelRows('P&ID');
  const compPanelRows = usePanelRows(['Feed Components', 'Fuel Components']);
  const satPanelRows  = usePanelRows('Saturator');
  const selPanelRows  = usePanelRows('Feed Selector Switch');

  // Top tabs (replace the former stacked accordion rows). Feed Selector Switch only
  // appears when ≥2 feeds are active.
  const TABS: { key: RowKey; title: string }[] = (['pid', 'comp', 'sat'] as RowKey[])
    .concat(needsSelector ? ['sel'] : [])
    .map(key => ({ key, title: FMS_TAB_TITLES[key] }));
  // Active tab — fall back to the first tab if the stored row is unset or no longer present.
  const activeTab: RowKey = TABS.some(t => t.key === expanded) ? (expanded as RowKey) : 'pid';
  function selectTab(key: RowKey) {
    if (key !== activeTab) toggleRow(key); // toggleRow runs the visited / reconcile side-effects
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <CompDeleteDialog />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0" id="fms-outer">

        {/* Centered capsule tabs — sticky page tab bar (SEGMENT.bar) */}
        <div className={SEGMENT.bar}>
          <div className={SEGMENT.group}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={cn(
                  styles.mono,
                  SEGMENT.item,
                  'min-w-[160px] px-6 py-2 text-[11px]',
                  activeTab === t.key ? SEGMENT.active : SEGMENT.inactive,
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        {/* TAB: Area Feed Header */}
        {activeTab === 'pid' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Questionnaire + SV Panel (TOP) — hidden in mode 3 (sketch-only) */}
            {pidMode !== 3 && <div className="flex-1 flex overflow-hidden min-h-0">
              <SvPanel rows={pidPanelRows} />
              <div ref={questScrollRef} onScroll={(e) => { questScrollTop.current = e.currentTarget.scrollTop; }} className="flex-1 overflow-y-auto px-3 py-2">
              <ColHeader />
              <AccordionSection id="acc-s1" num="01" title="Fresh & Recycle Feed Availability" tipId="fms.acc.fresh-recycle">
                <GridRow label="Select the fresh feed the complex receives" tipId="fms.q.fresh-feed" keys={['ff_eth','ff_pro','ff_but','ff_nap']}>
                  <div className="flex justify-center"><SegBtn vkey="ff_eth" segId="sg-ff-eth" label="ETH FF" /></div>
                  <div className="flex justify-center"><SegBtn vkey="ff_pro" segId="sg-ff-pro" label="PRO FF" /></div>
                  <div className="flex justify-center"><SegBtn vkey="ff_but" segId="sg-ff-but" label="BUT FF" /></div>
                  <div className="flex justify-center"><SegBtn vkey="ff_nap" segId="sg-ff-nap" label="NAP FF" /></div>
                </GridRow>
                <GridRow label="Is there internal separation and recirculation of the following streams?" tipId="fms.q.recirculation" keys={['rcy_eth','rcy_pro','rcy_but','rcy_nap']}>
                  <div className="flex justify-center"><SegBtn vkey="rcy_eth" segId="sg-rcy-eth" label="ETH RCY" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_pro" segId="sg-rcy-pro" label="PRO RCY" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_but" segId="sg-rcy-but" label="BUT RCY" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_nap" segId="sg-rcy-nap" label="NAP RCY" /></div>
                </GridRow>
              </AccordionSection>

              <AccordionSection id="acc-s2" num="02" title="Recycle Routing Provision" tipId="fms.acc.recycle-routing">
                <GridRow label="Provision to route ethane recycle to following header" tipId="fms.q.route-ethane-recycle" keys={['rcy_eth_to_eth','rcy_eth_to_pro','rcy_eth_to_but']}>
                  <div className="flex justify-center"><SegBtn vkey="rcy_eth_to_eth" segId="sg-er2eth" label="E→E" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_eth_to_pro" segId="sg-er2pro" label="E→P" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_eth_to_but" segId="sg-er2but" label="E→B" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
                <GridRow label="Provision to route propane recycle to following header" tipId="fms.q.route-propane-recycle" keys={['rcy_pro_to_eth','rcy_pro_to_pro','rcy_pro_to_but']}>
                  <div className="flex justify-center"><SegBtn vkey="rcy_pro_to_eth" segId="sg-pr2eth" label="P→E" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_pro_to_pro" segId="sg-pr2pro" label="P→P" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_pro_to_but" segId="sg-pr2but" label="P→B" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
                <GridRow label="Provision to route butane recycle to following header" tipId="fms.q.route-butane-recycle" keys={['rcy_but_to_eth','rcy_but_to_pro','rcy_but_to_but']}>
                  <div className="flex justify-center"><SegBtn vkey="rcy_but_to_eth" segId="sg-br2eth" label="B→E" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_but_to_pro" segId="sg-br2pro" label="B→P" /></div>
                  <div className="flex justify-center"><SegBtn vkey="rcy_but_to_but" segId="sg-br2but" label="B→B" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
              </AccordionSection>

              <AccordionSection id="acc-s3" num="03" title="Routing To General Headers" tipId="fms.acc.general-headers">
                <GridRow label="Do the headers contribute to general fresh and recycle header?" tipId="fms.q.gen-fresh-recycle" keys={['eth_to_gen_fr','pro_to_gen_fr','but_to_gen_fr']}>
                  <div className="flex justify-center"><SegBtn vkey="eth_to_gen_fr" segId="sg-eth-gfr" label="E→GFR" /></div>
                  <div className="flex justify-center"><SegBtn vkey="pro_to_gen_fr" segId="sg-pro-gfr" label="P→GFR" /></div>
                  <div className="flex justify-center"><SegBtn vkey="but_to_gen_fr" segId="sg-but-gfr" label="B→GFR" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
                <GridRow label="Do the headers contribute to general total feed header?" tipId="fms.q.gen-total-feed" keys={['eth_to_gen_tf','pro_to_gen_tf','but_to_gen_tf']}>
                  <div className="flex justify-center"><SegBtn vkey="eth_to_gen_tf" segId="sg-eth-gtf" label="E→GTF" /></div>
                  <div className="flex justify-center"><SegBtn vkey="pro_to_gen_tf" segId="sg-pro-gtf" label="P→GTF" /></div>
                  <div className="flex justify-center"><SegBtn vkey="but_to_gen_tf" segId="sg-but-gtf" label="B→GTF" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
              </AccordionSection>

              <AccordionSection id="acc-s4" num="04" title="Feed Header Jumpover Provision" tipId="fms.acc.jumpover">
                <GridRow label="Does ethane header jumpover to" tipId="fms.q.ethane-jumpover" keys={['eth_spill_pro','eth_spill_but']}>
                  <div className="flex justify-center"><FixedNo /></div>
                  <div className="flex justify-center"><SegBtn vkey="eth_spill_pro" segId="sg-eth-spill-pro" label="E→P" /></div>
                  <div className="flex justify-center"><SegBtn vkey="eth_spill_but" segId="sg-eth-spill-but" label="E→B" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
                <GridRow label="Does propane header jumpover to" tipId="fms.q.propane-jumpover" keys={['pro_spill_eth','pro_spill_but']}>
                  <div className="flex justify-center"><SegBtn vkey="pro_spill_eth" segId="sg-pro-spill-eth" label="P→E" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                  <div className="flex justify-center"><SegBtn vkey="pro_spill_but" segId="sg-pro-spill-but" label="P→B" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
                <GridRow label="Does butane header jumpover to" tipId="fms.q.butane-jumpover" keys={['but_spill_eth','but_spill_pro']}>
                  <div className="flex justify-center"><SegBtn vkey="but_spill_eth" segId="sg-but-spill-eth" label="B→E" /></div>
                  <div className="flex justify-center"><SegBtn vkey="but_spill_pro" segId="sg-but-spill-pro" label="B→P" /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                  <div className="flex justify-center"><FixedNo /></div>
                </GridRow>
              </AccordionSection>
            </div></div>}

            {/* Single divider bar — cycles Q-only(2) → Both(1) → Sketch-only(3) → Q-only.
                In 'Both' mode it also drags to resize the sketch below it. */}
            <button
              onPointerDown={(e) => beginDividerDrag(e, () => setPidMode(m => m === 2 ? 1 : m === 1 ? 3 : 2))}
              title="Click to cycle: Questionnaire → Both → Sketch"
              className={clsx(styles.mono, 'flex-shrink-0 flex items-center justify-center gap-2 w-full h-6 bg-surface-hover border-y border-border text-[9px] text-text-secondary hover:text-text-primary hover:bg-surface transition select-none', pidMode === 1 && 'cursor-row-resize')}
            >
              <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="6"
                className={clsx('transition-transform', pidMode === 3 && 'rotate-180')}>
                <path d="M1 1L5 5L9 1"/>
              </svg>
              {pidMode === 2 ? 'Show Sketch and Questionnaire' : pidMode === 1 ? 'Show Sketch' : 'Show Questionnaire'}
            </button>

            {/* P&ID SVG (BOTTOM) — hidden in mode 2 (questionnaire-only). The wrapper is a
                fixed-scale scroll viewport whose height is drag-resizable. Until dragged it
                hugs the diagram (capped at 47vh); dragging pins an explicit pixel height. */}
            {pidMode !== 2 && (
              <div
                ref={pidWrapRef}
                className={clsx('overflow-y-auto overflow-x-hidden', pidMode === 3 ? 'flex-1 min-h-0' : 'flex-shrink-0')}
                style={pidMode === 3 ? undefined : (pidHeight != null ? { height: pidHeight } : { maxHeight: '47vh' })}
              >
                <PidSvgPanel vars={v} />
              </div>
            )}
          </div>
        )}

        {/* TAB: Feed Components */}
        {activeTab === 'comp' && (
          <div className="flex flex-1 overflow-hidden min-h-0">
          <SvPanel rows={compPanelRows} />
          {/* Split "research-paper" layout: Feed components (left) | Fuel components (right) */}
          <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex flex-col overflow-hidden min-h-0 flex-1">
            {/* Topbar */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2 bg-surface border-b border-border">
              <div>
                <div className={TEXT.sectionHeader}>Feed Components Configuration</div>
              </div>
              <div className={clsx(styles.mono, 'flex items-center gap-2 text-[10px] text-text-secondary')}>
                <span>Components in feed:</span>
                <input
                  type="number" min={1} max={MAX_COMP}
                  className={cn(
                    styles.mono, styles.numInput, FIELD.input,
                    'w-14 px-2 py-1 text-xs font-medium text-center',
                    countErr && 'border-accent-red',
                  )}
                  value={countInput}
                  onChange={e => {
                    const raw = e.target.value;
                    setCountInput(raw);
                    if (raw === '') { setCountErr(''); return; }
                    const n = parseInt(raw);
                    if (isNaN(n) || n < 1) setCountErr('Must be ≥ 1');
                    else if (n > MAX_COMP) setCountErr(`Max is ${MAX_COMP}`);
                    else setCountErr('');
                  }}
                  onBlur={() => {
                    if (countInput === '') {
                      setFms(prev => ({ ...prev, compCount: 0, compComponents: [], compConfirmPhase: 0 }));
                      return;
                    }
                    applyCompCount(countInput);
                  }}
                  onKeyDown={e => { if (e.key==='Enter') { (e.target as HTMLInputElement).blur(); } }}
                />
                <span className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>max {MAX_COMP}</span>
              </div>
              {countErr && <span className={clsx(styles.mono, 'text-[9px] text-accent-red')}>{countErr}</span>}
            </div>
            {/* Table */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {/* No `overflow-hidden` on this wrapper: the header is sticky to the
                  outer scroll container above, and `overflow-hidden` would make this
                  wrapper itself a scroll-container ancestor, breaking that stickiness. */}
              <div className={cn(TABLE.wrap, 'rounded-[4px]')}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className={TABLE.header}>
                    <th className={clsx(styles.mono, 'text-[11px] font-semibold text-text-secondary px-3 py-2 text-center sticky top-0 z-10 w-40')}>Feed Component Number</th>
                    <th className={clsx(styles.mono, 'text-[11px] font-semibold text-text-secondary px-3 py-2 text-center sticky top-0 z-10')}>Feed Component Name</th>
                  </tr>
                </thead>
                <tbody className={TABLE.divide}>
                  {fms.compComponents.map((comp, idx) => (
                    <tr
                      key={idx}
                      draggable
                      onDragStart={() => compDragStart(idx)}
                      onDragOver={e => compDragOver(e, idx)}
                      onDragLeave={compDragLeave}
                      onDrop={e => compDrop(e, idx)}
                      onDragEnd={compDragEnd}
                      className={cn(
                        TABLE.row,
                        dragOverIdx === idx && dragSrcIdx !== idx && 'bg-accent-blue/10 outline outline-1 outline-accent-blue',
                        dragSrcIdx === idx && 'opacity-40'
                      )}
                    >
                      <td className={clsx(styles.mono, 'px-3 py-2 text-[10px] text-text-secondary')}>
                        <span className={clsx(styles.dragHandle, 'mr-2 cursor-grab')} title="Drag to reorder">⠿</span>
                        Component {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={comp}
                          onChange={e => updateComp(idx, e.target.value)}
                          className={cn(styles.mono, styles.fiSel, FIELD.input, 'w-full px-2 py-1.5 text-[11px]',
                            save(fms.compComponents[idx], f => f.compComponents[idx]))}
                        >
                          <option value="">— select —</option>
                          {availableComps.map(c => {
                            const usedElsewhere = fms.compComponents.some((v2, j) => j !== idx && v2 === c);
                            return (
                              <option key={c} value={c} disabled={usedElsewhere && c !== comp}>
                                {c}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
          {/* Divider between Feed (left) and Fuel (right) */}
          <div className="w-px flex-shrink-0 bg-border" />
          <FuelComponentsSection />
          </div>
          </div>
        )}

        {/* TAB: Saturator Config */}
        {activeTab === 'sat' && (
          <div className="flex flex-1 overflow-hidden min-h-0">
          <SvPanel rows={satPanelRows} />
          <div className="flex flex-col overflow-hidden min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* Both tables share one container so they merge seamlessly. The
                  first column has a fixed shared width; data columns within each
                  table are distributed equally via table-fixed. */}
              <div className={cn(TABLE.wrap, 'rounded-[4px]')}>
                {/* Does the following exist? — always 2 data columns */}
                <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: SAT_LABEL_COL_W }} />
                    <col style={{ width: `calc((100% - ${SAT_LABEL_COL_W}px) / 2)` }} />
                    <col style={{ width: `calc((100% - ${SAT_LABEL_COL_W}px) / 2)` }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td
                        rowSpan={2}
                        className={cn(TEXT.tableRowLabel, 'px-4 py-3 bg-table-header border-r border-border align-middle')}
                      >
                        Does the following exist?
                      </td>
                      <th className={cn(TEXT.tableHeader, 'px-4 py-2.5 text-center border-b border-r border-border bg-table-header')}>
                        Dilution Steam Generator
                      </th>
                      <th className={cn(TEXT.tableHeader, 'px-4 py-2.5 text-center border-b border-border bg-table-header')}>
                        Feed Saturator
                      </th>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-center border-r border-border bg-table-body">
                        <SatSegBtn vkey="sat_dsg" />
                      </td>
                      <td className="px-4 py-3 text-center bg-table-body">
                        <SatSegBtn vkey="sat_exists" />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Which header has saturator — N data columns (active feeds),
                    only in 'both' mode. Rendered borderless so it stacks under
                    the table above as one continuous grid. */}
                {satGetMode(fms.satVars) === 'both' && <SatFeedSection />}
              </div>
            </div>

          </div>
          </div>
        )}

        {/* TAB: Feed Selector Switch — only shown when ≥2 feeds active */}
        {needsSelector && activeTab === 'sel' && (
          <div className="flex flex-1 overflow-hidden min-h-0">
            <SvPanel rows={selPanelRows} />
            <div className="flex-1 overflow-hidden"><SelectorBody /></div>
          </div>
        )}

      </div>
    </div>
  );
}
