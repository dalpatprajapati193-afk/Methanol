export type NodeTypeKey =
  | 'system'
  | 'furnace'
  | 'cell'
  | 'pass'
  | 'tube'
  | 'drum_train'
  | 'drum'
  | 'fractionator'
  | 'column_overhead'
  | 'column_reboiler'
  | 'spall_group'

export interface NodeTypeDefinition {
  key: NodeTypeKey
  displayName: string
  pluralName: string
  validChildren: NodeTypeKey[]
  canHaveMultipleParents?: boolean
}

export const HIERARCHY_SCHEMA: Record<NodeTypeKey, NodeTypeDefinition> = {
  system: {
    key: 'system',
    displayName: 'System',
    pluralName: 'Systems',
    validChildren: ['furnace', 'drum_train', 'fractionator'],
  },
  furnace: {
    key: 'furnace',
    displayName: 'Furnace',
    pluralName: 'Furnaces',
    validChildren: ['cell', 'drum_train', 'spall_group'],
  },
  cell: {
    key: 'cell',
    displayName: 'Cell',
    pluralName: 'Cells',
    validChildren: ['pass'],
  },
  pass: {
    key: 'pass',
    displayName: 'Pass',
    pluralName: 'Passes',
    validChildren: ['tube'],
  },
  tube: {
    key: 'tube',
    displayName: 'Tube',
    pluralName: 'Tubes',
    validChildren: [],
  },
  drum_train: {
    key: 'drum_train',
    displayName: 'Drum train',
    pluralName: 'Drum trains',
    validChildren: ['drum'],
  },
  drum: {
    key: 'drum',
    displayName: 'Drum',
    pluralName: 'Drums',
    validChildren: [],
  },
  fractionator: {
    key: 'fractionator',
    displayName: 'Fractionator',
    pluralName: 'Fractionators',
    validChildren: ['column_overhead', 'column_reboiler'],
  },
  column_overhead: {
    key: 'column_overhead',
    displayName: 'Column Overhead',
    pluralName: 'Column Overheads',
    validChildren: [],
  },
  column_reboiler: {
    key: 'column_reboiler',
    displayName: 'Column Reboiler',
    pluralName: 'Column Reboilers',
    validChildren: [],
  },
  spall_group: {
    key: 'spall_group',
    displayName: 'Spall Group',
    pluralName: 'Spall Groups',
    validChildren: [],
  },
}

export function getNodeTypeName(typeKey: NodeTypeKey): string {
  return HIERARCHY_SCHEMA[typeKey]?.displayName || typeKey
}

export function isValidChild(parentType: NodeTypeKey, childType: NodeTypeKey): boolean {
  return HIERARCHY_SCHEMA[parentType]?.validChildren.includes(childType) ?? false
}

export function getValidChildren(parentType: NodeTypeKey): NodeTypeKey[] {
  return HIERARCHY_SCHEMA[parentType]?.validChildren ?? []
}
