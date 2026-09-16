'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { activePageAtom } from '../../store/FmsAtoms';
import {
  pkgSelectionAtom, pkgKpiBaselineAtom, emptyPkgSelection,
  confirmedPkgSelectionAtom, draftPkgSelectionAtom,
  type KpiSource, type PkgOrigin, type PkgSelection,
} from '../../store/PkgSelectionAtoms';
import { selectionHash, selectionComplete } from '../../constants/PkgSelectionStatus';
import { confirmVisual } from '../../constants/ModulesStatus';
import { usePkgSave } from '../../constants/SaveState';
import { exportPackageKpiSelection, readPackageKpiSelection, savePkgKpiDraft } from '../../actions/actions';
import { useParams } from 'next/navigation';
import { listParentPackages, listKpis, confirmPackagesStream } from '../../actions/PipelineActions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TEXT, TILE, TABLE, SEGMENT, FIELD, BUTTON, MODAL, Tile } from '../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

type SelTab = 'kpi' | 'package';

interface ParentPackage {
  parent: string;
  package_name: string;
  ignore: boolean;
  selected: boolean;
}

interface Kpi {
  unique_display_name: string;
  attribute_name: string;
  package: string;
  parent: string;
}

// Per-KPI data source (KpiSource) is shared via the selection store.

const KPI_SOURCE_OPTIONS: { id: KpiSource; label: string }[] = [
  { id: 'none', label: 'Not Required' },
  { id: 'sensor', label: 'Sensor Tag' },
  { id: 'calculate', label: 'Calculate' },
];

// Case-insensitive search. `*` is a wildcard (matches any run of characters);
// a query without `*` is a plain substring match.
function matchesQuery(value: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const v = value.toLowerCase();
  if (!q.includes('*')) return v.includes(q);
  const pattern = q
    .split('*')
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  try {
    return new RegExp(pattern).test(v);
  } catch {
    return v.includes(q);
  }
}

const TABS: { id: SelTab; label: string }[] = [
  { id: 'kpi', label: 'KPI Selection' },
  { id: 'package', label: 'Package Selection' },
];

// Map the live pipeline output to a coarse [floor, ceil] progress band + label.
// The bar creeps toward `ceil` on every streamed chunk (so it visibly advances),
// and each phase boundary raises the floor. The moving sheen shows it's working
// even while a long step produces no new output.
function phaseFor(log: string): { floor: number; ceil: number; label: string } {
  if (/ALL DONE/.test(log)) return { floor: 100, ceil: 100, label: 'Done' };
  if (/Running Create_Input_Sheet\.py/.test(log)) return { floor: 74, ceil: 98, label: 'Generating input sheet…' };
  if (/Current_Attribute\.py finished/.test(log) || /Running Expand\.py/.test(log)) return { floor: 60, ceil: 74, label: 'Expanding attributes…' };
  if (/Running Current_Attribute\.py/.test(log)) return { floor: 44, ceil: 60, label: 'Building current attributes…' };
  if (/Current_Packages\.py finished/.test(log)) return { floor: 42, ceil: 44, label: 'Packages processed' };
  if (/Running Current_Packages\.py/.test(log)) return { floor: 14, ceil: 42, label: 'Processing packages…' };
  if (/run_status updated/.test(log)) return { floor: 10, ceil: 14, label: 'Packages selected…' };
  return { floor: 3, ceil: 10, label: 'Starting…' };
}

