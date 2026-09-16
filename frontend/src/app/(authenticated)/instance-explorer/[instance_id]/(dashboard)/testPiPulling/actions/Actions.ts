"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/shared/libs/Prisma";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import type { PiPullConfig, SensorDef, SensorStats, StatsResponse } from "../store/Types";
import sensors from "../sensors.json";

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000/api/";
const InstanceIdSchema = z.number().int().positive();

const MappingSchema = z.object({
  displayName: z.string().min(1),
  piTag: z.string(),
  unit: z.string().optional(),
});

const ConfigSchema = z.object({
  mappings: z.array(MappingSchema).min(1).max(10),
  startTime: z.string(),
  endTime: z.string(),
  interval: z.string().default("1h"),
});

/** Default config: one empty row per predefined sensor, interval defaulted to 1h. */
const DEFAULT_CONFIG: PiPullConfig = {
  mappings: (sensors as SensorDef[]).map((s) => ({
    displayName: s.displayName,
    piTag: "",
    unit: s.defaultUnit,
  })),
  startTime: "",
  endTime: "",
  interval: "1h",
};

// ── Statistics (config passed directly — no DB fetch) ─────────────────────────

/** Pull series from the Historian via FastAPI and compute per-sensor statistics. */
export async function generateStatistics(config: PiPullConfig): Promise<StatsResponse> {
  const valid = ConfigSchema.parse(config);
  return fetchFastAPI<StatsResponse>("test-pi-pulling/generate-stats", {
    method: "POST",
    body: JSON.stringify(valid),
  });
}

// ── Draft persistence (mirror EG: upsert one row per instance) ────────────────

export async function saveDraft(
  instanceId: number,
  draftData: PiPullConfig,
  currentStep?: string | null,
): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const valid = ConfigSchema.parse(draftData);
  const json = valid as unknown as Prisma.InputJsonValue;

  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: validId },
  });
  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      data: { draft_data: json, current_step: currentStep ?? null },
    });
  } else {
    await prisma.instance_configuration_drafts.create({
      data: { instance_id: validId, draft_data: json, current_step: currentStep ?? null },
    });
  }
}

export async function getDraft(
  instanceId: number,
): Promise<{ data: PiPullConfig; currentStep: string | null; updatedAt: string } | null> {
  const validId = InstanceIdSchema.parse(instanceId);
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (!draft) return null;
  const data = { ...DEFAULT_CONFIG, ...(draft.draft_data as Partial<PiPullConfig>) } as PiPullConfig;
  return { data, currentStep: draft.current_step, updatedAt: draft.updated_at.toISOString() };
}

export async function clearDraft(instanceId: number): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  await prisma.instance_configuration_drafts.deleteMany({ where: { instance_id: validId } });
}

/** Resume loader: live draft → latest snapshot → defaults. */
export async function loadInitialConfig(
  instanceId: number,
): Promise<{ data: PiPullConfig; currentStep: string | null; source: "draft" | "snapshot" | "default" }> {
  const validId = InstanceIdSchema.parse(instanceId);

  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (draft) {
    const data = { ...DEFAULT_CONFIG, ...(draft.draft_data as Partial<PiPullConfig>) } as PiPullConfig;
    return { data, currentStep: draft.current_step, source: "draft" };
  }

  const snap = await prisma.instanceConfiguration.findFirst({
    where: { instanceId: validId },
    orderBy: { updatedAt: "desc" },
  });
  if (snap?.ui_config_data) {
    const data = { ...DEFAULT_CONFIG, ...(snap.ui_config_data as Partial<PiPullConfig>) } as PiPullConfig;
    return { data, currentStep: null, source: "snapshot" };
  }

  return { data: { ...DEFAULT_CONFIG }, currentStep: null, source: "default" };
}

// ── Submit: persist config + stats snapshot as xlsx blob (mirror EG) ──────────

/** Build the xlsx export via FastAPI. Raw fetch (not fetchFastAPI) to read bytes. */
async function buildExportBytes(payload: PiPullConfig & { results: SensorStats[] }): Promise<Buffer> {
  const base = FASTAPI_BASE.endsWith("/") ? FASTAPI_BASE.slice(0, -1) : FASTAPI_BASE;
  const res = await fetch(`${base}/test-pi-pulling/generate-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`FastAPI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Finalize: generate the xlsx (config + statistics) and persist it as the snapshot. */
export async function submitConfig(
  instanceId: number,
  config: PiPullConfig,
  results: SensorStats[],
): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const valid = ConfigSchema.parse(config);
  const bytes = await buildExportBytes({ ...valid, results });

  // One config row per instance (instance_id is @unique, seeded at instance creation),
  // so update the existing snapshot in place; create only if somehow absent.
  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } });
  const data = {
    pipeline_config_data: new Uint8Array(bytes),
    ui_config_data: { ...valid, results } as unknown as Prisma.InputJsonValue,
  };
  if (existing) {
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data,
    });
  } else {
    await prisma.instanceConfiguration.create({ data: { instanceId: validId, ...data } });
  }
}
