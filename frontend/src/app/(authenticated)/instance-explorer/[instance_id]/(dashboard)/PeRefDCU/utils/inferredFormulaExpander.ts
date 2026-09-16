import type { TopologyNode, ModelTagMapping, Equipment, SpallConfig } from '../types'

interface ExpansionContext {
  equipment?: Equipment
  spallConfig?: SpallConfig | null
  constants?: Record<string, string> // e.g. { cop_sensor_level: 'Cell' }
  nIndex?: string // numeric copy index for <<N>> substitution in multiplied attributes
  modelPrefix?: string // lowercase model alias (e.g. 'pdi') used to build <<submodel>>
}

const DRUM_LEVELS = new Set(['Drum train', 'Drum'])

/**
 * Resolve cross-hierarchy prefixes for <<fur>> and <<frac>> when the current node
 * lives in the drum train/drum hierarchy but the expression references the linked
 * furnace or fractionator (stored in Equipment link maps).
 *
 * Returns the lowercase prefix string, or undefined when the node is already in
 * the target hierarchy (fall through to the normal path-depth logic).
 */
function resolveCrossHierarchyPrefix(
  keyword: string,
  node: TopologyNode,
  equipment: Equipment
): string | undefined {
  if (!DRUM_LEVELS.has(node.level)) return undefined

  const trainName = node.path.split('/')[0]
  const train = equipment.drumTrains.find(t => t.name === trainName)
  if (!train) return undefined

  if (keyword === 'fur') {
    const furnaceId = equipment.trainFurnaceLinks?.[train.id]
    if (furnaceId) {
      const furnace = equipment.furnaces.find(f => f.id === furnaceId)
      if (furnace) return furnace.name.toLowerCase()
    }
    const trainIdx = equipment.drumTrains.indexOf(train)
    return equipment.furnaces[trainIdx]?.name.toLowerCase()
  }

  if (keyword === 'frac') {
    const fracIds = equipment.trainFractionatorLinks[train.id] ?? []
    const frac = equipment.fractionators.find(f => f.id === fracIds[0])
    return frac?.name.toLowerCase()
  }

  return undefined
}

const PATH_KEYWORD_DEPTH: Record<string, number> = {
  fur: 1, cell: 2, pass: 3, tube: 4, // furnace hierarchy
  train: 1, drum: 2, // drum hierarchy
  frac: 1, colovhd: 2, colreb: 2, // fractionator hierarchy
}

/**
 * Resolve the Spall Group prefix for a Pass node.
 * Looks up which SG contains this pass via spallConfig.heaterGroups.
 * Returns e.g. "h1_p1_p3" for a pass that belongs to spall group "P1_P3" under furnace "H1".
 * Returns undefined for non-Pass nodes or when spall data is unavailable.
 */
function getSpallGroupPrefix(
  node: TopologyNode,
  equipment?: Equipment,
  spallConfig?: SpallConfig | null
): string | undefined {
  if (!equipment || !spallConfig || node.level !== 'Pass') return undefined

  const [furnaceName, cellName, passName] = node.path.split('/')
  const furnace = equipment.furnaces.find(f => f.name === furnaceName)
  if (!furnace) return undefined

  const heaterId = equipment.furnaces.indexOf(furnace) + 1

  let globalPassNum: number | undefined
  let idx = 0
  outer: for (const cell of furnace.cells) {
    for (const pass of cell.passes) {
      idx++
      if (cell.name === cellName && pass.name === passName) {
        globalPassNum = idx
        break outer
      }
    }
  }
  if (globalPassNum === undefined) return undefined

  const steamGroupNum = spallConfig.heaterGroups[String(heaterId)]?.assignment[String(globalPassNum)]
  if (steamGroupNum === undefined) return undefined

  const spallGroup = furnace.spallGroups?.find(sg => sg.groupNum === steamGroupNum)
  if (!spallGroup) return undefined

  return `${furnaceName}_${spallGroup.name}`.toLowerCase()
}

