'use server'

/**
 * PeRefDCU server actions.
 *
 * BFF boundary: every function here is the only thing allowed to call
 * fetchFastAPI() — components/atoms never reach the FastAPI router directly.
 */

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { fetchFastAPI } from '@/shared/libs/FastApiClient'
import prisma from '@/shared/libs/Prisma'
import type {
  ModelTagMapping, ModelEntry, ModelParameterWithIds, ValueMapEntry, UOMEntry,
  WizardQuestion, MultipliedAttributeEntry, OdsRule, ImputationPolicyEntry,
} from '../types'
import type { SavedConfig } from '../store/dcuAtoms'
import type { ModelRegistryGroup, ModelRegistrySyncedRow } from '../utils/outputGenerator'

export interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const BASE = 'pe-ref-dcu'

// ─── Blueprint: bulk fetch (used to hydrate dcuAtoms on mount) ───────────────

export interface BlueprintBundle {
  tagMappings: ModelTagMapping[]
  valueMap: ValueMapEntry[]
  wizardQuestions: WizardQuestion[]
  multipliedAttributes: MultipliedAttributeEntry[]
  odsRules: OdsRule[]
  models: ModelEntry[]
  uomBank: UOMEntry[]
  modelParameters: ModelParameterWithIds[]
  imputationPolicy: ImputationPolicyEntry[]
}

async function fetchUomBankFromDb(): Promise<UOMEntry[]> {
  const rows = await prisma.unit_of_measurement.findMany({
    where: { is_active: true },
    orderBy: { uom_id: 'asc' },
  })
  const byId = new Map(rows.map(r => [r.uom_id, r]))
  return rows.map(r => ({
    name: r.uom_name,
    symbol: r.uom_symbol,
    category: r.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    refUOM: r.ref_uom_id === r.uom_id ? null : (byId.get(r.ref_uom_id)?.uom_symbol ?? null),
    refFactor: Number(r.ref_factor),
    refOffset: Number(r.ref_offset),
    source: r.source === 'user' ? 'user' : 'system',
  }))
}

export async function getBlueprintBundle(): Promise<ActionResponse<BlueprintBundle>> {
  try {
    const [tagMappings, models, modelParameters, valueMappings, uomBank, wizardQuestions, multipliedAttributes, odsRules, imputationPolicy] = await Promise.all([
      fetchFastAPI<{ tagMappings: ModelTagMapping[] }>(`${BASE}/blueprint/tag-mappings`),
      fetchFastAPI<{ models: ModelEntry[] }>(`${BASE}/blueprint/models`),
      fetchFastAPI<{ parameters: ModelParameterWithIds[] }>(`${BASE}/blueprint/model-parameters`),
      fetchFastAPI<{ valueMap: ValueMapEntry[] }>(`${BASE}/blueprint/value-mappings`),
      fetchUomBankFromDb(),
      fetchFastAPI<{ questions: WizardQuestion[] }>(`${BASE}/blueprint/wizard-questions`),
      fetchFastAPI<{ multipliedAttributes: MultipliedAttributeEntry[] }>(`${BASE}/blueprint/multiplied-attributes`),
      fetchFastAPI<{ rules: OdsRule[] }>(`${BASE}/blueprint/ods-rules`),
      fetchFastAPI<{ policies: ImputationPolicyEntry[] }>(`${BASE}/blueprint/imputation-policy`),
    ])
    return {
      success: true,
      data: {
        tagMappings: tagMappings.tagMappings,
        models: models.models,
        modelParameters: modelParameters.parameters,
        valueMap: valueMappings.valueMap,
        uomBank,
        wizardQuestions: wizardQuestions.questions,
        multipliedAttributes: multipliedAttributes.multipliedAttributes,
        odsRules: odsRules.rules,
        imputationPolicy: imputationPolicy.policies,
      },
    }
  } catch (err) {
    console.error('[getBlueprintBundle]', err)
    return { success: false, error: 'Failed to load blueprint reference data' }
  }
}

// ─── Blueprint: individual save actions ───────────────────────────────────────

