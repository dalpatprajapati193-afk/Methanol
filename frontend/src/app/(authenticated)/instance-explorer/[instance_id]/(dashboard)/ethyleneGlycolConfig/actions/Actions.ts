"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/shared/libs/Prisma";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import type {
  EgConfigData,
  EgConfigRecord,
  EgConfigListItem,
  ExpandedKpi,
  AdditionalInput,
  SoftSensor,
  ModelFileEntry,
} from "../store/Types";

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000/api/";
const InstanceIdSchema = z.number().int().positive();

const DEFAULT_EG_CONFIG: EgConfigData = {
  configName: "",
  plantCapacity: "",
  commissioningYear: "",
  techLicensor: "",
  waterToEORatio: "",
  numSteamHeaders: 1,
  steamHeaders: [{ headerLabel: "HP Steam", isSuperheated: "no" }],
  eq_hasGFS: "no",
  eq_gfsArrangement: "",
  sc_columnType: "", sc_hasReboiler: "no", sc_reboilerFreshSteam: "no", sc_reboilerMedium: "",
  sc_hasDirectSteam: "no", sc_directSteamFreshSteam: "no", sc_numDirectSteam: 0,
  sc_directSteamInputs: [], sc_hasBottomBleed: "no",
  ra_columnType: "", ra_absorptionMedium: "", ra_absorptionMediumOther: "", ra_hasIntercooler: "no", ra_intercoolerMedium: "", ra_intercoolerMediumOther: "",
  ra_hasAftercooler: "no", ra_aftercoolerFreshSteam: "no", ra_aftercoolerSource: "", ra_aftercoolerSourceOther: "",
  int_columnType: "", int_absorptionMedium: "", int_absorptionMediumOther: "", int_hasIntercooler: "no", int_intercoolerMedium: "", int_intercoolerMediumOther: "",
  int_hasReboiler: "no", int_reboilerFreshSteam: "no", int_reboilerMedium: "",
  int_hasDirectSteam: "no", int_directSteamFreshSteam: "no", int_numDirectSteam: 0,
  int_directSteamInputs: [], int_strippingPurpose: "", int_overheadVent: "",
  gfs_columnType: "", gfs_hasReboiler: "no", gfs_reboilerFreshSteam: "no", gfs_reboilerMedium: "",
  gfs_hasDirectSteam: "no", gfs_directSteamFreshSteam: "no", gfs_numDirectSteam: 0,
  gfs_directSteamInputs: [], gfs_strippingPurpose: "", gfs_overheadVent: "",
  fpe_numExchangers: 1,
  fpe_exchangers: [{ freshSteam: "no", heatSource: "", heatSourceOther: "", exchangerType: "" }],
  gr_reactorType: "", gr_numReactors: 1, gr_heatRecovered: "no",
  gr_heatRecoverySinks: [], gr_numInterstage: 0,
  ev_numEffects: 1, ev_flowArrangement: "", ev_firstEffectFreshSteam: "no",
  ev_firstEffectSource: "", ev_hasMVR: "no", ev_mvrEffect: 1,
  ev_hasTVR: "no", ev_tvrEffect: 1, ev_condensateFlash: "no",
  oe_hasOther: "no", oe_numEquipment: 0, oe_equipment: [],
  output_kpis: {}, additional_inputs: {}, soft_sensor_mappings: {}, forecast_config: {},
};

// ── Private helpers ───────────────────────────────────────────────────────────

const WIZARD_ONLY_KEYS = [
  "output_kpis",
  "additional_inputs",
  "soft_sensor_mappings",
  "forecast_config",
] as const;

/** Convert a stored legacy-attrs blob back to EgConfigData, re-attaching wizard-only keys.
 *  Detects old camelCase drafts by absence of "Plant_Name" and falls back gracefully. */
async function attrsToEgConfig(stored: Record<string, unknown>): Promise<EgConfigData> {
  const plantAttrs: Record<string, unknown> = { ...stored };
  const wizardExtra: Record<string, unknown> = {};
  for (const k of WIZARD_ONLY_KEYS) {
    if (k in plantAttrs) {
      wizardExtra[k] = plantAttrs[k];
      delete plantAttrs[k];
    }
  }
  const plantConfig = await fetchFastAPI<Partial<EgConfigData>>("eg-config/attrs-to-config", {
    method: "POST",
    body: JSON.stringify({ attrs: plantAttrs }),
  });
  return { ...DEFAULT_EG_CONFIG, ...plantConfig, ...wizardExtra } as EgConfigData;
}

