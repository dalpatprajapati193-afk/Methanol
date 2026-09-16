"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { dirtyAtom, saveStatusAtom, wizardStateAtom, wizardStepAtom } from "../config/ConfigAtoms";
import { saveDraft } from "../actions/Actions";

/**
 * Draft autosave (mirrors testPiPulling's useDraftAutosave). `flush()` upserts
 * the live wizard state to the draft row only when dirty. Also best-effort
 * persists when the tab is hidden/closed.
 */
export function useDraftAutosave(instanceId: number | null) {
  const state = useAtomValue(wizardStateAtom);
  const step = useAtomValue(wizardStepAtom);
  const [dirty, setDirty] = useAtom(dirtyAtom);
  const setStatus = useSetAtom(saveStatusAtom);

  const ref = useRef({ state, step, dirty, instanceId });
  useEffect(() => {
    ref.current = { state, step, dirty, instanceId };
  });

  const flush = useCallback(async () => {
    const snap = ref.current;
    if (!snap.instanceId || !snap.dirty) return; // dirty-guard
    try {
      setStatus("saving");
      await saveDraft(snap.instanceId, snap.state, String(snap.step));
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
