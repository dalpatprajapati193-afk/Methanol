/**
 * Jotai atoms for the PeRefDCU wizard + Blueprint Manager.
 *
 * Scope: feature-local (lives in app/PeRefDCU/store per AGENTS.md)
 * Blueprint reference data (tag mappings, models, UOM bank, etc.) is fetched
 * from FastAPI via Server Actions and loaded into state through
 * hydrateBlueprintAtom — it is never imported statically.
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type {
  Equipment, Furnace, DrumTrain, Fractionator, TopologyNode,
  FurnaceGeometry, AuxiliaryEquipmentConfig, PassTubeMapping, SpallConfig,
  SpallHeaterTubeConfig, SpallHeaterGroups, SpallHeaterOps,
  ModelParameter, TagEntry, ValueMapEntry, ModelTagMapping, WizardQuestion,
  MultipliedAttributeEntry, OdsRule, ModelEntry, UOMEntry,
  ModelParameterWithIds, ImputationPolicyEntry, FormState,
} from '../types'
import { HierarchyBuilder } from '../config/topology/hierarchyBuilder'
import { getBaseAttribute } from '../utils/attributeMultiplier'
import { buildUomIndex, type UomIndex } from '../utils/uomUtils'

// ─── Static UI config ───────────────────────────────────────────────────────

export const DASHBOARD_OPTIONS = [
  { value: 'dcu', label: 'Delayed Coker Unit', disabled: false, comingSoon: false },
  { value: 'cdu', label: 'Crude Distillation Unit', disabled: true, comingSoon: true },
]

export const DEFAULT_TAG_ENTRY: TagEntry = {
  tag_type: 'pi',
  pi_sensors: [{ sensor_code: 'sensor-1', sensor_name: '', sensor_uom: '' }],
  aggregation: 'add',
  sip_min: '',
  sip_max: '',
  sip_default_value: '',
  sip_policy: '0',
  constant_value: '',
  default_uom: '',
  attribute_uom: '',
}

export const emptyEquipment: Equipment = {
  furnaces: [], drumTrains: [], fractionators: [], trainFractionatorLinks: {},
}

// ─── Equipment-building helpers (pure, framework-agnostic) ───────────────────

const makeId = () => Math.random().toString(36).slice(2, 9)

export interface MatrixRow {
  trainName: string
  furnaceName: string
  cells: number
  passesPerCell: number
  tubesPerPass: number
  tmtTubeIndices: number[] // 0-based tube indices that have TMT (same for all passes in this row)
  drumsPerTrain: number
  tubeDisplayStart?: number // 1-based display number for the first tube
}

export function buildDefaultEquipment(
  numFurnaces: number, numCells: number, numPasses: number, numTubes: number,
  numDrumTrains: number, numDrumsPerTrain: number,
  numFractionators: number,
  numOverheads: number, numReboilers: number,
): Equipment {
  const furnaces: Furnace[] = Array.from({ length: numFurnaces }, (_, fi) => {
    const furnaceName = `H${fi + 1}`
    let passCounter = 1
    const cells = Array.from({ length: numCells }, (_, ci) => {
      const cellName = `Cell${String.fromCharCode(65 + ci)}`
      const passes = Array.from({ length: numPasses }, () => {
        const passName = `P${passCounter++}`
        const tubes = Array.from({ length: numTubes }, (_, ti) => ({
          id: makeId(), name: `T${ti + 1}`,
        }))
        return { id: makeId(), name: passName, tubes }
      })
      return { id: makeId(), name: cellName, passes }
    })
    return { id: makeId(), name: furnaceName, cells }
  })

  let drumIndex = 1
  const drumTrains: DrumTrain[] = Array.from({ length: numDrumTrains }, () => {
    const drums = Array.from({ length: Math.max(1, numDrumsPerTrain) }, () => ({
      id: makeId(), name: `D${drumIndex++}`,
    }))
    return { id: makeId(), name: drums.map(d => d.name).join('_'), drums }
  })

  const fractionators: Fractionator[] = Array.from({ length: numFractionators }, (_, fi) => {
    const suffix = String.fromCharCode(65 + fi)
    return {
      id: makeId(),
      name: `Fractionator${suffix}`,
      columnOverheads: Array.from({ length: numOverheads }, (_, i) => ({ id: makeId(), name: `column overhead${String.fromCharCode(65 + fi * numOverheads + i)}` })),
      columnReboilers: Array.from({ length: numReboilers }, (_, i) => ({ id: makeId(), name: `column reboiler${String.fromCharCode(65 + fi * numReboilers + i)}` })),
    }
  })

  return { furnaces, drumTrains, fractionators, trainFractionatorLinks: {} }
}

export function buildEquipmentFromMatrix(
  rows: MatrixRow[],
  fracLinks: Record<number, number[]>, // rowIdx → fractionator indices
  numFractionators: number,
  numOverheads: number,
  numReboilers: number,
  existing?: Equipment,
): Equipment {
  const furnaces: Furnace[] = rows.map((row, fi) => {
    const exF = existing?.furnaces[fi]
    let passCounter = 1
    const cells = Array.from({ length: Math.max(1, row.cells) }, (_, ci) => {
      const exC = exF?.cells[ci]
      const passes = Array.from({ length: Math.max(1, row.passesPerCell) }, (_, pi) => {
        const exP = exC?.passes[pi]
        const passName = `P${passCounter++}`
        const start = Math.max(1, row.tubeDisplayStart ?? 1)
        const tubes = Array.from({ length: Math.max(1, row.tubesPerPass) }, (_, ti) => {
          const exT = exP?.tubes[ti]
          return {
            id: exT?.id ?? makeId(),
            name: exT?.name ?? `T${start + ti}`,
            hasTMT: row.tmtTubeIndices.includes(ti),
          }
        })
        return { id: exP?.id ?? makeId(), name: exP?.name ?? passName, tubes }
      })
      return { id: exC?.id ?? makeId(), name: exC?.name ?? `Cell${String.fromCharCode(65 + ci)}`, passes }
    })
    return { id: exF?.id ?? makeId(), name: exF?.name ?? row.furnaceName, cells }
  })

  const drumTrains: DrumTrain[] = rows.map((row, tri) => {
    const exTrain = existing?.drumTrains[tri]
    const drums = Array.from({ length: Math.max(1, row.drumsPerTrain) }, (_, di) => {
      const exD = exTrain?.drums[di]
      return { id: exD?.id ?? makeId(), name: exD?.name ?? `D${di + 1}` }
    })
    return {
      id: exTrain?.id ?? makeId(),
      name: exTrain?.name ?? (row.trainName || drums.map(d => d.name).join('_')),
      drums,
    }
  })

  const fractionators: Fractionator[] = Array.from({ length: Math.max(0, numFractionators) }, (_, fi) => {
    const exFrac = existing?.fractionators[fi]
    const suffix = String.fromCharCode(65 + fi)
    return {
      id: exFrac?.id ?? makeId(),
      name: exFrac?.name ?? `Fractionator${suffix}`,
      columnOverheads: Array.from({ length: numOverheads }, (_, i) => {
        const exO = exFrac?.columnOverheads[i]
        return { id: exO?.id ?? makeId(), name: exO?.name ?? `column overhead${String.fromCharCode(65 + fi * numOverheads + i)}` }
      }),
      columnReboilers: Array.from({ length: numReboilers }, (_, i) => {
        const exR = exFrac?.columnReboilers[i]
        return { id: exR?.id ?? makeId(), name: exR?.name ?? `column reboiler${String.fromCharCode(65 + fi * numReboilers + i)}` }
      }),
    }
  })

  const trainFractionatorLinks: Record<string, string[]> = {}
  const trainFurnaceLinks: Record<string, string> = {}
  rows.forEach((_, rowIdx) => {
    const train = drumTrains[rowIdx]
    const furnace = furnaces[rowIdx]
    if (!train) return
    const linkedFracIndices = fracLinks[rowIdx] ?? (fractionators.length > 0 ? [0] : [])
    trainFractionatorLinks[train.id] = linkedFracIndices
      .filter(fi => fi >= 0 && fi < fractionators.length)
      .map(fi => fractionators[fi].id)
    if (furnace) trainFurnaceLinks[train.id] = furnace.id
  })

  return { furnaces, drumTrains, fractionators, trainFractionatorLinks, trainFurnaceLinks }
}

// ─── Migrate tagEntries from random equipment IDs to deterministic paths ─────

function buildEquipmentIdToPathMap(equipment: Equipment): Record<string, string> {
  const map: Record<string, string> = {}

  for (const furnace of equipment.furnaces) {
    map[furnace.id] = furnace.name
    for (const cell of furnace.cells) {
      map[cell.id] = `${furnace.name}/${cell.name}`
      for (const pass of cell.passes) {
        map[pass.id] = `${furnace.name}/${cell.name}/${pass.name}`
        for (const tube of pass.tubes) {
          map[tube.id] = `${furnace.name}/${cell.name}/${pass.name}/${tube.name}`
        }
      }
    }
    for (const sg of furnace.spallGroups ?? []) {
      map[sg.id] = `${furnace.name}/${sg.name}`
    }
  }

  for (const train of equipment.drumTrains) {
    map[train.id] = train.name
    for (const drum of train.drums) {
      map[drum.id] = `${train.name}/${drum.name}`
    }
  }

  for (const frac of equipment.fractionators) {
    map[frac.id] = frac.name
    for (const co of frac.columnOverheads) map[co.id] = `${frac.name}/${co.name}`
    for (const cr of frac.columnReboilers) map[cr.id] = `${frac.name}/${cr.name}`
  }

  return map
}

export function migrateTagEntries(
  tagEntries: Record<string, Record<string, TagEntry>>,
  equipment: Equipment,
): Record<string, Record<string, TagEntry>> {
  const idToPath = buildEquipmentIdToPathMap(equipment)
  const result: Record<string, Record<string, TagEntry>> = {}

  for (const [key, entries] of Object.entries(tagEntries)) {
    result[key === 'system_dcu' ? key : (idToPath[key] ?? key)] = entries
  }

  return result
}

// ─── Wizard navigation ─────────────────────────────────────────────────────────

export const stepAtom = atom<number>(1)
export const maxStepAtom = atom<number>(1)

export const setStepAtom = atom(null, (get, set, step: number) => {
  set(stepAtom, step)
  set(maxStepAtom, Math.max(get(maxStepAtom), step))
})

export const viewAtom = atom<'wizard' | 'blueprint-manager' | 'model-blueprint'>('wizard')
export const dashboardAtom = atom<string>('dcu')

export const dcuZoomAtom = atomWithStorage<number>('dcu_zoom', 1.0)

// ─── Client / affiliate identity ───────────────────────────────────────────────

export const clientIdAtom = atom<string>('')

// ─── Equipment & topology ──────────────────────────────────────────────────────

export const equipmentAtom = atom<Equipment>(emptyEquipment)
export const furnaceGeometryAtom = atom<FurnaceGeometry | null>(null)
export const auxiliaryEquipmentConfigAtom = atom<AuxiliaryEquipmentConfig | null>(null)
export const passTubeMappingAtom = atom<PassTubeMapping | null>(null)
export const spallConfigAtom = atom<SpallConfig | null>(null)

export const topologyTreeAtom = atom<TopologyNode[]>((get) => HierarchyBuilder.buildTree(get(equipmentAtom)))

// ─── Models ─────────────────────────────────────────────────────────────────

export const selectedModelIdsAtom = atom<number[]>([])

export const toggleModelAtom = atom(null, (get, set, modelId: number) => {
  const ids = get(selectedModelIdsAtom)
  set(selectedModelIdsAtom, ids.includes(modelId) ? ids.filter(id => id !== modelId) : [...ids, modelId])
})

export const modelParametersAtom = atom<Record<number, ModelParameter[]>>({})

export const setModelParametersAtom = atom(null, (get, set, modelId: number, params: ModelParameter[]) => {
  set(modelParametersAtom, { ...get(modelParametersAtom), [modelId]: params })
})

// ─── Tag entries (per-node attribute configuration) ────────────────────────────

export const tagEntriesAtom = atom<Record<string, Record<string, TagEntry>>>({})

export function getTagEntry(
  tagEntries: Record<string, Record<string, TagEntry>>,
  nodeId: string,
  attribute: string,
): TagEntry {
  return tagEntries[nodeId]?.[attribute] ?? { ...DEFAULT_TAG_ENTRY }
}

export const setTagEntryAtom = atom(null, (get, set, nodeId: string, attribute: string, entry: TagEntry) => {
  const tagEntries = get(tagEntriesAtom)
  set(tagEntriesAtom, {
    ...tagEntries,
    [nodeId]: { ...(tagEntries[nodeId] || {}), [attribute]: entry },
  })
})

// ─── Blueprint reference data ──────────────────────────────────────────────────
// Fetched from FastAPI via Server Actions; loaded into state via hydrateBlueprintAtom.

export const tagMappingsAtom = atom<ModelTagMapping[]>([])
export const valueMapAtom = atom<ValueMapEntry[]>([])
export const wizardQuestionsAtom = atom<WizardQuestion[]>([])
export const multipliedAttributesAtom = atom<MultipliedAttributeEntry[]>([])
export const odsRulesAtom = atom<OdsRule[]>([])
export const modelsAtom = atom<ModelEntry[]>([])
export const uomBankAtom = atom<UOMEntry[]>([])
export const modelParametersBlueprintAtom = atom<ModelParameterWithIds[]>([])
export const imputationPolicyAtom = atom<ImputationPolicyEntry[]>([])

export const uomIndexAtom = atom<UomIndex>((get) => buildUomIndex(get(uomBankAtom)))

export const uomSetAtom = atom<Record<string, string>>({})

export interface BlueprintPayload {
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

/**
 * Reconciles per-model parameters against the current blueprint: the blueprint decides which
 * parameters exist for a model (drops renamed/removed ones, adds new ones with defaults), while
 * any previously-saved value for a parameter name that still exists is preserved.
 */
