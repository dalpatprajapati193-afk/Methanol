"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
  wizardStateAtom,
  hasSucceededOnceAtom,
  hasAppliedDomainLimitsOnceAtom,
  hasAppliedTripLimitsOnceAtom,
} from "../../config/ConfigAtoms";
import { toKey, UOM_OPTIONS, TRIP_DIRECTION_OPTIONS, TRIP_LIMIT_BASIS_OPTIONS } from "../../config/ConfigCatalog";
import { generateSubAssets, type GeneratedSubAsset } from "../../config/SubAssets";
import {
  applyDomainLimits,
  applyShutdownDate,
  applyTripLimits,
  getConfirmedAutoencoderTags,
  getEvaluatedTripTags,
  getShutdownDate,
  previewDomainLimits,
  previewTripLimits,
  type ApplySmeLimitInput,
  type ApplyTripLimitInput,
  type OemLimitSubmission,
  type TripLimitSubmission,
} from "../../actions/Actions";
import type { OemLimitRow, TripLimitRow } from "../../config/ConfigTypes";
import type { OemTagInfo, OnboardingSnapshot, TripTagInfo } from "../../store/Types";

interface StepDomainLimitsProps {
  instanceId: number;
  initialSnapshot: OnboardingSnapshot | null;
}

interface CalculatedRow {
  tagName: string;
  smeLow: number | "";
  smeHigh: number | "";
  /** false when this row is another referencing sub-asset's own computed
   * value for a tag whose home is a different tab (see SmeLimitRow) — shown
   * read-only for review, since Apply only ever honors the home row. */
  isHome: boolean;
}

interface TripCalculatedRow {
  tagName: string;
  tripLimit: number | "";
  tripDirection: string;
  tripLimitBasis: string;
  runModelOnReconsError: number;
}

/** Matches BuildWorkbook.ts's Summary sheet — the Python pipeline's
 * sub_asset_code is toKey(item.label), not item.id. */
const subAssetCode = (item: GeneratedSubAsset) => toKey(item.label);

/** Display-only — tag names are underscored (real registered tag_name, e.g.
 * "Stg_1_Discharge_Pressure"), shown with underscores replaced by spaces.
 * Never applied to the value actually submitted/keyed on. */
const displayTag = (tag: string) => tag.replace(/_/g, " ");

/** epoch (Unix seconds, UTC) <-> <input type="datetime-local"> value, shown/edited
 * in the browser's local time zone. */
const epochToLocalInput = (epoch: number | null): string => {
  if (epoch === null) return "";
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localInputToEpoch = (value: string): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
};

