import * as XLSX from 'xlsx'
import type {
  FormState, TopologyNode, SpallConfig, TagEntry, Equipment,
  OutputRow_InstantiatedAttributes, OutputRow_SensorsMapping,
  OutputRow_UserPreferences, OutputRow_ModelParameterConfig,
  FurnaceGeometry, PassTubeMapping, ModelParameterWithIds, ImputationPolicyEntry,
} from '../types'
import { HierarchyBuilder } from '../config/topology/hierarchyBuilder'
import { buildFormulaExpression } from './formulaUtils'
import { expandInferredExpression } from './inferredFormulaExpander'
import { isAttributeMappingVisible } from './attributeVisibility'
import { expandMultipliedMapping, getBaseAttribute } from './attributeMultiplier'
import type { UomIndex } from './uomUtils'

function buildTopologyTree(equipment: Equipment): TopologyNode[] {
  return HierarchyBuilder.buildTree(equipment)
}

// ─── Spall JSON builder (mirrors spall_config_ui.html logic) ─────────────────

function generateSpallStatusFormula(
  spall: SpallConfig,
  heaterId: number,
  passNum: number,
  totalPasses: number,
): string {
  const h = heaterId
  const opAssignment = spall.spallOps[String(h)]?.assignment || {}
  const opGroupNum = opAssignment[String(passNum)]
  if (!opGroupNum) return ''

  const passesInOp = Array.from({ length: totalPasses }, (_, i) => i + 1)
    .filter(p => opAssignment[String(p)] === opGroupNum)
    .sort((a, b) => a - b)

  const groupAssignment = spall.heaterGroups[String(h)]?.assignment || {}
  const steamGroupsToCheck = [...new Set(
    passesInOp.map(p => groupAssignment[String(p)]).filter(Boolean)
  )].sort((a, b) => (a as number) - (b as number)) as number[]

  const conditions: string[] = []
  passesInOp.forEach(p => conditions.push(`({h${h}p${p}_feed_md}==1)`))
  steamGroupsToCheck.forEach(g => conditions.push(`({h${h}sg${g}_spall_steam}>0)`))
  if (spall.hasOpTags) {
    steamGroupsToCheck.forEach(g => conditions.push(`({h${h}sg${g}_spall_steam_op}>0)`))
  }
  return `if(${conditions.join(' & ')}, 1, 0)`
}

function buildSpallOutputJSON(
  spall: SpallConfig,
  equipment: Equipment,
  tagEntries: Record<string, Record<string, TagEntry>>,
  furnaceGeometry: FurnaceGeometry | null,
  passTubeMapping: PassTubeMapping | null
) {
  if (!furnaceGeometry || !passTubeMapping) return { heaters: [] }

  const cells = furnaceGeometry.firingConfig === 'double' ? 2 : 1
  const totalPasses = cells === 1
    ? furnaceGeometry.passesPerCell
    : (furnaceGeometry.uniformPasses
        ? cells * furnaceGeometry.passesPerCell
        : Object.values(furnaceGeometry.passesPerCellMap).reduce((s, v) => s + v, 0) || cells * furnaceGeometry.passesPerCell)

  const heaters = Array.from({ length: furnaceGeometry.numHeaters }, (_, i) => {
    const h = i + 1
    const numGroups = spall.heaterGroups[String(h)]?.numGroups || 1
    const groupAssignment = spall.heaterGroups[String(h)]?.assignment || {}
    const numOps = spall.spallOps[String(h)]?.numOps || 1
    const opAssignment = spall.spallOps[String(h)]?.assignment || {}

    const groupMap: Record<number, number[]> = {}
    for (let g = 1; g <= numGroups; g++) groupMap[g] = []
    for (let p = 1; p <= totalPasses; p++) {
      const g = groupAssignment[String(p)]
      if (g) groupMap[g].push(p)
    }

    const opMap: Record<number, number[]> = {}
    for (let op = 1; op <= numOps; op++) opMap[op] = []
    for (let p = 1; p <= totalPasses; p++) {
      const op = opAssignment[String(p)]
      if (op) opMap[op].push(p)
    }

    const passToCellMap: Record<number, number> = {}
    for (let p = 1; p <= totalPasses; p++) {
      passToCellMap[p] = Number(passTubeMapping.passToCell[String(h)]?.[String(p)] || 1)
    }

    const tubeConf = passTubeMapping.tubeConfigs[String(h)]
    const formulas: Record<string, string> = {}
    for (let p = 1; p <= totalPasses; p++) {
      formulas[`h${h}p${p}_spall_status`] = generateSpallStatusFormula(spall, h, p, totalPasses)
    }

    const furnace = equipment.furnaces[h - 1]
    return {
      heater_id: h,
      firing_config: furnaceGeometry.firingConfig,
      cells_per_heater: cells,
      passes_per_cell: furnaceGeometry.passesPerCell,
      uniform_passes: furnaceGeometry.uniformPasses,
      passes_per_cell_map: furnaceGeometry.uniformPasses ? null : furnaceGeometry.passesPerCellMap,
      total_passes: totalPasses,
      has_op_tags: spall.hasOpTags,
      tube_config: tubeConf ? {
        total_tubes_per_pass: tubeConf.totalTubesPerPass,
        radiant_tubes_per_pass: tubeConf.radiantTubesPerPass,
        convection_tubes_per_pass: tubeConf.convectionTubesPerPass,
        tube_numbering: tubeConf.tubeNumbering,
        tmt_tags: { radiant: [...tubeConf.tmtTubes], convection: [] },
      } : null,
      spall_steam_groups: Object.entries(groupMap)
        .filter(([, passes]) => passes.length > 0)
        .map(([g, passes]) => {
          const sg = furnace?.spallGroups?.find(s => s.groupNum === Number(g))
          const sgPath = sg ? `${furnace?.name}/${sg.name}` : undefined
          const entry = sgPath ? tagEntries[sgPath]?.['spall_steam_flow'] : undefined
          const piTag = entry?.pi_sensors?.[0]?.sensor_name
          const alias = piTag || `h${h}sg${g}_spall_steam`
          return {
            group_id: `sg${g}`,
            passes,
            alias,
          }
        }),
      spall_operation_groups: Object.entries(opMap)
        .filter(([, passes]) => passes.length > 0)
        .map(([op, passes]) => ({ op_id: `op${op}`, passes })),
      pass_to_cell: passToCellMap,
      formulas,
    }
  })

  return { heaters }
}

