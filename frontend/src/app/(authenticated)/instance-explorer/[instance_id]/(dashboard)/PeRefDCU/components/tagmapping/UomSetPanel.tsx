'use client'

import { useState, useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  tagMappingsAtom,
  selectedModelIdsAtom,
  uomSetAtom,
  applyUomSetAtom,
} from '../../store/dcuAtoms'
import { uomIndexAtom } from '../../store/dcuAtoms'
import { getUomsByCategory } from '../../utils/uomUtils'

interface Props {
  onClose: () => void
}

export default function UomSetPanel({ onClose }: Props) {
  const tagMappings = useAtomValue(tagMappingsAtom)
  const selectedModelIds = useAtomValue(selectedModelIdsAtom)
  const [uomSet, setUomSet] = useAtom(uomSetAtom)
  const applyUomSet = useSetAtom(applyUomSetAtom)
  const uomIndex = useAtomValue(uomIndexAtom)

  // Collect unique uom_category values from active model's mappings
  const activeCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const m of tagMappings) {
      if (m.uom_category && m.model_ids.some(id => selectedModelIds.includes(id))) {
        cats.add(m.uom_category)
      }
    }
    return [...cats].sort()
  }, [tagMappings, selectedModelIds])

  // Blueprint default UOM for a category — used as initial pre-fill
  const defaultForCat = (cat: string): string =>
    tagMappings.find(m => m.uom_category === cat && m.default_uom)?.default_uom ?? ''

  const [localSet, setLocalSet] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const cat of activeCategories) {
      init[cat] = uomSet[cat] ?? defaultForCat(cat)
    }
    return init
  })

  // Checkbox selection — all checked by default
  const [selected, setSelected] = useState<Set<string>>(() => new Set(activeCategories))

  const allChecked = selected.size === activeCategories.length
  const someChecked = selected.size > 0 && !allChecked

  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(activeCategories))
  }

  const toggleCat = (cat: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleApply = () => {
    const filteredSet: Record<string, string> = { ...uomSet }
    for (const cat of activeCategories) {
      if (selected.has(cat)) filteredSet[cat] = localSet[cat] ?? ''
    }
    setUomSet(filteredSet)
    applyUomSet()
    onClose()
  }

  const handleSaveOnly = () => {
    const filteredSet: Record<string, string> = { ...uomSet }
    for (const cat of activeCategories) {
      if (selected.has(cat)) filteredSet[cat] = localSet[cat] ?? ''
    }
    setUomSet(filteredSet)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/35 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-[10px] shadow-[0_8px_32px_rgba(28,48,69,0.18)] w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[15px] font-bold text-text-primary">UOM Set</h3>
            <p className="mt-1 mb-0 text-[11px] text-text-secondary">
              Select categories and configure preferred units. Click Apply to auto-fill checked categories.
            </p>
          </div>
          <button
            onClick={onClose}
            className="border-none bg-transparent cursor-pointer text-text-secondary text-lg leading-none p-1"
            aria-label="Close"
          >×</button>
        </div>

        {/* Category rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {activeCategories.length === 0 ? (
            <p className="text-xs text-text-secondary text-center mt-6">
              No UOM categories found for the selected models.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="w-8 pb-2 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      className="cursor-pointer w-3.5 h-3.5"
                      title={allChecked ? 'Deselect all' : 'Select all'}
                    />
                  </th>
                  <th className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-[0.5px] pb-2">Category</th>
                  <th className="text-left text-[10px] font-bold text-text-secondary uppercase tracking-[0.5px] pb-2 pl-3">Preferred UOM</th>
                </tr>
              </thead>
              <tbody>
                {activeCategories.map(cat => {
                  const options = getUomsByCategory(uomIndex, cat)
                  const isChecked = selected.has(cat)
                  return (
                    <tr
                      key={cat}
                      className="border-b border-border"
                      style={{ opacity: isChecked ? 1 : 0.45 }}
                    >
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCat(cat)}
                          className="cursor-pointer w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-2 text-xs font-semibold text-text-primary whitespace-nowrap pr-4">
                        {cat}
                      </td>
                      <td className="py-2 pl-3">
                        <select
                          value={localSet[cat] ?? ''}
                          onChange={e => setLocalSet(prev => ({ ...prev, [cat]: e.target.value }))}
                          disabled={!isChecked}
                          className={`w-full text-xs border border-border rounded-md px-2 py-1.5 text-text-primary outline-none transition-colors
                            ${isChecked ? 'bg-surface cursor-pointer' : 'bg-background cursor-not-allowed'}`}
                        >
                          <option value="">— Not set —</option>
                          {options.map(u => (
                            <option key={u.symbol} value={u.symbol}>
                              {u.symbol}  ({u.name})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center gap-2 justify-between">
          <span className="text-[11px] text-text-secondary">
            {selected.size} of {activeCategories.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-md cursor-pointer border border-border bg-surface text-text-secondary font-semibold hover:text-text-primary transition-colors"
            >Cancel</button>
            <button
              onClick={handleSaveOnly}
              className="px-4 py-1.5 text-xs rounded-md cursor-pointer border border-accent-blue bg-surface text-accent-blue font-semibold hover:bg-accent-blue/5 transition-colors"
              title="Save UOM set for new tags without overwriting existing ones"
            >Save (new tags only)</button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-xs rounded-md cursor-pointer border-none bg-accent-blue text-white font-semibold hover:opacity-90 transition-opacity"
              title="Apply to all existing configured tags AND new tags"
            >Apply to All Tags</button>
          </div>
        </div>
      </div>
    </div>
  )
}
