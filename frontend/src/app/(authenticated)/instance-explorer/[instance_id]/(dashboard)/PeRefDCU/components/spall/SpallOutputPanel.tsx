'use client'

import type { SpallState } from './helpers'
import { calcTotalPasses, defaultPassToCellMap, getCells, makeHeaterGroups, makeHeaterOps, makeTubeConfig } from './helpers'

export function SpallOutputPanel({ spall, onBack, onNext }: {
  spall: SpallState
  onBack: () => void
  onNext: () => void
}) {
  const generateJSON = () => {
    const filled = { ...spall }
    for (let h = 1; h <= spall.numHeaters; h++) {
      if (!filled.passToCell[h]) filled.passToCell = { ...filled.passToCell, [h]: defaultPassToCellMap(filled) }
      if (!filled.tubeConfigs[h]) filled.tubeConfigs = { ...filled.tubeConfigs, [h]: makeTubeConfig(filled) }
      if (!filled.heaterGroups[h]) filled.heaterGroups = { ...filled.heaterGroups, [h]: makeHeaterGroups(filled, h) }
      if (!filled.spallOps[h]) filled.spallOps = { ...filled.spallOps, [h]: makeHeaterOps(filled, h) }
    }

    const cells = getCells(filled.firingConfig)
    const totalPasses = calcTotalPasses(filled)

    const heaters = Array.from({ length: filled.numHeaters }, (_, i) => {
      const h = i + 1
      const ptc = filled.passToCell[h] || defaultPassToCellMap(filled)
      const grp = filled.heaterGroups[h] || makeHeaterGroups(filled, h)
      const ops = filled.spallOps[h] || makeHeaterOps(filled, h)
      const tubeConf = filled.tubeConfigs[h] || makeTubeConfig(filled)

      const groupMap: Record<number, number[]> = {}
      for (let g = 1; g <= grp.numGroups; g++) groupMap[g] = []
      for (let p = 1; p <= totalPasses; p++) {
        const g = grp.assignment[p]; if (g) groupMap[g].push(p)
      }

      const opMap: Record<number, number[]> = {}
      for (let op = 1; op <= ops.numOps; op++) opMap[op] = []
      for (let p = 1; p <= totalPasses; p++) {
        const op = ops.assignment[p]; if (op) opMap[op].push(p)
      }

      const convPerPass = Math.max(0, tubeConf.totalTubesPerPass - tubeConf.radiantTubesPerPass)

      return {
        heater_id: h,
        firing_config: filled.firingConfig,
        cells_per_heater: cells,
        passes_per_cell: filled.passesPerCell,
        total_passes: totalPasses,
        steam_groups: groupMap,
        spall_operations: opMap,
        has_op_tags: filled.hasOpTags,
        tube_config: {
          total_tubes_per_pass: tubeConf.totalTubesPerPass,
          radiant_tubes_per_pass: tubeConf.radiantTubesPerPass,
          convection_tubes_per_pass: convPerPass,
          tube_numbering: tubeConf.tubeNumbering,
          tmt_tags: tubeConf.tmtTubes,
          pass_to_cell: ptc,
        },
      }
    })

    return {
      spall_config: {
        num_heaters: filled.numHeaters,
        firing_config: filled.firingConfig,
        uniform_passes: filled.uniformPasses,
        passes_per_cell_map: !filled.uniformPasses ? filled.passesPerCellMap : null,
        heaters,
      },
    }
  }

  const output = generateJSON()
  const jsonString = JSON.stringify(output, null, 2)

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-accent-blue px-4 py-3">
          <span className="text-[12px] font-bold text-white uppercase tracking-wide">Spall Configuration Output</span>
        </div>
        <div className="p-4">
          <p className="text-[12px] text-text-secondary mb-4">
            Generated spall configuration in JSON format. This configuration will be stored and used in the model pipeline.
          </p>

          <div className="bg-surface border border-border rounded-md p-4 font-mono text-[11px] text-text-primary max-h-[400px] overflow-auto whitespace-pre-wrap break-words">
            {jsonString}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(jsonString)
              }}
              className="px-3.5 py-2 text-[11px] font-semibold rounded border border-border bg-background text-accent-blue cursor-pointer font-[inherit] hover:bg-surface-hover transition-colors"
            >
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t border-border pt-3">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>← Back</button>
        <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={onNext}>
          Complete: Go to Tag Mapping →
        </button>
      </div>
    </div>
  )
}
