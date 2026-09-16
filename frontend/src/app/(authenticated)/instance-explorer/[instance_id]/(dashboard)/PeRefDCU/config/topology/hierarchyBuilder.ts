import type { Equipment, TopologyNode } from '../../types'
import { HIERARCHY_SCHEMA } from './hierarchySchema'

/**
 * Generic hierarchy builder that uses schema and config to build the topology tree
 * from equipment data (furnaces, cells, passes, tubes, drum trains, fractionators).
 */
export class HierarchyBuilder {
  static buildTree(equipment: Equipment): TopologyNode[] {
    const root = this.createRootNode()

    const furnaceNodes = this.buildFurnaceNodes(equipment.furnaces)
    const drumTrainNodes = this.buildDrumTrainNodes(equipment.drumTrains)
    const fractionatorNodes = this.buildFractionatorNodes(equipment.fractionators)

    root.children.push(...furnaceNodes, ...drumTrainNodes, ...fractionatorNodes)

    return [root]
  }

  private static createRootNode(): TopologyNode {
    return {
      id: 'system_dcu',
      name: 'DCU',
      type: 'system',
      level: 'System',
      path: 'DCU',
      parentPath: '',
      elementCode: 'DCU',
      children: [],
    }
  }

  private static buildFurnaceNodes(furnaces: Equipment['furnaces']): TopologyNode[] {
    return furnaces.map(furnace => {
      const cellNodes = furnace.cells.map(cell => ({
        id: `${furnace.name}/${cell.name}`,
        name: cell.name,
        type: 'cell' as const,
        level: HIERARCHY_SCHEMA.cell.displayName,
        path: `${furnace.name}/${cell.name}`,
        parentPath: `DCU/${furnace.name}/`,
        elementCode: `${furnace.name}${cell.name}`,
        children: cell.passes.map(pass => ({
          id: `${furnace.name}/${cell.name}/${pass.name}`,
          name: pass.name,
          type: 'pass' as const,
          level: HIERARCHY_SCHEMA.pass.displayName,
          path: `${furnace.name}/${cell.name}/${pass.name}`,
          parentPath: `DCU/${furnace.name}/${cell.name}/`,
          elementCode: `${furnace.name}${pass.name}`,
          children: pass.tubes
            .filter(tube => tube.hasTMT !== false)
            .map(tube => ({
              id: `${furnace.name}/${cell.name}/${pass.name}/${tube.name}`,
              name: tube.name,
              type: 'tube' as const,
              level: HIERARCHY_SCHEMA.tube.displayName,
              path: `${furnace.name}/${cell.name}/${pass.name}/${tube.name}`,
              parentPath: `DCU/${furnace.name}/${cell.name}/${pass.name}/`,
              elementCode: `${furnace.name}${pass.name}${tube.name}`,
              children: [],
              hasTMT: tube.hasTMT ?? undefined,
            })),
        })),
      }))

      const spallGroupNodes = (furnace.spallGroups ?? []).map(sg => ({
        id: `${furnace.name}/${sg.name}`,
        name: sg.name,
        type: 'spall_group' as const,
        level: HIERARCHY_SCHEMA.spall_group.displayName,
        path: `${furnace.name}/${sg.name}`,
        parentPath: `DCU/${furnace.name}/`,
        elementCode: `${furnace.name}${sg.name}`,
        children: [],
      }))

      return {
        id: furnace.name,
        name: furnace.name,
        type: 'furnace' as const,
        level: HIERARCHY_SCHEMA.furnace.displayName,
        path: furnace.name,
        parentPath: 'DCU/',
        elementCode: furnace.name,
        children: [...cellNodes, ...spallGroupNodes],
      }
    })
  }

  private static buildDrumTrainNodes(drumTrains: Equipment['drumTrains']): TopologyNode[] {
    return drumTrains.map(drumTrain => ({
      id: drumTrain.name,
      name: drumTrain.name,
      type: 'drum_train' as const,
      level: HIERARCHY_SCHEMA.drum_train.displayName,
      path: drumTrain.name,
      parentPath: 'DCU/',
      elementCode: drumTrain.name,
      children: drumTrain.drums.map(drum => ({
        id: `${drumTrain.name}/${drum.name}`,
        name: drum.name,
        type: 'drum' as const,
        level: HIERARCHY_SCHEMA.drum.displayName,
        path: `${drumTrain.name}/${drum.name}`,
        parentPath: `DCU/${drumTrain.name}/`,
        elementCode: drum.name,
        children: [],
      })),
    }))
  }

  private static buildFractionatorNodes(fractionators: Equipment['fractionators']): TopologyNode[] {
    return fractionators.map(fractionator => {
      const children: TopologyNode[] = []

      children.push(
        ...fractionator.columnOverheads.map(co => ({
          id: `${fractionator.name}/${co.name}`,
          name: co.name,
          type: 'column_overhead' as const,
          level: HIERARCHY_SCHEMA.column_overhead.displayName,
          path: `${fractionator.name}/${co.name}`,
          parentPath: `DCU/${fractionator.name}/`,
          elementCode: co.name,
          children: [],
        }))
      )

      children.push(
        ...fractionator.columnReboilers.map(cr => ({
          id: `${fractionator.name}/${cr.name}`,
          name: cr.name,
          type: 'column_reboiler' as const,
          level: HIERARCHY_SCHEMA.column_reboiler.displayName,
          path: `${fractionator.name}/${cr.name}`,
          parentPath: `DCU/${fractionator.name}/`,
          elementCode: cr.name,
          children: [],
        }))
      )

      return {
        id: fractionator.name,
        name: fractionator.name,
        type: 'fractionator' as const,
        level: HIERARCHY_SCHEMA.fractionator.displayName,
        path: fractionator.name,
        parentPath: 'DCU/',
        elementCode: fractionator.name,
        children,
      }
    })
  }
}