/**
 * Expand template symbols in inferred formula expressions.
 *
 * Symbols:
 * - `<<all>>`: Expands to all child paths whose attribute level matches the target.
 *   Usage: {<<all>>_attributename}
 * - `<<spall_status>>`: Expands to spall status formula based on equipment topology and spall config.
 *
 * Expansion is data-driven from blueprint attribute definitions and equipment topology
 * — no hardcoded logic for node types or hierarchy levels.
 */
export function expandInferredExpression(
  template: string,
  node: TopologyNode,
  tagMappings: ModelTagMapping[],
  context?: ExpansionContext
): string {
  if (!template.includes('<<')) {
    return template
  }

  let result = template

  if (context?.modelPrefix && result.includes('<<submodel>>')) {
    const pathSuffix = node.type !== 'system' && node.path
      ? '_' + node.path.replace(/\//g, '_').toLowerCase()
      : ''
    result = result.replaceAll('<<submodel>>', "'" + context.modelPrefix + pathSuffix + "'")
  }

  if (context?.nIndex && result.includes('<<N>>')) {
    result = result.replaceAll('<<N>>', context.nIndex)
  }

  const needsIndex = ['<<N_max>>', '<<N_mid>>', '<<N_min>>'].some(s => result.includes(s))
  if (needsIndex) {
    const stepsRaw = context?.constants?.['hold_temp_steps']
    const count = Math.max(1, parseInt(stepsRaw ?? '1', 10))
    result = result.replaceAll('<<N_max>>', String(count))
    result = result.replaceAll('<<N_mid>>', String(Math.ceil(count / 2)))
    result = result.replaceAll('<<N_min>>', '1')
  }

  const spallStatusMatch = result.match(/<<spall_status(?:\(([^)]*)\))?>>/)
  if (spallStatusMatch) {
    const rawParams = spallStatusMatch[1] ?? ''
    const params = rawParams.split(',').map(p => p.trim()).filter(Boolean)
    const spallFormula = expandSpallStatus(node, context?.equipment, context?.spallConfig, params)
    result = result.replace(/<<spall_status(?:\([^)]*\))?>>/, spallFormula)
  }

  const getDepthForKeyword = (keyword: string): number | undefined => {
    const pathDepth = PATH_KEYWORD_DEPTH[keyword]
    if (pathDepth !== undefined) return pathDepth

    if (keyword.endsWith('_level')) {
      const attr = keyword.slice(0, -6)
      const constantKey = `${attr}_sensor_level`
      const sensorLevel = context?.constants?.[constantKey]
      if (sensorLevel) {
        const levelToDepth: Record<string, number> = { Furnace: 1, Cell: 2, Pass: 3, Tube: 4 }
        return levelToDepth[sensorLevel] ?? 3
      }
    }

    return undefined
  }

  const kwRegex = /\{([^}]*<<\w+>>[^}]*)\}/g
  const kwMatches = Array.from(result.matchAll(kwRegex))
  for (const match of kwMatches) {
    const fullBlock = match[0]
    const innerPattern = match[1]

    const symbolMatch = innerPattern.match(/<<(\w+)>>/)
    if (!symbolMatch) continue

    const keyword = symbolMatch[1].toLowerCase()

    if (keyword === 'sg') {
      const sgPrefix = getSpallGroupPrefix(node, context?.equipment, context?.spallConfig)
      if (!sgPrefix) continue
      const expanded = innerPattern.replace(/<<sg>>/g, sgPrefix)
      result = result.replace(fullBlock, `{${expanded}}`)
      continue
    }

    if (context?.equipment && (keyword === 'fur' || keyword === 'frac')) {
      const crossPrefix = resolveCrossHierarchyPrefix(keyword, node, context.equipment)
      if (crossPrefix !== undefined) {
        const expanded = innerPattern.replace(new RegExp(`<<${keyword}>>`, 'g'), crossPrefix)
        result = result.replace(fullBlock, `{${expanded}}`)
        continue
      }
    }

    const depth = getDepthForKeyword(keyword)
    if (depth === undefined) continue

    const pathSegments = node.path.split('/')
    const parts = pathSegments.slice(0, depth).filter(Boolean)
    if (parts.length === 0) continue

    const pathId = parts.join('_').toLowerCase()
    const expanded = innerPattern.replace(new RegExp(`<<${keyword}>>`, 'g'), pathId)
    result = result.replace(fullBlock, `{${expanded}}`)
  }

  const blockRegex = /\{([^}]*<<all>>[^}]*)\}/g
  const matches = Array.from(result.matchAll(blockRegex))

  for (const match of matches) {
    const fullBlock = match[0]
    const innerPattern = match[1]

    const attrMatch = innerPattern.match(/<<all>>(.+)/)
    if (!attrMatch) continue

    const attrSuffix = attrMatch[1]
    const targetAttribute = attrSuffix.startsWith('_') ? attrSuffix.slice(1) : attrSuffix

    const targetMapping = tagMappings.find(m => m.attribute === targetAttribute)
    if (!targetMapping) continue

    const targetLevel = targetMapping.level

    const expandableChildren = (node.children || []).filter(child => child.level === targetLevel)

    const tags = expandableChildren.map(child => {
      const childPathId = child.path.toLowerCase().replace(/\//g, '_')
      const expanded = innerPattern.replace(/<<all>>/g, childPathId)
      return `{${expanded}}`
    })

    const replacement = tags.join(',')
    result = result.replace(fullBlock, replacement)
  }

  return result
}

