"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CgcConfig } from "../types/config";
import { saveDraft, type DraftExcel } from "../actions/Actions";

export function useDraftAutosave(instanceId: number | null, config: CgcConfig) {
  const latest = useRef({ instanceId, config });

  useEffect(() => {
    latest.current = { instanceId, config };
  }, [instanceId, config]);

  /** `excel` is only passed by an explicit "Save Draft" click (see
   * CgcConfigClient.handleSaveDraft) — the debounced autosave below flushes
   * JSON only, so it doesn't regenerate the workbook on every keystroke. */
  const flush = useCallback(async (excel?: DraftExcel) => {
    const snap = latest.current;
    if (!snap.instanceId) return;
    await saveDraft(snap.instanceId, snap.config, excel);
  }, []);

  useEffect(() => {
    if (!instanceId) return;
    const timer = window.setTimeout(() => {
      void flush().catch((err) => console.error("Draft autosave failed:", err));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [config, flush, instanceId]);

  return { flush };
}