export default function PkgSelectionPage() {
  const [, setActivePage] = useAtom(activePageAtom);
  const [tab, setTab] = useState<SelTab>('package');

  // ── Live selection (shared store; seeded from Package_KPI_Selection.json on
  //    app open). selected / kpiSource / pkgOrigin are views onto it. ──
  const [sel, setSel] = useAtom(pkgSelectionAtom);
  const [baseline, setBaseline] = useAtom(pkgKpiBaselineAtom);
  // Draft-model snapshots (mirror the Hub): confirmed drives the per-entry indicator's
  // "confirmed" state; draft drives the SAVE button + the "saved" state.
  const [confirmedPkg, setConfirmedPkg] = useAtom(confirmedPkgSelectionAtom);
  const [draftPkg, setDraftPkg] = useAtom(draftPkgSelectionAtom);
  const save = usePkgSave();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const selected = useMemo(() => new Set(sel.selectedPackages), [sel.selectedPackages]);
  const kpiSource = sel.kpiStates;   // each KPI defaults to "Not Required" when absent
  const pkgOrigin = sel.pkgOrigin;   // 'manual' card click vs 'kpi'-cascade (drives de-select warning)

  // Confirm colour state (blue / orange / yellow / green) + completeness, shared
  // with the Input Sheet tile lock. Green = recorded & matches (can't re-confirm).
  const complete = selectionComplete(sel);
  const currentHash = selectionHash(sel);
  const visual = confirmVisual(baseline, currentHash, complete);

  // Draft SAVE (mirrors the Hub's per-page Save): appears when the live selection
  // differs from the saved draft (baseline = draft, else confirmed, else empty). Save
  // persists ONLY the draft set (Package_KPI_Selection.draft.json + the draft workbook
  // sheet), leaving the confirmed copy untouched.
  const draftBase = draftPkg ?? confirmedPkg ?? emptyPkgSelection();
  const pageDirty = currentHash !== selectionHash(draftBase);
  const showSave = pageDirty || saveState !== 'idle';
  const saveLabel = saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' ? 'Saved ✓'
    : saveState === 'error' ? 'Save failed'
    : 'SAVE';
  const saveDotColor = saveState === 'saved' ? 'text-accent-green'
    : saveState === 'error' ? 'text-accent-red'
    : 'text-accent-yellow';

  // ── Package Selection state ──
  const [parents, setParents] = useState<ParentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── KPI Selection state ──
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  // instance_id from the route ([instance_id]) scopes every pipeline call to this
  // instance's private dirs (server action -> FastAPI -> _instances/<id>).
  const routeInstance = useParams()?.instance_id;
  const instanceId = Number(Array.isArray(routeInstance) ? routeInstance[0] : routeInstance) || null;
  // Parent pending a de-select confirmation (KPI-origin packages only).
  const [confirmDeselect, setConfirmDeselect] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  // User-adjustable column widths (px) for the KPI and Package columns.
  const [kpiColWidth, setKpiColWidth] = useState(480);
  const [pkgColWidth, setPkgColWidth] = useState(240);
  // Per-column search filters for the KPI list.
  const [kpiQuery, setKpiQuery] = useState('');
  const [pkgQuery, setPkgQuery] = useState('');

  // KPIs grouped by their parent (the Package-tab card they belong to).
  const kpisByParent = useMemo(() => {
    const map: Record<string, Kpi[]> = {};
    for (const k of kpis) (map[k.parent] ??= []).push(k);
    return map;
  }, [kpis]);

  // Drag a column divider to resize it (clamped to a sensible range).
  function makeResizer(width: number, setWidth: (n: number) => void, min: number, max: number) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const move = (ev: MouseEvent) =>
        setWidth(Math.min(max, Math.max(min, width + (ev.clientX - startX))));
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
  }

  // KPI rows filtered by both column searches (case-insensitive, `*` wildcard).
  const filteredKpis = useMemo(() => {
    if (!kpiQuery.trim() && !pkgQuery.trim()) return kpis;
    return kpis.filter(
      (k) => matchesQuery(k.unique_display_name, kpiQuery) && matchesQuery(k.parent, pkgQuery),
    );
  }, [kpis, kpiQuery, pkgQuery]);

  // ── Confirm / pipeline state ──
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<null | 'ok' | 'fail'>(null);
  const [log, setLog] = useState<string>('');
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Starting…');
  // Draggable position (px offset from centre) of the processing dialog.
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  // Drag the processing dialog by its header.
  function startDrag(e: React.MouseEvent) {
    const origin = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y };
    const move = (ev: MouseEvent) => setDragPos({ x: ev.clientX - origin.x, y: ev.clientY - origin.y });
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Package list via the server action -> FastAPI (/api/pe-olf-fur/packages),
      // scoped to this instance. (Replaces the old Next.js /api/packages route.)
      const list: ParentPackage[] = await listParentPackages(instanceId);
      setParents(list);
      // Selection is NOT seeded from run_status — it comes from the shared store
      // (seeded from Package_KPI_Selection.json on app open), so it reflects the
      // user's last recorded choice, not the pipeline's enable-state.
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      // KPI list via the server action -> FastAPI (/api/pe-olf-fur/kpi), scoped to
      // this instance. (Replaces the old Next.js /api/kpi route.)
      setKpis(await listKpis(instanceId));
    } catch (err) {
      setKpiError(err instanceof Error ? err.message : 'Failed to load KPIs');
    } finally {
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadKpis();
  }, [load, loadKpis]);

  // Block tab close / refresh / browser-back while the pipeline is running.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);

  // Set every KPI of a parent to one source value on a selection object.
  const withParentKpis = useCallback(
    (s: PkgSelection, parent: string, value: KpiSource): PkgSelection => {
      const names = (kpisByParent[parent] ?? []).map((k) => k.unique_display_name);
      if (!names.length) return s;
      const kpiStates = { ...s.kpiStates };
      for (const n of names) kpiStates[n] = value;
      return { ...s, kpiStates };
    },
    [kpisByParent],
  );

  // Select a parent and cascade all its KPIs to Calculate (rule 2).
  function selectPackage(parent: string, origin: PkgOrigin) {
    setSel((prev) => {
      let next: PkgSelection = {
        ...prev,
        selectedPackages: prev.selectedPackages.includes(parent)
          ? prev.selectedPackages
          : [...prev.selectedPackages, parent],
        pkgOrigin: { ...prev.pkgOrigin, [parent]: origin },
      };
      if (origin === 'manual') next = withParentKpis(next, parent, 'calculate');
      return next;
    });
  }

  // De-select a parent and revert all its KPIs to Not Required (rule 4).
  function deselectPackage(parent: string) {
    setSel((prev) => {
      const pkgOrigin = { ...prev.pkgOrigin };
      delete pkgOrigin[parent];
      const next: PkgSelection = {
        ...prev,
        selectedPackages: prev.selectedPackages.filter((p) => p !== parent),
        pkgOrigin,
      };
      return withParentKpis(next, parent, 'none');
    });
  }

  // Package card click. De-selecting a KPI-origin package warns first.
  function toggle(parent: string, ignore: boolean) {
    if (ignore || running) return;
    if (selected.has(parent)) {
      if (pkgOrigin[parent] === 'kpi') setConfirmDeselect(parent);
      else deselectPackage(parent);
    } else {
      selectPackage(parent, 'manual');
    }
  }

  // KPI toggle click. Calculate auto-selects the parent (rule 1, siblings
  // untouched); leaving Calculate auto-deselects the parent once none of its
  // KPIs remain Calculate (rule 3).
  function setKpi(kpi: Kpi, value: KpiSource) {
    if (running) return;
    const { unique_display_name: name, parent } = kpi;
    setSel((prev) => {
      const kpiStates = { ...prev.kpiStates, [name]: value };
      let selectedPackages = prev.selectedPackages;
      let pkgOrigin = prev.pkgOrigin;
      if (value === 'calculate') {
        if (!selectedPackages.includes(parent)) {
          selectedPackages = [...selectedPackages, parent];
          pkgOrigin = { ...pkgOrigin, [parent]: 'kpi' };
        }
      } else if (selectedPackages.includes(parent)) {
        const anyOtherCalc = (kpisByParent[parent] ?? []).some(
          (k) => k.unique_display_name !== name && (kpiStates[k.unique_display_name] ?? 'none') === 'calculate',
        );
        if (!anyOtherCalc) {
          selectedPackages = selectedPackages.filter((p) => p !== parent);
          const po = { ...pkgOrigin };
          delete po[parent];
          pkgOrigin = po;
        }
      }
      return { selectedPackages, kpiStates, pkgOrigin };
    });
  }

  // Save = draft. Persists the live selection to the draft set (Package_KPI_Selection
  // .draft.json + the draft workbook sheet) without touching the confirmed copy. No
  // completeness gate — a work-in-progress selection can be saved at any time.
  async function onSave() {
    if (saveState === 'saving' || running) return;
    setSaveState('saving');
    try {
      const res = await savePkgKpiDraft(instanceId, {
        selectedPackages: sel.selectedPackages,
        kpiStates: sel.kpiStates,
        pkgOrigin: sel.pkgOrigin,
      });
      if (res.success) {
        setDraftPkg(sel);   // this on-screen selection is now the draft baseline
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
    setTimeout(() => setSaveState('idle'), 1800);
  }

  // Revert the live selection to the last recorded Package_KPI_Selection.json, and
  // rewrite the draft = confirmed (mirrors the Hub Revert).
  async function revert() {
    if (reverting || running) return;
    setReverting(true);
    try {
      const res = await readPackageKpiSelection(instanceId);
      if (res.success && res.selection) {
        const restored: PkgSelection = {
          selectedPackages: res.selection.selectedPackages,
          kpiStates: res.selection.kpiStates,
          pkgOrigin: res.selection.pkgOrigin,
        };
        setSel(restored);
        setBaseline({ hash: selectionHash(restored) });
        setConfirmedPkg(restored);
        setDraftPkg(restored);
        await savePkgKpiDraft(instanceId, restored);   // draft file now matches confirmed
      } else if (res.success) {
        // Nothing recorded → clear to an empty selection.
        setSel(emptyPkgSelection());
        setBaseline(null);
        setConfirmedPkg(null);
        setDraftPkg(null);
      }
    } finally {
      setReverting(false);
    }
  }

  async function onConfirm() {
    if (running || !complete || visual.state === 'green') return;
    setRunning(true);
    setDone(null);
    setLog('');
    setProgress(0);
    setPhase('Starting…');
    setDragPos({ x: 0, y: 0 });
    setShowProgress(true);
    try {
      // Resolve every displayed KPI to its current source (default Not Required),
      // so the backend can build the Exclusion_Rule sheet.
      const kpiStates: Record<string, KpiSource> = {};
      for (const k of kpis) kpiStates[k.unique_display_name] = kpiSource[k.unique_display_name] ?? 'none';

      // Confirm streams pp_bridge.py output via the server action -> FastAPI
      // (/api/pe-olf-fur/packages/confirm), scoped to this instance. (Replaces the
      // old Next.js /api/packages/confirm route.)
      const stream = await confirmPackagesStream(instanceId, Array.from(selected), kpiStates);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let exitCode: number | null = null;

      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        // Pull off any __DONE__<code> sentinel before displaying.
        const m = buffer.match(/__DONE__(\d+)\s*$/);
        if (m) {
          exitCode = Number(m[1]);
          buffer = buffer.replace(/__DONE__\d+\s*$/, '');
        }
        setLog(buffer);

        // Advance the bar: raise to this phase's floor, then creep toward its
        // ceiling on each chunk so movement tracks real backend output.
        const { floor, ceil, label } = phaseFor(buffer);
        setPhase(label);
        setProgress((prev) => {
          if (ceil >= 100) return 100;
          const base = Math.max(prev, floor);
          return Math.min(ceil, base + (ceil - base) * 0.18);
        });
      }

      if (exitCode === 0) {
        // Persist the selection AFTER the pipeline: Current_Packages.py wipes the
        // Current/ folder mid-run, so a JSON written before would be deleted. The
        // UI_Export sheet survives (the workbook is kept), and readback self-heals
        // from it if the JSON is ever missing.
        const saveRes = await exportPackageKpiSelection(instanceId, {
          selectedPackages: sel.selectedPackages,
          kpiStates: sel.kpiStates,
          pkgOrigin: sel.pkgOrigin,
        });
        if (!saveRes.success) {
          setLog((l) => l + `\n✖ Could not save selection: ${saveRes.error}`);
          setDone('fail');
          return;
        }
        setProgress(100);
        setPhase('Done');
        setDone('ok');
        // Recorded selection now matches the live one → baseline (green), which
        // unlocks the Input Sheet tile. Confirm writes BOTH confirmed + draft, so the
        // snapshots match afterwards (SAVE hidden, indicator settles to confirmed).
        setBaseline({ hash: currentHash });
        setConfirmedPkg(sel);
        setDraftPkg(sel);
        // Input sheet has been regenerated — open the Input Sheet tile, which
        // auto-loads the fresh workbook on mount.
        setTimeout(() => setActivePage('inputSheet'), 900);
      } else {
        setDone('fail');
      }
    } catch (err) {
      setLog((l) => l + `\n✖ ${err instanceof Error ? err.message : 'Pipeline failed'}\n`);
      setDone('fail');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-border">
        <div className={cn(TEXT.sectionHeader, 'tracking-wide')}>
          KPI / Package Selection
        </div>
      </div>

      {/* Centered capsule tabs — sticky page tab bar (SEGMENT.bar) */}
      <div className={SEGMENT.bar}>
        <div className={SEGMENT.group}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              disabled={running}
              className={cn(
                TEXT.breadcrumb,
                SEGMENT.item,
                'min-w-[160px] px-6 py-2',
                tab === t.id ? SEGMENT.active : SEGMENT.inactive,
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'kpi' && (
          <div className="flex flex-col items-center gap-6">
            {kpiLoading && (
              <div className={cn(TEXT.breadcrumb, 'text-text-secondary')}>Loading KPIs…</div>
            )}
            {kpiError && !kpiLoading && (
              <div className="flex flex-col items-center gap-3">
                <span className={cn(TEXT.caption, 'text-accent-red text-center max-w-sm')}>{kpiError}</span>
                <button onClick={loadKpis} className={cn(TEXT.breadcrumb, BUTTON.ghost)}>Retry</button>
              </div>
            )}

            {!kpiLoading && !kpiError && (
              <>
              {/* Per-column search */}
              <div className="w-full flex items-center justify-center gap-3 flex-wrap">
                <input
                  value={kpiQuery}
                  onChange={(e) => setKpiQuery(e.target.value)}
                  placeholder="Search KPIs…"
                  className={cn(TEXT.breadcrumb, FIELD.input, 'w-64')}
                />
                <input
                  value={pkgQuery}
                  onChange={(e) => setPkgQuery(e.target.value)}
                  placeholder="Search packages…"
                  className={cn(TEXT.breadcrumb, FIELD.input, 'w-56')}
                />
                {(kpiQuery || pkgQuery) && (
                  <button
                    onClick={() => { setKpiQuery(''); setPkgQuery(''); }}
                    className={cn(TEXT.annotation, BUTTON.ghost, 'px-3')}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="w-full overflow-x-auto">
                <div className={cn(TABLE.wrap, 'mx-auto w-fit max-w-full')}>
                  {/* Column headers */}
                  <div className={cn(TABLE.header, 'flex items-stretch px-4 py-2.5')}>
                    <div
                      style={{ width: kpiColWidth }}
                      className={cn(TEXT.eyebrow, 'shrink-0 tracking-[.14em] text-center')}
                    >
                      Key Performance Indicators
                    </div>
                    {/* Drag-to-resize divider (KPI column) */}
                    <div
                      onMouseDown={makeResizer(kpiColWidth, setKpiColWidth, 260, 820)}
                      title="Drag to resize"
                      className="w-2 shrink-0 cursor-col-resize flex items-center justify-center group"
                    >
                      <div className="w-px h-4 bg-border group-hover:bg-accent-blue transition-colors" />
                    </div>
                    <div
                      style={{ width: pkgColWidth }}
                      className={cn(TEXT.eyebrow, 'shrink-0 tracking-[.14em] text-center')}
                    >
                      Package
                    </div>
                    {/* Drag-to-resize divider (Package column) */}
                    <div
                      onMouseDown={makeResizer(pkgColWidth, setPkgColWidth, 140, 500)}
                      title="Drag to resize"
                      className="w-2 shrink-0 cursor-col-resize flex items-center justify-center group"
                    >
                      <div className="w-px h-4 bg-border group-hover:bg-accent-blue transition-colors" />
                    </div>
                    <div className={cn(TEXT.eyebrow, 'w-[330px] shrink-0 tracking-[.14em] text-center')}>
                      Data Source
                    </div>
                  </div>

                  {/* Rows */}
                  <div className={cn('flex flex-col', TABLE.divide)}>
                    {filteredKpis.map((k) => {
                      const current = kpiSource[k.unique_display_name] ?? 'none';
                      return (
                        <div
                          key={k.unique_display_name}
                          className={cn(TABLE.row, 'flex items-center px-4 py-2.5')}
                        >
                          {/* Column 1 — KPI name */}
                          <div style={{ width: kpiColWidth }} className="shrink-0 flex items-center gap-3 min-w-0">
                            <span className="text-accent-blue shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" />
                              </svg>
                            </span>
                            <span className={cn(TEXT.breadcrumb, 'text-text-primary break-all')}>
                              {k.unique_display_name}
                            </span>
                          </div>

                          {/* Divider spacer (aligns with the header handle) */}
                          <div className="w-2 shrink-0 flex items-center justify-center">
                            <div className="w-px h-5 bg-border/60" />
                          </div>

                          {/* Column 2 — parent package */}
                          <div style={{ width: pkgColWidth }} className="shrink-0 px-2">
                            <span className={cn(TEXT.annotation, 'text-text-secondary break-all')}>
                              {k.parent}
                            </span>
                          </div>

                          {/* Divider spacer */}
                          <div className="w-2 shrink-0 flex items-center justify-center">
                            <div className="w-px h-5 bg-border/60" />
                          </div>

                          {/* Column 3 — triple toggle */}
                          <div className={cn(SEGMENT.groupInset, 'w-[330px] shrink-0')}>
                            {KPI_SOURCE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => setKpi(k, opt.id)}
                                disabled={running}
                                className={cn(
                                  TEXT.annotation,
                                  SEGMENT.item,
                                  'flex-1 px-3',
                                  current === opt.id ? SEGMENT.active : SEGMENT.inactive,
                                )}
                              >
                                {/* Save marker on the active option's TEXT only (inner
                                    span, like SegYesNo) so it beats the button fill's
                                    white text and never touches the blue pill. */}
                                <span className={current === opt.id ? save(current, (s) => s.kpiStates[k.unique_display_name] ?? 'none') : undefined}>
                                  {opt.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {filteredKpis.length === 0 && (
                      <div className={cn(TEXT.breadcrumb, 'text-text-secondary px-4 py-6 text-center')}>
                        {kpis.length === 0
                          ? 'No KPIs found for the selected packages.'
                          : 'No KPIs match your search.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {tab === 'package' && (
          <div className="flex flex-col items-center gap-6">
            {loading && (
              <div className={cn(TEXT.breadcrumb, 'text-text-secondary')}>Loading packages…</div>
            )}
            {loadError && !loading && (
              <div className="flex flex-col items-center gap-3">
                <span className={cn(TEXT.caption, 'text-accent-red text-center max-w-sm')}>{loadError}</span>
                <button onClick={load} className={cn(TEXT.breadcrumb, BUTTON.ghost)}>Retry</button>
              </div>
            )}

            {!loading && !loadError && (
              <div className="flex gap-5 flex-wrap justify-center w-full max-w-3xl">
                {parents.map((p) => {
                  const isSel = selected.has(p.parent);
                  return (
                    <Tile
                      key={p.parent}
                      center
                      selected={isSel}
                      disabled={p.ignore || running}
                      onClick={() => toggle(p.parent, p.ignore)}
                      icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26" height="26" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" />
                          <path d="M7 7h.01M7 17h.01" />
                        </svg>
                      }
                      title={p.parent}
                      titleClassName={cn(TEXT.tableHeader, 'tracking-wide', isSel ? 'text-accent-blue' : 'text-text-primary')}
                    >
                      {isSel && (
                        <div className={cn(TEXT.eyebrow, 'tracking-[.18em] text-accent-blue')}>
                          <span className={save(1, (s) => s.selectedPackages.includes(p.parent) ? 1 : 0)}>Selected</span>
                        </div>
                      )}
                    </Tile>
                  );
                })}
                {parents.length === 0 && (
                  <div className={cn(TEXT.breadcrumb, 'text-text-secondary')}>No packages found.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Common Confirm bar (serves both tabs) — blue/orange/yellow/green like the
          Configuration Modules Confirm; the status text sits inside the button and
          both buttons share the same fixed size. Green = recorded (not clickable). */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-border">
        {/* Draft SAVE — per page, shown only when the live selection differs from the
            saved draft. Neutral styling (never a status colour); the dot flashes yellow. */}
        {showSave && (
          <button
            onClick={onSave}
            disabled={saveState === 'saving' || running}
            title="Unsaved changes — Save a draft (UI_Export_Draft.xlsx); Confirm to record it"
            className={cn(
              TEXT.button,
              BUTTON.confirm,
              'min-w-[200px] border border-border bg-background text-text-primary',
              saveState === 'saving' ? 'opacity-70 cursor-wait' : running ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-hover',
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className={cn(styles.saveDot, saveDotColor)} aria-hidden />
              <span className="font-semibold tracking-wide">{saveLabel}</span>
            </span>
            <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5 text-text-secondary')}>Save a draft on this page</span>
          </button>
        )}
        <button
          onClick={() => { if (visual.state !== 'green') onConfirm(); }}
          disabled={!complete || running}
          title={complete
            ? 'Record the KPI / Package selection and generate the input sheet'
            : 'Select at least one package to enable'}
          style={{ background: visual.bg, color: visual.fg }}
          className={cn(
            TEXT.button,
            BUTTON.confirm,
            'min-w-[260px]',
            visual.state === 'green'
              ? 'cursor-default'
              : complete && !running
                ? 'cursor-pointer hover:brightness-110'
                : 'opacity-60 cursor-not-allowed',
          )}
        >
          <span>{running ? 'Processing…' : 'Confirm'}</span>
          <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: visual.fg }}>{visual.subtext}</span>
        </button>

        {(visual.state === 'orange' || visual.state === 'yellow') && (
          <button
            onClick={revert}
            disabled={reverting || running}
            title="Revert to the last recorded selection (UI_Export.xlsx)"
            style={{ background: 'var(--color-accent-green)', color: '#ffffff' }}
            className={cn(
              TEXT.button,
              BUTTON.confirm,
              'min-w-[260px]',
              reverting || running ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110',
            )}
          >
            <span>{reverting ? 'Reverting…' : 'Revert'}</span>
            <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: '#ffffff' }}>Revert to last recorded selection</span>
          </button>
        )}
      </div>

      {/* Progress modal */}
      {showProgress && (
        <div className={MODAL.overlay}>
          <div
            className={cn(MODAL.panel, 'w-full max-w-2xl')}
            style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
          >
            <div
              onMouseDown={startDrag}
              className={cn(MODAL.header, 'flex items-center justify-between cursor-move select-none')}
            >
              <div className={cn(TEXT.sectionHeader, 'tracking-wide')}>
                {running ? 'Processing packages…' : done === 'ok' ? '✔ Complete' : '✖ Failed'}
              </div>
              {/* No close button while running — navigation is locked until the
                  pipeline finishes. */}
              {!running && (
                <button
                  onClick={() => setShowProgress(false)}
                  className={cn(TEXT.annotation, BUTTON.ghost, 'px-3 py-1')}
                >
                  Close
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-4 pb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn(TEXT.annotation, 'text-text-secondary')}>
                  {done === 'fail' ? 'Stopped' : phase}
                </span>
                <span className={cn(TEXT.annotation, 'font-semibold', done === 'fail' ? 'text-accent-red' : 'text-accent-blue')}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className={styles.procTrack}>
                <div
                  className={clsx(styles.procFill, !running && styles.procDone)}
                  style={{
                    width: `${done === 'fail' ? Math.max(progress, 6) : progress}%`,
                    background: done === 'fail' ? 'var(--color-accent-red)' : undefined,
                  }}
                />
              </div>
              {running && (
                <div className={cn(TEXT.annotation, 'text-text-secondary mt-2')}>
                  Please wait — do not close or leave this page until processing completes.
                </div>
              )}
            </div>

            <div className={MODAL.footer}>
              {done === 'ok' && (
                <span className={cn(TEXT.annotation, 'text-accent-green')}>Opening Input Sheet…</span>
              )}
              {done === 'fail' && (
                <button
                  onClick={() => setShowProgress(false)}
                  className={cn(TEXT.annotation, BUTTON.ghost)}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* De-select confirmation — only for packages auto-selected via a KPI. */}
      {confirmDeselect && (
        <div className={MODAL.overlay}>
          <div className={cn(MODAL.panel, 'w-full max-w-md')}>
            <div className={MODAL.header}>
              <div className={cn(TEXT.sectionHeader, 'tracking-wide')}>
                Deselect "{confirmDeselect}"?
              </div>
            </div>
            <div className="px-5 py-4">
              <p className={cn(TEXT.caption, 'leading-relaxed')}>
                This package was selected because one or more of its KPIs is set to{' '}
                <span className="text-accent-blue">Calculate</span>. Deselecting it will revert all of
                its KPIs to <span className="text-text-primary">Not Required</span>.
              </p>
            </div>
            <div className={MODAL.footer}>
              <button
                onClick={() => setConfirmDeselect(null)}
                className={cn(TEXT.annotation, BUTTON.ghost)}
              >
                Cancel
              </button>
              <button
                onClick={() => { deselectPackage(confirmDeselect); setConfirmDeselect(null); }}
                className={cn(TEXT.annotation, 'px-4 py-1.5 rounded font-semibold bg-accent-red text-white hover:brightness-110 transition')}
              >
                Deselect &amp; revert KPIs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
