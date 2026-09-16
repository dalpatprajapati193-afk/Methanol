import { atom } from "jotai";
import type { PiPullConfig, SensorStats, SaveStatus } from "./Types";

/** Live config being edited (null until loadInitialConfig resolves). */
export const piConfigAtom = atom<PiPullConfig | null>(null);

/** Computed statistics from the last Generate run. */
export const statsResultsAtom = atom<SensorStats[]>([]);

/** Generate-in-flight flag. */
export const isGeneratingAtom = atom(false);

/** Last error message (generation or save). */
export const errorAtom = atom<string | null>(null);

/** Dirty-guard for autosave — set true on any config edit, cleared on flush. */
export const dirtyAtom = atom(false);

/** Draft save status indicator. */
export const saveStatusAtom = atom<SaveStatus>("idle");

/** Kept for autosave-hook parity with EG (single page → always null). */
export const currentStepAtom = atom<string | null>(null);
