import type { UOMEntry } from '../types'

interface Transform {
  scale: number
  offset: number
}

export interface UomIndex {
  bySymbol: Record<string, UOMEntry>
  byCategory: Record<string, UOMEntry[]>
  categories: string[]
}

/**
 * Builds lookup structures from the UOM bank fetched from the blueprint API.
 * The bank is loaded dynamically (Jotai atom via Server Action), so callers
 * build the index once with useMemo rather than relying on a static import.
 */
export function buildUomIndex(bank: UOMEntry[]): UomIndex {
  const bySymbol: Record<string, UOMEntry> = {}
  const byCategory: Record<string, UOMEntry[]> = {}

  for (const entry of bank) {
    bySymbol[entry.symbol] = entry
    if (!byCategory[entry.category]) byCategory[entry.category] = []
    byCategory[entry.category].push(entry)
  }

  return {
    bySymbol,
    byCategory,
    categories: Object.keys(byCategory).sort(),
  }
}

function toBaseTransform(
  symbol: string,
  index: UomIndex,
  cache: Map<string, Transform | null>
): Transform | null {
  if (cache.has(symbol)) {
    return cache.get(symbol) || null
  }

  const uom = index.bySymbol[symbol]
  if (!uom) {
    cache.set(symbol, null)
    return null
  }

  if (!uom.refUOM) {
    const result = { scale: 1, offset: 0 }
    cache.set(symbol, result)
    return result
  }

  const parentTransform = toBaseTransform(uom.refUOM, index, cache)
  if (!parentTransform) {
    cache.set(symbol, null)
    return null
  }

  const result = {
    scale: parentTransform.scale * uom.refFactor,
    offset: parentTransform.offset * uom.refFactor + uom.refOffset,
  }

  cache.set(symbol, result)
  return result
}

export function getConversion(
  index: UomIndex,
  fromSymbol: string,
  toSymbol: string
): { scale: number; shift: number } | null {
  const fromUom = index.bySymbol[fromSymbol]
  const toUom = index.bySymbol[toSymbol]

  if (!fromUom || !toUom) return null
  if (fromUom.category !== toUom.category) return null

  const cache = new Map<string, Transform | null>()
  const fromBase = toBaseTransform(fromSymbol, index, cache)
  const toBase = toBaseTransform(toSymbol, index, cache)

  if (!fromBase || !toBase) return null

  const scale = fromBase.scale / toBase.scale
  const shift = (fromBase.offset - toBase.offset) / toBase.scale

  return { scale, shift }
}

export function getUomsByCategory(index: UomIndex, category: string): UOMEntry[] {
  return index.byCategory[category] || []
}

export function getAllCategories(index: UomIndex): string[] {
  return index.categories
}

export function formatConversionExpression(scale: number, shift: number): string {
  const absScale = Math.abs(scale)
  const scalePrecision = absScale < 1 ? 6 : 2

  if (shift === 0) {
    if (scale === 1) {
      return ''
    }
    return `* ${scale.toFixed(scalePrecision)}`
  }

  const scaleStr = scale.toFixed(scalePrecision)
  const shiftStr = shift >= 0 ? `+ ${shift.toFixed(2)}` : `- ${Math.abs(shift).toFixed(2)}`
  return `* ${scaleStr} ${shiftStr}`
}
