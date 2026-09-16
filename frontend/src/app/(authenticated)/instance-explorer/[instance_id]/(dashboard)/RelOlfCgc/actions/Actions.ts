"use server";

import { z } from "zod";
import prisma from "@/shared/libs/Prisma";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import { Prisma } from "@prisma/client";
import type {
  ApplyDomainLimitsApiResponse,
  ApplyShutdownDateApiResponse,
  ApplyTripLimitsApiResponse,
  OemTagInfo,
  OemTagsApiResponse,
  OnboardApiResponse,
  OnboardingSnapshot,
  OnboardProgressApiResponse,
  OnboardProgressStage,
  OnboardResult,
  PreviewDomainLimitsApiResponse,
  PreviewTripLimitsApiResponse,
  ShutdownDateApiResponse,
  SmeLimitRow,
  TripLimitPreviewRow,
  TripTagInfo,
  TripTagsApiResponse,
} from "../store/Types";
import { AfpWizardStateSchema } from "../config/ConfigSchemas";
import { buildConfigWorkbookBytes } from "../config/BuildWorkbook";
import { newWizardState, type AfpWizardState } from "../config/ConfigTypes";

// Local, long-running variant of fetchFastAPI — only /onboard needs this (its
// timeoutMs can run up to 15 minutes for Session 9's historian pull +
// autoencoder training). Node's global fetch (undici) kills any request after
// 5 minutes (headersTimeout/bodyTimeout default) independent of our own
// AbortController, so a custom dispatcher is needed above that threshold.
// Kept local rather than in the shared FastApiClient.ts — no other capability
// runs a call anywhere near 5 minutes, and src/shared/libs is app_dev-owned
// (mirrors AmmoniaReformer's own local fetchFastAPIRaw for the same reason).
const UNDICI_DEFAULT_HEADERS_TIMEOUT_MS = 300_000;

async function fetchFastAPILongRunning<T = unknown>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const baseUrl = process.env.FASTAPI_URL;
  if (!baseUrl) {
    throw new Error("FASTAPI_URL environment variable is missing.");
  }
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  let dispatcher: unknown;
  if (timeoutMs > UNDICI_DEFAULT_HEADERS_TIMEOUT_MS) {
    const { Agent } = await import("undici");
    dispatcher = new Agent({ headersTimeout: timeoutMs, bodyTimeout: timeoutMs });
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...fetchOptions,
      signal: controller.signal,
      ...(dispatcher ? ({ dispatcher } as Record<string, unknown>) : {}),
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });
    clearTimeout(id);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI Error ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`FastAPI Request Timeout after ${timeoutMs}ms to ${endpoint}`);
    }
    throw error;
  }
}

const InstanceIdSchema = z.number().int().positive();

const RunOnboardingInputSchema = z.object({
  instanceId: InstanceIdSchema,
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
});

// ── Model files registry (documentation/06 — output schema, not in Prisma) ────

/** Seed configurations.model_registry from the model_registry sheet the pipeline
 * writes into AFP_DB_Tables.xlsx — model_key === model_alias always for this
 * capability (see build_model_registry_table's docstring), unlike EG's DM/LBM
 * alias mapping. */
async function syncModelRegistry(instanceId: number): Promise<void> {
  const entries = await fetchFastAPI<{ model_key: string; model_alias: string; model_description: string }[]>(
    `rel-olf-cgc/model-registry-entries?instance_id=${instanceId}`
  );
  for (const entry of entries) {
    await prisma.model_registry.upsert({
      where: { instance_id_model_key: { instance_id: instanceId, model_key: entry.model_key } },
      update: { model_alias: entry.model_alias, model_description: entry.model_description },
      create: {
        instance_id: instanceId,
        model_key: entry.model_key,
        model_alias: entry.model_alias,
        model_description: entry.model_description,
      },
    });
  }
}

/** Push the trained model binaries (.joblib/.keras) FastAPI produced on local
 * disk into output.model_files_registry. Unlike EG, there is no browser upload
 * step — the bytes are pulled straight from FastAPI (base64-in-JSON, per
 * documentation/06's transfer rule) and inserted server-side. */
