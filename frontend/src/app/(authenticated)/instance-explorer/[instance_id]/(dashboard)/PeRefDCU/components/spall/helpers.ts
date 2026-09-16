// Shared helper functions for spall configuration

export interface HeaterTubeConfig {
  totalTubesPerPass: number
  radiantTubesPerPass: number
  convectionTubesPerPass: number
  tubeNumbering: 'top_to_bottom' | 'bottom_to_top'
  tmtTubes: number[]
}

export interface HeaterGroups {
  numGroups: number
  assignment: Record<number, number>
}

export interface HeaterOps {
  numOps: number
  assignment: Record<number, number>
}

export interface SpallState {
  numHeaters: number
  firingConfig: 'double' | 'single'
  passesPerCell: number
  uniformPasses: boolean
  passesPerCellMap: Record<number, number>
  hasOpTags: boolean
  drumsPerTrain: number
  uniformDrums: boolean
  drumsPerTrainMap: Record<number, number>
  numFractionators: number
  overheads: number
  reboilers: number
  passToCell: Record<number, Record<number, number>>
  tubeConfigs: Record<number, HeaterTubeConfig>
  heaterGroups: Record<number, HeaterGroups>
  spallOps: Record<number, HeaterOps>
}

export function getCells(fc: 'double' | 'single') {
  return fc === 'double' ? 2 : 1
}

export function calcTotalPasses(spall: SpallState): number {
  const cells = getCells(spall.firingConfig)
  if (spall.uniformPasses || cells === 1) return cells * spall.passesPerCell
  let total = 0
  for (let c = 1; c <= cells; c++) total += spall.passesPerCellMap[c] || spall.passesPerCell
  return total
}

export function defaultCellForPass(spall: SpallState, p: number): number {
  const cells = getCells(spall.firingConfig)
  if (spall.uniformPasses || cells === 1) return Math.ceil(p / spall.passesPerCell)
  let boundary = 0
  for (let c = 1; c <= cells; c++) {
    boundary += spall.passesPerCellMap[c] || spall.passesPerCell
    if (p <= boundary) return c
  }
  return cells
}

export function defaultPassToCellMap(spall: SpallState): Record<number, number> {
  const totalPasses = calcTotalPasses(spall)
  const result: Record<number, number> = {}
  for (let p = 1; p <= totalPasses; p++) result[p] = defaultCellForPass(spall, p)
  return result
}

export function makeHeaterGroups(spall: SpallState, h: number): HeaterGroups {
  const cells = getCells(spall.firingConfig)
  const totalPasses = calcTotalPasses(spall)
  const passToCell = spall.passToCell[h] || defaultPassToCellMap(spall)

  const numGroups = cells
  const assignment: Record<number, number> = {}
  for (let p = 1; p <= totalPasses; p++) assignment[p] = passToCell[p] || 1
  return { numGroups, assignment }
}

export function makeHeaterOps(spall: SpallState, h: number): HeaterOps {
  const totalPasses = calcTotalPasses(spall)
  const numOps = Math.ceil(totalPasses / 2)
  const assignment: Record<number, number> = {}
  for (let p = 1; p <= totalPasses; p++) assignment[p] = Math.ceil(p / 2)
  return { numOps, assignment }
}

export function makeTubeConfig(_spall: SpallState): HeaterTubeConfig {
  const radiantPerPass = 17
  return {
    totalTubesPerPass: radiantPerPass,
    radiantTubesPerPass: radiantPerPass,
    convectionTubesPerPass: 0,
    tubeNumbering: 'top_to_bottom',
    tmtTubes: [],
  }
}
