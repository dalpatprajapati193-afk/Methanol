'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  activePageAtom, fmsStateAtom, enterHwSection, ffiUnlocked, basicInfoComplete, type FmsState, type PageKey,
  expandedFmsRowAtom, FMS_TAB_TITLES, type FmsRowKey,
  basicInfoTabAtom, BASICINFO_TAB_TITLES, type BasicInfoTabKey,
  convTabAtom, CONV_TAB_TITLES,
  radTabAtom, RAD_TAB_TITLES,
  draftFmsAtom, confirmedFmsAtom, defaultFmsState,
} from '../store/FmsAtoms';
import { fuelStateAtom, draftFuelAtom, confirmedFuelAtom, defaultFuelState, type FuelState } from '../store/FuelAtoms';
import { selIsNeeded } from './pages/FeedManagementPage';
import { serializeFmsState } from '../constants/ExportUtils';
import { saveDraftWorkbook } from '../actions/actions';
import styles from '../Style.module.css';
import { TEXT } from '../theme/TextTypes';
import { BUTTON } from '../theme/Surfaces';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

// The Configuration-Modules wizard runs in a fixed order. Each page that is part
// of the sequence gets a Back / Next bar that threads to its neighbours. Hardware
// "Convection" and "Radiation" are both the `hwdefine` page distinguished by
// `hwCurSec`, so steps are keyed separately from PageKey.
type Step = 'basicinfo' | 'fms' | 'conv' | 'rad' | 'ffi';

// A destination is either a plain page, a hardware section (needs section setup),
// or the gated jump to Feed & Furnace Interaction.
type Dest =
  | { kind: 'page'; page: PageKey; label: string; title?: string }
  | { kind: 'sec'; sec: 'conv' | 'rad'; label: string }
  | { kind: 'ffi'; label: string };

const NAV: Record<Step, { back: Dest; next: Dest }> = {
  basicinfo: {
    back: { kind: 'page', page: 'hub', label: 'Configuration Modules' },
    next: { kind: 'page', page: 'fms', label: 'Feed & Fuel Management System' },
  },
  fms: {
    back: { kind: 'page', page: 'basicinfo', label: 'Basic Information' },
    next: { kind: 'sec', sec: 'conv', label: 'Convection Section & Transfer Line Exchangers' },
  },
  conv: {
    back: { kind: 'page', page: 'fms', label: 'Feed & Fuel Management System' },
    next: { kind: 'sec', sec: 'rad', label: 'Radiation Zone' },
  },
  rad: {
    back: { kind: 'sec', sec: 'conv', label: 'Convection Section & Transfer Line Exchangers' },
    next: { kind: 'ffi', label: 'Feed & Furnace Interaction' },
  },
  ffi: {
    back: { kind: 'sec', sec: 'rad', label: 'Radiation Zone' },
    next: { kind: 'page', page: 'hub', label: 'Submit', title: 'Go to Configuration Modules to submit' },
  },
};

function stepFor(page: PageKey, hwCurSec: FmsState['hwCurSec']): Step | null {
  switch (page) {
    case 'basicinfo': return 'basicinfo';
    case 'fms': return 'fms';
    case 'ffi': return 'ffi';
    case 'hwdefine':
      return hwCurSec === 'conv' ? 'conv' : hwCurSec === 'rad' ? 'rad' : null;
    default: return null;
  }
}

// A hardware section's CONTENT only — sameForAll, furnace assignment, and each
// template's id/name/fields. Deliberately drops selectedIdx and the derived
// completeness flags so merely navigating between templates isn't "unsaved".
function hwK(s: { sameForAll: 0 | 1; applyMap: Record<number, string>; templates: { id: string; name: string; fields: unknown }[] }): unknown {
  return { s: s.sameForAll, a: s.applyMap, t: s.templates.map(t => ({ id: t.id, n: t.name, f: t.fields })) };
}

// The slice of state each wizard step owns — used to decide whether THIS page has
// unsaved changes (its slice differs from the saved draft). Save is per-page: it is
// shown only when the current step's slice is dirty.
function pageSliceKey(step: Step, f: FmsState, fu: FuelState): string {
  switch (step) {
    case 'basicinfo': return JSON.stringify([f.furnaceInfo, f.uom, f.furnaceCount]);
    case 'fms':       return JSON.stringify([f.pidVars, f.satVars, f.selectorChars, f.mixedChars, f.dualChars, f.mixedFeedOp, f.dualFeedOp, f.compComponents, f.compCount, fu]);
    case 'conv':      return JSON.stringify([hwK(f.hwConv), hwK(f.hwTle)]);
    case 'rad':       return JSON.stringify([hwK(f.hwRad)]);
    case 'ffi':       return JSON.stringify([f.ffiTemplates, f.ffiApplyMap, f.ffiSameForAll, f.ffiModeState]);
  }
}

// Internal pill-tabs belonging to the current step, if any. Back/Next walk through
// these one at a time before falling through to the adjacent page/section.
type TabCycle = { keys: string[]; current: string; setTab: (key: string) => void; titles: Record<string, string> };

