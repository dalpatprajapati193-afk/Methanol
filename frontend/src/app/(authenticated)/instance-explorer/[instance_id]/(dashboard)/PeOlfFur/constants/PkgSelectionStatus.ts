// Status helpers for the KPI / Package Selection page — the package-side twins of
// ModulesStatus' entriesHash / isRecordedGreen. They drive the Confirm button's
// blue/orange/yellow/green state (via ModulesStatus' shared `confirmVisual`) and
// the Input Sheet tile lock on the Packages hub.
import type { PkgSelection } from '../store/PkgSelectionAtoms';

function strHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Stable hash of exactly what Confirm records: the selected packages + the
// non-'none' KPI states (order-independent).
export function selectionHash(sel: PkgSelection): string {
  const pkgs = [...sel.selectedPackages].sort();
  const kpis = Object.entries(sel.kpiStates)
    .filter(([, v]) => v !== 'none')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return strHash(JSON.stringify({ p: pkgs, k: kpis }));
}

// "Complete" = at least one package selected (an empty selection is the
// incomplete/orange state).
export function selectionComplete(sel: PkgSelection): boolean {
  return sel.selectedPackages.length > 0;
}

// The Input Sheet tile unlocks only when the selection is complete AND matches
// the recorded baseline (green) — mirrors isRecordedGreen for the FMS modules.
export function isPackageKpiGreen(
  baseline: { hash: string } | null,
  sel: PkgSelection,
): boolean {
  return !!baseline && selectionComplete(sel) && selectionHash(sel) === baseline.hash;
}