async function postBlueprint(path: string, body: Record<string, unknown>): Promise<ActionResponse<{ count: number }>> {
  try {
    const data = await fetchFastAPI<{ success: boolean; count: number }>(`${BASE}/blueprint/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return { success: true, data: { count: data.count } }
  } catch (err) {
    console.error(`[postBlueprint:${path}]`, err)
    return { success: false, error: `Failed to save ${path}` }
  }
}

export const saveTagMappings = async (mappings: ModelTagMapping[]) => postBlueprint('tag-mappings', { mappings })
export const saveModels = async (models: ModelEntry[]) => postBlueprint('models', { models })
export const saveModelParametersBlueprint = async (parameters: ModelParameterWithIds[]) => postBlueprint('model-parameters', { parameters })
export const saveValueMappings = async (valueMap: ValueMapEntry[]) => postBlueprint('value-mappings', { valueMap })
export const saveWizardQuestions = async (questions: WizardQuestion[]) => postBlueprint('wizard-questions', { questions })
export const saveMultipliedAttributes = async (multipliedAttributes: MultipliedAttributeEntry[]) => postBlueprint('multiplied-attributes', { multipliedAttributes })
export const saveOdsRules = async (rules: OdsRule[]) => postBlueprint('ods-rules', { rules })

// ─── Draft (platform DB: instance_configuration_drafts) ──────────────────────

const InstanceIdSchema = z.coerce.number().int().positive()

const DraftSchema = z.object({
  instanceId: InstanceIdSchema,
  config: z.record(z.string(), z.unknown()),
  currentStep: z.number().int().positive().optional(),
})

export async function saveDraft(
  instanceId: string,
  config: SavedConfig,
  currentStep?: number
): Promise<ActionResponse<null>> {
  try {
    const parsed = DraftSchema.parse({ instanceId, config, currentStep })
    const json = parsed.config as Prisma.InputJsonValue
    const existing = await prisma.instance_configuration_drafts.findFirst({
      where: { instance_id: parsed.instanceId },
    })
    if (existing) {
      await prisma.instance_configuration_drafts.update({
        where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
        data: { draft_data: json, current_step: parsed.currentStep?.toString() ?? null },
      })
    } else {
      await prisma.instance_configuration_drafts.create({
        data: { instance_id: parsed.instanceId, draft_data: json, current_step: parsed.currentStep?.toString() ?? null },
      })
    }
    return { success: true }
  } catch (err) {
    console.error('[saveDraft]', err)
    return { success: false, error: 'Failed to save draft' }
  }
}

export async function clearDraft(instanceId: string): Promise<ActionResponse<null>> {
  try {
    const validId = InstanceIdSchema.parse(instanceId)
    await prisma.instance_configuration_drafts.deleteMany({ where: { instance_id: validId } })
    return { success: true }
  } catch (err) {
    console.error('[clearDraft]', err)
    return { success: false, error: 'Failed to clear draft' }
  }
}

// ─── Final submission (platform DB: instance_configurations) ──────────────────

const SubmitConfigSchema = z.object({
  instanceId: InstanceIdSchema,
  config: z.record(z.string(), z.unknown()),
  excelBase64: z.string().min(1),
})

export interface SubmitConfigResult {
  savedAt: string
}

export async function submitConfig(
  instanceId: string,
  config: SavedConfig,
  excelBase64: string
): Promise<ActionResponse<SubmitConfigResult>> {
  try {
    const parsed = SubmitConfigSchema.parse({ instanceId, config, excelBase64 })
    const excelBytes = Buffer.from(parsed.excelBase64, 'base64')
    const existing = await prisma.instanceConfiguration.findFirst({
      where: { instanceId: parsed.instanceId },
    })
    const row = existing
      ? await prisma.instanceConfiguration.update({
          where: { instance_configurations_id: existing.instance_configurations_id },
          data: { pipeline_config_data: excelBytes, ui_config_data: parsed.config },
        })
      : await prisma.instanceConfiguration.create({
          data: { instanceId: parsed.instanceId, pipeline_config_data: excelBytes, ui_config_data: parsed.config },
        })
    await prisma.instance_configuration_drafts.deleteMany({ where: { instance_id: parsed.instanceId } })
    return { success: true, data: { savedAt: row.updatedAt.toISOString() } }
  } catch (err) {
    console.error('[submitConfig]', err)
    return { success: false, error: 'Failed to submit configuration to database' }
  }
}

export interface LoadInitialConfigResult {
  config: SavedConfig | null
  currentStep: number | null
  source: 'draft' | 'snapshot' | 'default'
}

export async function loadInitialConfigFromDb(instanceId: string): Promise<ActionResponse<LoadInitialConfigResult>> {
  try {
    const validId = InstanceIdSchema.parse(instanceId)

    // 1. Draft takes precedence
    const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: validId } })
    if (draft) {
      return {
        success: true,
        data: {
          config: draft.draft_data as unknown as SavedConfig,
          currentStep: draft.current_step ? parseInt(draft.current_step) : null,
          source: 'draft',
        },
      }
    }

    // 2. Last submitted snapshot
    const snap = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } })
    if (snap?.ui_config_data) {
      return {
        success: true,
        data: { config: snap.ui_config_data as unknown as SavedConfig, currentStep: null, source: 'snapshot' },
      }
    }

    // 3. Fresh start
    return { success: true, data: { config: null, currentStep: null, source: 'default' } }
  } catch (err) {
    console.error('[loadInitialConfigFromDb]', err)
    return { success: false, error: 'Failed to load configuration from database' }
  }
}

export async function loadSubmittedConfigFromDb(instanceId: string): Promise<ActionResponse<{ config: SavedConfig | null }>> {
  try {
    const validId = InstanceIdSchema.parse(instanceId)
    const snap = await prisma.instanceConfiguration.findFirst({ where: { instanceId: validId } })
    if (!snap?.ui_config_data) return { success: true, data: { config: null } }
    return { success: true, data: { config: snap.ui_config_data as unknown as SavedConfig } }
  } catch (err) {
    console.error('[loadSubmittedConfigFromDb]', err)
    return { success: false, error: 'Failed to load configuration from database' }
  }
}

const ModelRegistryRowSchema = z.object({
  model_key: z.string().regex(/^[A-Za-z0-9_]+$/),
  model_alias: z.string().regex(/^[A-Za-z0-9_]+$/),
  model_description: z.string(),
})
const ModelRegistryGroupSchema = z.object({
  parent: ModelRegistryRowSchema,
  submodels: z.array(ModelRegistryRowSchema),
})
const SyncModelRegistrySchema = z.object({
  instanceId: InstanceIdSchema,
  groups: z.array(ModelRegistryGroupSchema),
})

export async function syncModelRegistry(
  instanceId: string,
  groups: ModelRegistryGroup[]
): Promise<ActionResponse<{ rows: ModelRegistrySyncedRow[] }>> {
  try {
    const parsed = SyncModelRegistrySchema.parse({ instanceId, groups })
    const rows: ModelRegistrySyncedRow[] = []
    await prisma.$transaction(async (tx) => {
      for (const group of parsed.groups) {
        const parentRow = await tx.model_registry.upsert({
          where: { instance_id_model_key: { instance_id: parsed.instanceId, model_key: group.parent.model_key } },
          update: { model_alias: group.parent.model_alias, model_description: group.parent.model_description },
          create: {
            instance_id: parsed.instanceId,
            model_key: group.parent.model_key,
            model_alias: group.parent.model_alias,
            model_description: group.parent.model_description,
          },
        })
        rows.push({
          model_key: parentRow.model_key,
          model_alias: parentRow.model_alias,
          model_description: parentRow.model_description ?? '',
          parent_model_id: null,
        })
        for (const sub of group.submodels) {
          const subRow = await tx.model_registry.upsert({
            where: { instance_id_model_key: { instance_id: parsed.instanceId, model_key: sub.model_key } },
            update: { model_alias: sub.model_alias, model_description: sub.model_description, parent_model_id: parentRow.model_id },
            create: {
              instance_id: parsed.instanceId,
              model_key: sub.model_key,
              model_alias: sub.model_alias,
              model_description: sub.model_description,
              parent_model_id: parentRow.model_id,
            },
          })
          rows.push({
            model_key: subRow.model_key,
            model_alias: subRow.model_alias,
            model_description: subRow.model_description ?? '',
            parent_model_id: subRow.parent_model_id,
          })
        }
      }
    })
    return { success: true, data: { rows } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[syncModelRegistry]', msg)
    return { success: false, error: msg }
  }
}

export interface ModelRegistryEntry {
  model_id: number
  model_alias: string
}

export async function uploadModelFile(
  instanceId: string,
  modelId: number,
  fileName: string,
  displayName: string,
  fileBase64: string,
  metadata: Record<string, unknown> | null = null
): Promise<ActionResponse<null>> {
  try {
    const validId = InstanceIdSchema.parse(instanceId)
    const fileBytes = Buffer.from(fileBase64, 'base64')
    const metadataJson = metadata !== null ? JSON.stringify(metadata) : null
    await prisma.$executeRaw`
      INSERT INTO output.model_files_registry
        (instance_id, model_id, model_file_display_name, file_name, model_data, model_metadata)
      VALUES (${validId}, ${modelId}, ${displayName}, ${fileName}, ${fileBytes}, ${metadataJson}::jsonb)
      ON CONFLICT (instance_id, model_id, file_name)
      DO UPDATE SET
        model_data = EXCLUDED.model_data,
        model_file_display_name = EXCLUDED.model_file_display_name,
        model_metadata = EXCLUDED.model_metadata,
        updated_at = now()
    `
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[uploadModelFile]', msg)
    return { success: false, error: msg }
  }
}

export async function getModelRegistry(instanceId: string): Promise<ActionResponse<ModelRegistryEntry[]>> {
  try {
    const validId = InstanceIdSchema.parse(instanceId)
    const rows = await prisma.model_registry.findMany({
      where: { instance_id: validId, is_active: true },
      select: { model_id: true, model_alias: true },
      orderBy: { model_id: 'asc' },
    })
    return { success: true, data: rows }
  } catch (err) {
    console.error('[getModelRegistry]', err)
    return { success: false, error: 'Failed to load model registry' }
  }
}

