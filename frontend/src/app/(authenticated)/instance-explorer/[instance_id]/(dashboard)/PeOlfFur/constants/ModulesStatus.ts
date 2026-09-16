// Shared status helpers for the Configuration Modules (Hub) — used by both the
// Hub page (Confirm button) and the Landing page (Packages/KPI tile lock) so the
// two always agree on "complete", the recorded-vs-current diff, and the resulting
// colour state.
import { basicInfoComplete, feedAllVisited, hwSectionPct, type FmsState } from '../store/FmsAtoms';
import type { FuelState } from '../store/FuelAtoms';
import { serializeFmsState } from './ExportUtils';

// ── Module completion ───────────────────────────────────────────────────────────
// Mirrors the per-tile gating shown on the Hub page; `true` only when all
// module tiles are complete (the same condition that enables Confirm). Uses the
// shared store helpers so the Hub, wizard, and this always agree.
export function modulesComplete(fms: FmsState, fuel: FuelState): boolean {
  const single = fms.furnaceCount === 1;
  const hwPct = Math.round((hwSectionPct(fms.hwConv, single) + hwSectionPct(fms.hwRad, single)) / 2);
  const ffmsDone = feedAllVisited(fms) && fuel.visitedFuel;
  const ffiPct = fms.ffiDone ? 100
    : fms.ffiTemplates.length > 0 && fms.ffiTemplates.some(t => t.furnaces.length > 0) ? 50 : 0;

  return basicInfoComplete(fms) && ffmsDone && hwPct >= 100 && ffiPct >= 100;
}

// ── Entries signature ───────────────────────────────────────────────────────────
// Stable hash of exactly the entries Confirm writes (FMS State + Entity_Tree).
// Two states with identical serialized output produce the same hash.
function strHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function entriesHash(fms: FmsState, fuel: FuelState): string {
  const { fmsRows, treeRows } = serializeFmsState(fms, fuel);
  return strHash(JSON.stringify({ f: fmsRows, t: treeRows }));
}

// ── Confirm colour state ─────────────────────────────────────────────────────────
export type ConfirmState = 'blue' | 'orange' | 'yellow' | 'green';

export interface ConfirmVisual {
  state: ConfirmState;
  subtext: string;
  bg: string;   // CSS background (semantic token)
  fg: string;   // readable foreground
}

const VISUALS: Record<ConfirmState, Omit<ConfirmVisual, 'state'>> = {
  blue:   { subtext: "First time's the charm",                       bg: 'var(--color-accent-blue)',   fg: '#ffffff' },
  orange: { subtext: 'Setup Incomplete, previous recorded copy exists', bg: 'var(--color-accent-orange)', fg: '#1a1a1a' },
  yellow: { subtext: 'Setup complete but not recorded',             bg: 'var(--color-accent-yellow)', fg: '#1a1a1a' },
  green:  { subtext: 'Setup complete and recorded',                 bg: 'var(--color-accent-green)',  fg: '#ffffff' },
};

// Derive the Confirm button's colour state from the recorded baseline (session),
// the current entries hash, and whether the modules are complete.
//   blue   — never confirmed this session (no baseline)
//   green  — complete AND current entries match the recorded baseline
//   yellow — complete AND current entries differ from the recorded baseline
//   orange — incomplete (a recorded copy exists from an earlier confirm)
export function confirmVisual(
  baseline: { hash: string } | null,
  currentHash: string,
  complete: boolean,
): ConfirmVisual {
  let state: ConfirmState;
  if (!baseline) state = 'blue';
  else if (complete) state = currentHash === baseline.hash ? 'green' : 'yellow';
  else state = 'orange';
  return { state, ...VISUALS[state] };
}

// The Packages/KPI tile unlocks only when the modules are complete and the
// current entries are the recorded (latest) ones — i.e. the green state.
export function isRecordedGreen(
  baseline: { hash: string } | null,
  fms: FmsState,
  fuel: FuelState,
): boolean {
  return !!baseline && modulesComplete(fms, fuel) && entriesHash(fms, fuel) === baseline.hash;
}
