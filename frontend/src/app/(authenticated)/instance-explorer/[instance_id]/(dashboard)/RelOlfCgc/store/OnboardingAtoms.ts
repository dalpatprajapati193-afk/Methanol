import { atom } from "jotai";
import type { OnboardResult, RunStatus } from "./Types";

/** Current onboarding run status. */
export const runStatusAtom = atom<RunStatus>("idle");

/** Result of the last onboarding run (this session), null until one completes. */
export const lastResultAtom = atom<OnboardResult | null>(null);
