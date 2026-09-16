"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { piConfigAtom, currentStepAtom, dirtyAtom, saveStatusAtom } from "../store/PiAtoms";
import { saveDraft } from "../actions/Actions";

/**
 * Draft autosave (mirrors EG). `flush()` upserts the live config to the draft row
 * only when dirty. Also best-effort persists when the tab is hidden/closed.
 */
export function useDraftAutosave(instanceId: number | null) {
  const config = useAtomValue(piConfigAtom);
  const currentStep = useAtomValue(currentStepAtom);
  const [dirty, setDirty] = useAtom(dirtyAtom);
  const setStatus = useSetAtom(saveStatusAtom);

  const ref = useRef({ config, currentStep, dirty, instanceId });
  useEffect(() => {
    ref.current = { config, currentStep, dirty, instanceId };
  });

  const flush = useCallback(async () => {
    const snap = ref.current;
    if (!snap.instanceId || !snap.dirty || !snap.config) return; // dirty-guard
    try {
      setStatus("saving");
      await saveDraft(snap.instanceId, snap.config, snap.currentStep);
      setDirty(false);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }, [setDirty, setStatus]);

  useEffect(() => {
    const onHide = () => {
      const snap = ref.current;
      if (!snap.instanceId || !snap.dirty) return;
      void flush();
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
