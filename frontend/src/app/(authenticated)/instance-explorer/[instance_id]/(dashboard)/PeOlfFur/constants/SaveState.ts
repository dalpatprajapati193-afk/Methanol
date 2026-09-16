// ── Per-entry save-state indicator — the GLOBAL rule ─────────────────────────
//
// Every editable control in Know-Your-Case reflects its save state on its TEXT
// (never the box / border / button fill): each control compares its LIVE value
// to the confirmed + draft snapshots —
//   == confirmed           → 'confirmed' (no marker, normal text)
//   == draft (≠ confirmed) → 'saved'     (steady yellow text)
//   ≠ both                 → 'unsaved'   (yellow text that fades out & reappears)
//
// The snapshots live in confirmed/draftFmsAtom + confirmed/draftFuelAtom, set at
// the four sync points (auto-fill on open, Save = draft, Confirm = both, Revert =
// both). When neither snapshot exists yet there is nothing to diff → no marker.
//
// Usage (page-level state):
//   const save = useFmsSave();
//   <select className={cn(base, save(fields.x, f => f.x))} … />
// Usage (already-resolved snapshot fields, e.g. a hardware template):
//   className={cn(base, saveTextCls(entryStatus(cur, conf, draft, active)))}
'use client';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect } from 'react';
import { confirmedFmsAtom, draftFmsAtom, type FmsState } from '../store/FmsAtoms';
import { confirmedFuelAtom, draftFuelAtom, type FuelState } from '../store/FuelAtoms';
import { confirmedPkgSelectionAtom, draftPkgSelectionAtom, type PkgSelection } from '../store/PkgSelectionAtoms';
import styles from '../Style.module.css';

export type SaveStatus = 'confirmed' | 'saved' | 'unsaved';

// ── The single shared "unsaved" fade clock ──────────────────────────────────
// Every unsaved field's text colour is driven from ONE rAF loop writing the shared
// --fieldFadeColor custom property, so all unsaved fields stay in phase no matter
// when each one individually became unsaved (a per-element CSS animation would
// restart at each field's own edit time and drift). The cycle is deliberately
// asymmetric — a SLOW fade-out then a FAST reappear. color-mix keeps it the theme's
// accent-yellow at a varying alpha (no muddy interpolation, auto-adapts to theme).
// Mount once (FurnaceApp); honours prefers-reduced-motion by holding steady.
const FADE_PERIOD_MS = 2000;   // full fade→reappear cycle
const FADE_OUT_FRAC = 0.8;     // fraction of the cycle spent fading out (slow); rest = fast reappear
export function useFieldFadeClock(): void {
  useEffect(() => {
    const root = document.documentElement;
    const setColor = (pct: number) =>
      root.style.setProperty('--fieldFadeColor', `color-mix(in srgb, var(--color-accent-yellow) ${pct}%, transparent)`);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setColor(100);
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      const p = (t % FADE_PERIOD_MS) / FADE_PERIOD_MS;
      const alpha = p < FADE_OUT_FRAC ? 1 - p / FADE_OUT_FRAC : (p - FADE_OUT_FRAC) / (1 - FADE_OUT_FRAC);
      setColor(Math.round(alpha * 100));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); root.style.removeProperty('--fieldFadeColor'); };
  }, []);
}

/** Classify one entry from its live value + the two snapshot values. `active` is
 *  false when neither snapshot exists yet (nothing to diff → no marker). */
export function entryStatus(cur: unknown, confirmed: unknown, draft: unknown, active: boolean): SaveStatus {
  if (!active) return 'confirmed';
  if (cur === confirmed) return 'confirmed';
  if (cur === draft) return 'saved';
  return 'unsaved';
}

/** TEXT-only marker classes: fade the text colour when unsaved (fieldTextFade
 *  rests on yellow), steady yellow when saved, nothing when confirmed. The box /
 *  border / button fill are never touched. */
export function saveTextCls(s: SaveStatus): string {
  if (s === 'unsaved') return styles.fieldTextFade;
  if (s === 'saved') return 'text-accent-yellow';
  return '';
}

/** A picker → save-state-class function comparing a control's live value to the
 *  FMS snapshots. Returns the class string ready to drop into `cn(...)`. */
export type SaveFn<Root> = (cur: unknown, pick: (root: Root) => unknown) => string;

export function useFmsSave(): SaveFn<FmsState> {
  const confirmed = useAtomValue(confirmedFmsAtom);
  const draft = useAtomValue(draftFmsAtom);
  const active = confirmed != null || draft != null;
  return useCallback(
    (cur, pick) => saveTextCls(entryStatus(
      cur,
      confirmed ? pick(confirmed) : undefined,
      draft ? pick(draft) : undefined,
      active,
    )),
    [confirmed, draft, active],
  );
}

export function useFuelSave(): SaveFn<FuelState> {
  const confirmed = useAtomValue(confirmedFuelAtom);
  const draft = useAtomValue(draftFuelAtom);
  const active = confirmed != null || draft != null;
  return useCallback(
    (cur, pick) => saveTextCls(entryStatus(
      cur,
      confirmed ? pick(confirmed) : undefined,
      draft ? pick(draft) : undefined,
      active,
    )),
    [confirmed, draft, active],
  );
}

/** Per-entry save-state for the KPI / Package Selection page — compares a control's
 *  live value (a package's selected flag, a KPI's data source) to the confirmed +
 *  draft selection snapshots. Same three states as the Hub controls. */
export function usePkgSave(): SaveFn<PkgSelection> {
  const confirmed = useAtomValue(confirmedPkgSelectionAtom);
  const draft = useAtomValue(draftPkgSelectionAtom);
  const active = confirmed != null || draft != null;
  return useCallback(
    (cur, pick) => saveTextCls(entryStatus(
      cur,
      confirmed ? pick(confirmed) : undefined,
      draft ? pick(draft) : undefined,
      active,
    )),
    [confirmed, draft, active],
  );
}