async function syncModelFilesRegistry(instanceId: number): Promise<void> {
  const files = await fetchFastAPI<{ model_alias: string; file_name: string; file_base64: string }[]>(
    `rel-olf-cgc/model-files?instance_id=${instanceId}`
  );
  for (const file of files) {
    const modelRows = await prisma.$queryRaw<{ model_id: number }[]>`
      SELECT model_id FROM configurations.model_registry
      WHERE instance_id = ${instanceId} AND model_key = ${file.model_alias}
      LIMIT 1
    `;
    const modelId = modelRows[0]?.model_id;
    if (!modelId) continue;
    const fileBytes = Buffer.from(file.file_base64, "base64");
    await prisma.$executeRaw`
      INSERT INTO output.model_files_registry
        (instance_id, model_id, model_file_display_name, file_name, model_data, model_metadata)
      VALUES (${instanceId}, ${modelId}, ${file.file_name}, ${file.file_name}, ${fileBytes}, NULL)
      ON CONFLICT (instance_id, model_id, file_name)
      DO UPDATE SET
        model_data = EXCLUDED.model_data,
        model_file_display_name = EXCLUDED.model_file_display_name,
        updated_at = now()
    `;
  }
}

/**
 * Upload a config workbook and run the AFP onboarding pipeline for one instance.
 * Persists the generated AFP_DB_Tables.xlsx (the pipeline-consumable output, per
 * documentation/05's contract) + result as the instance's configuration snapshot.
 * `wizardState`, when the run came from the config wizard, rides along in the
 * snapshot so documentation/04's draft->snapshot->defaults resume precedence
 * can rebuild the form after its draft is cleared on a successful submit.
 */
export async function runOnboarding(
  instanceId: number,
  fileName: string,
  fileBase64: string,
  wizardState?: AfpWizardState
): Promise<OnboardResult> {
  const valid = RunOnboardingInputSchema.parse({ instanceId, fileName, fileBase64 });
  const validWizardState = wizardState ? AfpWizardStateSchema.parse(wizardState) : undefined;

  const result = await fetchFastAPILongRunning<OnboardApiResponse>("rel-olf-cgc/onboard", {
    method: "POST",
    body: JSON.stringify({
      instance_id: String(valid.instanceId),
      file_name: valid.fileName,
      file_base64: valid.fileBase64,
    }),
    // Sessions 1-9 run synchronously incl. historian queries + autoencoder training
    // per sub-asset — 5min was too tight and aborted a run that the backend went on
    // to finish anyway (confirmed via fastapi_server.log: 200 OK after client abort).
    timeoutMs: 15 * 60 * 1000,
  });
  const ranAt = new Date().toISOString();

  // Workbook bytes come back as a separate raw fetch, not JSON — per
  // documentation/05's binary-transfer contract (a partial workbook can exist
  // even after a failed run, so this is attempted regardless of result.ok).
  const workbookRes = await fetch(
    `${process.env.FASTAPI_URL}/rel-olf-cgc/onboard-workbook?instance_id=${valid.instanceId}`
  );
  const workbookBytes = workbookRes.ok ? Buffer.from(await workbookRes.arrayBuffer()) : null;

  // instance_id is @unique on InstanceConfiguration (row already seeded at instance
  // creation from the blueprint) — update in place, create only if somehow absent.
  const existing = await prisma.instanceConfiguration.findFirst({
    where: { instanceId: valid.instanceId },
  });
  const prevSnapshot = (existing?.ui_config_data as unknown as OnboardingSnapshot | null) ?? null;

  const snapshot: OnboardingSnapshot = {
    fileName: valid.fileName,
    ranAt,
    result,
    ...(validWizardState ? { wizardState: validWizardState as AfpWizardState } : {}),
    // Carry the last SUCCESSFUL run forward on a failed re-run — otherwise this
    // attempt's failure would overwrite the only record of an earlier success.
    lastSuccessfulRun: result.ok ? { fileName: valid.fileName, ranAt, result } : prevSnapshot?.lastSuccessfulRun,
  };

  const ui_config_data = snapshot as unknown as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data: {
        ui_config_data,
        // Only overwrite the generated workbook if this run actually produced one —
        // a very-early failure leaves the prior snapshot's workbook untouched.
        ...(workbookBytes ? { pipeline_config_data: new Uint8Array(workbookBytes) } : {}),
      },
    });
  } else {
    await prisma.instanceConfiguration.create({
      data: {
        instanceId: valid.instanceId,
        ui_config_data,
        pipeline_config_data: workbookBytes ? new Uint8Array(workbookBytes) : new Uint8Array(),
      },
    });
  }

  // documentation/06 — seed model metadata, then push trained binaries, best
  // effort: model_registry is written as early as Session 1, so it can be
  // non-empty even when a later stage fails; model files only exist once
  // Session 9 training actually ran.
  await syncModelRegistry(valid.instanceId);
  await syncModelFilesRegistry(valid.instanceId);

  return result;
}

