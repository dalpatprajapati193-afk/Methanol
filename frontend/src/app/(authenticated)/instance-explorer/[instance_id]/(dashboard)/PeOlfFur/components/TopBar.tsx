'use client';
import { useRef, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useAtom } from 'jotai';
import { activePageAtom, fmsStateAtom, PageKey } from '../store/FmsAtoms';
import { fuelStateAtom } from '../store/FuelAtoms';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../Style.module.css';
import { TEXT } from '../theme/TextTypes';
import { THEME_KEY } from '../constants/Theme';
import { serializeFmsState, ExportRow, TreeRow } from '../constants/ExportUtils';
import { importFromRows } from '../constants/ImportUtils';
import * as XLSX from 'xlsx';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

// Theme-toggle symbols. `currentColor` so the parent sets the tint.
function SunIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// Root crumb → landing (the "Olefin Furnace Suite" 2-tile page). Both the
// configuration and packages flows share the same root name — there is no
// "Know Your Case" / "Packages / KPI" crumb; both mean and point to the Suite.
const KYC: { label: string; parent?: PageKey }[] = [
  { label: 'Olefin Furnace Suite', parent: 'landing' },
];
const PKG: { label: string; parent?: PageKey }[] = [
  { label: 'Olefin Furnace Suite', parent: 'landing' },
  { label: 'Home', parent: 'packages' },
];
// RULE: every breadcrumb label must match the exact title of the tile/page it
// represents (e.g. the "Feed & Fuel Management System" tile is never abbreviated to
// "Feed & Fuel Mgmt" in the trail). Keep these in sync whenever a tile is renamed.
const PAGE_CRUMBS: Record<PageKey, { label: string; parent?: PageKey }[]> = {
  landing:   [{ label: 'Olefin Furnace Suite' }],
  packages:     [{ label: 'Olefin Furnace Suite', parent: 'landing' }, { label: 'Home' }],
  pkgSelection: [...PKG, { label: 'KPI / Package Selection' }],
  inputSheet:   [...PKG, { label: 'Input Sheet' }],
  basicinfo: [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Basic Information' }],
  hub:       [...KYC, { label: 'Configuration Modules' }],
  fms:       [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Feed & Fuel Management System' }],
  ffi:       [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Feed & Furnace Interaction' }],
  hwcfg:     [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Furnace Hardware Configuration' }],
  hwsec:     [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Furnace Hardware Configuration', parent: 'hwcfg' }, { label: '—' }],
  hwdefine:  [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Furnace Hardware Configuration', parent: 'hwcfg' }, { label: 'Define Hardware' }],
  hwapply:   [...KYC, { label: 'Configuration Modules', parent: 'hub' }, { label: 'Furnace Hardware Configuration', parent: 'hwcfg' }, { label: 'Apply Hardware' }],
};

export default function TopBar() {
  const [activePage, setActivePage] = useAtom(activePageAtom);
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [fuel, setFuel] = useAtom(fuelStateAtom);
  const importRef = useRef<HTMLInputElement>(null);
  const [devOpen, setDevOpen] = useState(false);
  const devRef = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Close the Dev Functions dropdown on outside click.
  useEffect(() => {
    if (!devOpen) return;
    function onDown(e: MouseEvent) {
      if (devRef.current && !devRef.current.contains(e.target as Node)) setDevOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [devOpen]);
  function toggleTheme() {
    const next = !isDark;
    const root = document.documentElement;
    // Persist the choice so a refresh keeps it (restored pre-hydration in page.tsx).
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch { /* storage blocked */ }
    // Apply the theme as ONE synchronous DOM commit (flushSync) so the View
    // Transition snapshots the fully-themed new state in a single pass.
    const apply = () => flushSync(() => {
      setIsDark(next);
      root.classList.toggle('dark', next);
    });
    // View Transitions API crossfades a snapshot of the whole viewport — SVG,
    // native <select> controls, box-shadows and all — as one uniform fade. Per-
    // element CSS color transitions can't cover those (native widgets + shadows
    // snap), which is why a class-by-class transition never looked smooth. Fall
    // back to a plain toggle where unsupported or when reduced motion is asked.
    const vt = (document as unknown as {
      startViewTransition?: (cb: () => void) => { ready?: Promise<void> };
    }).startViewTransition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof vt === 'function' && !reduceMotion) {
      // Suppress every element's own CSS transition (transition-all on tiles,
      // transition-colors on inputs, …) for the duration of the flip. Otherwise
      // VT captures its "new" snapshot while those elements are still mid-colour-
      // transition — a half-themed frame — and the crossfade pops to the final
      // colour underneath (worst on heavy pages like the Hub). With transitions
      // off, styles commit instantly so the snapshot is fully themed. Re-enable
      // once VT is `ready` (snapshot taken); the crossfade itself is unaffected.
      root.classList.add('theme-anim-off');
      const reenable = () => root.classList.remove('theme-anim-off');
      const transition = vt.call(document, apply);
      if (transition?.ready) transition.ready.finally(reenable);
      else requestAnimationFrame(reenable);
    } else {
      apply();
    }
  }

  // The two hardware tiles share the hwdefine/hwsec pages — the final crumb must
  // name the tile the user actually entered (matches HardwareConfigPage tile labels).
  const HW_SEC_LABELS: Record<string, string> = {
    conv: 'Convection Section & Transfer Line Exchangers',
    rad:  'Radiation Zone',
  };
  const crumbs = (() => {
    const base = PAGE_CRUMBS[activePage] || [];
    if ((activePage === 'hwdefine' || activePage === 'hwsec') && fms.hwCurSec) {
      const secLabel = HW_SEC_LABELS[fms.hwCurSec];
      if (secLabel) return base.map((c, i) => i === base.length - 1 ? { ...c, label: secLabel } : c);
    }
    return base;
  })();

  function devExport() {
    const { fmsRows, treeRows } = serializeFmsState(fms, fuel);

    // Sheet 1: FMS State
    const wsData: (string | number)[][] = [['Variable', 'Value', 'Section', 'Standard Variable']];
    fmsRows.forEach((r: ExportRow) => wsData.push([r.variable, r.value ?? '—', r.section, r.standardVar]));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 48 }, { wch: 28 }, { wch: 34 }, { wch: 48 }];

    // Sheet 2: Entity_Tree
    const treeData: (string | number)[][] = [['Node_ID', 'Node_Type', 'Index', 'Parent_Node_ID', 'Label']];
    treeRows.forEach((r: TreeRow) => treeData.push([r.nodeId, r.nodeType, r.index, r.parentId, r.label]));
    const wsTree = XLSX.utils.aoa_to_sheet(treeData);
    wsTree['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,     'FMS State');
    XLSX.utils.book_append_sheet(wb, wsTree, 'Entity_Tree');
    XLSX.writeFile(wb, 'UI_Export.xlsx');
  }

  return (
    <div className="flex-shrink-0 flex items-center justify-between bg-surface border-b border-border px-4 h-10 shadow-sm relative z-30">
      {/* Left: title + breadcrumb */}
      <div className="flex items-center gap-3">
        <span className={cn(TEXT.breadcrumb, 'font-semibold tracking-[.1em] text-accent-blue uppercase')}>
          Furnace Management System
        </span>
        <div className="flex items-center gap-1.5">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className={cn(TEXT.breadcrumb, 'text-border')}>›</span>}
              <span
                className={cn(
                  TEXT.breadcrumb,
                  i === crumbs.length - 1
                    ? 'text-accent-blue pointer-events-none'
                    : c.parent
                      ? 'text-text-secondary cursor-pointer hover:text-text-primary'
                      : 'text-text-secondary'
                )}
                onClick={() => c.parent && setActivePage(c.parent)}
              >
                {c.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Right: theme toggle + Dev Functions dropdown */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
        {/* Theme toggle — Sun (light) ↔ Moon (dark) sliding switch */}
        <button
          onClick={toggleTheme}
          title="Toggle light/dark theme"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative flex items-center cursor-pointer rounded-full transition"
          style={{ width: 46, height: 22, background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}
        >
          {/* Dim track hint for the inactive side */}
          <span style={{ position:'absolute', left:5, display:'flex', color:'var(--color-text-secondary)', opacity: isDark ? 0.45 : 0 }}>
            <SunIcon />
          </span>
          <span style={{ position:'absolute', right:5, display:'flex', color:'var(--color-text-secondary)', opacity: isDark ? 0 : 0.45 }}>
            <MoonIcon />
          </span>
          {/* Sliding thumb carrying the ACTIVE mode's symbol */}
          <span
            style={{
              position:'absolute', top:2, left: isDark ? 25 : 2, width:16, height:16, borderRadius:'50%',
              background:'var(--color-background)', border:'1px solid var(--color-border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color: isDark ? 'var(--color-accent-blue)' : 'var(--color-accent-yellow)',
              transition:'left .2s ease, color .2s ease',
            }}
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </span>
        </button>
        {/* Hidden file inputs driven by the Dev Functions menu items */}
        <input
          ref={importRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = evt => {
                try {
                  const wb = XLSX.read(evt.target?.result, { type: 'array' });
                  const ws = wb.Sheets['FMS State'];
                  if (!ws) { alert('Invalid file: missing "FMS State" sheet'); return; }
                  const data = XLSX.utils.sheet_to_json<{ Variable: string; Value: string | number }>(ws);
                  const { fms: newFms, fuel: newFuel } = importFromRows(data);
                  setFms(newFms);
                  setFuel(newFuel);
                  if (newFms.furnaceCount > 0) setActivePage('hub');
                } catch (err) {
                  alert('Import failed: ' + String(err));
                }
              };
              reader.readAsArrayBuffer(file);
            }
            if (importRef.current) importRef.current.value = '';
          }}
        />

        {/* Dev Functions dropdown */}
        <div ref={devRef} className="relative">
          <button
            onClick={() => setDevOpen(o => !o)}
            className={cn(TEXT.button, 'flex items-center gap-1.5 border rounded px-2 py-1 transition cursor-pointer border-border text-text-secondary hover:border-accent-blue hover:text-accent-blue bg-transparent')}
            title="Developer utilities"
          >
            DEV FUNCTIONS
            <svg width="9" height="9" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" className={clsx('transition-transform', devOpen && 'rotate-180')}>
              <path d="M2.5 4L5.5 7L8.5 4"/>
            </svg>
          </button>
          {devOpen && (
            <div className={cn(TEXT.button, 'absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded border border-border bg-surface shadow-lg py-1')}>
              {[
                { label: 'Dev Export',  onClick: () => devExport() },
                { label: 'Dev Import',  onClick: () => importRef.current?.click() },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setDevOpen(false); item.onClick(); }}
                  className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-surface-hover hover:text-accent-blue transition cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
