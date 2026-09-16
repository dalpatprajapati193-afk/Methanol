'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAtom, useSetAtom } from 'jotai';
import { fmsStateAtom, activePageAtom, confirmedBaselineAtom, confirmedFmsAtom, draftFmsAtom, basicInfoComplete, feedAllVisited, hwSectionPct, ffiUnlocked } from '../../store/FmsAtoms';
import { fuelStateAtom, confirmedFuelAtom, draftFuelAtom } from '../../store/FuelAtoms';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TEXT, BUTTON, Tile, badgeCls, type TileStatus } from '../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));
import { serializeFmsState } from '../../constants/ExportUtils';
import { importFromRows } from '../../constants/ImportUtils';
import { entriesHash, confirmVisual } from '../../constants/ModulesStatus';
import { exportUiWorkbook, saveDraftWorkbook, readUserSetupResponse } from '../../actions/actions';

interface TileState { locked: boolean; done: boolean; pct: number; prefilled?: boolean; }

// Map a tile's completion state to the shared status accent (green/orange/yellow
// border on the unified TILE chassis).
function tileStatus({ locked, done, pct, prefilled }: TileState): TileStatus {
  if (locked) return 'locked';
  if (done) return 'done';
  if (prefilled || pct > 0) return 'started';
  return 'todo';
}