/**
 * Build the AFP config workbook from the configuration wizard's state and run
 * onboarding against it — the wizard replaces needing to already have a
 * hand-built Excel file. Delegates entirely to runOnboarding() so the FastAPI
 * call, snapshot persistence, and result handling stay in exactly one place.
 *
 * Does NOT clear the draft on success (unlike before the "Domain Limits" step
 * existed) — OEM Limits/Trip Limit are now filled in AFTER this run succeeds
 * (step 8), so the draft must survive until applyDomainLimits() finishes.
 */
export async function runOnboardingFromWizard(
  instanceId: number,
  fileName: string,
  wizardState: AfpWizardState
): Promise<OnboardResult> {
  const validState = AfpWizardStateSchema.parse(wizardState) as AfpWizardState;
  const bytes = buildConfigWorkbookBytes(validState);
  const fileBase64 = Buffer.from(bytes).toString("base64");
  return runOnboarding(instanceId, fileName, fileBase64, validState);
}

/**
 * Generate the draft PI + Inferred tag list (kpi_draft_pi/kpi_draft_inferred)
 * from the Machine Config sheet of a workbook built from the CURRENT wizard
 * state — called right after the Machine Config step validates, well before
 * Sensor Mapping or Run Onboarding, so Sensor Mapping has real rows to show.
 * buildConfigWorkbookBytes() tolerates the unfilled downstream steps fine
 * (every macro push is individually guarded against missing values).
 */
export async function generateKpiDraft(
  instanceId: number,
  wizardState: AfpWizardState
): Promise<{ ok: boolean; piCount: number; inferredCount: number }> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validState = AfpWizardStateSchema.parse(wizardState) as AfpWizardState;
  const bytes = buildConfigWorkbookBytes(validState);
  const fileBase64 = Buffer.from(bytes).toString("base64");

  const res = await fetchFastAPI<{
    ok: boolean;
    pi_count: number;
    inferred_count: number;
    error?: string | null;
  }>("rel-olf-cgc/generate-kpi-draft", {
    method: "POST",
    body: JSON.stringify({ instance_id: String(validId), file_base64: fileBase64 }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to generate KPI draft");
  return { ok: true, piCount: res.pi_count, inferredCount: res.inferred_count };
}

export interface KpiDraftPiRow {
  subAsset: string;
  mainSubasset: string;
  originalPiTag: string;
  piTag: string;
  uom: string;
}

/** The generated kpi_draft_pi rows Sensor Mapping (step 6) reads from,
 * keyed by mainSubasset (physical sub-asset, e.g. "LP_Mechanical") — not the
 * raw Sub_Asset cross-reference label. */
export async function getKpiDraft(instanceId: number): Promise<KpiDraftPiRow[]> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<{
    ok: boolean;
    rows: { sub_asset: string; main_subasset: string; original_pi_tag: string; pi_tag: string; uom: string }[];
    error?: string | null;
  }>(`rel-olf-cgc/kpi-draft?instance_id=${validId}`);
  if (!res.ok) throw new Error(res.error || "Failed to fetch KPI draft");
  return res.rows.map((r) => ({
    subAsset: r.sub_asset,
    mainSubasset: r.main_subasset,
    originalPiTag: r.original_pi_tag,
    piTag: r.pi_tag,
    uom: r.uom,
  }));
}

/** Poll target for StepReview.tsx's live progress stepper while a run is in
 * flight — reads the FastAPI process's in-memory stage tracker, a separate
 * fast GET so the UI doesn't have to wait on the long-running /onboard POST. */
export async function getOnboardProgress(instanceId: number): Promise<{
  overallStatus: "idle" | "running" | "done" | "error";
  stages: OnboardProgressStage[];
}> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<OnboardProgressApiResponse>(
    `rel-olf-cgc/onboard-progress?instance_id=${validId}`
  );
  if (!res.ok) throw new Error(res.error || "Failed to fetch onboarding progress");
  return { overallStatus: res.overall_status, stages: res.stages };
}

