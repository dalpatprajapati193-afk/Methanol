'use server';

/**
 * egConfigurator server actions.
 *
 * Every function checks USE_MOCK_DATA and routes to either:
 *   - MockDB  (local development, no DB needed)
 *   - Prisma  (integrated mode, real PostgreSQL)
 *
 * The calling code (pages, components) never knows which path was taken.
 * To switch modes: set USE_MOCK_DATA=true|false in .env.local
 */

import { MockDB } from '../mock/MockData';
import prisma from '@/shared/libs/Prisma';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

// ---------------------------------------------------------------------------
// Shared response shape
// ---------------------------------------------------------------------------

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InstanceContext {
  instanceId: string;
  plantName: string;
  plantType: string;
  status: 'draft' | 'published';
  currentStep: number;
  configData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// getMockInstances — only called from the local launcher page
// ---------------------------------------------------------------------------

export async function getMockInstances(): Promise<InstanceContext[]> {
  if (!USE_MOCK) return [];
  return MockDB.listInstances().map((i) => ({
    instanceId: i.instanceId,
    plantName: i.plantName,
    plantType: i.plantType,
    status: i.status,
    currentStep: i.currentStep,
    configData: i.configData,
  }));
}

// ---------------------------------------------------------------------------
// getInstanceContext — load context for the wizard page
// ---------------------------------------------------------------------------

export async function getInstanceContext(
  instanceId: string
): Promise<ActionResponse<InstanceContext>> {
  try {
    if (USE_MOCK) {
      const instance = MockDB.getInstance(instanceId);
      if (!instance) {
        return { success: false, error: `Instance not found: ${instanceId}` };
      }
      return {
        success: true,
        data: {
          instanceId: instance.instanceId,
          plantName: instance.plantName,
          plantType: instance.plantType,
          status: instance.status,
          currentStep: instance.currentStep,
          configData: instance.configData,
        },
      };
    }

    // Integrated: read from EgPlantConfig
    const config = await (prisma as any).egPlantConfig.findUnique({
      where: { instanceId },
    });

    if (!config) {
      // First visit — create a new config record for this instance
      const created = await (prisma as any).egPlantConfig.create({
        data: {
          instanceId,
          configData: {},
          status: 'draft',
          currentStep: 1,
        },
      });
      return {
        success: true,
        data: {
          instanceId: created.instanceId,
          plantName: instanceId, // main product sets the name; we use instanceId as fallback
          plantType: 'EG Plant',
          status: 'draft',
          currentStep: created.currentStep,
          configData: created.configData as Record<string, unknown>,
        },
      };
    }

    return {
      success: true,
      data: {
        instanceId: config.instanceId,
        plantName: instanceId,
        plantType: 'EG Plant',
        status: config.status as 'draft' | 'published',
        currentStep: config.currentStep,
        configData: config.configData as Record<string, unknown>,
      },
    };
  } catch (err) {
    console.error('[getInstanceContext]', err);
    return { success: false, error: 'Failed to load instance context' };
  }
}

// ---------------------------------------------------------------------------
// saveStep — save one wizard step and append to history
// ---------------------------------------------------------------------------

export async function saveStep(
  instanceId: string,
  stepKey: string,
  stepData: Record<string, unknown>
): Promise<ActionResponse<InstanceContext>> {
  try {
    if (USE_MOCK) {
      const updated = MockDB.saveStep(instanceId, stepKey, stepData);
      return {
        success: true,
        data: {
          instanceId: updated.instanceId,
          plantName: updated.plantName,
          plantType: updated.plantType,
          status: updated.status,
          currentStep: updated.currentStep,
          configData: updated.configData,
        },
      };
    }

    // Integrated: update EgPlantConfig + append history row
    const existing = await (prisma as any).egPlantConfig.findUnique({
      where: { instanceId },
      include: { history: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!existing) {
      return { success: false, error: 'Instance not found' };
    }

    const nextVersion = (existing.history[0]?.version ?? 0) + 1;
    const nextStep = Math.max(
      existing.currentStep,
      extractStepNumber(stepKey)
    );
    const updatedConfig = {
      ...(existing.configData as Record<string, unknown>),
      ...stepData,
    };

    const [updated] = await prisma.$transaction([
      (prisma as any).egPlantConfig.update({
        where: { instanceId },
        data: {
          configData: updatedConfig as object,
          currentStep: nextStep,
          updatedAt: new Date(),
        },
      }),
      (prisma as any).egPlantConfigHistory.create({
        data: {
          configId: existing.id,
          version: nextVersion,
          stepSaved: stepKey,
          savedBy: 'user', // replace with session user when auth is live
          snapshot: updatedConfig as object,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        instanceId: updated.instanceId,
        plantName: instanceId,
        plantType: 'EG Plant',
        status: updated.status as 'draft' | 'published',
        currentStep: updated.currentStep,
        configData: updated.configData as Record<string, unknown>,
      },
    };
  } catch (err) {
    console.error('[saveStep]', err);
    return { success: false, error: 'Failed to save step' };
  }
}

// ---------------------------------------------------------------------------
// KPI / Soft Sensor types
// ---------------------------------------------------------------------------

export interface KpiTemplate {
  id: string;
  section: string;
  name: string;
  /** Display name / PI AF attribute name (from Excel col D) */
  attribute_name?: string;
  formula: string;
  kpi_type: 'calculated_tag' | 'soft_sensor';
  uom: string;
  variables: string[];
  /** Where this KPI lives in the pipeline output (from Excel col I) */
  pipeline_location?: string;
}

export interface SoftSensor {
  id: string;
  name: string;
  x_variables: string[];
}

// ---------------------------------------------------------------------------
// getKpiTemplates
// ---------------------------------------------------------------------------

/**
 * getKpiTemplates — returns a KPI list filtered to this instance's plant config.
 *
 * Mock mode: reads the instance's Step 1 configData and generates KPIs dynamically
 * so that only relevant KPIs (based on equipment flags) are shown in Step 2.
 *
 * Integrated mode: POSTs the plant config to FastAPI which evaluates show_conditions
 * against the Excel-defined KPI templates and returns the filtered list.
 */
export async function getKpiTemplates(
  instanceId: string
): Promise<ActionResponse<KpiTemplate[]>> {
  try {
    if (USE_MOCK) {
      // Load this instance's saved config to drive dynamic KPI filtering
      const instance = MockDB.getInstance(instanceId);
      const configData = instance?.configData ?? {};
      const templates = MockDB.listKpiTemplates(configData);
      return { success: true, data: templates };
    }

    // Integrated: fetch plant config from DB, then post to FastAPI for filtering
    const config = await (prisma as any).egPlantConfig.findUnique({ where: { instanceId } });
    const plantConfig = (config?.configData as Record<string, unknown>) ?? {};
    const FASTAPI_URL = process.env.FASTAPI_URL ?? 'http://localhost:8000';
    const res = await fetch(`${FASTAPI_URL}/api/eg-configurator/kpi-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_config: plantConfig }),
    });
    if (!res.ok) throw new Error(`FastAPI returned ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[getKpiTemplates]', err);
    return { success: false, error: 'Failed to load KPI templates' };
  }
}

// ---------------------------------------------------------------------------
// getSoftSensors
// ---------------------------------------------------------------------------

export async function getSoftSensors(): Promise<ActionResponse<SoftSensor[]>> {
  try {
    if (USE_MOCK) {
      const sensors = MockDB.listSoftSensors();
      return { success: true, data: sensors };
    }
    const FASTAPI_URL = process.env.FASTAPI_URL ?? 'http://localhost:8000';
    const res = await fetch(`${FASTAPI_URL}/api/eg-configurator/soft-sensors`);
    if (!res.ok) throw new Error(`FastAPI returned ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[getSoftSensors]', err);
    return { success: false, error: 'Failed to load soft sensors' };
  }
}

// ---------------------------------------------------------------------------
// saveKpiSelections
// ---------------------------------------------------------------------------

export async function saveKpiSelections(
  instanceId: string,
  selections: Record<string, unknown>
): Promise<ActionResponse<InstanceContext>> {
  return saveStep(instanceId, 'step2_kpi_selections', { kpi_selections: selections });
}

// ---------------------------------------------------------------------------
// getAdditionalInputs — list from Excel "Additional inputs" sheet
// ---------------------------------------------------------------------------

export interface AdditionalInputDef {
  id: string;
  name: string;
  attribute_name: string;
  uom: string;
  type: 'sensor' | 'constant';
}

export async function getAdditionalInputs(
  instanceId: string
): Promise<ActionResponse<AdditionalInputDef[]>> {
  try {
    if (USE_MOCK) {
      const inputs = MockDB.listAdditionalInputs();
      return { success: true, data: inputs };
    }
    // Integrated: fetch plant config, post to FastAPI for show_condition filtering
    const config = await (prisma as any).egPlantConfig.findUnique({ where: { instanceId } });
    const plantConfig = (config?.configData as Record<string, unknown>) ?? {};
    const FASTAPI_URL = process.env.FASTAPI_URL ?? 'http://localhost:8000';
    const res = await fetch(`${FASTAPI_URL}/api/eg-configurator/additional-inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_config: plantConfig }),
    });
    if (!res.ok) throw new Error(`FastAPI returned ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[getAdditionalInputs]', err);
    return { success: false, error: 'Failed to load additional inputs' };
  }
}

// ---------------------------------------------------------------------------
// saveInputMapping
// ---------------------------------------------------------------------------

export async function saveInputMapping(
  instanceId: string,
  mapping: Record<string, { type: 'sensor' | 'fixed' | 'not_set'; tag: string; fixedValue: string; uom: string }>
): Promise<ActionResponse<InstanceContext>> {
  return saveStep(instanceId, 'step3_input_mapping', { input_mapping: mapping });
}

// ---------------------------------------------------------------------------
// saveForecastConfig
// ---------------------------------------------------------------------------

export async function saveForecastConfig(
  instanceId: string,
  config: Record<string, { has_pi_tag: boolean; pi_tag: string; uom: string; x_variables: Record<string, { tag: string; uom: string }> }>
): Promise<ActionResponse<InstanceContext>> {
  return saveStep(instanceId, 'step4_forecast_config', { forecast_config: config });
}

// ---------------------------------------------------------------------------
// submitInstance — marks the config as 'published' (submitted to main product)
// ---------------------------------------------------------------------------

export async function submitInstance(instanceId: string): Promise<ActionResponse<InstanceContext>> {
  try {
    if (USE_MOCK) {
      const updated = MockDB.updateStatus(instanceId, 'published');
      return {
        success: true,
        data: {
          instanceId: updated.instanceId,
          plantName: updated.plantName,
          plantType: updated.plantType,
          status: updated.status,
          currentStep: 5,
          configData: updated.configData,
        },
      };
    }

    const existing = await (prisma as any).egPlantConfig.findUnique({
      where: { instanceId },
      include: { history: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!existing) {
      return { success: false, error: 'Instance not found' };
    }

    const nextVersion = (existing.history[0]?.version ?? 0) + 1;

    const [updated] = await prisma.$transaction([
      (prisma as any).egPlantConfig.update({
        where: { instanceId },
        data: { status: 'published', currentStep: 5, updatedAt: new Date() },
      }),
      (prisma as any).egPlantConfigHistory.create({
        data: {
          configId: existing.id,
          version: nextVersion,
          stepSaved: 'step5_submitted',
          savedBy: 'user',
          snapshot: existing.configData as object,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        instanceId: updated.instanceId,
        plantName: instanceId,
        plantType: 'EG Plant',
        status: 'published',
        currentStep: 5,
        configData: updated.configData as Record<string, unknown>,
      },
    };
  } catch (err) {
    console.error('[submitInstance]', err);
    return { success: false, error: 'Failed to submit configuration' };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractStepNumber(stepKey: string): number {
  const match = stepKey.match(/step(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}