export default function HubPage() {
  // instance_id from the route → threaded into Hub reads/writes (per-instance dir).
  const routeInstance = useParams()?.instance_id;
  const instanceId = Number(Array.isArray(routeInstance) ? routeInstance[0] : routeInstance) || null;
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [fuel, setFuel] = useAtom(fuelStateAtom);
  const [, setActivePage] = useAtom(activePageAtom);
  const [baseline, setBaseline] = useAtom(confirmedBaselineAtom);
  const setConfirmedFms = useSetAtom(confirmedFmsAtom);
  const setDraftFms = useSetAtom(draftFmsAtom);
  const setConfirmedFuel = useSetAtom(confirmedFuelAtom);
  const setDraftFuel = useSetAtom(draftFuelAtom);

  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reverting, setReverting] = useState(false);

  // Revert restores the FMS / Fuel state from User_Setup_Response.json (the
  // PRIMARY recorded setup) in the current data folder — no file-picker dialog,
  // no xlsx parsing. Offered when the current entries differ from the recorded
  // copy (Confirm is orange or yellow).
  async function revert() {
    if (reverting) return;
    setReverting(true);
    setConfirmMsg(null);
    try {
      const res = await readUserSetupResponse(instanceId);
      if (!res.success) { setConfirmMsg({ ok: false, text: res.error }); return; }
      // Rows already carry { Variable, Value } → feed importFromRows directly.
      const { fms: newFms, fuel: newFuel } = importFromRows(res.rows);
      setFms(newFms);
      setFuel(newFuel);
      // The reverted state IS the recorded setup → make it the baseline so
      // Confirm shows green.
      setBaseline({ hash: entriesHash(newFms, newFuel) });
      // Reverted state == confirmed == draft → snapshots match (indicators clear).
      setConfirmedFms(newFms);
      setDraftFms(newFms);
      setConfirmedFuel(newFuel);
      setDraftFuel(newFuel);
      // Sync the draft to the confirmed copy so UI_Export_Draft no longer diverges
      // (best-effort — the confirmed copy remains the source of truth on failure).
      try {
        const { fmsRows, treeRows } = serializeFmsState(newFms, newFuel);
        await saveDraftWorkbook(instanceId, fmsRows, treeRows);
      } catch { /* non-fatal: draft mirror will re-sync on the next Save/Confirm */ }
    } catch (err) {
      setConfirmMsg({ ok: false, text: 'Revert failed: ' + String(err) });
    } finally {
      setReverting(false);
    }
  }

  const biLocked = !fms.basicInfoDone;
  const biDone = fms.basicInfoDone;
  const biStarted = !biDone && fms.furnaceInfo.some(info => info.licensor || info.coilType || info.cells || info.passPerCell || info.tubesPerPass || info.designRunlength);

  const uomDone = fms.visitedUom || fms.uomConfirmed;
  // Basic Information now hosts the Default UOM Manager as its second tab, so the
  // module completes only when the fleet record is valid AND UOM has been visited.
  // Until it's complete, the hub shows ONLY the Basic Information tile (no other
  // tiles, no Confirm bar).
  const basicDone = basicInfoComplete(fms);

  const single = fms.furnaceCount === 1;
  const feedVisited = feedAllVisited(fms);
  const convPct = hwSectionPct(fms.hwConv, single);
  const radPct  = hwSectionPct(fms.hwRad, single);
  const hwPct   = Math.round((convPct + radPct) / 2);
  const ffmsDone = feedVisited && fuel.visitedFuel;

  // FFI progress: done = 100%, templates exist with furnaces = 50%, else 0
  const ffiPct = fms.ffiDone ? 100
    : fms.ffiTemplates.length > 0 && fms.ffiTemplates.some(t => t.furnaces.length > 0) ? 50 : 0;

  // FFI tile gate — same predicate the wizard Next uses (kept in the store).
  const ffiGate = ffiUnlocked(fms);

  // Confirm is enabled only when all module tiles are complete.
  const allComplete = basicDone && ffmsDone && hwPct >= 100 && ffiPct >= 100;

  // Colour state of the Confirm button: blue (never confirmed this session),
  // orange (incomplete, recorded copy exists), yellow (complete but differs from
  // the recorded copy), green (complete and matches the recorded copy).
  const currentHash = entriesHash(fms, fuel);
  const visual = confirmVisual(baseline, currentHash, allComplete);

  async function confirmExport() {
    if (!allComplete || confirming) return;
    setConfirming(true);
    setConfirmMsg(null);
    try {
      const { fmsRows, treeRows } = serializeFmsState(fms, fuel);
      const res = await exportUiWorkbook(instanceId, fmsRows, treeRows, currentHash);
      if (res.success) {
        // Record the just-confirmed signature → button turns green and the
        // Packages/KPI tile unlocks (until entries change or the page refreshes).
        setBaseline({ hash: currentHash });
        // Confirmed == draft == current → snapshots match (indicators clear).
        setConfirmedFms(fms);
        setDraftFms(fms);
        setConfirmedFuel(fuel);
        setDraftFuel(fuel);
        setConfirmMsg({ ok: true, text: 'Saved to UI_Export.xlsx' });
      } else {
        setConfirmMsg({ ok: false, text: res.error || 'Export failed' });
      }
    } catch (err) {
      setConfirmMsg({ ok: false, text: String(err) });
    } finally {
      setConfirming(false);
    }
  }

  function goBasicInfo() {
    // The furnace count is now entered inside Basic Information, so this is always
    // reachable (auto-saves; basicInfoDone tracks validity).
    setActivePage('basicinfo');
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8">
        <div>
          <div className={cn(TEXT.eyebrow, 'tracking-[.14em] text-center')}>
            Configuration Modules
          </div>
        </div>

        <div className="flex gap-5 flex-wrap justify-center">
          {/* Basic Information — hosts Fleet Record + Default UOM Manager as tabs */}
          <TileCard
            locked={false} done={basicDone} pct={basicDone ? 100 : (biDone || biStarted || uomDone) ? 1 : 0}
            onClick={goBasicInfo}
            icon={<BasicInfoIcon />}
            label="Basic Information"
            showBar
          />

          {/* The rest of the modules appear only once Basic Information is complete. */}
          {basicDone && (<>
          {/* Feed & Fuel Management */}
          <TileCard
            locked={biLocked} done={ffmsDone} prefilled={!ffmsDone}
            pct={0}
            onClick={() => !biLocked && setActivePage('fms')}
            icon={<FfmsIcon />}
            label="Feed & Fuel Management System"
            badge={ffmsDone ? '✓ Completed' : '✓ Prefilled'}
          />

          {/* Furnace Hardware Config */}
          <TileCard
            locked={biLocked} done={hwPct >= 100} pct={hwPct}
            onClick={() => !biLocked && setActivePage('hwcfg')}
            icon={<HwIcon />}
            label="Furnace Hardware Configuration"
            showBar
            sections={biLocked ? [
              { label: 'Convection & TLE' },
              { label: 'Radiation Zone' },
            ] : [
              { label: 'Convection & TLE', pct: convPct },
              { label: 'Radiation Zone',   pct: radPct  },
            ]}
          />

          {/* Feed & Furnace Interaction */}
          <TileCard
            locked={!ffiGate}
            done={ffiPct >= 100} pct={ffiPct}
            onClick={() => ffiGate && setActivePage('ffi')}
            icon={<FfiIcon />}
            label="Feed & Furnace Interaction"
            showBar
            sections={!ffiGate ? [
              { label: 'Feed Management' },
              { label: 'Convection & TLE' },
              { label: 'Radiation Zone' },
            ] : [
              { label: 'Feed Management',   pct: feedVisited ? 100 : 0 },
              { label: 'Convection & TLE',  pct: convPct },
              { label: 'Radiation Zone',    pct: radPct  },
            ]}
          />
          </>)}
        </div>

        {/* Confirm — records the UI export workbook + signature to disk. Colour
            reflects the recorded-vs-current state; enabled only when complete.
            Revert (acts like Dev Import) appears when entries differ from the
            recorded copy (orange / yellow). Shown only once Basic Information is
            complete. */}
        {basicDone && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (visual.state !== 'green') confirmExport(); }}
              disabled={!allComplete || confirming}
              title={allComplete
                ? 'Write FMS State & Entity_Tree to UI_Export.xlsx'
                : 'Complete all modules to enable'}
              style={{ background: visual.bg, color: visual.fg }}
              className={cn(
                TEXT.button,
                BUTTON.confirm,
                'min-w-[260px]',
                visual.state === 'green'
                  ? 'cursor-default'
                  : allComplete && !confirming
                    ? 'cursor-pointer hover:brightness-110'
                    : 'opacity-60 cursor-not-allowed',
              )}
            >
              <span>{confirming ? 'Saving…' : 'Confirm'}</span>
              <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: visual.fg }}>{visual.subtext}</span>
            </button>

            {(visual.state === 'orange' || visual.state === 'yellow') && (
              <button
                onClick={revert}
                disabled={reverting}
                title="Revert to the last recorded setup (UI_Export.xlsx)"
                style={{ background: 'var(--color-accent-green)', color: '#ffffff' }}
                className={cn(
                  TEXT.button,
                  BUTTON.confirm,
                  'min-w-[260px]',
                  reverting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110',
                )}
              >
                <span>{reverting ? 'Reverting…' : 'Revert'}</span>
                <span className={cn(TEXT.annotation, 'font-normal opacity-90 mt-0.5')} style={{ color: '#ffffff' }}>Revert to last recorded setup</span>
              </button>
            )}
          </div>
          {confirmMsg && !confirmMsg.ok && (
            <span className={cn(TEXT.annotation, 'text-accent-red')}>
              {confirmMsg.text}
            </span>
          )}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}