function reconcileModelParameters(
  models: ModelEntry[],
  modelParamsBlueprint: ModelParameterWithIds[],
  existing: Record<number, ModelParameter[]>,
): Record<number, ModelParameter[]> {
  const reconciled: Record<number, ModelParameter[]> = {}
  for (const m of models) {
    const applicable = modelParamsBlueprint.filter(p => p.model_ids.includes(m.model_id))
    const existingForModel = existing[m.model_id] ?? []
    reconciled[m.model_id] = applicable.map(p => {
      const match = existingForModel.find(e => e.parameter === p.parameter)
      return { parameter: p.parameter, display_name: p.display_name, value: match?.value ?? p.value, description: p.description }
    })
  }
  return reconciled
}

function seedModelParameters(
  models: ModelEntry[],
  modelParamsBlueprint: ModelParameterWithIds[],
): Record<number, ModelParameter[]> {
  return reconcileModelParameters(models, modelParamsBlueprint, {})
}

/** Loads blueprint reference data fetched from FastAPI into state, reconciling per-model parameters against any already-loaded config. */
export const hydrateBlueprintAtom = atom(null, (get, set, payload: BlueprintPayload) => {
  set(tagMappingsAtom, payload.tagMappings)
  set(valueMapAtom, payload.valueMap)
  set(wizardQuestionsAtom, payload.wizardQuestions)
  set(multipliedAttributesAtom, payload.multipliedAttributes)
  set(odsRulesAtom, payload.odsRules)
  set(modelsAtom, payload.models)
  set(uomBankAtom, payload.uomBank)
  set(modelParametersBlueprintAtom, payload.modelParameters)
  set(imputationPolicyAtom, payload.imputationPolicy)

  const existing = get(modelParametersAtom)
  set(modelParametersAtom, reconcileModelParameters(payload.models, payload.modelParameters, existing))
})

