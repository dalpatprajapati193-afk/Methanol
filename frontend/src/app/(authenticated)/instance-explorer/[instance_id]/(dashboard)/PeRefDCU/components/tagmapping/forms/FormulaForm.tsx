'use client'

import { useAtomValue } from 'jotai'
import type { TagEntry, AggregationType } from '../../../types'
import { buildFormulaExpression } from '../../../utils/formulaUtils'
import { uomIndexAtom } from '../../../store/dcuAtoms'

interface Props {
  entry: TagEntry
  onUpdate: (patch: Partial<TagEntry>) => void
  blueprintDefaultUom?: string
  blueprintType?: string
  attributeType?: string
  onAttributeTypeChange?: (type: string) => void
}

const labelCls = 'text-xs font-semibold text-text-secondary mb-1 block'

const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'add', label: 'Add (sum)' },
  { value: 'avg', label: 'Avg (average)' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'difference', label: 'Difference (2 sensors only)' },
]

export default function FormulaForm({ entry, onUpdate, blueprintDefaultUom }: Props) {
  const uomIndex = useAtomValue(uomIndexAtom)
  const sensors = entry.pi_sensors ?? []
  const sensorCount = sensors.filter(s => s.sensor_name || s.sensor_code).length
  const targetUom = blueprintDefaultUom || entry.default_uom || ''

  const expression = buildFormulaExpression(sensors, entry.aggregation, uomIndex, targetUom)
  const hasConversion = sensors.some(s => s.sensor_uom && targetUom && s.sensor_uom !== targetUom)

  return (
    <div className="space-y-2">
      {/* Read-only sensor list from PI section */}
      <div>
        <label className={labelCls}>PI Sensors (from PI Sensor section)</label>
        {sensorCount === 0 ? (
          <p className="text-xs text-accent-orange bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            No sensors entered yet — switch to PI Sensor tab and add sensors first.
          </p>
        ) : (
          <div className="space-y-1">
            {sensors.filter(s => s.sensor_name || s.sensor_code).map((s, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-hover border border-border rounded-md px-2 py-1 text-xs font-mono text-text-primary">
                <span className="text-text-secondary font-sans font-semibold w-4">{idx + 1}.</span>
                <span className="font-semibold">{s.sensor_name || s.sensor_code}</span>
                {s.sensor_uom && <span className="text-text-secondary">({s.sensor_uom})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggregation */}
      <div className="pt-1 border-t border-border">
        <label className={labelCls}>Aggregation functions</label>
        <div className="flex flex-wrap gap-2">
          {AGGREGATION_OPTIONS.map(opt => {
            const isDifferenceDisabled = opt.value === 'difference' && sensorCount !== 2
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isDifferenceDisabled}
                onClick={() => onUpdate({ aggregation: opt.value })}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                  entry.aggregation === opt.value
                    ? 'bg-purple-600 text-white border-purple-600'
                    : isDifferenceDisabled
                      ? 'border-border text-text-secondary cursor-not-allowed bg-surface-hover'
                      : 'border-border text-text-secondary hover:border-purple-300 hover:text-purple-600'
                }`}
                title={isDifferenceDisabled ? 'Requires exactly 2 sensors' : undefined}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Target UOM info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 text-xs">
        <p className="text-blue-900">
          <span className="font-semibold">Target UOM:</span> {targetUom || '(none set)'}
          {blueprintDefaultUom && (
            <span className="ml-2 text-blue-700">(from Blueprint: {blueprintDefaultUom})</span>
          )}
          {!blueprintDefaultUom && entry.default_uom && (
            <span className="ml-2 text-blue-700">(from Default UOM: {entry.default_uom})</span>
          )}
        </p>
      </div>

      {/* Expression preview */}
      <div>
        <label className={labelCls}>Expression (Python-compatible preview)</label>
        <div className="w-full border border-border rounded-md px-2.5 py-1.5 bg-surface-hover font-mono text-xs text-text-primary min-h-[32px]">
          {expression || <span className="text-text-secondary italic">Add sensors in the PI Sensor tab first</span>}
        </div>
        {hasConversion && targetUom && (
          <p className="text-xs text-accent-green mt-1">
            ✓ UOM conversion applied: sensors converted to {targetUom}
          </p>
        )}
      </div>
    </div>
  )
}
