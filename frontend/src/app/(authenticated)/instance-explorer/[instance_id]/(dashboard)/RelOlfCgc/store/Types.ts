// ─── AFP Onboarding (RelOlfCgc) — shared types (mirror the FastAPI contract) ───

import type { AfpWizardState } from "../config/ConfigTypes";

/** Result of one onboarding run, as shown in the UI. */
export interface OnboardResult {
  ok: boolean;
  log: string;
  error?: string | null;
}

/** Raw POST rel-olf-cgc/onboard response — JSON status only. The generated
 * workbook is fetched separately via a raw-bytes GET onboard-workbook call
 * (documentation/05's binary-transfer contract: raw fetch + arrayBuffer(),
 * not base64-in-JSON). */
export type OnboardApiResponse = OnboardResult;

/** Persisted snapshot of the last onboarding run for an instance (ui_config_data).
 * wizardState is included so the draft->snapshot->defaults resume precedence
 * (documentation/04) can rebuild the wizard's form after its draft is cleared
 * on a successful submit — absent for runs made via the raw-upload path. */
export interface OnboardingSnapshot {
  fileName: string;
  ranAt: string; // ISO-8601
  result: OnboardResult;
  wizardState?: AfpWizardState;
  /** Set only when result.ok, and never overwritten by a later failed attempt —
   * the top-level fields above always reflect the LATEST run (for the Review
   * step's "last run" banner), so a subsequent failed re-run must not erase the
   * record of an earlier success the Domain Limits step depends on. */
  lastSuccessfulRun?: {
    fileName: string;
    ranAt: string;
    result: OnboardResult;
  };
  /** Set by applyDomainLimits() once the user confirms the Domain/Trip Limit
   * review modal — durable, cross-reload signal for the wizard stepper's
   * Domain/Trip Limit tick (see hasAppliedDomainLimitsOnceAtom for the
   * same-session-without-reload case). */
  domainLimitsAppliedAt?: string;
  /** Set by applyTripLimits() once the user confirms the Trip Limit review
   * modal — mirrors domainLimitsAppliedAt for the OEM side. */
  tripLimitsAppliedAt?: string;
}

export type RunStatus = "idle" | "running" | "done" | "error";

// ─── Live onboarding progress (polled while a run is in flight) ────────────

export interface OnboardProgressStage {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

/** Raw GET /onboard-progress response. */
export interface OnboardProgressApiResponse {
  ok: boolean;
  overall_status: "idle" | "running" | "done" | "error";
  stages: OnboardProgressStage[];
  error?: string | null;
}

// ─── Post-onboarding "Domain Limits" review step ────────────────────────────

/** One tag_alias, per sub-asset, straight from deviation_detection_tag_details
 * — raw GET /confirmed-autoencoder-tags response. Shown directly on the OEM
 * Limits tab, no template/catalog matching. */
export interface OemTagInfo {
  tag_name: string;
  user_uom: string;
  default_uom: string;
}

export interface OemTagsApiResponse {
  ok: boolean;
  tags_by_sub_asset: Record<string, OemTagInfo[]>;
  error?: string | null;
}

/** One affiliate_specific_tag, per sub-asset, straight from
 * trip_limit_tag_mapping — raw GET /evaluated-trip-tags response. Shown
 * directly on the Trip Limit tab, no template/catalog matching. user_uom/
 * default_uom come from tag_uom (same per-tag registry the OEM Limits tab
 * uses), falling back to trip_limit_tag_mapping's own uom only when tag_uom
 * has no entry for the tag. */
export interface TripTagInfo {
  tag_name: string;
  user_uom: string;
  default_uom: string;
  trip_direction: string;
}

export interface TripTagsApiResponse {
  ok: boolean;
  tags_by_sub_asset: Record<string, TripTagInfo[]>;
  error?: string | null;
}

/** One calculated sme_low/sme_high row from POST /preview-domain-limits. A
 * tag trained into more than one sub-asset's model gets one row per
 * referencing sub-asset, each independently computed from that sub-asset's
 * own training stats — is_home marks the one row /apply-domain-limits
 * actually honors (and propagates to every referencing model); the rest are
 * review-only. */
export interface SmeLimitRow {
  sub_asset_code: string;
  tag_name: string;
  sme_low: number | null;
  sme_high: number | null;
  is_home: boolean;
}

export interface PreviewDomainLimitsApiResponse {
  ok: boolean;
  rows: SmeLimitRow[];
  error?: string | null;
}

export interface ApplyDomainLimitsApiResponse {
  ok: boolean;
  updated_count: number;
  error?: string | null;
}

// ─── Post-onboarding "Trip Limit" review step — mirrors Domain Limits above ──

/** One resolved Trip Limit row from POST /preview-trip-limits. */
export interface TripLimitPreviewRow {
  sub_asset_code: string;
  tag_name: string;
  trip_limit: number | null;
  trip_direction: string;
  trip_limit_basis: string;
  run_model_on_recons_error: number;
}

export interface PreviewTripLimitsApiResponse {
  ok: boolean;
  rows: TripLimitPreviewRow[];
  error?: string | null;
}

export interface ApplyTripLimitsApiResponse {
  ok: boolean;
  updated_count: number;
  error?: string | null;
}

/** Raw GET /shutdown-date response. epoch is Unix seconds (UTC), or null if
 * session9_training._compute_shutdown_date() found no shutdown/gap. */
export interface ShutdownDateApiResponse {
  ok: boolean;
  epoch: number | null;
  error?: string | null;
}

export interface ApplyShutdownDateApiResponse {
  ok: boolean;
  error?: string | null;
}