// ─── Blueprint editing (Blueprint Manager / Model Blueprint Manager) ──────────

export const setTagMappingsAtom = atom(null, (get, set, updater: ModelTagMapping[] | ((prev: ModelTagMapping[]) => ModelTagMapping[])) => {
  set(tagMappingsAtom, typeof updater === 'function' ? updater(get(tagMappingsAtom)) : updater)
})
export const setWizardQuestionsAtom = atom(null, (get, set, updater: WizardQuestion[] | ((prev: WizardQuestion[]) => WizardQuestion[])) => {
  set(wizardQuestionsAtom, typeof updater === 'function' ? updater(get(wizardQuestionsAtom)) : updater)
})
export const setMultipliedAttributesAtom = atom(null, (get, set, updater: MultipliedAttributeEntry[] | ((prev: MultipliedAttributeEntry[]) => MultipliedAttributeEntry[])) => {
  set(multipliedAttributesAtom, typeof updater === 'function' ? updater(get(multipliedAttributesAtom)) : updater)
})
export const setOdsRulesAtom = atom(null, (get, set, updater: OdsRule[] | ((prev: OdsRule[]) => OdsRule[])) => {
  set(odsRulesAtom, typeof updater === 'function' ? updater(get(odsRulesAtom)) : updater)
})
export const setModelsAtom = atom(null, (get, set, updater: ModelEntry[] | ((prev: ModelEntry[]) => ModelEntry[])) => {
  set(modelsAtom, typeof updater === 'function' ? updater(get(modelsAtom)) : updater)
})

