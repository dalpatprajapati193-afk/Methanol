import type { PISensor, AggregationType } from '../types'
import { getConversion, type UomIndex } from './uomUtils'

export function buildFormulaExpression(
  sensors: PISensor[],
  aggregation: AggregationType,
  uomIndex: UomIndex,
  defaultUom?: string
): string {
  const filled = sensors.filter(s => s.sensor_name || s.sensor_code)
  if (filled.length === 0) return ''

  const tags = filled.map(s => {
    const label = s.sensor_name || s.sensor_code
    const sensor = `[${label}]`

    if (defaultUom && s.sensor_uom && s.sensor_uom !== defaultUom) {
      const conv = getConversion(uomIndex, s.sensor_uom, defaultUom)
      if (conv) {
        const { scale, shift } = conv
        if (scale === 1 && shift === 0) {
          return sensor
        } else if (shift === 0) {
          const scaleFmt = Math.abs(scale) < 1 ? scale.toFixed(6) : scale.toFixed(2)
          return `${sensor} * ${scaleFmt}`
        } else {
          const scaleFmt = Math.abs(scale) < 1 ? scale.toFixed(6) : scale.toFixed(2)
          const shiftStr = shift >= 0 ? `+ ${shift.toFixed(2)}` : `- ${Math.abs(shift).toFixed(2)}`
          return `${sensor} * ${scaleFmt} ${shiftStr}`
        }
      }
    }

    return sensor
  })

  switch (aggregation) {
    case 'add': return tags.map(t => `(${t})`).join(' + ')
    case 'avg': return `(${tags.map(t => `(${t})`).join(' + ')}) / ${tags.length}`
    case 'min': return `min(${tags.map(t => `(${t})`).join(', ')})`
    case 'max': return `nanmax(${tags.map(t => `(${t})`).join(', ')})`
    case 'difference': return filled.length === 2 ? `abs((${tags[0]}) - (${tags[1]}))` : ''
    default: return tags.map(t => `(${t})`).join(' + ')
  }
}