export function StepDomainLimits({ instanceId, initialSnapshot }: StepDomainLimitsProps) {
  const [state, setState] = useAtom(wizardStateAtom);
  const items = useMemo(() => generateSubAssets(state.mc), [state.mc]);
  const hasSucceededOnce = useAtomValue(hasSucceededOnceAtom);
  const setHasAppliedDomainLimitsOnce = useSetAtom(hasAppliedDomainLimitsOnceAtom);
  const setHasAppliedTripLimitsOnce = useSetAtom(hasAppliedTripLimitsOnceAtom);
  // initialSnapshot.result reflects only the LATEST run attempt — a failed
  // re-run after an earlier success would make initialSnapshot.result.ok
  // false even though a success already happened. lastSuccessfulRun is a
  // separate field that's never overwritten by a later failure (see
  // runOnboarding() in actions/Actions.ts), so it's the durable, cross-reload
  // signal. hasSucceededOnceAtom covers the same-session case before a reload.
  const hasRun = !!initialSnapshot?.lastSuccessfulRun || hasSucceededOnce;

  const [loading, setLoading] = useState(hasRun);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmedBySubAsset, setConfirmedBySubAsset] = useState<Record<string, OemTagInfo[]>>({});
  const [evaluatedBySubAsset, setEvaluatedBySubAsset] = useState<Record<string, TripTagInfo[]>>({});
  const [activeTabOverride, setActiveTab] = useState<string>("");
  const [innerTab, setInnerTab] = useState<"oem" | "trip">("oem");
  const [calculated, setCalculated] = useState<Record<string, CalculatedRow[]>>({});
  const [tripCalculated, setTripCalculated] = useState<Record<string, TripCalculatedRow[]>>({});
  const [calcStatus, setCalcStatus] = useState<"idle" | "calculating" | "done" | "error">("idle");
  const [applyStatus, setApplyStatus] = useState<"idle" | "applying" | "done" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTabOverride, setReviewTab] = useState<string>("");

  const [shutdownEpoch, setShutdownEpoch] = useState<number | null>(null);
  const [shutdownInput, setShutdownInput] = useState<string>("");
  const [shutdownLoading, setShutdownLoading] = useState(hasRun);
  const [shutdownError, setShutdownError] = useState<string | null>(null);
  const [shutdownSaveStatus, setShutdownSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!hasRun) return;
    let cancelled = false;
    getShutdownDate(instanceId)
      .then((epoch) => {
        if (cancelled) return;
        setShutdownEpoch(epoch);
        setShutdownInput(epochToLocalInput(epoch));
        setShutdownError(null);
      })
      .catch((e) => {
        if (!cancelled) setShutdownError(e instanceof Error ? e.message : "Failed to load shutdown date");
      })
      .finally(() => {
        if (!cancelled) setShutdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, hasRun]);

  const onSaveShutdownDate = async () => {
    setShutdownSaveStatus("saving");
    setShutdownError(null);
    try {
      const epoch = localInputToEpoch(shutdownInput);
      await applyShutdownDate(instanceId, epoch);
      setShutdownEpoch(epoch);
      setShutdownSaveStatus("saved");
    } catch (e) {
      setShutdownError(e instanceof Error ? e.message : "Failed to save shutdown date");
      setShutdownSaveStatus("error");
    }
  };

  useEffect(() => {
    if (!hasRun) return;
    let cancelled = false;
    Promise.all([getConfirmedAutoencoderTags(instanceId), getEvaluatedTripTags(instanceId)])
      .then(([confirmed, evaluated]) => {
        if (cancelled) return;
        setConfirmedBySubAsset(confirmed);
        setEvaluatedBySubAsset(evaluated);
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load confirmed tags");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, hasRun]);

  // Tags are shown directly as returned by the backend (tag_alias from
  // deviation_detection_tag_details / trip_limit_tag_mapping) — no
  // OemLimitTemplates.ts/TripLimitTemplates.ts catalog matching. Those
  // catalogs used generic, unprefixed parameter names ("Discharge Pressure")
  // while the real tag names are per-instance and prefixed
  // ("Stg_1_Discharge_Pressure"), so reconciling one to the other required
  // fragile name-guessing; deviation_detection_tag_details/
  // trip_limit_tag_mapping are already each their own authoritative "what's
  // relevant for this instance" source.
  const confirmedTagsFor = (item: GeneratedSubAsset) => confirmedBySubAsset[subAssetCode(item)] || [];
  const evaluatedTagsFor = (item: GeneratedSubAsset) => evaluatedBySubAsset[subAssetCode(item)] || [];

  const subAssetsWithContent = useMemo(
    () => items.filter((item) => confirmedTagsFor(item).length > 0 || evaluatedTagsFor(item).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, confirmedBySubAsset, evaluatedBySubAsset]
  );

  // Derived, not effect-driven: falls back to the first tab whenever the
  // current override isn't (or is no longer) a valid choice.
  const activeTab =
    activeTabOverride && subAssetsWithContent.some((i) => i.id === activeTabOverride)
      ? activeTabOverride
      : subAssetsWithContent[0]?.id || "";

  const activeItem = subAssetsWithContent.find((i) => i.id === activeTab);

  const oemRowsFor = (item: GeneratedSubAsset): OemLimitRow[] => {
    const tags = confirmedTagsFor(item);
    const byId = new Map((state.oemLimits[item.id] || []).map((r) => [r.templateId, r]));
    return tags.map((t) => {
      const found = byId.get(t.tag_name);
      if (found) return found;
      return {
        templateId: t.tag_name,
        parameter: t.tag_name,
        uom: t.user_uom || t.default_uom || "-",
        defaultUom: t.default_uom || "-",
        designLow: "" as const,
        designHigh: "" as const,
        rated: "" as const,
      };
    });
  };
  const setOemRow = (item: GeneratedSubAsset, idx: number, patch: Partial<OemLimitRow>) => {
    const rows = oemRowsFor(item).map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setState({ ...state, oemLimits: { ...state.oemLimits, [item.id]: rows } });
  };

  const tripRowsFor = (item: GeneratedSubAsset): TripLimitRow[] => {
    const tags = evaluatedTagsFor(item);
    const byId = new Map((state.tripLimits[item.id] || []).map((r) => [r.templateId, r]));
    return tags.map((t) => {
      const found = byId.get(t.tag_name);
      if (found) return found;
      return {
        templateId: t.tag_name,
        parameter: t.tag_name,
        uom: t.user_uom || t.default_uom || "-",
        defaultUom: t.default_uom || "-",
        tripLimit: "" as const,
        tripDirection: t.trip_direction || "",
        tripLimitBasis: "",
      };
    });
  };
  const setTripRow = (item: GeneratedSubAsset, idx: number, patch: Partial<TripLimitRow>) => {
    const rows = tripRowsFor(item).map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setState({ ...state, tripLimits: { ...state.tripLimits, [item.id]: rows } });
  };

  // Single Calculate button drives both previews. Run sequentially, not in
  // parallel — both endpoints read-modify-write the same instance's
  // AFP_DB_Tables.xlsx (different sheets), and design_limits/trip_limits
  // upserts racing on the same physical file risks a lost write.
  const onCalculateAll = async () => {
    setCalcStatus("calculating");
    setActionError(null);
    try {
      const oemSubmissions: OemLimitSubmission[] = [];
      const tripSubmissions: TripLimitSubmission[] = [];
      subAssetsWithContent.forEach((item) => {
        oemRowsFor(item).forEach((row) => {
          oemSubmissions.push({
            subAssetCode: subAssetCode(item),
            group: item.groupLabel,
            parameter: row.parameter,
            userUom: row.uom,
            defaultUom: row.defaultUom,
            designLow: row.designLow,
            designHigh: row.designHigh,
            rated: row.rated,
          });
        });
        tripRowsFor(item).forEach((row) => {
          tripSubmissions.push({
            subAssetCode: subAssetCode(item),
            group: item.groupLabel,
            parameter: row.parameter,
            userUom: row.uom,
            defaultUom: row.defaultUom,
            tripLimit: row.tripLimit,
            tripDirection: row.tripDirection,
            tripLimitBasis: row.tripLimitBasis,
          });
        });
      });

      const oemRows = await previewDomainLimits(instanceId, oemSubmissions);
      const bySubAsset: Record<string, CalculatedRow[]> = {};
      oemRows.forEach((r) => {
        (bySubAsset[r.sub_asset_code] ??= []).push({
          tagName: r.tag_name,
          smeLow: r.sme_low ?? "",
          smeHigh: r.sme_high ?? "",
          isHome: r.is_home,
        });
      });
      setCalculated(bySubAsset);

      const tripRows = await previewTripLimits(instanceId, tripSubmissions);
      const tripBySubAsset: Record<string, TripCalculatedRow[]> = {};
      tripRows.forEach((r) => {
        (tripBySubAsset[r.sub_asset_code] ??= []).push({
          tagName: r.tag_name,
          tripLimit: r.trip_limit ?? "",
          tripDirection: r.trip_direction,
          tripLimitBasis: r.trip_limit_basis,
          runModelOnReconsError: r.run_model_on_recons_error,
        });
      });
      setTripCalculated(tripBySubAsset);

      setCalcStatus("done");
      setReviewOpen(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to calculate domain/trip limits");
      setCalcStatus("error");
    }
  };

  const setCalculatedRow = (code: string, idx: number, patch: Partial<CalculatedRow>) => {
    setCalculated((prev) => ({
      ...prev,
      [code]: (prev[code] || []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const setTripCalculatedRow = (code: string, idx: number, patch: Partial<TripCalculatedRow>) => {
    setTripCalculated((prev) => ({
      ...prev,
      [code]: (prev[code] || []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  // Single Apply button persists both — sequential for the same reason as
  // onCalculateAll, plus applyDomainLimits/applyTripLimits each do a
  // read-modify-write of the instance's ui_config_data snapshot row; running
  // them concurrently would race and one's *AppliedAt field would be lost.
  const onApplyAll = async () => {
    setApplyStatus("applying");
    setActionError(null);
    try {
      const oemRows: ApplySmeLimitInput[] = [];
      Object.entries(calculated).forEach(([code, list]) => {
        // Non-home rows are read-only review copies of another sub-asset's
        // own computed value for a shared tag (see CalculatedRow.isHome) —
        // apply-domain-limits only ever honors the tag's one home row
        // (propagating it to every referencing model itself), so submitting
        // the others here would be a no-op at best.
        list.filter((r) => r.isHome).forEach((r) => {
          oemRows.push({
            subAssetCode: code,
            tagName: r.tagName,
            smeLow: r.smeLow === "" ? null : r.smeLow,
            smeHigh: r.smeHigh === "" ? null : r.smeHigh,
          });
        });
      });
      if (oemRows.length) {
        await applyDomainLimits(instanceId, oemRows, state);
        setHasAppliedDomainLimitsOnce(true);
      }

      // Calculate/Preview covers every evaluated tag across every sub-asset
      // (so the review table shows what's available), but Apply must only
      // persist tags the user actually set a trip limit for — otherwise every
      // sub-asset with an evaluated tag gets a phantom failure_prediction_tag_details
      // row with a null trip_limit, even ones the user never touched.
      const tripRows: ApplyTripLimitInput[] = [];
      Object.entries(tripCalculated).forEach(([code, list]) => {
        list.forEach((r) => {
          if (r.tripLimit === "") return;
          tripRows.push({
            subAssetCode: code,
            tagName: r.tagName,
            tripLimit: r.tripLimit,
            tripDirection: r.tripDirection,
            tripLimitBasis: r.tripLimitBasis,
            runModelOnReconsError: r.runModelOnReconsError,
          });
        });
      });
      if (tripRows.length) {
        await applyTripLimits(instanceId, tripRows, state);
        setHasAppliedTripLimitsOnce(true);
      }

      setApplyStatus("done");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to apply domain/trip limits");
      setApplyStatus("error");
    }
  };

  if (!hasRun) {
    return (
      <div className="rounded-md border border-border bg-surface p-5 text-sm text-text-secondary">
        Waiting on a successful onboarding run — go back to Review &amp; Run.
      </div>
    );
  }

  // Instance-wide (not per-sub-asset), so it renders regardless of whether
  // confirmed OEM/Trip tags exist for this run — independent loading state
  // from confirmedBySubAsset/evaluatedBySubAsset below.
  const shutdownSection = (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Last Asset Shutdown Date</p>
      {shutdownLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            Auto-computed from the last onboarding run (latest plant_status = 0 reading, or a historian data gap of
            2+ days). Confirm or edit if it looks wrong.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="datetime-local"
              value={shutdownInput}
              onChange={(e) => setShutdownInput(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary"
            />
            <button
              type="button"
              onClick={onSaveShutdownDate}
              disabled={shutdownSaveStatus === "saving"}
              className="w-fit rounded-md bg-accent-blue px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {shutdownSaveStatus === "saving" ? "Saving…" : "Save"}
            </button>
            {shutdownSaveStatus === "saved" && <span className="text-xs text-accent-green">Saved</span>}
            {shutdownSaveStatus === "error" && <span className="text-xs text-accent-red">Failed to save</span>}
          </div>
          {shutdownEpoch === null && !shutdownInput && (
            <p className="text-xs text-text-secondary">
              No shutdown detected in the test range — leave blank, or set one manually above.
            </p>
          )}
          {shutdownError && <p className="text-xs text-accent-red">{shutdownError}</p>}
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {shutdownSection}
        <div className="text-sm text-text-secondary">Loading confirmed tags…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        {shutdownSection}
        <div className="text-sm text-accent-red">{loadError}</div>
      </div>
    );
  }

  if (!subAssetsWithContent.length) {
    return (
      <div className="flex flex-col gap-5">
        {shutdownSection}
        <div className="rounded-md border border-border bg-surface p-5 text-sm text-text-secondary">
          No confirmed autoencoder tags or evaluated Trip Limit tags found for this run.
        </div>
      </div>
    );
  }

  const activeOemRows = activeItem ? oemRowsFor(activeItem) : [];
  const activeTripRows = activeItem ? tripRowsFor(activeItem) : [];
  const effectiveInnerTab = innerTab === "trip" && !activeTripRows.length ? "oem" : innerTab;

  // Only sub-assets with actual calculated rows get a tab in the review modal.
  // Union — a sub-asset shows up in the review modal if it has calculated
  // OEM rows, Trip rows, or both; each section below renders only if that
  // sub-asset actually has rows for it.
  const reviewSubAssets = subAssetsWithContent.filter(
    (item) =>
      (calculated[subAssetCode(item)] || []).length > 0 || (tripCalculated[subAssetCode(item)] || []).length > 0
  );
  const reviewTab =
    reviewTabOverride && reviewSubAssets.some((i) => i.id === reviewTabOverride)
      ? reviewTabOverride
      : reviewSubAssets[0]?.id || "";
  const reviewItem = reviewSubAssets.find((i) => i.id === reviewTab);
  const reviewCode = reviewItem ? subAssetCode(reviewItem) : "";
  const reviewRows = reviewItem ? calculated[reviewCode] || [] : [];
  const tripReviewRows = reviewItem ? tripCalculated[reviewCode] || [] : [];

  return (
    <div className="flex flex-col gap-5">
      {shutdownSection}
      {/* Calculate/Apply act on every sub-asset below at once (Apply must persist
       * everything the user has had a chance to review, not just whichever tab
       * happens to be active) — kept at the top, outside the tabs, so that's clear. */}
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-text-secondary">
          Fill in Design Limits (OEM tab) and Trip Limits (Trip Limit tab) for{" "}
          <span className="text-text-primary">all</span> sub-assets below, then click Calculate to review the
          computed domain and trip limits before applying them.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCalculateAll}
            disabled={calcStatus === "calculating"}
            className="w-fit rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {calcStatus === "calculating" ? "Calculating…" : "Calculate"}
          </button>
          {calcStatus === "done" && !reviewOpen && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="w-fit rounded-md border border-border px-4 py-2 text-sm text-text-primary"
            >
              Review Calculated Limits
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {subAssetsWithContent.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={
              "px-3 py-2 text-xs font-medium uppercase tracking-wide " +
              (activeTab === item.id ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeItem && (
        <>
          {activeOemRows.length > 0 && activeTripRows.length > 0 && (
            <div className="flex gap-4 text-xs">
              {(["oem", "trip"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInnerTab(t)}
                  className={
                    "pb-1 font-medium uppercase tracking-wide " +
                    (effectiveInnerTab === t ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
                  }
                >
                  {t === "oem" ? "OEM Limits" : "Trip Limit"}
                </button>
              ))}
            </div>
          )}

          {effectiveInnerTab === "oem" && activeOemRows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface">
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">#</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Parameter</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">User UoM</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Default UoM</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Design Low</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Design High</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Rated</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOemRows.map((row, idx) => (
                    <tr key={row.templateId} className="border-t border-border">
                      <td className="p-2 text-text-secondary">{idx + 1}</td>
                      <td className="p-2 text-text-primary">{displayTag(row.parameter)}</td>
                      <td className="p-2">
                        <select
                          value={row.uom}
                          onChange={(e) => setOemRow(activeItem, idx, { uom: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                        >
                          {!UOM_OPTIONS.includes(row.uom) && row.uom && <option value={row.uom}>{row.uom}</option>}
                          {UOM_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-text-secondary">{row.defaultUom}</td>
                      {(["designLow", "designHigh", "rated"] as const).map((field) => (
                        <td key={field} className="p-2">
                          <input
                            type="number"
                            value={row[field]}
                            onChange={(e) =>
                              setOemRow(activeItem, idx, { [field]: e.target.value === "" ? "" : Number(e.target.value) })
                            }
                            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {effectiveInnerTab === "trip" && activeTripRows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface">
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">#</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Parameter</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">User UoM</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Default UoM</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Limit</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Direction</th>
                    <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Limit Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTripRows.map((row, idx) => (
                    <tr key={row.templateId} className="border-t border-border">
                      <td className="p-2 text-text-secondary">{idx + 1}</td>
                      <td className="p-2 text-text-primary">{displayTag(row.parameter)}</td>
                      <td className="p-2">
                        <select
                          value={row.uom}
                          onChange={(e) => setTripRow(activeItem, idx, { uom: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                        >
                          {!UOM_OPTIONS.includes(row.uom) && row.uom && <option value={row.uom}>{row.uom}</option>}
                          {UOM_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-text-secondary">{row.defaultUom}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.tripLimit}
                          onChange={(e) =>
                            setTripRow(activeItem, idx, { tripLimit: e.target.value === "" ? "" : Number(e.target.value) })
                          }
                          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.tripDirection}
                          onChange={(e) => setTripRow(activeItem, idx, { tripDirection: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                        >
                          {!TRIP_DIRECTION_OPTIONS.includes(row.tripDirection) && row.tripDirection && (
                            <option value={row.tripDirection}>{row.tripDirection}</option>
                          )}
                          <option value="">—</option>
                          {TRIP_DIRECTION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={row.tripLimitBasis}
                          onChange={(e) => setTripRow(activeItem, idx, { tripLimitBasis: e.target.value })}
                          className="w-full min-w-[16rem] rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="">Select basis…</option>
                          {TRIP_LIMIT_BASIS_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {reviewOpen && calcStatus === "done" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-md border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Calculated sme_low / sme_high — review before applying</h2>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                aria-label="Close"
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border">
              {reviewSubAssets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReviewTab(item.id)}
                  className={
                    "px-3 py-2 text-xs font-medium uppercase tracking-wide " +
                    (reviewTab === item.id ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-4">
              {reviewItem && reviewRows.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">Domain Limits</h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface">
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">Tag</th>
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">sme_low</th>
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">sme_high</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewRows.map((row, idx) => (
                          <tr key={row.tagName} className="border-t border-border">
                            <td className="p-2 text-text-primary">
                              {displayTag(row.tagName)}
                              {!row.isHome && (
                                <span className="ml-2 text-xs text-text-secondary">
                                  (review only — applied from its home tab)
                                </span>
                              )}
                            </td>
                            {(["smeLow", "smeHigh"] as const).map((field) =>
                              row.isHome ? (
                                <td key={field} className="p-2">
                                  <input
                                    type="number"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setCalculatedRow(reviewCode, idx, {
                                        [field]: e.target.value === "" ? "" : Number(e.target.value),
                                      })
                                    }
                                    className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                                  />
                                </td>
                              ) : (
                                <td key={field} className="p-2 text-text-secondary">
                                  {row[field]}
                                </td>
                              )
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reviewItem && tripReviewRows.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">Trip Limits</h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface">
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">Tag</th>
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Limit</th>
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Direction</th>
                          <th className="p-2 text-left text-xs uppercase text-text-secondary">Trip Limit Basis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tripReviewRows.map((row, idx) => (
                          <tr key={row.tagName} className="border-t border-border">
                            <td className="p-2 text-text-primary">{displayTag(row.tagName)}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={row.tripLimit}
                                onChange={(e) =>
                                  setTripCalculatedRow(reviewCode, idx, {
                                    tripLimit: e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                                className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.tripDirection}
                                onChange={(e) => setTripCalculatedRow(reviewCode, idx, { tripDirection: e.target.value })}
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              >
                                {!TRIP_DIRECTION_OPTIONS.includes(row.tripDirection) && row.tripDirection && (
                                  <option value={row.tripDirection}>{row.tripDirection}</option>
                                )}
                                <option value="">—</option>
                                {TRIP_DIRECTION_OPTIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <select
                                value={row.tripLimitBasis}
                                onChange={(e) => setTripCalculatedRow(reviewCode, idx, { tripLimitBasis: e.target.value })}
                                className="w-full min-w-[16rem] rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              >
                                <option value="">Select basis…</option>
                                {TRIP_LIMIT_BASIS_OPTIONS.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              {actionError && <p className="text-sm text-accent-red">{actionError}</p>}
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onApplyAll}
                  disabled={applyStatus === "applying" || applyStatus === "done"}
                  className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {applyStatus === "applying" ? "Applying…" : applyStatus === "done" ? "Applied" : "Confirm & Apply (all sub-assets)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!reviewOpen && actionError && <p className="text-sm text-accent-red">{actionError}</p>}
    </div>
  );
}