interface TileProps {
  locked: boolean; done: boolean; pct?: number; prefilled?: boolean;
  onClick: () => void; icon: React.ReactNode; label: string;
  showBar?: boolean; badge?: string;
  sections?: { label: string; done?: boolean; prefilled?: boolean; pct?: number }[];
}
function TileCard({ locked, done, pct=0, prefilled, onClick, icon, label, showBar, badge, sections }: TileProps) {
  const state: TileState = { locked, done, pct, prefilled };
  return (
    <Tile
      status={tileStatus(state)}
      locked={locked}
      onClick={locked ? undefined : onClick}
      icon={<div className="w-8 h-8 flex items-center justify-center">{icon}</div>}
      title={label}
      titleClassName={cn(TEXT.cardTitle, 'text-center px-3 leading-snug')}
    >
      {sections && sections.length > 0 && (
        <div className="flex flex-col gap-0.5 w-full px-3 mt-1">
          {sections.map(s => {
            const secDone = s.done || (s.pct ?? 0) >= 100;
            const secStarted = !secDone && ((s.pct ?? 0) > 0 || s.prefilled);
            const dotCls = secDone ? 'bg-accent-green' : secStarted ? 'bg-accent-orange' : 'bg-border';
            const textCls = secDone ? 'text-accent-green' : secStarted ? 'text-accent-orange' : 'text-text-secondary';
            const statusLabel = secDone ? '✓ Completed' : secStarted ? 'Started' : 'Not Started';
            return (
              <div key={s.label} className={cn(TEXT.annotation, 'flex items-center gap-2', textCls)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotCls)} />
                <span className="flex-1">{s.label}</span>
                <span>{statusLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1" />

      {/* A locked tile shows no status badge — the padlock is the only signal. */}
      {!locked && badge && (
        <span className={cn(TEXT.badge, badgeCls(done ? 'green' : 'orange'))}>
          {badge}
        </span>
      )}

      {!locked && showBar && (() => {
        if (done)   return <span className={cn(TEXT.badge, badgeCls('green'))}>✓ Completed</span>;
        if (pct > 0) return <span className={cn(TEXT.badge, badgeCls('orange'))}>Started</span>;
        return <span className={cn(TEXT.badge, badgeCls('yellow'))}>Not Started</span>;
      })()}
    </Tile>
  );
}

function BasicInfoIcon() {
  return (
    <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <circle cx="13" cy="9" r="3"/><path d="M7 21c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
      <line x1="13" y1="3" x2="13" y2="5"/><line x1="13" y1="21" x2="13" y2="23"/>
    </svg>
  );
}
function FfmsIcon() {
  return (
    <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <rect x="3" y="5" width="8" height="4" rx="1"/><rect x="15" y="5" width="8" height="4" rx="1"/>
      <line x1="7" y1="9" x2="7" y2="13"/><line x1="19" y1="9" x2="19" y2="13"/>
      <line x1="7" y1="13" x2="19" y2="13"/><line x1="13" y1="13" x2="13" y2="17"/>
      <rect x="9" y="17" width="8" height="4" rx="1"/>
    </svg>
  );
}
function HwIcon() {
  return (
    <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <rect x="3" y="8" width="20" height="12" rx="2"/>
      <line x1="7" y1="4" x2="7" y2="8"/><line x1="13" y1="4" x2="13" y2="8"/><line x1="19" y1="4" x2="19" y2="8"/>
      <circle cx="8" cy="14" r="2"/><circle cx="13" cy="14" r="2"/><circle cx="18" cy="14" r="2"/>
      <line x1="3" y1="20" x2="23" y2="20"/>
    </svg>
  );
}
function FfiIcon() {
  return (
    <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <circle cx="8" cy="13" r="3"/><circle cx="18" cy="13" r="3"/>
      <line x1="11" y1="13" x2="15" y2="13"/>
      <line x1="8" y1="10" x2="8" y2="6"/><line x1="18" y1="10" x2="18" y2="6"/>
      <line x1="5" y1="6" x2="21" y2="6"/>
    </svg>
  );
}
