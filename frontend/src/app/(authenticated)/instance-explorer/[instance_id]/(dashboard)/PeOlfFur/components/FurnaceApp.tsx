'use client';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAtom, useSetAtom } from 'jotai';
import { activePageAtom, fmsStateAtom, confirmedBaselineAtom, confirmedFmsAtom, draftFmsAtom } from '../store/FmsAtoms';
import { fuelStateAtom, confirmedFuelAtom, draftFuelAtom } from '../store/FuelAtoms';
import { pkgSelectionAtom, pkgKpiBaselineAtom, confirmedPkgSelectionAtom, draftPkgSelectionAtom } from '../store/PkgSelectionAtoms';
import { tooltipsAtom } from '../store/TooltipAtoms';
import { importFromRows } from '../constants/ImportUtils';
import { entriesHash } from '../constants/ModulesStatus';
import { selectionHash } from '../constants/PkgSelectionStatus';
import { readUserSetupResponse, readUserSetupDraft, readPackageKpiSelection, readPkgKpiDraft } from '../actions/actions';
import { readTooltips } from '../actions/tooltipActions';
import { useFieldFadeClock } from '../constants/SaveState';
import TopBar from './TopBar';
import WizardNav from './WizardNav';
import LandingPage from './pages/LandingPage';
import PackagesPage from './pages/PackagesPage';
import PkgSelectionPage from './pages/PkgSelectionPage';
import InputSheetPage from './pages/InputSheetPage';
import BasicInfoPage from './pages/BasicInfoPage';
import HubPage from './pages/HubPage';
import FeedManagementPage from './pages/FeedManagementPage';
import FeedFurnaceInteractionPage from './pages/FeedFurnaceInteractionPage';
import HardwareConfigPage from './pages/HardwareConfigPage';
import HardwareSectionPage from './pages/HardwareSectionPage';
import HardwareDefinePage from './pages/HardwareDefinePage';
import HardwareApplyPage from './pages/HardwareApplyPage';

