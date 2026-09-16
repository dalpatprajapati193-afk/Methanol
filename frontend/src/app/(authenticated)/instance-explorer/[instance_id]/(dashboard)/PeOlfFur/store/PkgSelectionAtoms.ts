import { atom } from 'jotai';

// Per-KPI data source (how a KPI's value is obtained). Shared across the
// Package/KPI selection page and the persisted selection artifact.
export type KpiSource = 'none' | 'sensor' | 'calculate';

// How a selected package became selected: a manual card click, or automatically
// because one of its KPIs was set to Calculate. Drives the de-select warning.
export type PkgOrigin = 'manual' | 'kpi';

// The full Package/KPI selection the user makes on the selection page — the live,
// in-memory selection the Confirm button records to Package_KPI_Selection.json.
export interface PkgSelection {
  selectedPackages: string[];
  kpiStates: Record<string, KpiSource>;   // only non-'none' entries are persisted
  pkgOrigin: Record<string, PkgOrigin>;
}

export function emptyPkgSelection(): PkgSelection {
  return { selectedPackages: [], kpiStates: {}, pkgOrigin: {} };
}

// Current live selection (in-memory; seeded from Package_KPI_Selection.json when
// the app opens — mirrors how the Configuration Modules seed from
// User_Setup_Response.json). Resets on refresh, then re-seeds on open.
export const pkgSelectionAtom = atom<PkgSelection>(emptyPkgSelection());

// Last-confirmed baseline signature — green when the live selection matches it.
export const pkgKpiBaselineAtom = atom<{ hash: string } | null>(null);

// ── Draft-model snapshots (mirror confirmed/draftFmsAtom on the Hub) ──────────
// The confirmed + draft selection snapshots drive the per-entry save-state indicator
// and the per-page SAVE button (which appears when the live selection differs from the
// saved draft). Set at the four sync points: auto-fill on open, Save, Confirm, Revert.
// Null until a snapshot exists (nothing to diff → no marker / no SAVE).
export const confirmedPkgSelectionAtom = atom<PkgSelection | null>(null);
export const draftPkgSelectionAtom = atom<PkgSelection | null>(null);