// ── Draft persistence (documentation/04 — instance_configuration_drafts) ──────

/** Upsert: find the instance's draft row -> update it, else create it.
 * One mutable row per instance_id, not versioned. */
export async function saveDraft(
  instanceId: number,
  wizardState: AfpWizardState,
  currentStep?: string | null
): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validState = AfpWizardStateSchema.parse(wizardState);
  const draft_data = validState as unknown as Prisma.InputJsonValue;

  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: validId },
  });
  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      // updated_at has no @updatedAt in the schema — Prisma won't bump it
      // automatically on update, so it must be set explicitly here.
      data: { draft_data, current_step: currentStep ?? null, updated_at: new Date() },
    });
  } else {
    await prisma.instance_configuration_drafts.create({
      data: { instance_id: validId, draft_data, current_step: currentStep ?? null },
    });
  }
}

/** Read the current draft (or null). */
export async function getDraft(
  instanceId: number
): Promise<{ data: AfpWizardState; currentStep: string | null; updatedAt: string } | null> {
  const validId = InstanceIdSchema.parse(instanceId);
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (!draft) return null;
  const data = AfpWizardStateSchema.parse(draft.draft_data) as AfpWizardState;
  return { data, currentStep: draft.current_step, updatedAt: draft.updated_at.toISOString() };
}

/** Delete the instance's draft (e.g. after a successful onboarding run). */
export async function clearDraft(instanceId: number): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  await prisma.instance_configuration_drafts.deleteMany({ where: { instance_id: validId } });
}

/** Resume loader: live draft -> last submitted snapshot -> defaults. */
export async function loadInitialConfig(
  instanceId: number
): Promise<{ data: AfpWizardState; currentStep: string | null; source: "draft" | "snapshot" | "default" }> {
  const validId = InstanceIdSchema.parse(instanceId);

  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (draft) {
    const data = AfpWizardStateSchema.parse(draft.draft_data) as AfpWizardState;
    return { data, currentStep: draft.current_step, source: "draft" };
  }

  const snap = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } });
  const snapData = snap?.ui_config_data as unknown as OnboardingSnapshot | undefined;
  if (snapData?.wizardState) {
    return { data: snapData.wizardState, currentStep: null, source: "snapshot" };
  }

  return { data: newWizardState(), currentStep: null, source: "default" };
}

// ── Post-onboarding "Domain Limits" review step (wizard step 8) ─────────────
// OEM Limits / Trip Limit are filled in AFTER a successful Run Onboarding,
// scoped to only the tags confirmed relevant for this instance instead of the
// full static template list — see router.py's 4 new /domain-limits endpoints.

/** tag_alias, per sub-asset code, confirmed as active autoencoder tags after
 * the last onboarding run — shown directly on the Domain Limits step's OEM
 * Limits tab, no template/catalog matching. */
export async function getConfirmedAutoencoderTags(instanceId: number): Promise<Record<string, OemTagInfo[]>> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<OemTagsApiResponse>(
    `rel-olf-cgc/confirmed-autoencoder-tags?instance_id=${validId}`
  );
  if (!res.ok) throw new Error(res.error || "Failed to fetch confirmed autoencoder tags");
  return res.tags_by_sub_asset;
}

/** affiliate_specific_tag, per sub-asset code, from trip_limit_tag_mapping —
 * shown directly on the Domain Limits step's Trip Limit tab, no
 * template/catalog matching. */
export async function getEvaluatedTripTags(instanceId: number): Promise<Record<string, TripTagInfo[]>> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<TripTagsApiResponse>(
    `rel-olf-cgc/evaluated-trip-tags?instance_id=${validId}`
  );
  if (!res.ok) throw new Error(res.error || "Failed to fetch evaluated trip tags");
  return res.tags_by_sub_asset;
}