// ─── UOM set (per-category preferred UOM, applied across all tag entries) ─────

export const applyUomSetAtom = atom(null, (get, set) => {
  const uomSet = get(uomSetAtom)
  if (!Object.keys(uomSet).length) return

  const tagMappings = get(tagMappingsAtom)
  const tagEntries = get(tagEntriesAtom)
  const tree = get(topologyTreeAtom)

  const nodeMap: Record<string, { level: string }> = {}
  const visit = (node: TopologyNode) => {
    if (node.level) nodeMap[node.id] = { level: node.level }
    node.children.forEach(visit)
  }
  tree.forEach(visit)

  const updatedEntries: Record<string, Record<string, TagEntry>> = {}
  for (const [nodeId, attrs] of Object.entries(tagEntries)) {
    const nodeInfo = nodeMap[nodeId]
    const updatedAttrs: Record<string, TagEntry> = {}
    for (const [attribute, entry] of Object.entries(attrs)) {
      const baseAttr = getBaseAttribute(attribute)
      const mapping = tagMappings.find(m => m.level === (nodeInfo?.level ?? '') && m.attribute === baseAttr)
      const cat = mapping?.uom_category
      const targetUom = cat ? uomSet[cat] : undefined
      if (!targetUom) {
        updatedAttrs[attribute] = entry
        continue
      }
      updatedAttrs[attribute] = {
        ...entry,
        attribute_uom: entry.attribute_uom || targetUom,
        ...(entry.tag_type === 'pi' ? {
          pi_sensors: entry.pi_sensors.map(s => ({ ...s, sensor_uom: s.sensor_uom || targetUom })),
        } : {}),
      }
    }
    updatedEntries[nodeId] = updatedAttrs
  }
  set(tagEntriesAtom, updatedEntries)
})

