"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import prisma from "@/shared/libs/Prisma";
import { SYSTEM_DISPLAY_NAME } from "../Constants";
import type {
  BlueprintResponse,
  AttributeRow,
  UomRow,
  ConstraintRow,
  QuestionRow,
  HierarchyNode,
  FlatNode,
  SensorMappingRow,
  CoverageStats,
  KpiPackage,
  CalcAlternativeGroup,
  DraftConfigPayload,
  HydrateConfigResponse,
} from "../types/Index";
import type {
  BuildFramesResponse,
  TopologyStateResponse,
  StreamSensorsResponse,
  CalcResolutionResponse,
} from "../api/Index";

// ── Instance ID header helper ──────────────────────────────────────────────────
// All actions receive instanceId from the Jotai store (via atoms) and forward it
// to FastAPI via the X-Instance-ID header so the backend can scope session state.

function instanceHeaders(instanceId: number): HeadersInit {
  return { "X-Instance-ID": instanceId.toString() };
}

// ── Raw FastAPI fetch helper (capability-local) ────────────────────────────────
// Like the shared fetchFastAPI, but returns the raw Response instead of parsed
// JSON and does NOT throw on non-2xx — callers inspect res.ok/status and read the
// body themselves (json/arrayBuffer/headers). No default Content-Type is set so
// FormData (multipart file uploads) keeps its auto-generated boundary. Lives here
// because src/shared/libs is app_dev-owned.