const OemLimitSubmissionSchema = z.object({
  subAssetCode: z.string(),
  group: z.string(),
  parameter: z.string(),
  userUom: z.string(),
  defaultUom: z.string(),
  designLow: z.union([z.number(), z.literal("")]),
  designHigh: z.union([z.number(), z.literal("")]),
  rated: z.union([z.number(), z.literal("")]),
});
export type OemLimitSubmission = z.infer<typeof OemLimitSubmissionSchema>;

/**
 * Write the OEM Design Low/High/Rated edits straight into the design_limits
 * table (no workbook rebuild/re-upload) and recompute sme_low/sme_high WITHOUT
 * persisting them yet — the caller shows the calculated values for review/
 * edit before applyDomainLimits() actually writes them.
 */
export async function previewDomainLimits(
  instanceId: number,
  oemLimits: OemLimitSubmission[]
): Promise<SmeLimitRow[]> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validRows = z.array(OemLimitSubmissionSchema).parse(oemLimits);
  const res = await fetchFastAPI<PreviewDomainLimitsApiResponse>("rel-olf-cgc/preview-domain-limits", {
    method: "POST",
    body: JSON.stringify({
      instance_id: String(validId),
      oem_limits: validRows.map((r) => ({
        sub_asset_code: r.subAssetCode,
        group: r.group,
        parameter: r.parameter,
        user_uom: r.userUom,
        default_uom: r.defaultUom,
        design_low: r.designLow === "" ? null : r.designLow,
        design_high: r.designHigh === "" ? null : r.designHigh,
        rated: r.rated === "" ? null : r.rated,
      })),
    }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to preview domain limits");
  return res.rows;
}

const ApplySmeLimitSchema = z.object({
  subAssetCode: z.string(),
  tagName: z.string(),
  smeLow: z.number().nullable(),
  smeHigh: z.number().nullable(),
});
export type ApplySmeLimitInput = z.infer<typeof ApplySmeLimitSchema>;

/**
 * Persist the user-confirmed (possibly edited) sme_low/sme_high values into
 * deviation_detection_tag_details — exactly what was shown/edited, not a
 * silent server-side recompute that would discard the user's override.
 *
 * Then folds the final OEM/Trip Limit state into the instance's snapshot
 * (ui_config_data.wizardState) — required, since clearDraft() below would
 * otherwise lose these values forever (the snapshot was written back at
 * Run-Onboarding time, before these values existed) — and finally clears the
 * draft, since this is the flow's terminal action.
 */
export async function applyDomainLimits(
  instanceId: number,
  rows: ApplySmeLimitInput[],
  wizardState: AfpWizardState
): Promise<{ ok: boolean; updatedCount: number }> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validRows = z.array(ApplySmeLimitSchema).parse(rows);
  const validState = AfpWizardStateSchema.parse(wizardState) as AfpWizardState;

  const res = await fetchFastAPI<ApplyDomainLimitsApiResponse>("rel-olf-cgc/apply-domain-limits", {
    method: "POST",
    body: JSON.stringify({
      instance_id: String(validId),
      rows: validRows.map((r) => ({
        sub_asset_code: r.subAssetCode,
        tag_name: r.tagName,
        sme_low: r.smeLow,
        sme_high: r.smeHigh,
      })),
    }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to apply domain limits");

  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } });
  if (existing) {
    const prevSnapshot = existing.ui_config_data as unknown as OnboardingSnapshot | null;
    const updatedSnapshot: OnboardingSnapshot = {
      ...(prevSnapshot ?? { fileName: "", ranAt: new Date().toISOString(), result: { ok: true, log: "" } }),
      wizardState: validState,
      domainLimitsAppliedAt: new Date().toISOString(),
    };
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data: { ui_config_data: updatedSnapshot as unknown as Prisma.InputJsonValue },
    });
  }

  await clearDraft(validId);
  return { ok: true, updatedCount: res.updated_count };
}

const TripLimitSubmissionSchema = z.object({
  subAssetCode: z.string(),
  group: z.string(),
  parameter: z.string(),
  userUom: z.string(),
  defaultUom: z.string(),
  tripLimit: z.union([z.number(), z.literal("")]),
  tripDirection: z.string(),
  tripLimitBasis: z.string(),
});
export type TripLimitSubmission = z.infer<typeof TripLimitSubmissionSchema>;