// ─── Aggregated form state (for outputGenerator.ts, which takes a plain FormState) ──

export const formStateAtom = atom<FormState>((get) => ({
  step: get(stepAtom),
  maxStep: get(maxStepAtom),
  view: get(viewAtom),
  dashboard: get(dashboardAtom),
  clientId: get(clientIdAtom),
  equipment: get(equipmentAtom),
  furnaceGeometry: get(furnaceGeometryAtom),
  auxiliaryEquipmentConfig: get(auxiliaryEquipmentConfigAtom),
  passTubeMapping: get(passTubeMappingAtom),
  spallConfig: get(spallConfigAtom),
  selectedModelIds: get(selectedModelIdsAtom),
  modelParameters: get(modelParametersAtom),
  tagEntries: get(tagEntriesAtom),
  tagMappings: get(tagMappingsAtom),
  valueMap: get(valueMapAtom),
  wizardQuestions: get(wizardQuestionsAtom),
  multipliedAttributes: get(multipliedAttributesAtom),
  odsRules: get(odsRulesAtom),
  models: get(modelsAtom),
  uomSet: get(uomSetAtom),
}))

// ─── Config save / load / reset ────────────────────────────────────────────────

export interface SavedConfig {
  clientId: string
  dashboard: string
  selectedModelIds: number[]
  equipment: Equipment
  furnaceGeometry: FurnaceGeometry | null
  auxiliaryEquipmentConfig: AuxiliaryEquipmentConfig | null
  passTubeMapping: PassTubeMapping | null
  spallConfig: SpallConfig | null
  modelParameters: Record<number, ModelParameter[]>
  tagEntries: Record<string, Record<string, TagEntry>>
  uomSet?: Record<string, string>
}

