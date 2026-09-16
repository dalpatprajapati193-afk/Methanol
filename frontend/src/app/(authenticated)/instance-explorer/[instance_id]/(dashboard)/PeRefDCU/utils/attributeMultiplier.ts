import type { ModelTagMapping, TagEntry, MultipliedAttributeEntry } from '../types'

/**
 * Extract the base attribute name from a potentially multiplied attribute.
 * E.g., hold_temp_1 → hold_temp, hold_temp → hold_temp
 */
export function getBaseAttribute(attribute: string): string {
  const match = attribute.match(/^(.+)_(\d+)$/)
  if (match) {
    return match[1]
  }
  return attribute
}

/**
 * Expand a blueprint mapping into N copies if it's a multiplied attribute.
 * If the count constant is not set (0 or missing), returns empty array (hides the attribute).
 * Otherwise returns N copies with numeric suffixes: hold_temp_1, hold_temp_2, etc.
 * Non-multiplied attributes return as single-item array unchanged.
 */
export function expandMultipliedMapping(
  mapping: ModelTagMapping,
  getTagEntry: (nodeId: string, attr: string) => TagEntry | undefined,
  multipliedAttributes: MultipliedAttributeEntry[]
): ModelTagMapping[] {
  const rule = multipliedAttributes.find(a => a.attribute === mapping.attribute)
  if (!rule) {
    return [mapping]
  }

  const nodeId = rule.nodeId ?? 'system_dcu'
  const entry = getTagEntry(nodeId, rule.countAttr)
  const count = Number(entry?.constant_value || 0)

  if (count <= 0) {
    return []
  }

  return Array.from({ length: count }, (_, i) => ({
    ...mapping,
    attribute: `${mapping.attribute}_${i + 1}`,
    expression: mapping.expression?.replaceAll('<<N>>', String(i + 1)),
  }))
}
