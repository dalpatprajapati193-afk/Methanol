"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  configDataAtom,
  currentStepAtom,
  wizardDirtyAtom,
  saveStatusAtom,
} from "../store/WizardAtoms";
import { saveDraft } from "../actions/Actions";

/**
 * Draft autosave. `flush()` persists the live config to the draft row (upsert)
 * only when something changed (dirty-guard). Also best-effort persists when the
 * tab is hidden/closed so unexpected exits don't lose work.
 */
export function useDraftAutosave(instanceId: number | null) {
  const config = useAtomValue(configDataAtom);
  const currentStep = useAtomValue(currentStepAtom);
  const [dirty, setDirty] = useAtom(wizardDirtyAtom);
  const setStatus = useSetAtom(saveStatusAtom);

  // Keep latest values reachable from event listeners without re-binding them.
  const ref = useRef({ config, currentStep, dirty, instanceId });
  useEffect(() => {
    ref.current = { config, currentStep, dirty, instanceId };
  });

  const flush = useCallback(async () => {
    const snap = ref.current;
    if (!snap.instanceId || !snap.dirty) return; // dirty-guard: nothing changed
    try {
      setStatus("saving");
      await saveDraft(snap.instanceId, snap.config, snap.currentStep);
      setDirty(false);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      throw err; // re-throw so callers (handleSubmit) know the save failed
    }
  }, [setDirty, setStatus]);

  useEffect(() => {
    const onHide = () => {
      const snap = ref.current;
      if (!snap.instanceId || !snap.dirty) return;
      void flush(); // fire-and-forget; best-effort on close
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  return { flush };
}