export default function WizardNav() {
  const [activePage, setActivePage] = useAtom(activePageAtom);
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [fmsTab, setFmsTab] = useAtom(expandedFmsRowAtom);
  const [basicInfoTab, setBasicInfoTab] = useAtom(basicInfoTabAtom);
  const [convTab, setConvTab] = useAtom(convTabAtom);
  const [radTab, setRadTab] = useAtom(radTabAtom);
  const fuel = useAtomValue(fuelStateAtom);
  const setDraftFms = useSetAtom(draftFmsAtom);
  const setDraftFuel = useSetAtom(draftFuelAtom);
  const draftFms = useAtomValue(draftFmsAtom);
  const confirmedFms = useAtomValue(confirmedFmsAtom);
  const draftFuel = useAtomValue(draftFuelAtom);
  const confirmedFuel = useAtomValue(confirmedFuelAtom);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const step = stepFor(activePage, fms.hwCurSec);
  if (!step) return null;
  const { back, next } = NAV[step];

  const fmsTabKeys: FmsRowKey[] = (['pid', 'comp', 'sat'] as FmsRowKey[]).concat(selIsNeeded(fms.pidVars) ? ['sel'] : []);
  const currentFmsTab: FmsRowKey = fmsTabKeys.includes((fmsTab ?? 'pid') as FmsRowKey) ? (fmsTab as FmsRowKey) : 'pid';

  const tabsForStep: TabCycle | null =
    step === 'basicinfo' ? { keys: ['fleet', 'uom'], current: basicInfoTab, setTab: (k) => setBasicInfoTab(k as BasicInfoTabKey), titles: BASICINFO_TAB_TITLES } :
    step === 'fms' ? { keys: fmsTabKeys, current: currentFmsTab, setTab: (k) => setFmsTab(k as FmsRowKey), titles: FMS_TAB_TITLES } :
    step === 'conv' ? { keys: ['conv', 'tle'], current: convTab, setTab: (k) => setConvTab(k as 'conv' | 'tle'), titles: CONV_TAB_TITLES } :
    step === 'rad' ? { keys: ['tube', 'burner'], current: radTab, setTab: (k) => setRadTab(k as 'tube' | 'burner'), titles: RAD_TAB_TITLES } :
    null;

  const idx = tabsForStep ? tabsForStep.keys.indexOf(tabsForStep.current) : -1;
  const atFirstTab = !tabsForStep || idx <= 0;
  const atLastTab = !tabsForStep || idx >= tabsForStep.keys.length - 1;

  const backLabel = atFirstTab ? back.label : tabsForStep!.titles[tabsForStep!.keys[idx - 1]];
  const nextLabel = atLastTab ? next.label : tabsForStep!.titles[tabsForStep!.keys[idx + 1]];

  function go(dest: Dest) {
    if (dest.kind === 'page') { setActivePage(dest.page); return; }
    if (dest.kind === 'sec') { setFms(prev => enterHwSection(prev, dest.sec)); setActivePage('hwdefine'); return; }
    // ffi — gated
    if (ffiUnlocked(fms)) setActivePage('ffi');
  }

  function goBack() {
    if (!atFirstTab) { tabsForStep!.setTab(tabsForStep!.keys[idx - 1]); return; }
    // Crossing back from FMS's first tab lands on Basic Information's last (UOM) tab.
    if (step === 'fms') setBasicInfoTab('uom');
    go(back);
  }

  function goNext() {
    if (!atLastTab) { tabsForStep!.setTab(tabsForStep!.keys[idx + 1]); return; }
    // Crossing forward from Basic Information's last (UOM) tab lands on FMS's first tab.
    if (step === 'basicinfo') setFmsTab('pid');
    go(next);
  }

  // The ffi gate only ever applies at the true page boundary (rad's last tab -> ffi),
  // never mid-tab-cycle.
  const ffiLocked = atLastTab && next.kind === 'ffi' && !ffiUnlocked(fms);
  const lockTitle = 'Feed & Furnace Interaction unlocks after Basic Information, Feed Management, and the Convection & Radiation define steps are complete.';

  // Basic Information gates the whole flow: until it's complete, the Next button
  // (which would cross to Feed & Fuel Management) is not shown at all.
  const nextHidden = step === 'basicinfo' && atLastTab && !basicInfoComplete(fms);

  // instance_id from the route → threaded into the draft Save (per-instance dir).
  const routeInstance = useParams()?.instance_id;
  const instanceId = Number(Array.isArray(routeInstance) ? routeInstance[0] : routeInstance) || null;

  // Save = draft. Persists the current FMS State + Entity_Tree to the draft set
  // (UI_Export_Draft.xlsx + its JSONs) without touching the confirmed copy. No
  // completeness gate — a work-in-progress draft can be saved at any time. The
  // Hub Confirm turns yellow (+ Revert) whenever the draft/current state differs
  // from the confirmed copy.
  async function onSave() {
    if (saveState === 'saving') return;
    setSaveState('saving');
    try {
      const { fmsRows, treeRows } = serializeFmsState(fms, fuel);
      const res = await saveDraftWorkbook(instanceId, fmsRows, treeRows);
      if (res.success) {
        setDraftFms(fms);   // this on-screen state is now the draft baseline
        setDraftFuel(fuel);
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
    // Settle back to idle so the button is ready for the next Save.
    setTimeout(() => setSaveState('idle'), 1800);
  }

  const saveLabel = saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' ? 'Saved ✓'
    : saveState === 'error' ? 'Save failed'
    : 'SAVE';
  const saveDotColor = saveState === 'saved' ? 'text-accent-green'
    : saveState === 'error' ? 'text-accent-red'
    : 'text-accent-yellow';

  // Save is PER PAGE: shown only when THIS step's slice differs from the saved draft
  // (baseline = draft, else confirmed, else defaults). During the brief save feedback
  // it stays visible so "Saved ✓" is seen before it hides.
  const baseFms = draftFms ?? confirmedFms ?? defaultFmsState();
  const baseFuel = draftFuel ?? confirmedFuel ?? defaultFuelState();
  // Opening a hardware section runs enterHwSection, which auto-creates its Template 1
  // (and, for Convection, the paired TLE templates) and forces sameForAll for a single
  // furnace. That entry normalization is not a user edit, so run the SAME transform on
  // the baseline before diffing — otherwise the section reads as "dirty" (SAVE shown)
  // the instant it's opened, with nothing actually changed.
  const norm = (s: FmsState): FmsState =>
    step === 'conv' ? enterHwSection(s, 'conv')
    : step === 'rad' ? enterHwSection(s, 'rad')
    : s;
  const pageDirty = pageSliceKey(step, norm(fms), fuel) !== pageSliceKey(step, norm(baseFms), baseFuel);
  const showSave = pageDirty || saveState !== 'idle';

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-surface">
      <button
        onClick={goBack}
        title={`Prev: ${backLabel}`}
        className={cn(TEXT.breadcrumb, 'w-[280px] h-10 flex items-center gap-2 px-3.5 rounded border border-accent-blue text-white bg-accent-blue hover:brightness-110 cursor-pointer transition', BUTTON.raised)}
      >
        <NavChevrons dir="prev" />
        <span className="opacity-80 flex-shrink-0">PREV:</span>
        <span className="font-medium truncate flex-1 text-left">{backLabel}</span>
      </button>

      {/* Centre SAVE button — per page: only when this page has unsaved changes. The
          centre slot is always present so PREV/NEXT stay put; the button appears in it. */}
      <div className="flex-1 flex justify-center">
        {showSave && (
        <button
          onClick={onSave}
          disabled={saveState === 'saving'}
          title="Unsaved changes on this page — Save a draft (UI_Export_Draft.xlsx); Confirm on the Hub to record it"
          className={cn(TEXT.breadcrumb, 'h-10 px-5 flex items-center gap-2.5 rounded border border-border bg-background text-text-primary transition', BUTTON.raised,
            saveState === 'saving' ? 'opacity-70 cursor-wait' : 'hover:bg-surface-hover cursor-pointer')}
        >
          <span className={cn(styles.saveDot, saveDotColor)} aria-hidden />
          <span className="font-semibold tracking-wide">{saveLabel}</span>
        </button>
        )}
      </div>

      {/* Spacer keeps SAVE centred when the NEXT button is hidden. */}
      {nextHidden && <div className="w-[280px] flex-shrink-0" aria-hidden />}

      {!nextHidden && (
      <button
        onClick={() => !ffiLocked && goNext()}
        disabled={ffiLocked}
        title={ffiLocked ? lockTitle : atLastTab && next.kind === 'page' && next.title ? next.title : `Next to ${nextLabel}`}
        className={cn(
          TEXT.breadcrumb,
          'w-[280px] h-10 flex items-center gap-2 px-3.5 rounded border transition',
          ffiLocked
            ? 'border-border text-text-secondary opacity-50 cursor-not-allowed'
            : cn('border-accent-blue text-white bg-accent-blue hover:brightness-110 cursor-pointer', BUTTON.raised),
        )}
      >
        {ffiLocked && <span className="leading-none flex-shrink-0">🔒</span>}
        <span className="opacity-80 flex-shrink-0">NEXT:</span>
        <span className="font-medium truncate flex-1 text-right">{nextLabel}</span>
        {!ffiLocked && <NavChevrons dir="next" />}
      </button>
      )}
    </div>
  );
}

// Three chevrons that pulse in sequence so the wave travels toward the button's
// direction (right for Next, left for Prev) — the animated "next/back feel".
function NavChevrons({ dir }: { dir: 'next' | 'prev' }) {
  const glyph = dir === 'next' ? '›' : '‹';
  return (
    <span className={cn(styles.navChevs, 'leading-none flex-shrink-0')} aria-hidden>
      {[0, 1, 2].map(i => {
        // Next: wave runs left→right (i). Prev: right→left (2 - i).
        const order = dir === 'next' ? i : 2 - i;
        return (
          <span key={i} style={{ animationDelay: `${order * 0.15}s` }}>{glyph}</span>
        );
      })}
    </span>
  );
}