export default function FurnaceApp() {
  const [activePage] = useAtom(activePageAtom);
  // instance_id from the route ([instance_id]) — threaded into every server action
  // so reads/writes hit this instance's private data dir (_instances/<id>).
  const routeInstance = useParams()?.instance_id;
  const instanceId = Number(Array.isArray(routeInstance) ? routeInstance[0] : routeInstance) || null;

  const setFms = useSetAtom(fmsStateAtom);
  const setFuel = useSetAtom(fuelStateAtom);
  const setConfirmedBaseline = useSetAtom(confirmedBaselineAtom);
  const setConfirmedFms = useSetAtom(confirmedFmsAtom);
  const setDraftFms = useSetAtom(draftFmsAtom);
  const setConfirmedFuel = useSetAtom(confirmedFuelAtom);
  const setDraftFuel = useSetAtom(draftFuelAtom);
  const setPkgSelection = useSetAtom(pkgSelectionAtom);
  const setPkgBaseline = useSetAtom(pkgKpiBaselineAtom);
  const setConfirmedPkg = useSetAtom(confirmedPkgSelectionAtom);
  const setDraftPkg = useSetAtom(draftPkgSelectionAtom);
  const setTooltips = useSetAtom(tooltipsAtom);
  const initedRef = useRef(false);

  // Drive the shared "unsaved" fade clock so every unsaved field stays in phase.
  useFieldFadeClock();

  // On app open, autofill from the recorded artifacts if they exist (state is
  // in-memory, so a refresh reset it to defaults — this restores the last
  // confirmed setup + selection, and sets each baseline so their status shows
  // green and the downstream tiles unlock).
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    (async () => {
      // Configuration Modules — auto-fill state from the DRAFT (so a Save survives a
      // refresh), falling back to the confirmed copy when no draft exists yet. The
      // baseline is set from the CONFIRMED copy, so if the draft/current state differs
      // from confirmed the Hub Confirm shows yellow + Revert on open.
      try {
        const [confirmedRes, draftRes] = await Promise.all([
          readUserSetupResponse(instanceId),
          readUserSetupDraft(instanceId),
        ]);
        const confirmed = confirmedRes.success ? importFromRows(confirmedRes.rows) : null;
        const draft = draftRes.success ? importFromRows(draftRes.rows) : null;
        // Live state ← draft (survives refresh of a Save), else the confirmed copy.
        const state = draft ?? confirmed;
        if (state) {
          setFms(state.fms);
          setFuel(state.fuel);
        }
        // Baseline = confirmed signature (null when nothing confirmed yet → blue).
        if (confirmed) setConfirmedBaseline({ hash: entriesHash(confirmed.fms, confirmed.fuel) });
        // Snapshots for the per-entry save-state indicator + per-page Save dirtiness.
        // The draft snapshot mirrors the loaded live state (draft when present, else
        // the confirmed copy) so nothing reads as "unsaved" on open.
        if (confirmed) { setConfirmedFms(confirmed.fms); setConfirmedFuel(confirmed.fuel); }
        if (draft) { setDraftFms(draft.fms); setDraftFuel(draft.fuel); }
        else if (confirmed) { setDraftFms(confirmed.fms); setDraftFuel(confirmed.fuel); }
      } catch { /* no recorded setup yet — leave defaults */ }

      // KPI / Package selection — auto-fill from the DRAFT (so a Save survives a
      // refresh), falling back to the confirmed copy. Baseline = confirmed hash (green
      // on open when the live selection matches confirmed; a draft ≠ confirmed lands on
      // yellow + Revert). The snapshots feed the per-page SAVE + per-entry indicator.
      try {
        const [confRes, draftRes] = await Promise.all([
          readPackageKpiSelection(instanceId),
          readPkgKpiDraft(instanceId),
        ]);
        const confirmed = confRes.success ? confRes.selection : null;
        const draft = draftRes.success ? draftRes.selection : null;
        const live = draft ?? confirmed;
        if (live) {
          setPkgSelection({
            selectedPackages: live.selectedPackages,
            kpiStates: live.kpiStates,
            pkgOrigin: live.pkgOrigin,
          });
        }
        if (confirmed && confirmed.selectedPackages.length) {
          setPkgBaseline({ hash: selectionHash(confirmed) });
        }
        if (confirmed) setConfirmedPkg(confirmed);
        if (draft) setDraftPkg(draft);
        else if (confirmed) setDraftPkg(confirmed);
      } catch { /* no recorded selection yet — leave empty */ }

      // Tooltip copy ← Tooltips.xlsx (user-editable; self-created on first open).
      try {
        const res = await readTooltips();
        if (res.success) setTooltips(res.tooltips);
      } catch { /* no tooltip file readable — icons simply don't render */ }
    })();
  }, [setFms, setFuel, setConfirmedBaseline, setConfirmedFms, setDraftFms, setConfirmedFuel, setDraftFuel, setPkgSelection, setPkgBaseline, setConfirmedPkg, setDraftPkg, setTooltips]);

  // Landing is the root ("Olefin Furnace Suite") — top bar + breadcrumb shown.
  if (activePage === 'landing') {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">
        <TopBar />
        <LandingPage />
      </div>
    );
  }
  // Packages flow: breadcrumb top bar (no flow map), navigation via crumbs.
  if (activePage === 'packages') {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">
        <TopBar />
        <PackagesPage />
      </div>
    );
  }
  if (activePage === 'pkgSelection') {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">
        <TopBar />
        <PkgSelectionPage />
      </div>
    );
  }
  if (activePage === 'inputSheet') {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">
        <TopBar />
        <InputSheetPage />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {activePage === 'basicinfo' && <BasicInfoPage />}
        {activePage === 'hub'       && <HubPage />}
        {activePage === 'fms'       && <FeedManagementPage />}
        {activePage === 'ffi'       && <FeedFurnaceInteractionPage />}
        {activePage === 'hwcfg'     && <HardwareConfigPage />}
        {activePage === 'hwsec'     && <HardwareSectionPage />}
        {activePage === 'hwdefine'  && <HardwareDefinePage />}
        {activePage === 'hwapply'   && <HardwareApplyPage />}
        {/* Configuration-Modules wizard Back/Next bar (renders only on wizard pages) */}
        <WizardNav />
      </div>
    </div>
  );
}