/** Builds the serializable config payload passed to the saveConfig server action. */
export const buildSaveConfigPayloadAtom = atom((get): SavedConfig => ({
  clientId: get(clientIdAtom),
  dashboard: get(dashboardAtom),
  selectedModelIds: get(selectedModelIdsAtom),
  equipment: get(equipmentAtom),
  furnaceGeometry: get(furnaceGeometryAtom),
  auxiliaryEquipmentConfig: get(auxiliaryEquipmentConfigAtom),
  passTubeMapping: get(passTubeMappingAtom),
  spallConfig: get(spallConfigAtom),
  modelParameters: get(modelParametersAtom),
  tagEntries: get(tagEntriesAtom),
  uomSet: get(uomSetAtom),
}))

interface LegacySpallConfig {
  numHeaters?: number
  firingConfig?: 'double' | 'single'
  passesPerCell?: number
  uniformPasses?: boolean
  passesPerCellMap?: Record<string, number>
  drumsPerTrain?: number
  uniformDrums?: boolean
  drumsPerTrainMap?: Record<string, number>
  numFractionators?: number
  overheads?: number
  reboilers?: number
  passToCell?: Record<string, Record<string, number>>
  tubeConfigs?: Record<string, SpallHeaterTubeConfig>
  hasOpTags?: boolean
  heaterGroups?: Record<string, SpallHeaterGroups>
  spallOps?: Record<string, SpallHeaterOps>
}

/** Applies a loaded config (from the loadConfig server action) into state, migrating legacy shapes. */
export const hydrateConfigAtom = atom(null, (get, set, config: SavedConfig) => {
  let furnaceGeometry = config.furnaceGeometry
  let auxiliaryEquipmentConfig = config.auxiliaryEquipmentConfig
  let passTubeMapping = config.passTubeMapping
  let spallConfig = config.spallConfig

  const legacy = spallConfig as LegacySpallConfig | null
  if (!furnaceGeometry && legacy && 'numHeaters' in legacy) {
    furnaceGeometry = {
      numHeaters: legacy.numHeaters!,
      firingConfig: legacy.firingConfig!,
      passesPerCell: legacy.passesPerCell!,
      uniformPasses: legacy.uniformPasses!,
      passesPerCellMap: legacy.passesPerCellMap || {},
    }
    auxiliaryEquipmentConfig = {
      drumsPerTrain: legacy.drumsPerTrain!,
      uniformDrums: legacy.uniformDrums!,
      drumsPerTrainMap: legacy.drumsPerTrainMap || {},
      numFractionators: legacy.numFractionators!,
      overheads: legacy.overheads!,
      reboilers: legacy.reboilers!,
    }
    passTubeMapping = {
      passToCell: legacy.passToCell || {},
      tubeConfigs: legacy.tubeConfigs || {},
    }
    spallConfig = {
      hasOpTags: legacy.hasOpTags!,
      heaterGroups: legacy.heaterGroups || {},
      spallOps: legacy.spallOps || {},
    }
  }

  const migratedTagEntries = migrateTagEntries(config.tagEntries, config.equipment)

  set(dashboardAtom, config.dashboard)
  set(selectedModelIdsAtom, config.selectedModelIds)
  set(equipmentAtom, config.equipment)
  set(furnaceGeometryAtom, furnaceGeometry)
  set(auxiliaryEquipmentConfigAtom, auxiliaryEquipmentConfig)
  set(passTubeMappingAtom, passTubeMapping)
  set(spallConfigAtom, spallConfig)
  const blueprint = get(modelParametersBlueprintAtom)
  const models = get(modelsAtom)
  set(modelParametersAtom,
    blueprint.length > 0 && models.length > 0
      ? reconcileModelParameters(models, blueprint, config.modelParameters)
      : config.modelParameters
  )
  set(tagEntriesAtom, migratedTagEntries)
  set(uomSetAtom, config.uomSet ?? {})
})

export const resetWizardAtom = atom(null, (get, set) => {
  set(stepAtom, 1)
  set(maxStepAtom, 1)
  set(dashboardAtom, 'dcu')
  set(clientIdAtom, '')
  set(equipmentAtom, emptyEquipment)
  set(furnaceGeometryAtom, null)
  set(auxiliaryEquipmentConfigAtom, null)
  set(passTubeMappingAtom, null)
  set(spallConfigAtom, null)
  set(selectedModelIdsAtom, [])
  set(tagEntriesAtom, {})
  set(uomSetAtom, {})
  set(modelParametersAtom, seedModelParameters(get(modelsAtom), get(modelParametersBlueprintAtom)))
})