/**
 * Write the Trip Limit/Direction/Basis edits straight into the trip_limits
 * table (no workbook rebuild/re-upload) and resolve which actually-evaluated
 * tags each submitted template maps to, WITHOUT persisting into
 * failure_prediction_tag_details yet — mirrors previewDomainLimits() exactly.
 */
export async function previewTripLimits(
  instanceId: number,
  tripLimits: TripLimitSubmission[]
): Promise<TripLimitPreviewRow[]> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validRows = z.array(TripLimitSubmissionSchema).parse(tripLimits);
  const res = await fetchFastAPI<PreviewTripLimitsApiResponse>("rel-olf-cgc/preview-trip-limits", {
    method: "POST",
    body: JSON.stringify({
      instance_id: String(validId),
      trip_limits: validRows.map((r) => ({
        sub_asset_code: r.subAssetCode,
        group: r.group,
        parameter: r.parameter,
        user_uom: r.userUom,
        default_uom: r.defaultUom,
        trip_limit: r.tripLimit === "" ? null : r.tripLimit,
        trip_direction: r.tripDirection,
        trip_limit_basis: r.tripLimitBasis,
      })),
    }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to preview trip limits");
  return res.rows;
}

const ApplyTripLimitSchema = z.object({
  subAssetCode: z.string(),
  tagName: z.string(),
  tripLimit: z.number().nullable(),
  tripDirection: z.string(),
  tripLimitBasis: z.string(),
  runModelOnReconsError: z.number(),
});
export type ApplyTripLimitInput = z.infer<typeof ApplyTripLimitSchema>;

/**
 * Persist the user-confirmed Trip Limit rows into failure_prediction_tag_details
 * — mirrors applyDomainLimits() exactly, including folding the final wizard
 * state into the instance snapshot and clearing the draft.
 */
export async function applyTripLimits(
  instanceId: number,
  rows: ApplyTripLimitInput[],
  wizardState: AfpWizardState
): Promise<{ ok: boolean; updatedCount: number }> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validRows = z.array(ApplyTripLimitSchema).parse(rows);
  const validState = AfpWizardStateSchema.parse(wizardState) as AfpWizardState;

  const res = await fetchFastAPI<ApplyTripLimitsApiResponse>("rel-olf-cgc/apply-trip-limits", {
    method: "POST",
    body: JSON.stringify({
      instance_id: String(validId),
      rows: validRows.map((r) => ({
        sub_asset_code: r.subAssetCode,
        tag_name: r.tagName,
        trip_limit: r.tripLimit,
        trip_direction: r.tripDirection,
        trip_limit_basis: r.tripLimitBasis,
        run_model_on_recons_error: r.runModelOnReconsError,
      })),
    }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to apply trip limits");

  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } });
  if (existing) {
    const prevSnapshot = existing.ui_config_data as unknown as OnboardingSnapshot | null;
    const updatedSnapshot: OnboardingSnapshot = {
      ...(prevSnapshot ?? { fileName: "", ranAt: new Date().toISOString(), result: { ok: true, log: "" } }),
      wizardState: validState,
      tripLimitsAppliedAt: new Date().toISOString(),
    };
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data: { ui_config_data: updatedSnapshot as unknown as Prisma.InputJsonValue },
    });
  }

  await clearDraft(validId);
  return { ok: true, updatedCount: res.updated_count };
}

// ── Last Asset Shutdown Date (auto-computed by session9_training, user-reviewable) ──

/** Unix epoch (seconds, UTC), or null if no shutdown/gap was found — read
 * straight from config_macros' last_asset_shutdown_date row for the main asset. */
export async function getShutdownDate(instanceId: number): Promise<number | null> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<ShutdownDateApiResponse>(`rel-olf-cgc/shutdown-date?instance_id=${validId}`);
  if (!res.ok) throw new Error(res.error || "Failed to fetch shutdown date");
  return res.epoch;
}

/** Direct save (no preview step — this is a single value, not a per-tag
 * review table like OEM/Trip) — epoch=null clears it back to blank. */
export async function applyShutdownDate(instanceId: number, epoch: number | null): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const res = await fetchFastAPI<ApplyShutdownDateApiResponse>("rel-olf-cgc/apply-shutdown-date", {
    method: "POST",
    body: JSON.stringify({ instance_id: String(validId), epoch }),
  });
  if (!res.ok) throw new Error(res.error || "Failed to apply shutdown date");
}