/**
 * Expand <<spall_status>> symbol to complete spall status formula.
 * Only works for Pass-level nodes with valid equipment and spall config.
 */
function expandSpallStatus(node: TopologyNode, equipment?: Equipment, spallConfig?: SpallConfig | null, params?: string[]): string {
  if (!equipment || !spallConfig || node.level !== 'Pass') {
    return ''
  }
  const feedAttr = params?.[0] || 'pass_feed_controller_mode'
  const steamAttr = params?.[1] || 'spall_steam_flow'
  const steamOpAttr = params?.[2] || 'spall_steam_flow_valve_opening'

  const [furnaceName, cellName, passName] = node.path.split('/')
  const furnace = equipment.furnaces.find(f => f.name === furnaceName)
  if (!furnace) return ''

  const heaterId = equipment.furnaces.indexOf(furnace) + 1

  const passMap: Array<{ cellName: string; passName: string; path: string; index: number }> = []
  let index = 0
  for (const cell of furnace.cells) {
    for (const pass of cell.passes) {
      passMap.push({
        cellName: cell.name,
        passName: pass.name,
        path: `${furnaceName}/${cell.name}/${pass.name}`,
        index: ++index,
      })
    }
  }

  const globalPassNum = passMap.find(p => p.cellName === cellName && p.passName === passName)?.index
  if (!globalPassNum) return ''

  const opGroupNum = spallConfig.spallOps[String(heaterId)]?.assignment[String(globalPassNum)]
  if (opGroupNum === undefined) return ''

  const opPassIndices = passMap
    .filter(p => spallConfig.spallOps[String(heaterId)]?.assignment[String(p.index)] === opGroupNum)
    .map(p => p.index)

  const steamGroupNums = new Set<number>()
  for (const passIdx of opPassIndices) {
    const steamGroupNum = spallConfig.heaterGroups[String(heaterId)]?.assignment[String(passIdx)]
    if (steamGroupNum !== undefined) {
      steamGroupNums.add(steamGroupNum)
    }
  }

  const conditions: string[] = []

  for (const passIdx of opPassIndices) {
    const passPath = passMap.find(p => p.index === passIdx)?.path
    if (passPath) {
      const pathId = passPath.toLowerCase().replace(/\//g, '_')
      conditions.push(`({${pathId}_${feedAttr}}==1)`)
    }
  }

  for (const steamGroupNum of steamGroupNums) {
    const spallGroup = furnace.spallGroups?.find(sg => sg.groupNum === steamGroupNum)
    if (spallGroup) {
      const sgPath = `${furnaceName}/${spallGroup.name}`
      const sgPathId = sgPath.toLowerCase().replace(/\//g, '_')
      conditions.push(`({${sgPathId}_${steamAttr}}>0)`)
      conditions.push(`({${sgPathId}_${steamOpAttr}}>0)`)
    }
  }

  if (conditions.length === 0) return ''

  return `if(${conditions.join(' & ')}, 1, 0)`
}