/** Returns true when the stored JSON uses the new legacy attrs format (PascalCase keys). */
function isAttrsFormat(stored: Record<string, unknown>): boolean {
  return "Plant_Name" in stored;
}

async function generateExcelBytes(config: EgConfigData): Promise<Buffer> {
  const base = FASTAPI_BASE.endsWith("/") ? FASTAPI_BASE.slice(0, -1) : FASTAPI_BASE;
  const res = await fetch(`${base}/eg-config/generate-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error(`FastAPI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function parseExcelConfig(configBytes: Uint8Array | Buffer): Promise<Partial<EgConfigData>> {
  return fetchFastAPI<Partial<EgConfigData>>("eg-config/parse-config", {
    method: "POST",
    body: JSON.stringify({ config_data: Buffer.from(configBytes).toString("base64") }),
  });
}

/** Fill pi_tag_bank, tags, dm_tag_roles into the stored pipeline Excel (Steps 2–4). */
async function fillTemplateBytes(
  config: EgConfigData,
  templateBytes: Uint8Array | Buffer | null,
  fillLbmSheets: boolean = true,
  sheetOverrides: Record<string, unknown> = {},
): Promise<Buffer> {
  const base = FASTAPI_BASE.endsWith("/") ? FASTAPI_BASE.slice(0, -1) : FASTAPI_BASE;
  const res = await fetch(`${base}/eg-config/fill-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config,
      template_data: templateBytes ? Buffer.from(templateBytes).toString("base64") : null,
      fill_lbm_sheets: fillLbmSheets,
      sheet_overrides: sheetOverrides,
    }),
  });
  if (!res.ok) throw new Error(`FastAPI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Fill Step-5 sheets and copy as-is sheets from ExportFileFormat into the stored pipeline Excel. */
async function finalizeTemplateBytes(
  config: EgConfigData,
  pipelineConfigData: Uint8Array | Buffer,
  sheetOverrides: Record<string, unknown> = {},
): Promise<Buffer> {
  const base = FASTAPI_BASE.endsWith("/") ? FASTAPI_BASE.slice(0, -1) : FASTAPI_BASE;
  const res = await fetch(`${base}/eg-config/finalize-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pipeline_config_data: Buffer.from(pipelineConfigData).toString("base64"),
      config,
      sheet_overrides: sheetOverrides,
    }),
  });
  if (!res.ok) throw new Error(`FastAPI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function toListItem(row: {
  instance_configurations_id: number;
  instanceId: number;
  createdAt: Date;
  updatedAt: Date;
}): EgConfigListItem {
  return {
    instanceConfigurationId: row.instance_configurations_id,
    instanceId: row.instanceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listConfigurations(): Promise<EgConfigListItem[]> {
  const rows = await prisma.instanceConfiguration.findMany({
    distinct: ["instanceId"],
    select: {
      instance_configurations_id: true,
      instanceId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ instanceId: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map(toListItem);
}

export async function createConfiguration(
  instanceId: number,
  data: EgConfigData,
): Promise<EgConfigRecord> {
  const validId = InstanceIdSchema.parse(instanceId);
  const excelBytes = await generateExcelBytes(data);
  const row = await prisma.instanceConfiguration.create({
    data: { instanceId: validId, pipeline_config_data: new Uint8Array(excelBytes) },
  });
  return { ...toListItem(row), data };
}

export async function getConfiguration(instanceId: number): Promise<EgConfigRecord> {
  const validId = InstanceIdSchema.parse(instanceId);
  const row = await prisma.instanceConfiguration.findFirstOrThrow({
    where: { instanceId: validId },
    orderBy: { updatedAt: "desc" },
  });
  const partial = await parseExcelConfig(row.pipeline_config_data);
  const data = { ...DEFAULT_EG_CONFIG, ...partial } as EgConfigData;
  return { ...toListItem(row), data };
}

export async function saveConfiguration(
  instanceId: number,
  data: EgConfigData,
): Promise<EgConfigRecord> {
  const validId = InstanceIdSchema.parse(instanceId);
  const excelBytes = await generateExcelBytes(data);
  const row = await prisma.instanceConfiguration.create({
    data: { instanceId: validId, pipeline_config_data: new Uint8Array(excelBytes) },
  });
  return { ...toListItem(row), data };
}

export async function deleteConfiguration(instanceConfigurationId: number): Promise<void> {
  await prisma.instanceConfiguration.delete({ where: { instance_configurations_id: instanceConfigurationId } });
}

/** Copy the latest config of one instance into a new version row for another instance. */
export async function copyConfiguration(
  sourceInstanceId: number,
  targetInstanceId: number,
): Promise<EgConfigRecord> {
  const validSource = InstanceIdSchema.parse(sourceInstanceId);
  const validTarget = InstanceIdSchema.parse(targetInstanceId);
  const source = await prisma.instanceConfiguration.findFirstOrThrow({
    where: { instanceId: validSource },
    orderBy: { updatedAt: "desc" },
  });
  const row = await prisma.instanceConfiguration.create({
    data: { instanceId: validTarget, pipeline_config_data: new Uint8Array(source.pipeline_config_data) },
  });
  const partial = await parseExcelConfig(row.pipeline_config_data);
  const data = { ...DEFAULT_EG_CONFIG, ...partial } as EgConfigData;
  return { ...toListItem(row), data };
}

/** Submit a step: store a frozen JSON snapshot in legacy attrs format.
 *  When fillExcel=true (Steps 2–4), fills pi_tag_bank/tags/dm_tag_roles into pipelineConfigData.
 *  When finalize=true (Step 5), fills LBM sheets and copies as-is sheets from ExportFileFormat.
 *  options.sheetOverrides: user-edited sheet rows from Step 5 editor. */
export async function submitFilledSnapshot(
  instanceId: number,
  data: EgConfigData,
  fillExcel: boolean = false,
  options?: { fillLbmSheets?: boolean; sheetOverrides?: Record<string, unknown>; createNewSnapshot?: boolean; finalize?: boolean },
): Promise<EgConfigRecord> {
  const validId = InstanceIdSchema.parse(instanceId);
  const existing = await prisma.instanceConfiguration.findFirst({
    where: { instanceId: validId },
    orderBy: { updatedAt: "desc" },
  });

  const attrsRaw = await fetchFastAPI<Record<string, unknown>>("eg-config/config-to-attrs", {
    method: "POST",
    body: JSON.stringify({ config: data }),
  });
  const snapshot: Prisma.InputJsonValue = {
    ...attrsRaw,
    output_kpis: data.output_kpis,
    additional_inputs: data.additional_inputs,
    soft_sensor_mappings: data.soft_sensor_mappings,
    forecast_config: data.forecast_config,
  } as unknown as Prisma.InputJsonValue;

  const shouldCreate = !existing || (options?.createNewSnapshot ?? false);

  if (options?.finalize) {
    // Step 5: fill LBM sheets + copy as-is sheets from ExportFileFormat into pipeline Excel.
    const templateToUse = existing!.pipeline_config_data;
    const filled = await finalizeTemplateBytes(data, templateToUse, options?.sheetOverrides ?? {});
    const row = shouldCreate
      ? await prisma.instanceConfiguration.create({
        data: { instanceId: validId, pipeline_config_data: new Uint8Array(filled), ui_config_data: snapshot },
      })
      : await prisma.instanceConfiguration.update({
        where: { instance_configurations_id: existing!.instance_configurations_id },
        data: { pipeline_config_data: new Uint8Array(filled), ui_config_data: snapshot },
      });
    return { ...toListItem(row), data };
  } else if (fillExcel) {
    // Steps 2–4: fill pi_tag_bank, tags, dm_tag_roles into the stored pipeline Excel.
    const templateToUse = (existing?.pipeline_config_data?.length ?? 0) > 0 ? existing!.pipeline_config_data : null;
    const filled = await fillTemplateBytes(data, templateToUse, options?.fillLbmSheets ?? true, options?.sheetOverrides ?? {});
    const row = shouldCreate
      ? await prisma.instanceConfiguration.create({
        data: { instanceId: validId, pipeline_config_data: new Uint8Array(filled), ui_config_data: snapshot },
      })
      : await prisma.instanceConfiguration.update({
        where: { instance_configurations_id: existing!.instance_configurations_id },
        data: { pipeline_config_data: new Uint8Array(filled), ui_config_data: snapshot },
      });
    return { ...toListItem(row), data };
  } else {
    // Step 1 (plant phase): keep existing pipelineConfigData, only update uiConfigData.
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing!.instance_configurations_id },
      data: { ui_config_data: snapshot },
    });
    // Seed model_registry from ExportFileFormat.xlsx model_registry sheet (upsert on re-submit).
    const modelEntries = await fetchFastAPI<{ model_key: string; model_alias: string; model_description: string }[]>(
      "eg-config/model-registry-entries"
    );
    for (const entry of modelEntries) {
      await prisma.model_registry.upsert({
        where: { instance_id_model_key: { instance_id: validId, model_key: entry.model_key } },
        update: { model_alias: entry.model_alias, model_description: entry.model_description },
        create: { instance_id: validId, model_key: entry.model_key, model_alias: entry.model_alias, model_description: entry.model_description },
      });
    }
    const saved = await prisma.instanceConfiguration.findFirstOrThrow({
      where: { instanceId: validId },
      orderBy: { updatedAt: "desc" },
    });
    return { ...toListItem(saved), data };
  }
}

/** Seed/replace the template workbook for an instance (single row) with provided file bytes. */
export async function seedConfigTemplate(instanceId: number, base64: string): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const b64 = z.string().min(1).parse(base64);
  const bytes = Buffer.from(b64, "base64");
  await prisma.instanceConfiguration.deleteMany({ where: { instanceId: validId } });
  await prisma.instanceConfiguration.create({
    data: { instanceId: validId, pipeline_config_data: new Uint8Array(bytes) },
  });
}

// ── Draft (live working copy — JSON, one mutable row per instance) ────────────

const DraftInputSchema = z.object({
  instanceId: InstanceIdSchema,
  currentStep: z.string().nullable().optional(),
  draftData: z.record(z.string(), z.unknown()),
});

/** Autosave the live draft (upsert — one row per instance, overwritten in place).
 *  Converts EgConfigData to legacy attribute-value format before storing. */
export async function saveDraft(
  instanceId: number,
  draftData: EgConfigData,
  currentStep?: string | null,
): Promise<void> {
  const attrsRaw = await fetchFastAPI<Record<string, unknown>>("eg-config/config-to-attrs", {
    method: "POST",
    body: JSON.stringify({ config: draftData }),
  });
  const toStore: Record<string, unknown> = {
    ...attrsRaw,
    output_kpis: draftData.output_kpis,
    additional_inputs: draftData.additional_inputs,
    soft_sensor_mappings: draftData.soft_sensor_mappings,
    forecast_config: draftData.forecast_config,
  };
  const parsed = DraftInputSchema.parse({ instanceId, draftData: toStore, currentStep });
  const json = parsed.draftData as Prisma.InputJsonValue;
  const existing = await prisma.instance_configuration_drafts.findFirst({
    where: { instance_id: parsed.instanceId },
  });

  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      data: { draft_data: json, current_step: parsed.currentStep ?? null },
    });
  } else {
    await prisma.instance_configuration_drafts.create({
      data: { instance_id: parsed.instanceId, draft_data: json, current_step: parsed.currentStep ?? null },
    });
  }
}

export async function getDraft(
  instanceId: number,
): Promise<{ data: EgConfigData; currentStep: string | null; updatedAt: string } | null> {
  const validId = InstanceIdSchema.parse(instanceId);
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (!draft) return null;
  const stored = draft.draft_data as Record<string, unknown>;
  const data = isAttrsFormat(stored)
    ? await attrsToEgConfig(stored)
    : ({ ...DEFAULT_EG_CONFIG, ...(stored as Partial<EgConfigData>) } as EgConfigData);
  return { data, currentStep: draft.current_step, updatedAt: draft.updated_at.toISOString() };
}

export async function clearDraft(instanceId: number): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  await prisma.instance_configuration_drafts.deleteMany({ where: { instance_id: validId } });
}

/** Resume loader: live draft → else latest snapshot → else defaults. */
export async function loadInitialConfig(
  instanceId: number,
): Promise<{ data: EgConfigData; currentStep: string | null; source: "draft" | "snapshot" | "default" }> {
  const validId = InstanceIdSchema.parse(instanceId);

  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } });
  if (draft) {
    const stored = draft.draft_data as Record<string, unknown>;
    const data = isAttrsFormat(stored)
      ? await attrsToEgConfig(stored)
      : ({ ...DEFAULT_EG_CONFIG, ...(stored as Partial<EgConfigData>) } as EgConfigData);
    return { data, currentStep: draft.current_step, source: "draft" };
  }

  const snap = await prisma.instanceConfiguration.findFirst({
    where: { instanceId: validId },
    orderBy: { updatedAt: "desc" },
  });
  if (snap) {
    let data: EgConfigData;
    if (snap.ui_config_data) {
      const stored = snap.ui_config_data as Record<string, unknown>;
      data = isAttrsFormat(stored)
        ? await attrsToEgConfig(stored)
        : ({ ...DEFAULT_EG_CONFIG, ...(stored as Partial<EgConfigData>) } as EgConfigData);
    } else {
      data = { ...DEFAULT_EG_CONFIG } as EgConfigData;
    }
    return { data, currentStep: null, source: "snapshot" };
  }

  return { data: { ...DEFAULT_EG_CONFIG }, currentStep: null, source: "default" };
}