async function fetchFastAPIRaw(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const baseUrl = process.env.FASTAPI_URL;
  if (!baseUrl) {
    throw new Error("FASTAPI_URL environment variable is missing.");
  }

  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`FastAPI Request Timeout after ${timeoutMs}ms to ${endpoint}`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

const instanceIdSchema = z.number().int().positive();

// ── Blueprint actions ──────────────────────────────────────────────────────────

export async function uploadBlueprintAction(instanceId: number, formData: FormData): Promise<BlueprintResponse> {
  const qs = `?system_name=${encodeURIComponent(SYSTEM_DISPLAY_NAME)}`;
  const res = await fetchFastAPIRaw(`ammonia-reformer/blueprint/upload${qs}`, {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  return res.json();
}

export async function createBlueprintAction(instanceId: number): Promise<BlueprintResponse> {
  return fetchFastAPI<BlueprintResponse>("ammonia-reformer/blueprint/create", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function loadCurrentBlueprintAction(instanceId: number): Promise<BlueprintResponse> {
  return fetchFastAPI<BlueprintResponse>("ammonia-reformer/blueprint/current", {
    headers: instanceHeaders(instanceId),
  });
}

export async function updateAttributesAction(instanceId: number, rows: AttributeRow[]): Promise<void> {
  await fetchFastAPI("ammonia-reformer/blueprint/attributes", {
    method: "PUT",
    body: JSON.stringify({ rows }),
    headers: instanceHeaders(instanceId),
  });
}

export async function updateUomAction(instanceId: number, rows: UomRow[]): Promise<void> {
  await fetchFastAPI("ammonia-reformer/blueprint/uom", {
    method: "PUT",
    body: JSON.stringify({ rows }),
    headers: instanceHeaders(instanceId),
  });
}

export async function updateConstraintsAction(instanceId: number, rows: ConstraintRow[]): Promise<void> {
  await fetchFastAPI("ammonia-reformer/blueprint/constraints", {
    method: "PUT",
    body: JSON.stringify({ rows }),
    headers: instanceHeaders(instanceId),
  });
}

export async function updateQuestionsAction(instanceId: number, rows: QuestionRow[]): Promise<void> {
  await fetchFastAPI("ammonia-reformer/blueprint/questions", {
    method: "PUT",
    body: JSON.stringify({ rows }),
    headers: instanceHeaders(instanceId),
  });
}

export async function validateBlueprintAction(instanceId: number): Promise<{ errors: string[]; warnings: string[] }> {
  return fetchFastAPI<{ errors: string[]; warnings: string[] }>("ammonia-reformer/blueprint/validate", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function downloadBlueprintAction(instanceId: number): Promise<{ base64: string; filename: string }> {
  const res = await fetchFastAPIRaw("ammonia-reformer/blueprint/download", {
    headers: instanceHeaders(instanceId),
  });
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentDisposition = res.headers.get("content-disposition") ?? "";
  const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1] ?? "blueprint_config.xlsx";
  return { base64, filename };
}

export async function listSavedBlueprintsAction(instanceId: number): Promise<{ files: string[] }> {
  return fetchFastAPI<{ files: string[] }>("ammonia-reformer/blueprint/saved", {
    headers: instanceHeaders(instanceId),
  });
}

export async function getFileSystemsAction(
  instanceId: number,
  filename: string
): Promise<{ systems: { pathSegment: string; systemName: string }[] }> {
  return fetchFastAPI(
    `ammonia-reformer/blueprint/saved/${encodeURIComponent(filename)}/systems`,
    { headers: instanceHeaders(instanceId) }
  );
}

export async function saveBlueprintAsAction(instanceId: number): Promise<{ saved: { filename: string; systemName: string }[] }> {
  return fetchFastAPI<{ saved: { filename: string; systemName: string }[] }>(
    "ammonia-reformer/blueprint/save-as",
    { method: "POST", headers: instanceHeaders(instanceId) }
  );
}

export async function loadSavedBlueprintAction(
  instanceId: number,
  filename: string,
  opts?: { system?: string; merge?: boolean }
): Promise<BlueprintResponse> {
  const params = new URLSearchParams();
  if (opts?.system) params.set("system", opts.system);
  if (opts?.merge) params.set("merge", "true");
  if (!opts?.merge) params.set("system_name", SYSTEM_DISPLAY_NAME);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return fetchFastAPI<BlueprintResponse>(
    `ammonia-reformer/blueprint/load-saved/${encodeURIComponent(filename)}${qs}`,
    { method: "POST", headers: instanceHeaders(instanceId) }
  );
}

// ── Hierarchy actions ──────────────────────────────────────────────────────────

export async function getWizardStateAction(instanceId: number) {
  return fetchFastAPI("ammonia-reformer/hierarchy/wizard-state", {
    headers: instanceHeaders(instanceId),
  });
}

export async function navigateWizardAction(
  instanceId: number,
  mode: string,
  activeElement?: string,
  elementStep?: number,
  instanceIdx?: number
) {
  return fetchFastAPI("ammonia-reformer/hierarchy/wizard-navigate", {
    method: "POST",
    body: JSON.stringify({ mode, activeElement, elementStep, ...(instanceIdx !== undefined && { instanceIdx }) }),
    headers: instanceHeaders(instanceId),
  });
}

export async function submitWizardAnswerAction(
  instanceId: number,
  questionId: string,
  elementLevel: string,
  answer: string,
  instIdx?: number
) {
  return fetchFastAPI("ammonia-reformer/hierarchy/wizard-answer", {
    method: "POST",
    body: JSON.stringify({ questionId, elementLevel, answer, instIdx: instIdx ?? null }),
    headers: instanceHeaders(instanceId),
  });
}

export async function updateWizardCountAction(
  instanceId: number,
  parentLevel: string,
  childLevel: string,
  delta: number,
  elLevel?: string,
  instIdx?: number
) {
  return fetchFastAPI("ammonia-reformer/hierarchy/wizard-count", {
    method: "POST",
    body: JSON.stringify({ parentLevel, childLevel, delta, elLevel, instIdx: instIdx ?? null }),
    headers: instanceHeaders(instanceId),
  });
}

export async function configureElementAction(instanceId: number, elementLevel: string) {
  return fetchFastAPI("ammonia-reformer/hierarchy/configure-element", {
    method: "POST",
    body: JSON.stringify({ elementLevel }),
    headers: instanceHeaders(instanceId),
  });
}

export async function deleteElementAction(instanceId: number, elementLevel: string) {
  return fetchFastAPI("ammonia-reformer/hierarchy/delete-element", {
    method: "POST",
    body: JSON.stringify({ elementLevel }),
    headers: instanceHeaders(instanceId),
  });
}

export async function buildHierarchyAction(instanceId: number, rootName?: string): Promise<{ root: HierarchyNode; flatNodes: FlatNode[]; nodeCount: number }> {
  return fetchFastAPI("ammonia-reformer/hierarchy/build", {
    method: "POST",
    body: JSON.stringify({ rootName }),
    headers: instanceHeaders(instanceId),
  });
}

export async function loadHierarchyAction(instanceId: number, formData: FormData) {
  const res = await fetchFastAPIRaw("ammonia-reformer/hierarchy/load", {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  return res.json();
}

export async function resetHierarchyAction(instanceId: number) {
  return fetchFastAPI("ammonia-reformer/hierarchy/reset", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function newPlantResetAction(instanceId: number) {
  return fetchFastAPI("ammonia-reformer/hierarchy/new-plant-reset", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function getCurrentHierarchyAction(instanceId: number) {
  return fetchFastAPI("ammonia-reformer/hierarchy/current", {
    headers: instanceHeaders(instanceId),
  });
}

export async function validateHierarchyAction(instanceId: number) {
  return fetchFastAPI("ammonia-reformer/hierarchy/validate", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function uploadHierarchyConfigAction(instanceId: number, formData: FormData): Promise<{
  root: HierarchyNode;
  flatNodes: FlatNode[];
  databaseName: string;
  systemName: string;
  savedAs: string;
  blueprintLoaded: boolean;
}> {
  const res = await fetchFastAPIRaw("ammonia-reformer/hierarchy/upload-config", {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  return res.json();
}

// ── Sensor mapping actions ─────────────────────────────────────────────────────

export async function getSensorMappingAction(instanceId: number): Promise<{ rows: SensorMappingRow[]; coverage: CoverageStats }> {
  return fetchFastAPI("ammonia-reformer/sensors/mapping", {
    headers: instanceHeaders(instanceId),
  });
}

export async function updateSensorMappingAction(instanceId: number, rows: SensorMappingRow[]): Promise<{ coverage?: CoverageStats }> {
  return fetchFastAPI("ammonia-reformer/sensors/mapping", {
    method: "PUT",
    body: JSON.stringify({ rows }),
    headers: instanceHeaders(instanceId),
  });
}

export async function uploadSensorMappingAction(instanceId: number, formData: FormData): Promise<{
  rows: SensorMappingRow[];
  coverage: CoverageStats;
  report: { matched: number; skipped: number; total_template: number };
}> {
  const res = await fetchFastAPIRaw("ammonia-reformer/sensors/mapping/upload", {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function uploadPipelineInputAction(instanceId: number, formData: FormData): Promise<{
  rows: SensorMappingRow[];
  coverage: CoverageStats;
  report: { matched: number; skipped: number; total_template: number };
}> {
  const res = await fetchFastAPIRaw("ammonia-reformer/sensors/mapping/upload-pipeline-input", {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function updateCalcOverridesAction(
  instanceId: number,
  overrides: { elementPath: string; elementCode: string; outputAttrName: string; enabled: boolean }[]
): Promise<unknown> {
  return fetchFastAPI("ammonia-reformer/sensors/overrides", {
    method: "PUT",
    body: JSON.stringify({ overrides }),
    headers: instanceHeaders(instanceId),
  });
}

// ── Export actions ─────────────────────────────────────────────────────────────

export async function buildFramesAction(instanceId: number): Promise<BuildFramesResponse> {
  return fetchFastAPI("ammonia-reformer/export/build-frames", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

export async function downloadEffOutputAction(
  instanceId: number,
  startDate?: string,
): Promise<{ base64: string; filename: string }> {
  const qs = startDate ? `?start_date=${encodeURIComponent(startDate)}` : "";
  const res = await fetchFastAPIRaw(`ammonia-reformer/export/eff-output${qs}`, {
    headers: instanceHeaders(instanceId),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `EFF export failed (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, filename: "EFF_output.xlsx" };
}

export async function downloadPipelineInputAction(instanceId: number): Promise<{ base64: string; filename: string }> {
  const res = await fetchFastAPIRaw("ammonia-reformer/export/pipeline-input", {
    headers: instanceHeaders(instanceId),
  });
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, filename: "sensor_mapping.xlsx" };
}

// ── Pipeline / KPI run actions ─────────────────────────────────────────────────

export async function getCalcRequirementsAction(instanceId: number): Promise<{
  requirements: Record<string, {
    required: string[];
    optional: string[];
    optional_groups: {
      label: string;
      note: string;
      sensors: { attr: string; level: string | null; parent: string | null; path: string }[];
    }[];
    required_sensor_paths: { attr: string; level: string | null; parent: string | null; path: string }[];
    optional_sensor_paths: { attr: string; level: string | null; parent: string | null; path: string }[];
  }>;
}> {
  return fetchFastAPI("ammonia-reformer/run/calc-requirements", {
    headers: instanceHeaders(instanceId),
  });
}

export async function getCalcOptionalityAction(instanceId: number): Promise<{ sensor_alternatives: CalcAlternativeGroup[] }> {
  return fetchFastAPI("ammonia-reformer/run/calc-optionality", {
    headers: instanceHeaders(instanceId),
  });
}

export async function getCalcBlueprintAction(instanceId: number, systemName?: string) {
  const qs = systemName ? `?system_name=${encodeURIComponent(systemName)}` : "";
  return fetchFastAPI(`ammonia-reformer/run/calc-blueprint${qs}`, {
    headers: instanceHeaders(instanceId),
  });
}

export async function getKpiPackagesAction(instanceId: number): Promise<{ packages: KpiPackage[] }> {
  return fetchFastAPI("ammonia-reformer/run/kpi-packages", {
    headers: instanceHeaders(instanceId),
  });
}

export type ResolvedTag = {
  tag: string;
  path: string;
  attribute: string;
  direction?: string | number;
  decimal?: number;
  iterations?: { iter: number; min_tol: number; max_tol: number }[];
  pillar?: string;
  weight?: number;
  flag_scale_tag?: boolean;
  type?: string | null;
};

export type ResolvedOdsRule = {
  cause_tag: string;
  effect_tag: string;
  cause_monitoring_tag: string;
  effect_monitoring_tag: string;
  message?: string | null;
  message_category?: string | null;
  actionable_tolerance?: number | null;
  cause_condition?: string | null;
  effect_condition?: string | null;
};

export type ResolvedModel = {
  id: string;
  label: string;
  ready: boolean;
  missing: string[];
  groups: Record<string, ResolvedTag[]>;
  ods_rules?: ResolvedOdsRule[];
};

export async function getModelBlueprintStatusAction(
  instanceId: number,
  startDate?: string,
): Promise<{
  version: string;
  models: ResolvedModel[];
  blueprint_found: boolean;
  start_date?: string;
  error?: string;
}> {
  const qs = startDate ? `?start_date=${encodeURIComponent(startDate)}` : "";
  return fetchFastAPI(`ammonia-reformer/models/status${qs}`, {
    headers: instanceHeaders(instanceId),
  });
}

// ── Topology actions ─────────────────────────────────────────────────────────

export async function getTopologyStateAction(instanceId: number): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/state", {
    headers: instanceHeaders(instanceId),
  });
}

export async function reorderTopologyChainAction(
  instanceId: number,
  chainId: string,
  orderedNodes: { id: string; inPort: string; outPort: string }[],
): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/reorder-chain", {
    method: "POST",
    body: JSON.stringify({ chainId, orderedNodes }),
    headers: instanceHeaders(instanceId),
  });
}

export async function connectTopologyAction(
  instanceId: number,
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string,
  service: string,
  measurements: string[],
): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/connect", {
    method: "POST",
    body: JSON.stringify({ sourceNodeId, sourcePort, targetNodeId, targetPort, service, measurements }),
    headers: instanceHeaders(instanceId),
  });
}

export async function disconnectTopologyAction(instanceId: number, streamId: string): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/disconnect", {
    method: "POST",
    body: JSON.stringify({ streamId }),
    headers: instanceHeaders(instanceId),
  });
}

export async function rebuildTopologyAction(instanceId: number): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/rebuild", {
    method: "POST",
    headers: instanceHeaders(instanceId),
  });
}

// NOTE: the old `saveTopologyAction` (POST /topology/save → system+plant disk sidecar) was
// removed — it was not instance-scoped. Topology now persists per-instance in the DB draft
// (serialize/hydrate autosave); the Connectivity "Save" button force-flushes via `flushDraftAtom`.

export async function uploadTopologyAction(instanceId: number, formData: FormData): Promise<TopologyStateResponse> {
  const res = await fetchFastAPIRaw("ammonia-reformer/topology/upload", {
    method: "POST",
    body: formData,
    headers: instanceHeaders(instanceId),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to upload topology config");
  }
  return res.json();
}

export async function setTopologyLayoutAction(
  instanceId: number,
  positions: Record<string, { x: number; y: number } | null>,
): Promise<TopologyStateResponse> {
  return fetchFastAPI<TopologyStateResponse>("ammonia-reformer/topology/layout", {
    method: "POST",
    body: JSON.stringify({ positions }),
    headers: instanceHeaders(instanceId),
  });
}

export async function getStreamSensorsAction(instanceId: number): Promise<StreamSensorsResponse> {
  return fetchFastAPI<StreamSensorsResponse>("ammonia-reformer/topology/sensors", {
    headers: instanceHeaders(instanceId),
  });
}

export async function setStreamSensorAction(
  instanceId: number,
  streamId: string,
  measurement: string,
  tag: string,
): Promise<StreamSensorsResponse> {
  return fetchFastAPI<StreamSensorsResponse>("ammonia-reformer/topology/sensor", {
    method: "PUT",
    body: JSON.stringify({ streamId, measurement, tag }),
    headers: instanceHeaders(instanceId),
  });
}

export async function getCalcResolutionAction(instanceId: number): Promise<CalcResolutionResponse> {
  return fetchFastAPI<CalcResolutionResponse>("ammonia-reformer/topology/calc-resolution", {
    headers: instanceHeaders(instanceId),
  });
}

// ── DB Draft actions (instance_configuration_drafts) ──────────────────────────

const draftSaveSchema = z.object({
  instanceId: instanceIdSchema,
  draftData: z.record(z.string(), z.unknown()),
  currentStep: z.string().optional(),
});

export async function saveDraftAction(
  instanceId: number,
  draftData: Record<string, unknown>,
  currentStep?: string
): Promise<void> {
  const { instanceId: id, draftData: data, currentStep: step } = draftSaveSchema.parse({
    instanceId,
    draftData,
    currentStep,
  });

  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: id },
    select: { instance_configuration_draft_id: true },
  });

  const draftJson = data as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      data: { draft_data: draftJson, current_step: step ?? null, updated_at: new Date() },
    });
  } else {
    await prisma.instance_configuration_drafts.create({
      data: { instance_id: id, draft_data: draftJson, current_step: step ?? null },
    });
  }
}

export async function loadDraftAction(instanceId: number): Promise<{
  draftData: Record<string, unknown> | null;
  currentStep: string | null;
}> {
  instanceIdSchema.parse(instanceId);

  const draft = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: instanceId },
    select: { draft_data: true, current_step: true },
  });

  return {
    draftData: draft ? (draft.draft_data as Record<string, unknown>) : null,
    currentStep: draft?.current_step ?? null,
  };
}

export async function clearDraftAction(instanceId: number): Promise<void> {
  instanceIdSchema.parse(instanceId);

  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: instanceId },
    select: { instance_configuration_draft_id: true },
  });

  if (existing) {
    await prisma.instance_configuration_drafts.delete({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
    });
  }
}

// ── Draft serialize / hydrate (BFF proxy to FastAPI; the DB row holds the payload) ──
// serialize: snapshot the live FastAPI session to the draft payload (no disk write).
// hydrate:   replay a stored payload back into the FastAPI session (no disk read).

export async function serializeConfigAction(instanceId: number): Promise<DraftConfigPayload> {
  instanceIdSchema.parse(instanceId);
  return fetchFastAPI<DraftConfigPayload>("ammonia-reformer/hierarchy/serialize", {
    headers: instanceHeaders(instanceId),
  });
}

export async function hydrateConfigAction(
  instanceId: number,
  payload: DraftConfigPayload,
): Promise<HydrateConfigResponse> {
  instanceIdSchema.parse(instanceId);
  return fetchFastAPI<HydrateConfigResponse>("ammonia-reformer/hierarchy/hydrate", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: instanceHeaders(instanceId),
  });
}

// ── Final submission (instance_configurations) ─────────────────────────────────

export async function submitFinalConfigAction(instanceId: number): Promise<{ ok: boolean }> {
  instanceIdSchema.parse(instanceId);

  const headers = instanceHeaders(instanceId);

  // Get system config JSON from FastAPI export endpoint.
  const systemConfigRes = await fetchFastAPIRaw("ammonia-reformer/export/system-config", { headers });
  const systemConfigBytes = await systemConfigRes.arrayBuffer();
  const systemConfigJson = JSON.parse(Buffer.from(systemConfigBytes).toString("utf8")) as Record<string, unknown>;

  // Get pipeline input Excel bytes (EFF output — pipeline-consumable artifact).
  const pipelineRes = await fetchFastAPIRaw("ammonia-reformer/export/eff-output", { headers });
  if (!pipelineRes.ok) {
    throw new Error(`Export failed: ${pipelineRes.status}`);
  }
  const pipelineBuffer = await pipelineRes.arrayBuffer();
  const pipelineBytes = Buffer.from(pipelineBuffer);

  // Upsert instance_configurations (unique on instanceId).
  const existing = await prisma.instanceConfiguration.findUnique({
    where: { instanceId },
    select: { instance_configurations_id: true },
  });

  const uiConfigJson = systemConfigJson as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instanceConfiguration.update({
      where: { instanceId },
      data: { pipeline_config_data: pipelineBytes, ui_config_data: uiConfigJson },
    });
  } else {
    await prisma.instanceConfiguration.create({
      data: { instanceId, pipeline_config_data: pipelineBytes, ui_config_data: uiConfigJson },
    });
  }

  await clearDraftAction(instanceId);
  return { ok: true };
}
