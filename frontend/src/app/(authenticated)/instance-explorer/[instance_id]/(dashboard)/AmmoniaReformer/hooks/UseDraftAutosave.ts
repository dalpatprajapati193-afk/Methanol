"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { instanceIdAtom, dirtyAtom, flushDraftAtom } from "../store/Index";

const DEBOUNCE_MS = 1500;

/**
 * Draft autosave (mirrors the EG / Test PI reference). Drives `flushDraftAtom`
 * (the shared save logic, also used by the "Save now" button): debounced after
 * edits and flushed best-effort when the tab is hidden/closed. The flush itself
 * is dirty-guarded and persists only once a hierarchy exists.
 */
export function useDraftAutosave() {
  const instanceId = useAtomValue(instanceIdAtom);
  const dirty = useAtomValue(dirtyAtom);
  const flush = useSetAtom(flushDraftAtom);

  // Debounced autosave whenever the config becomes dirty.
  useEffect(() => {
    if (!dirty || !instanceId) return;
    const t = setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [dirty, instanceId, flush]);

  // Best-effort flush on tab hide / close so unexpected exits don't lose work.
  // flushDraftAtom reads dirty/instanceId fresh from the store and self-guards.
  useEffect(() => {
    const onHide = () => { void flush(); };
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