// ── Computation (config passed directly — no DB fetch) ────────────────────────

export async function getOutputKpiList(config: EgConfigData): Promise<ExpandedKpi[]> {
  const result = await fetchFastAPI<{ sections: { section: string; kpis: Record<string, unknown>[] }[] }>(
    "eg-config/expand-kpis",
    { method: "POST", body: JSON.stringify({ config }) },
  );
  return result.sections.flatMap((s) =>
    s.kpis.map((k) => ({
      ...k,
      kpi_type: k.kpi_type === "calculated_tag" ? "formula" : k.kpi_type,
    }))
  ) as ExpandedKpi[];
}

export async function getAdditionalInputsList(config: EgConfigData): Promise<AdditionalInput[]> {
  return fetchFastAPI<AdditionalInput[]>("eg-config/additional-inputs-list", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
}

export async function viewConfig(config: EgConfigData): Promise<Record<string, unknown>> {
  return fetchFastAPI<Record<string, unknown>>("eg-config/view-config", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
}

export async function getSoftSensors(): Promise<SoftSensor[]> {
  return fetchFastAPI<SoftSensor[]>("eg-config/soft-sensors");
}

export async function getKpiTemplateMtime(): Promise<{ mtime: number }> {
  return fetchFastAPI<{ mtime: number }>("eg-config/kpi-templates/mtime");
}

// ── Model files registry (output schema — not in Prisma, use raw SQL) ─────────

const ALIAS_TO_MODEL_KEY: Record<string, string> = {
  DM: "Data_Model",
  LBM: "Live_Benchmarking_Model",
};

const MODEL_KEY_TO_ALIAS: Record<string, "DM" | "LBM"> = {
  "Data Model": "DM",
  "Live Benchmarking Model": "LBM",
};

/** Fetch the UOM bank (symbol + category) from FastAPI. Cached server-side by Python. */
export async function getUomBank(): Promise<{ symbol: string; category: string }[]> {
  const res = await fetchFastAPI("eg-config/uom-bank");
  return (res as { uoms: { symbol: string; category: string }[] }).uoms ?? [];
}

/** Load existing pkl entries for an instance from output.model_files_registry (no binary data). */
export async function loadModelFilesRegistry(instanceId: number): Promise<ModelFileEntry[]> {
  const validId = InstanceIdSchema.parse(instanceId);
  const rows = await prisma.$queryRaw<
    { file_name: string; model_file_display_name: string; model_key: string }[]
  >`
    SELECT mfr.file_name, mfr.model_file_display_name, mr.model_key
    FROM output.model_files_registry mfr
    JOIN configurations.model_registry mr ON mfr.model_id = mr.model_id
    WHERE mfr.instance_id = ${validId}
  `;
  return rows.map((r) => ({
    model_alias: (MODEL_KEY_TO_ALIAS[r.model_key] ?? "DM") as "DM" | "LBM",
    file_name: r.file_name,
    model_file_display_name: r.model_file_display_name,
    model_metadata: null,
    state: "uploaded" as const,
  }));
}

/** Upsert new pkl entries into output.model_files_registry.
 *  fileBase64s: Record<file_name, base64-encoded bytes> — only entries with state="new" are processed. */
export async function uploadModelFiles(
  instanceId: number,
  entries: ModelFileEntry[],
  fileBase64s: Record<string, string>,
): Promise<void> {
  const validId = InstanceIdSchema.parse(instanceId);
  const newEntries = entries.filter((e) => e.state === "new");
  if (newEntries.length === 0) return;

  for (const entry of newEntries) {
    const modelKey = ALIAS_TO_MODEL_KEY[entry.model_alias];
    if (!modelKey) continue;
    const base64 = fileBase64s[entry.file_name];
    if (!base64) continue;
    const fileBytes = Buffer.from(base64, "base64");

    const modelRows = await prisma.$queryRaw<{ model_id: number }[]>`
      SELECT model_id FROM configurations.model_registry
      WHERE instance_id = ${validId} AND model_key = ${modelKey}
      LIMIT 1
    `;
    const modelId = modelRows[0]?.model_id;
    if (!modelId) continue;

    await prisma.$executeRaw`
      INSERT INTO output.model_files_registry
        (instance_id, model_id, model_file_display_name, file_name, model_data, model_metadata)
      VALUES (${validId}, ${modelId}, ${entry.model_file_display_name}, ${entry.file_name}, ${fileBytes}, NULL)
      ON CONFLICT (instance_id, model_id, file_name)
      DO UPDATE SET
        model_data = EXCLUDED.model_data,
        model_file_display_name = EXCLUDED.model_file_display_name,
        updated_at = now()
    `;
  }
}
