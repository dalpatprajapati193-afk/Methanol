import { HIERARCHY_SCHEMA, type NodeTypeKey } from './hierarchySchema'
import { HIERARCHY_PARENT_MAP } from './hierarchyConfig'

/**
 * Validates hierarchy schema and configuration for correctness.
 * Checks for circular references, invalid parent-child relationships,
 * orphaned node types, and invalid configurations.
 */

export interface ValidationError {
  type: 'error' | 'warning'
  message: string
  context?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function buildSchemaParentMap(): Record<NodeTypeKey, NodeTypeKey[]> {
  const parentMap: Record<NodeTypeKey, NodeTypeKey[]> = {} as Record<NodeTypeKey, NodeTypeKey[]>

  Object.keys(HIERARCHY_SCHEMA).forEach(key => {
    parentMap[key as NodeTypeKey] = []
  })

  Object.entries(HIERARCHY_SCHEMA).forEach(([typeKey, definition]) => {
    definition.validChildren.forEach(childType => {
      parentMap[childType].push(typeKey as NodeTypeKey)
    })
  })

  return parentMap
}

function detectCircularReferences(): ValidationError[] {
  const errors: ValidationError[] = []
  const parentMap = buildSchemaParentMap()

  const visited = new Set<NodeTypeKey>()
  const recursionStack = new Set<NodeTypeKey>()

  function dfs(node: NodeTypeKey): boolean {
    visited.add(node)
    recursionStack.add(node)

    for (const parent of parentMap[node]) {
      if (!visited.has(parent)) {
        if (dfs(parent)) return true
      } else if (recursionStack.has(parent)) {
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  const allTypes = Object.keys(HIERARCHY_SCHEMA) as NodeTypeKey[]
  for (const type of allTypes) {
    if (!visited.has(type)) {
      if (dfs(type)) {
        errors.push({
          type: 'error',
          message: `Circular reference detected in hierarchy schema involving type: ${type}`,
          context: { nodeType: type },
        })
      }
    }
  }

  return errors
}

function validateRelationships(): ValidationError[] {
  const errors: ValidationError[] = []

  Object.entries(HIERARCHY_SCHEMA).forEach(([parentKey, definition]) => {
    definition.validChildren.forEach(childType => {
      if (!HIERARCHY_SCHEMA[childType]) {
        errors.push({
          type: 'error',
          message: `Invalid child type "${childType}" for parent type "${parentKey}". Child type does not exist in schema.`,
          context: { parentType: parentKey, childType },
        })
      }
    })
  })

  return errors
}

function validateConfiguration(): ValidationError[] {
  const errors: ValidationError[] = []

  Object.entries(HIERARCHY_PARENT_MAP).forEach(([entityType, config]) => {
    const { parentType } = config

    if (!HIERARCHY_SCHEMA[parentType]) {
      errors.push({
        type: 'error',
        message: `Invalid parent type "${parentType}" in configuration for "${entityType}". Parent type does not exist in schema.`,
        context: { entityType, parentType },
      })
    }
  })

  return errors
}

function validateReachability(): ValidationError[] {
  const errors: ValidationError[] = []
  const visited = new Set<NodeTypeKey>()

  function bfs(start: NodeTypeKey) {
    const queue = [start]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue

      visited.add(current)
      const children = HIERARCHY_SCHEMA[current].validChildren
      queue.push(...children.filter(c => !visited.has(c)))
    }
  }

  bfs('system')

  Object.keys(HIERARCHY_SCHEMA).forEach(typeKey => {
    if (typeKey !== 'system' && !visited.has(typeKey as NodeTypeKey)) {
      errors.push({
        type: 'warning',
        message: `Type "${typeKey}" is not reachable from the system root. It may be orphaned.`,
        context: { nodeType: typeKey },
      })
    }
  })

  return errors
}

export function validateHierarchy(): ValidationResult {
  const allErrors: ValidationError[] = []

  allErrors.push(...detectCircularReferences())
  allErrors.push(...validateRelationships())
  allErrors.push(...validateConfiguration())
  allErrors.push(...validateReachability())

  const hasErrors = allErrors.some(e => e.type === 'error')

  return {
    valid: !hasErrors,
    errors: allErrors,
  }
}

/**
 * Validate and throw if invalid — ensures the app fails fast if hierarchy
 * config is broken. Called once at module load below.
 */
export function validateHierarchyOrThrow(): void {
  const result = validateHierarchy()

  if (!result.valid) {
    const errorMessages = result.errors
      .filter(e => e.type === 'error')
      .map(e => `  ❌ ${e.message}`)
      .join('\n')

    const warningMessages = result.errors
      .filter(e => e.type === 'warning')
      .map(e => `  ⚠️  ${e.message}`)
      .join('\n')

    const fullMessage = [
      '🔴 HIERARCHY CONFIGURATION ERROR',
      'The hierarchy schema/config is invalid. Fix the issues below before continuing.',
      '',
      errorMessages,
      ...(warningMessages ? ['', 'Warnings:', warningMessages] : []),
    ].join('\n')

    console.error(fullMessage)
    throw new Error(fullMessage)
  }
}

try {
  validateHierarchyOrThrow()
} catch (error) {
  console.error('Failed to initialize hierarchy configuration:', error)
  throw error
}
