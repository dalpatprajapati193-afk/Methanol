import type { ModelTagMapping, TagEntry } from '../types'

/**
 * Determine if an attribute mapping should be visible based on constant-driven gates.
 * Pattern: any {attr}_sensor_level constant gates whether {attr} appears at different
 * topology levels — only shown when its level matches the constant's value.
 */
export function isAttributeMappingVisible(
  mapping: ModelTagMapping,
  getTagEntry: (nodeId: string, attr: string) => TagEntry | undefined
): boolean {
  const { attribute, level } = mapping

  const gateConstantName = `${attribute}_sensor_level`
  const gateEntry = getTagEntry('system_dcu', gateConstantName)

  if (gateEntry?.tag_type === 'constant' && gateEntry.constant_value) {
    return level === gateEntry.constant_value
  }

  return true
}