// ─── Flatten tree ─────────────────────────────────────────────────────────────

export function flattenTree(nodes: TopologyNode[]): TopologyNode[] {
  const result: TopologyNode[] = []
  const visit = (node: TopologyNode) => {
    if (node.level) result.push(node) // skip container nodes with no level
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

// ─── Build output rows ────────────────────────────────────────────────────────

export function generateOutputs(state: FormState, uomIndex: UomIndex) {
  const tree = buildTopologyTree(state.equipment)
  const allNodes = flattenTree(tree)

  const instantiated: OutputRow_InstantiatedAttributes[] = []
  const sensorsMapping: OutputRow_SensorsMapping[] = []

  // Collect all system-level constants for use in formula expansion
  const systemConstants: Record<string, string> = {}
  const systemEntries = state.tagEntries['system_dcu'] ?? {}
  for (const [attr, entry] of Object.entries(systemEntries)) {
    if (entry.tag_type === 'constant') {
      systemConstants[attr] = entry.constant_value
    }
  }

  // Relevant multiplied-attribute rules for the selected models
  const relevantMultipliedAttrs = (state.multipliedAttributes ?? [])
    .filter(e => e.model_ids.some(id => state.selectedModelIds.includes(id)))

  const attrModelIds: Record<string, Record<string, number[]>> = {} // level → attr → [model_ids]
  for (const mapping of state.tagMappings) {
    const relevantIds = mapping.model_ids.filter(id => state.selectedModelIds.includes(id))
    if (relevantIds.length === 0) continue

    const getTagEntryLocal = (nodeId: string, attr: string) => state.tagEntries[nodeId]?.[attr]
    if (!isAttributeMappingVisible(mapping, getTagEntryLocal)) continue

    const expanded = expandMultipliedMapping(mapping, getTagEntryLocal, relevantMultipliedAttrs)
    for (const m of expanded) {
      if (!attrModelIds[m.level]) attrModelIds[m.level] = {}
      if (!attrModelIds[m.level][m.attribute]) attrModelIds[m.level][m.attribute] = []
      for (const mid of relevantIds) {
        if (!attrModelIds[m.level][m.attribute].includes(mid))
          attrModelIds[m.level][m.attribute].push(mid)
      }
    }
  }

  for (const node of allNodes) {
    const levelAttrs = attrModelIds[node.level]
    if (!levelAttrs) continue

    for (const [attribute] of Object.entries(levelAttrs)) {
      const entry = state.tagEntries[node.id]?.[attribute]
      const uom = entry?.default_uom || null

      const baseAttribute = getBaseAttribute(attribute)
      const blueprintMapping = state.tagMappings.find(m => m.level === node.level && m.attribute === baseAttribute)
      const nIndex = attribute !== baseAttribute ? attribute.match(/_(\d+)$/)?.[1] : undefined
      const isBlueprintFormula = blueprintMapping?.type === 'Inferred'
        || blueprintMapping?.type === 'Cause'
        || blueprintMapping?.type === 'Effect'
      const _smMid1 = blueprintMapping?.model_ids?.[0]
      const _smModel1 = _smMid1 !== undefined ? state.models.find(x => x.model_id === _smMid1) : undefined
      const _smPrefix1 = _smModel1 ? _smModel1.model_alias.toLowerCase().replace(/\s+/g, '_') : undefined
      const formula = isBlueprintFormula && blueprintMapping?.expression
        ? expandInferredExpression(blueprintMapping.expression, node, state.tagMappings, {
            equipment: state.equipment,
            spallConfig: state.spallConfig,
            constants: systemConstants,
            nIndex,
            modelPrefix: _smPrefix1,
          })
        : entry?.tag_type === 'formula'
          ? (buildFormulaExpression(entry.pi_sensors, entry.aggregation, uomIndex, entry.default_uom) || null)
          : null
      const constVal = entry?.tag_type === 'constant' ? (entry.constant_value || null) : null

      instantiated.push({
        element_path: node.path,
        element_code: node.elementCode,
        element_name: node.name,
        level: node.level,
        attribute,
        default_uom: uom,
        formula: formula,
        constant_value: constVal,
        client_id: state.clientId === 'auto' ? '' : state.clientId,
      })

      if (!entry || entry.tag_type === 'pi') {
        const firstSensor = entry?.pi_sensors?.[0]
        const dataType = entry?.data_type || blueprintMapping?.data_type || null
        sensorsMapping.push({
          element_path: node.level === 'System' ? node.path : node.parentPath,
          element_code: node.elementCode,
          level: node.level,
          attribute,
          sensor_code: firstSensor?.sensor_code || null,
          sensor_name: firstSensor?.sensor_name || null,
          sensor_uom: firstSensor?.sensor_uom || uom,
          sip_min: entry?.sip_min !== '' && entry?.sip_min != null ? Number(entry.sip_min) : null,
          sip_max: entry?.sip_max !== '' && entry?.sip_max != null ? Number(entry.sip_max) : null,
          sip_default_value: entry?.sip_default_value !== '' && entry?.sip_default_value != null ? Number(entry.sip_default_value) : null,
          sip_policy: entry?.sip_policy || '0',
          data_type: dataType,
          client_id: state.clientId === 'auto' ? '' : state.clientId,
        })
      }
    }
  }

  // user_preferences
  const userPrefs: OutputRow_UserPreferences[] = state.models.map(m => ({
    client_id: state.clientId === 'auto' ? '' : state.clientId,
    system: state.dashboard,
    sub_system: m.group === 'coke_drum' ? 'coker' : m.group,
    model: m.name,
    model_id: m.model_id,
    active: state.selectedModelIds.includes(m.model_id) ? 1 : 0,
  }))

  // model_parameter_config
  const modelParams: OutputRow_ModelParameterConfig[] = []
  for (const [modelIdStr, params] of Object.entries(state.modelParameters)) {
    const modelId = Number(modelIdStr)
    if (!state.selectedModelIds.includes(modelId)) continue
    for (const p of params) {
      modelParams.push({
        model_id: modelId,
        parameter: p.parameter,
        value: p.value !== '' ? p.value : null,
        description: p.description || null,
      })
    }
  }

  return { instantiated, sensorsMapping, userPrefs, modelParams }
}

// ─── JSON output ──────────────────────────────────────────────────────────────

export function generateJSON(state: FormState, uomIndex: UomIndex) {
  const { instantiated, sensorsMapping, userPrefs, modelParams } = generateOutputs(state, uomIndex)

  const tree = buildTopologyTree(state.equipment)
  const allNodes = flattenTree(tree)

  // Build tag entries section
  const tagSection: Record<string, Record<string, unknown>> = {}
  for (const node of allNodes) {
    const nodeEntries = state.tagEntries[node.id]
    if (nodeEntries && Object.keys(nodeEntries).length > 0) {
      tagSection[node.path] = {}
      for (const [attr, entry] of Object.entries(nodeEntries)) {
        if (entry.tag_type === 'pi') {
          tagSection[node.path][attr] = {
            type: 'pi',
            pi_sensors: entry.pi_sensors,
            sip_min: entry.sip_min !== '' ? Number(entry.sip_min) : null,
            sip_max: entry.sip_max !== '' ? Number(entry.sip_max) : null,
            sip_default_value: entry.sip_default_value !== '' ? Number(entry.sip_default_value) : null,
            sip_policy: entry.sip_policy,
            default_uom: entry.default_uom || null,
          }
        } else if (entry.tag_type === 'formula') {
          tagSection[node.path][attr] = {
            type: 'formula',
            pi_sensors: entry.pi_sensors,
            aggregation: entry.aggregation,
            formula: buildFormulaExpression(entry.pi_sensors, entry.aggregation, uomIndex, entry.default_uom) || null,
          }
        } else {
          tagSection[node.path][attr] = {
            type: 'constant',
            constant_value: entry.constant_value || null,
            default_uom: entry.default_uom || null,
          }
        }
      }
    }
  }

  // Build spall config section if present
  const spallSection = state.spallConfig ? buildSpallOutputJSON(state.spallConfig, state.equipment, state.tagEntries, state.furnaceGeometry, state.passTubeMapping) : null

  return {
    dashboard: state.dashboard,
    client_id: state.clientId === 'auto' ? null : state.clientId,
    equipment: state.equipment,
    spall_config: spallSection,
    selected_models: state.models.filter(m => state.selectedModelIds.includes(m.model_id)).map(m => m.name),
    tag_mappings: tagSection,
    model_parameters: modelParams,
    outputs: {
      instantiated_attributes: instantiated,
      sensors_mapping: sensorsMapping,
      user_preferences: userPrefs,
      model_parameter_config: modelParams,
      model_tag_mapping: state.tagMappings,
    },
  }
}

// ─── Excel download ───────────────────────────────────────────────────────────

export function downloadExcel(state: FormState, uomIndex: UomIndex, filename = 'dcu_config_output.xlsx') {
  const { instantiated, sensorsMapping, userPrefs, modelParams } = generateOutputs(state, uomIndex)

  const wb = XLSX.utils.book_new()

  const addSheet = <T extends object>(name: string, rows: T[]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  addSheet('model_parameter_config', modelParams)
  addSheet('intantiated_attributes', instantiated)
  addSheet('Sensors_Mapping', sensorsMapping)
  addSheet('user_preferences', userPrefs)
  // Include model_tag_mapping so downstream systems can use it
  // Expand model_ids array to one row per model_id for Excel compatibility
  const expandedMappings = state.tagMappings.flatMap(m =>
    m.model_ids.map(id => ({ model_id: id, level: m.level, attribute: m.attribute }))
  )
  addSheet('model_tag_mapping', expandedMappings)

  XLSX.writeFile(wb, filename)
}

// ─── ODS Rules expansion ─────────────────────────────────────────────────────

// Maps <<keyword_N>> placeholders to topology level names
const ODS_LEVEL_KEYWORDS: Record<string, string> = {
  fur: 'Furnace',
  cell: 'Cell',
  pass: 'Pass',
  tube: 'Tube',
  drum: 'Drum',
  sg: 'Spall Group',
  dt: 'Drum train',
  frac: 'Fractionator',
  oh: 'Column Overhead',
  rb: 'Column Reboiler',
}

// Replace <<keyword_N>> placeholders in a message using the ancestor chain of causeNode.
function expandOdsMessage(
  message: string,
  causeNode: TopologyNode,
  allNodes: TopologyNode[],
): string {
  if (!message || !message.includes('<<')) return message

  const kwMap: Record<string, string> = {}
  for (const [kw, level] of Object.entries(ODS_LEVEL_KEYWORDS)) {
    const ancestor = allNodes.find(n =>
      n.level === level &&
      (causeNode.path === n.path || causeNode.path.startsWith(n.path + '/'))
    )
    if (ancestor) {
      kwMap[kw] = ancestor.path.split('/').pop() ?? ancestor.path
    }
  }

  return message.replace(/<<(\w+)_N>>/g, (match, kw) =>
    kw in kwMap ? kwMap[kw] : match
  )
}

function buildOdsRulesRows(state: FormState): { rulesRows: Record<string, unknown>[], registryRows: Record<string, unknown>[] } {
  if (!state.odsRules?.length) return { rulesRows: [], registryRows: [] }

  const tree = buildTopologyTree(state.equipment)
  const allNodes = flattenTree(tree)

  const nodesByLevel = new Map<string, TopologyNode[]>()
  for (const node of allNodes) {
    if (!nodesByLevel.has(node.level)) nodesByLevel.set(node.level, [])
    nodesByLevel.get(node.level)!.push(node)
  }

  const attrLevel = new Map<string, string>()
  for (const m of state.tagMappings) {
    if (m.attribute && m.level) attrLevel.set(m.attribute, m.level)
  }

  const multMap: Record<string, { countAttr: string; nodeId: string }> = {}
  for (const ma of (state.multipliedAttributes ?? [])) {
    multMap[ma.attribute] = { countAttr: ma.countAttr, nodeId: ma.nodeId ?? 'system_dcu' }
  }
  function stepCount(attrName: string): number {
    const ma = multMap[attrName]
    if (!ma) return 1
    const val = state.tagEntries?.[ma.nodeId]?.[ma.countAttr]?.constant_value
    return Math.max(1, Number(val) || 1)
  }

  const rulesRows: Record<string, unknown>[] = []
  const registryRows: Record<string, unknown>[] = []

  for (const rule of state.odsRules) {
    if (!state.selectedModelIds.includes(rule.model_id)) continue

    const causeLevel = attrLevel.get(rule.cause_tag)
    if (!causeLevel) continue

    const causeNodes = nodesByLevel.get(causeLevel) ?? []

    const makeSn = (attrName: string, causeNode: TopologyNode): string => {
      if (!attrName) return ''
      const level = attrLevel.get(attrName)
      if (!level) return attrName
      const levelNodes = nodesByLevel.get(level) ?? []
      const ancestor = levelNodes.find(n =>
        causeNode.path === n.path || causeNode.path.startsWith(n.path + '/')
      )
      if (!ancestor) return attrName
      return (ancestor.path.replace(/\//g, '_') + '_' + attrName).toLowerCase()
    }

    const makeSnStepped = (attrName: string, causeNode: TopologyNode, step: number): string => {
      const base = makeSn(attrName, causeNode)
      if (!base || !multMap[attrName]) return base
      return `${base}_${step}`
    }

    const ruleTags = [rule.cause_tag, rule.effect_tag, rule.cause_monitoring_tag, rule.effect_monitoring_tag].filter(Boolean)
    const maxSteps = Math.max(...ruleTags.map(stepCount))

    for (let step = 1; step <= maxSteps; step++) {
      const causeStepSuffix = multMap[rule.cause_tag] ? `_${step}` : ''
      for (const causeNode of causeNodes) {
        const causePrefix = causeNode.path.replace(/\//g, '_').toLowerCase()
        const expandedCauseTag = causePrefix + '_' + rule.cause_tag + causeStepSuffix
        const odsMessageKey = `dcu_${expandedCauseTag}`
        rulesRows.push({
          cause_tag: expandedCauseTag,
          effect_tag: makeSnStepped(rule.effect_tag, causeNode, step),
          cause_monitoring_tag: makeSnStepped(rule.cause_monitoring_tag, causeNode, step),
          effect_monitoring_tag: makeSnStepped(rule.effect_monitoring_tag, causeNode, step),
          ods_message_key: odsMessageKey,
          actionable_tolerance: rule.actionable_tolerance,
        })
        const nodeIdForAttr = (attrName: string): string => {
          const level = attrLevel.get(attrName)
          if (!level) return 'system_dcu'
          const ancestor = (nodesByLevel.get(level) ?? []).find(n =>
            causeNode.path === n.path || causeNode.path.startsWith(n.path + '/')
          )
          return ancestor?.id ?? 'system_dcu'
        }
        const resolveTagValue = (attrName: string, nodeId: string, sensorIdx?: number): string | null => {
          const entry = state.tagEntries?.[nodeId]?.[attrName]
          if (!entry) return null
          if (entry.tag_type === 'constant') return entry.constant_value || null
          if (entry.pi_sensors?.length) {
            if (sensorIdx !== undefined) {
              const s = entry.pi_sensors[sensorIdx]
              return s ? (s.sensor_name || s.sensor_code || null) : null
            }
            return entry.pi_sensors.map(s => s.sensor_name || s.sensor_code).filter(Boolean).join(', ') || null
          }
          return null
        }
        registryRows.push({
          ods_message_key: odsMessageKey,
          ods_message_text: expandOdsMessage(rule.message, causeNode, allNodes)
            .replace(/<<N>>/g, String(step))
            .replace(/<<\{(\w+)_N(?:\[(\d+)\])?\}>>/g, (match, baseAttr, idxStr) => {
              const stepAttr = `${baseAttr}_${step}`
              const nodeId = multMap[baseAttr]?.nodeId ?? nodeIdForAttr(baseAttr)
              const idx = idxStr !== undefined ? Number(idxStr) : undefined
              return resolveTagValue(stepAttr, nodeId, idx) ?? match
            })
            .replace(/<<\{(\w+)(?:\[(\d+)\])?\}>>/g, (match, attrName, idxStr) => {
              const nodeId = nodeIdForAttr(attrName)
              const idx = idxStr !== undefined ? Number(idxStr) : undefined
              return resolveTagValue(attrName, nodeId, idx) ?? match
            }),
        })
      }
    }
  }

  return { rulesRows, registryRows }
}

// ─── Model info builder ───────────────────────────────────────────────────────

function buildModelInfoRows(models: FormState['models']): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const m of models) {
    if (!m.model_level) continue // no real topology expansion — just a placeholder submodel, nothing to report
    const parentFields = {
      model_id: m.model_id,
      model_name: m.name,
      model_alias: m.model_alias,
      model_display: m.model_display ?? '',
      model_description: m.model_description ?? '',
      group: m.group,
      model_level: m.model_level,
      model_attributes: (m.attributes ?? []).join(','),
    }
    for (const sm of m.sub_models ?? []) {
      rows.push({
        ...parentFields,
        sub_model_id: sm.sub_model_id,
        sub_model_alias: sm.sub_model_name,
        features_x: (sm.attributes ?? []).join(','),
        targets_y: (sm.target_variable ?? []).join(','),
        cumulative_attributes: (sm.cumulative_attributes ?? []).join(','),
        model_skip_attributes: (sm.model_skip_attributes ?? []).join(','),
      })
    }
  }
  return rows
}

export interface ModelRegistryRow {
  model_key: string
  model_alias: string
  model_description: string
}

export interface ModelRegistryGroup {
  parent: ModelRegistryRow
  submodels: ModelRegistryRow[]
}

export interface ModelRegistrySyncedRow extends ModelRegistryRow {
  parent_model_id: number | null
}

export function buildModelRegistryGroups(state: FormState): ModelRegistryGroup[] {
  const groups: ModelRegistryGroup[] = []
  for (const m of state.models.filter(m => state.selectedModelIds.includes(m.model_id))) {
    const parent: ModelRegistryRow = {
      model_key: `dcu_${m.name}`,
      model_alias: m.model_alias,
      model_description: m.model_display ?? '',
    }
    const submodels: ModelRegistryRow[] = []
    if (m.model_level) { // no real topology expansion otherwise — just a placeholder submodel
      for (const sm of m.sub_models ?? []) {
        submodels.push({
          model_key: `dcu_${sm.sub_model_name.toLowerCase()}`,
          model_alias: sm.sub_model_name,
          model_description: sm.sub_model_name,
        })
      }
    }
    groups.push({ parent, submodels })
  }
  return groups
}

export function buildModelRegistryRows(state: FormState): ModelRegistryRow[] {
  return buildModelRegistryGroups(state).flatMap(g => [g.parent, ...g.submodels])
}

// ─── PI Tag Bank Excel (matches reference format) ────────────────────────────

function buildPiTagBankWorkbook(
  state: FormState,
  uomIndex: UomIndex,
  modelParametersBlueprint: ModelParameterWithIds[],
  imputationPolicy: ImputationPolicyEntry[],
  syncedModelRegistryRows?: ModelRegistrySyncedRow[]
): XLSX.WorkBook {
  const tree = buildTopologyTree(state.equipment)
  const allNodes = flattenTree(tree)

  const piTagBankRows: Record<string, unknown>[] = []
  const tagsRows: Record<string, unknown>[] = []
  const tagRegistryRows: Record<string, unknown>[] = []
  const sipRulesRows: Record<string, unknown>[] = []

  // Collect all system-level constants for use in formula expansion
  const systemConstants: Record<string, string> = {}
  const systemEntries = state.tagEntries['system_dcu'] ?? {}
  for (const [attr, entry] of Object.entries(systemEntries)) {
    if (entry.tag_type === 'constant') {
      systemConstants[attr] = entry.constant_value
    }
  }

  // Relevant multiplied-attribute rules for the selected models
  const relevantMultipliedAttrs = (state.multipliedAttributes ?? [])
    .filter(e => e.model_ids.some(id => state.selectedModelIds.includes(id)))

  const attrModelIds: Record<string, Record<string, number[]>> = {}
  for (const mapping of state.tagMappings) {
    const relevantIds = mapping.model_ids.filter(id => state.selectedModelIds.includes(id))
    if (relevantIds.length === 0) continue

    const getTagEntryLocal = (nodeId: string, attr: string) => state.tagEntries[nodeId]?.[attr]
    if (!isAttributeMappingVisible(mapping, getTagEntryLocal)) continue

    const expanded = expandMultipliedMapping(mapping, getTagEntryLocal, relevantMultipliedAttrs)
    for (const m of expanded) {
      if (!attrModelIds[m.level]) attrModelIds[m.level] = {}
      if (!attrModelIds[m.level][m.attribute]) attrModelIds[m.level][m.attribute] = []
      for (const mid of relevantIds) {
        if (!attrModelIds[m.level][m.attribute].includes(mid))
          attrModelIds[m.level][m.attribute].push(mid)
      }
    }
  }

  // Track seen (pi_tag, model_id) pairs to avoid duplicate pi_tag_bank rows
  const seenPiTagBank = new Set<string>()
  const modelAliasById = new Map(state.models.map(m => [m.model_id, m.model_alias]))

  for (const node of allNodes) {
    const levelAttrs = attrModelIds[node.level]
    if (!levelAttrs) continue

    // Build short_name prefix from node path: "H1/CellA/P1" → "h1_cella_p1"
    const pathPrefix = node.path.replace(/\//g, '_').toLowerCase()

    for (const [attribute, modelIds] of Object.entries(levelAttrs)) {
      const entry = state.tagEntries[node.id]?.[attribute]

      const baseAttribute = getBaseAttribute(attribute)
      const blueprintMapping = state.tagMappings.find(
        m => m.level === node.level && m.attribute === baseAttribute
      )
      const nIndex = attribute !== baseAttribute ? attribute.match(/_(\d+)$/)?.[1] : undefined

      if (!entry && blueprintMapping?.type !== 'Inferred' && blueprintMapping?.type !== 'Constant' && blueprintMapping?.type !== 'Cause' && blueprintMapping?.type !== 'Effect') continue

      const effectiveEntry = entry || (blueprintMapping?.type === 'Inferred' || blueprintMapping?.type === 'Cause' || blueprintMapping?.type === 'Effect' ? {
        tag_type: 'formula' as const,
        pi_sensors: [],
        aggregation: 'add' as const,
        sip_min: '',
        sip_max: '',
        sip_default_value: '',
        sip_policy: '0' as const,
        constant_value: '',
        default_uom: blueprintMapping.default_uom || '',
        data_type: blueprintMapping.data_type as 'continuous' | 'discrete' | undefined,
      } : blueprintMapping?.type === 'Constant' ? {
        tag_type: 'constant' as const,
        pi_sensors: [],
        aggregation: 'add' as const,
        sip_min: '',
        sip_max: '',
        sip_default_value: '',
        sip_policy: '0' as const,
        constant_value: '',
        default_uom: blueprintMapping.default_uom || '',
        data_type: blueprintMapping.data_type as 'continuous' | 'discrete' | undefined,
      } : null)

      if (!effectiveEntry) continue

      const short_name = node.level === 'System' ? attribute : `${pathPrefix}_${attribute}`
      const clientId = state.clientId === 'auto' ? '' : state.clientId

      // ── Handle Constant type ──
      if (effectiveEntry.tag_type === 'constant') {
        const mappingDefaultUom = blueprintMapping?.default_uom || null
        const userUom = (entry?.attribute_uom && entry.attribute_uom.trim()) ? entry.attribute_uom : (mappingDefaultUom || effectiveEntry.default_uom || '')

        for (const mid of modelIds) {
          tagsRows.push({
            client_id: clientId,
            model_alias: modelAliasById.get(mid) ?? String(mid),
            short_name,
            type: 'constant',
            tag_sensor: null,
            formula: effectiveEntry.constant_value || null,
            formula_state: null,
            default_uom: mappingDefaultUom,
            user_uom: userUom,
            flag_ma: 'no',
          })
          const modelName = state.models.find(m => m.model_id === mid)?.name ?? String(mid)
          const systemName = (state.dashboard || '').toLowerCase()
          tagRegistryRows.push({
            tag_key: `${systemName}_${modelName}_${short_name}`,
            tag_alias: short_name,
            tag_display: entry?.display_name || blueprintMapping?.display_name || short_name.replace(/_/g, ' '),
          })
        }
        continue
      }

      // ── Handle PI type (user-defined formula from sensors) ──
      if (effectiveEntry.tag_type === 'pi' || (effectiveEntry.tag_type === 'formula' && blueprintMapping?.type === 'PI')) {
        const sensors = (effectiveEntry.pi_sensors ?? []).filter(s => s.sensor_name || s.sensor_code)
        if (sensors.length === 0) continue

        const attributeDataType = effectiveEntry.data_type || blueprintMapping?.data_type || null
        for (const s of sensors) {
          const piTag = s.sensor_name || s.sensor_code
          for (const mid of modelIds) {
            const key = `${piTag}|${mid}`
            if (seenPiTagBank.has(key)) continue
            seenPiTagBank.add(key)
            piTagBankRows.push({
              client_id: clientId,
              model_alias: modelAliasById.get(mid) ?? String(mid),
              pi_tag: piTag,
              sensor_uom: s.sensor_uom || null,
              sip_min: s.sip_min !== '' && s.sip_min != null ? Number(s.sip_min) : null,
              sip_max: s.sip_max !== '' && s.sip_max != null ? Number(s.sip_max) : null,
              sip_default: s.sip_default_value !== '' && s.sip_default_value != null ? Number(s.sip_default_value) : null,
              sip_policy: s.sip_policy ?? '0',
              data_type: attributeDataType,
            })
          }
        }

        const tagSensor = sensors.map(s => s.sensor_name || s.sensor_code).join(', ')
        const mappingDefaultUom = blueprintMapping?.default_uom || null
        const targetUom = (entry?.attribute_uom && entry.attribute_uom.trim())
          ? entry.attribute_uom
          : (mappingDefaultUom || effectiveEntry.default_uom || '')
        const formula = buildFormulaExpression(sensors, effectiveEntry.aggregation, uomIndex, targetUom)
        const defaultUom = mappingDefaultUom || effectiveEntry.default_uom || null
        const userUom = (entry?.attribute_uom && entry.attribute_uom.trim()) ? entry.attribute_uom : defaultUom

        for (const mid of modelIds) {
          tagsRows.push({
            client_id: clientId,
            model_alias: modelAliasById.get(mid) ?? String(mid),
            short_name,
            type: 'pi',
            tag_sensor: tagSensor,
            formula,
            formula_state: null,
            default_uom: defaultUom,
            user_uom: userUom,
            flag_ma: (entry?.flag_ma ?? blueprintMapping?.flag_ma) ? 'yes' : 'no',
          })
          const modelName = state.models.find(m => m.model_id === mid)?.name ?? String(mid)
          const systemName = (state.dashboard || '').toLowerCase()
          tagRegistryRows.push({
            tag_key: `${systemName}_${modelName}_${short_name}`,
            tag_alias: short_name,
            tag_display: entry?.display_name || blueprintMapping?.display_name || short_name.replace(/_/g, ' '),
          })
        }
      }

      // ── Handle Inferred type (formula from blueprint expansion, or per-node override) ──
      if (effectiveEntry.tag_type === 'formula' && blueprintMapping?.type === 'Inferred') {
        const _smMid2 = blueprintMapping?.model_ids?.[0]
        const _smModel2 = _smMid2 !== undefined ? state.models.find(x => x.model_id === _smMid2) : undefined
        const _smPrefix2 = _smModel2 ? _smModel2.model_alias.toLowerCase().replace(/\s+/g, '_') : undefined
        const formula = entry?.expression_override
          ? entry.expression_override
          : (blueprintMapping?.expression && blueprintMapping.expression !== ''
            ? expandInferredExpression(blueprintMapping.expression, node, state.tagMappings, {
                equipment: state.equipment,
                spallConfig: state.spallConfig,
                constants: systemConstants,
                nIndex,
                modelPrefix: _smPrefix2,
              })
            : null)

        const defaultUom = blueprintMapping?.default_uom || effectiveEntry.default_uom || null
        const userUom = (entry?.attribute_uom && entry.attribute_uom.trim()) ? entry.attribute_uom : defaultUom

        for (const mid of modelIds) {
          tagsRows.push({
            client_id: clientId,
            model_alias: modelAliasById.get(mid) ?? String(mid),
            short_name,
            type: 'inferred',
            tag_sensor: null,
            formula,
            formula_state: null,
            default_uom: defaultUom,
            user_uom: userUom,
            flag_ma: (entry?.flag_ma ?? blueprintMapping?.flag_ma) ? 'yes' : 'no',
          })
          const modelName = state.models.find(m => m.model_id === mid)?.name ?? String(mid)
          const systemName = (state.dashboard || '').toLowerCase()
          tagRegistryRows.push({
            tag_key: `${systemName}_${modelName}_${short_name}`,
            tag_alias: short_name,
            tag_display: entry?.display_name || blueprintMapping?.display_name || short_name.replace(/_/g, ' '),
          })
        }
      }

      // ── Handle Cause / Effect types ──
      if (effectiveEntry.tag_type === 'formula' && (blueprintMapping?.type === 'Cause' || blueprintMapping?.type === 'Effect')) {
        const _smMid3 = blueprintMapping?.model_ids?.[0]
        const _smModel3 = _smMid3 !== undefined ? state.models.find(x => x.model_id === _smMid3) : undefined
        const _smPrefix3 = _smModel3 ? _smModel3.model_alias.toLowerCase().replace(/\s+/g, '_') : undefined
        const formula = blueprintMapping.expression && blueprintMapping.expression !== ''
          ? expandInferredExpression(blueprintMapping.expression, node, state.tagMappings, {
              equipment: state.equipment,
              spallConfig: state.spallConfig,
              constants: systemConstants,
              nIndex,
              modelPrefix: _smPrefix3,
            })
          : null

        const defaultUom = blueprintMapping?.default_uom || effectiveEntry.default_uom || null
        const userUom = (entry?.attribute_uom && entry.attribute_uom.trim()) ? entry.attribute_uom : defaultUom
        const rowType = blueprintMapping.type === 'Cause' ? 'cause' : 'effect'

        for (const mid of modelIds) {
          tagsRows.push({
            client_id: clientId,
            model_alias: modelAliasById.get(mid) ?? String(mid),
            short_name,
            type: rowType,
            tag_sensor: null,
            formula,
            formula_state: null,
            default_uom: defaultUom,
            user_uom: userUom,
            flag_ma: 'no',
          })
          const modelName = state.models.find(m => m.model_id === mid)?.name ?? String(mid)
          const systemName = (state.dashboard || '').toLowerCase()
          tagRegistryRows.push({
            tag_key: `${systemName}_${modelName}_${short_name}`,
            tag_alias: short_name,
            tag_display: entry?.display_name || blueprintMapping?.display_name || short_name.replace(/_/g, ' '),
          })
        }
      }
    }
  }

  // ── Build sip_rules sheet ─────────────────────────────────────────────────────
  for (const node of allNodes) {
    const levelAttrs = attrModelIds[node.level]
    if (!levelAttrs) continue
    const pathPrefix = node.path.replace(/\//g, '_').toLowerCase()
    for (const [attribute, modelIds] of Object.entries(levelAttrs)) {
      const baseAttribute = getBaseAttribute(attribute)
      const blueprintMapping = state.tagMappings.find(
        m => m.level === node.level && m.attribute === baseAttribute
      )
      const type = blueprintMapping?.type
      if (type === 'Cause' || type === 'Effect') continue
      const nodeEntry = state.tagEntries[node.id]?.[attribute]
      const policies = nodeEntry?.sip_policies || blueprintMapping?.sip_policies
      if (!policies || policies.length === 0) continue
      const short_name = node.level === 'System' ? attribute : `${pathPrefix}_${attribute}`
      for (const mid of modelIds) {
        const policy = policies.find(p => p.model_id === mid)
        if (!policy) continue
        sipRulesRows.push({
          model_alias: modelAliasById.get(mid) ?? String(mid),
          short_name,
          sip_min: policy.sip_min ?? null,
          sip_max: policy.sip_max ?? null,
          sip_default: policy.sip_default ?? null,
          tag_out_of_bound_switch: policy.tag_oob_switch,
          tag_stuck_switch: policy.tag_stuck_switch,
          tag_nan_switch: policy.tag_nan_switch,
          default_switch: policy.default_switch,
        })
      }
    }
  }

  // Build value_mappings sheet from state.valueMap
  const valueMappingsRows = state.valueMap.map(entry => ({
    label: entry.label,
    raw_value: entry.raw_value,
    code: entry.code,
  }))

  const wb = XLSX.utils.book_new()
  const addSheet = <T extends object>(name: string, rows: T[], header?: string[]) => {
    const ws = header && rows.length === 0
      ? XLSX.utils.json_to_sheet(rows, { header })
      : XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  const modelParametersRows: { model_alias: string; parameter: string; value: string }[] = []
  for (const entry of modelParametersBlueprint) {
    for (const mid of entry.model_ids) {
      if (state.selectedModelIds.includes(mid)) {
        const userParam = (state.modelParameters[mid] ?? []).find(p => p.parameter === entry.parameter)
        modelParametersRows.push({
          model_alias: modelAliasById.get(mid) ?? String(mid),
          parameter: entry.parameter,
          value: userParam?.value ?? entry.value,
        })
      }
    }
  }

  const modelRegistryRows: ModelRegistrySyncedRow[] = syncedModelRegistryRows
    ?? buildModelRegistryRows(state).map(r => ({ ...r, parent_model_id: null }))

  addSheet('pi_tag_bank', piTagBankRows)
  addSheet('Tags', tagsRows)
  addSheet('sip_rules', sipRulesRows)
  addSheet('value_mappings', valueMappingsRows)
  addSheet('tag_registry', tagRegistryRows)
  const { rulesRows: odsRulesRows, registryRows: odsMessageRegistryRows } = buildOdsRulesRows(state)
  addSheet('ods_rules', odsRulesRows)
  // Rename registry columns: ods_message_key -> code_key, ods_message_text -> code_text
  const textCodeRegistryRows = odsMessageRegistryRows.map(r => ({
    code_key: (r as any).ods_message_key ?? (r as any).code_key ?? '',
    code_text: (r as any).ods_message_text ?? (r as any).code_text ?? '',
    category: 'ods_message',
  }))
  addSheet('text_code_registry', textCodeRegistryRows)
  addSheet('model_parameters', modelParametersRows)
  addSheet('imputation_policy', imputationPolicy)
  addSheet('model_registry', modelRegistryRows)
  addSheet('model_info', buildModelInfoRows(state.models.filter(m => state.selectedModelIds.includes(m.model_id))), [
    'model_id', 'model_name', 'model_alias', 'model_display', 'model_description', 'group', 'model_level', 'model_attributes',
    'sub_model_id', 'sub_model_alias', 'features_x', 'targets_y', 'cumulative_attributes', 'model_skip_attributes',
  ])

  return wb
}

export function downloadPiTagBankExcel(
  state: FormState,
  uomIndex: UomIndex,
  modelParametersBlueprint: ModelParameterWithIds[],
  imputationPolicy: ImputationPolicyEntry[],
  filename = 'instance_configs.xlsx'
): void {
  const wb = buildPiTagBankWorkbook(state, uomIndex, modelParametersBlueprint, imputationPolicy)
  XLSX.writeFile(wb, filename)
}

export function buildPiTagBankExcelBase64(
  state: FormState,
  uomIndex: UomIndex,
  modelParametersBlueprint: ModelParameterWithIds[],
  imputationPolicy: ImputationPolicyEntry[],
  syncedModelRegistryRows?: ModelRegistrySyncedRow[]
): string {
  const wb = buildPiTagBankWorkbook(state, uomIndex, modelParametersBlueprint, imputationPolicy, syncedModelRegistryRows)
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
}
