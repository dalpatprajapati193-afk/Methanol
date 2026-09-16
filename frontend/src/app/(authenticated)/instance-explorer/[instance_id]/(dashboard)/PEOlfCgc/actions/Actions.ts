"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/shared/libs/Prisma";
import { makeDefaultConfig, type CgcConfig } from "../types/config";

const InstanceIdSchema = z.number().int().positive();

/** Validates the critical top-level shape before any Prisma write — `instanceId` is
 * untrusted (URL-sourced) and `draftData`/`config` come straight from the client, so
 * both must be checked here even though this is a server action, not a public API.
 * Uses `.passthrough()` on nested objects rather than mirroring every leaf field in
 * types/config.ts, so this doesn't silently drift out of sync as that schema evolves —
 * it still rejects structurally wrong payloads (missing plant/stages, wrong types). */
const StageConfigSchema = z
  .object({
    stage_number: z.number().int().positive(),
  })
  .passthrough();

const ConfigSchema = z
  .object({
    schema: z.string(),
    plant: z
      .object({
        plant_name: z.string(),
        stage_count: z.number().int().min(1).max(50),
      })
      .passthrough(),
    stages: z.array(StageConfigSchema),
  })
  .passthrough();

/** The generated EFF workbook, carried alongside the config inside `draft_data`
 * (see below) — `instance_configuration_drafts.draft_data` is a JSON column,
 * so this stays inside the documented draft storage contract without any
 * schema changes. */
const DraftExcelSchema = z.object({
  base64: z.string(),
  filename: z.string(),
  generatedAt: z.string(),
});
export type DraftExcel = z.infer<typeof DraftExcelSchema>;

/** On-disk shape of `instance_configuration_drafts.draft_data`. Older rows
 * (written before Save-in-Database/Save-Draft-with-Excel existed) hold the
 * bare `CgcConfig` — `unwrapDraftData` below reads both shapes. */
interface DraftEnvelope {
  config: CgcConfig;
  generatedExcel: DraftExcel | null;
}

function unwrapDraftData(raw: unknown): DraftEnvelope {
  const obj = raw as Record<string, unknown>;
  if (obj && typeof obj === "object" && "config" in obj) {
    return {
      config: obj.config as CgcConfig,
      generatedExcel: (obj.generatedExcel as DraftExcel | undefined) ?? null,
    };
  }
  // Legacy shape: draft_data was the bare config.
  return { config: raw as CgcConfig, generatedExcel: null };
}

// ── Draft persistence (mirror testPiPulling/EG: upsert one row per instance) ──

/**
 * Upsert the working draft. When `excel` is omitted, any previously saved
 * generated workbook is carried forward untouched (the lightweight autosave
 * path only updates the JSON; it doesn't regenerate the Excel on every
 * keystroke). Pass `excel` from an explicit "Save Draft" action to attach/
 * refresh the generated workbook.
 */
export async function saveDraft(instanceId: number, draftData: CgcConfig, excel?: DraftExcel): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const validConfig = ConfigSchema.parse(draftData);
  const validExcel = excel ? DraftExcelSchema.parse(excel) : undefined;

  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: validId },
  });

  const carriedExcel = validExcel ?? (existing ? unwrapDraftData(existing.draft_data).generatedExcel : null);
  const envelope: DraftEnvelope = { config: validConfig as unknown as CgcConfig, generatedExcel: carriedExcel };
  const json = envelope as unknown as Prisma.InputJsonValue;

  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      // `updated_at` has no @updatedAt directive in schema.prisma, so it must be set
      // explicitly here — otherwise it silently goes stale on every re-save.
      data: { draft_data: json, updated_at: new Date() },
    });
  } else {
    await prisma.instance_configuration_drafts.create({
      data: { instance_id: validId, draft_data: json },
    });
  }
}

export async function getDraft(instanceId: number): Promise<CgcConfig | null> {
  const validId = InstanceIdSchema.parse(instanceId);
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (!draft) return null;
  return unwrapDraftData(draft.draft_data).config;
}

export async function loadInitialConfig(
  instanceId: number,
): Promise<{ data: CgcConfig; source: "draft" | "snapshot" | "default" }> {
  const validId = InstanceIdSchema.parse(instanceId);

  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (draft) {
    return { data: unwrapDraftData(draft.draft_data).config, source: "draft" };
  }

  const snap = await prisma.instanceConfiguration.findFirst({
    where: { instanceId: validId },
    orderBy: { updatedAt: "desc" },
  });
  if (snap?.ui_config_data) {
    return { data: snap.ui_config_data as unknown as CgcConfig, source: "snapshot" };
  }

  return { data: makeDefaultConfig(), source: "default" };
}

// ── Final snapshot (mirror EG/testPiPulling: instance_id is unique -> upsert) ──

/** Persist the generated EFF workbook + finalized config as the instance's snapshot. */
export async function submitSnapshot(
  instanceId: number,
  config: CgcConfig,
  xlsxBase64: string,
): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const valid = ConfigSchema.parse(config);
  const bytes = Buffer.from(xlsxBase64, "base64");

  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } });
  const data = {
    pipeline_config_data: new Uint8Array(bytes),
    ui_config_data: valid as unknown as Prisma.InputJsonValue,
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

/** Fetches generated EFF workbook from internal Python FastAPI service securely on the server. */
export async function generateEffAction(
  config: CgcConfig,
): Promise<{ success: boolean; base64: string; filename: string }> {
  const valid = ConfigSchema.parse(config);
  const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000/api";

  const res = await fetch(`${FASTAPI_BASE}/pe-olf-cgc/generate-eff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuration: valid }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FastAPI Error ${res.status}: ${errText}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const plantName = (config.plant.plant_name || "cgc").replace(/[^a-z0-9_-]/gi, "_");

  return {
    success: true,
    base64,
    filename: `${plantName}_EFF.xlsx`,
  };
}

