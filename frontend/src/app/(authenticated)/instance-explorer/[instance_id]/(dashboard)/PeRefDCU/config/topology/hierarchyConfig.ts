import type { NodeTypeKey } from './hierarchySchema'

/**
 * Maps equipment types to their parent levels in the hierarchy.
 * Key: What type of entity (furnaces, drum_trains, fractionators)
 * Value: Where it should be placed in the hierarchy
 */
export const HIERARCHY_PARENT_MAP = {
  furnaces: {
    parentType: 'system' as NodeTypeKey,
    parentId: 'system_dcu',
  },
  drumTrains: {
    parentType: 'system' as NodeTypeKey,
    parentId: 'system_dcu',
  },
  fractionators: {
    parentType: 'system' as NodeTypeKey,
    parentId: 'system_dcu',
  },
}

export const EQUIPMENT_HIERARCHY = {
  furnace: {
    childrenProperty: 'cells',
  },
  cell: {
    childrenProperty: 'passes',
  },
  pass: {
    childrenProperty: 'tubes',
  },
  drum_train: {
    childrenProperty: 'drums',
  },
  fractionator: {
    childrenProperty: null, // Children come from multiple properties
  },
}

export const FRACTIONATOR_CHILDREN_PROPERTIES = ['columnOverheads', 'columnReboilers']

export const NODE_TYPE_MAPPINGS = {
  furnace: 'furnace',
  cell: 'cell',
  pass: 'pass',
  tube: 'tube',
  drum_train: 'drum_train',
  drum: 'drum',
  fractionator: 'fractionator',
  columnOverhead: 'column_overhead',
  columnReboiler: 'column_reboiler',
} as const

export function getParentConfig(equipmentType: 'furnaces' | 'drumTrains' | 'fractionators') {
  return HIERARCHY_PARENT_MAP[equipmentType]
}

export function isSystemChild(equipmentType: 'furnaces' | 'drumTrains' | 'fractionators'): boolean {
  return getParentConfig(equipmentType).parentType === 'system'
}
