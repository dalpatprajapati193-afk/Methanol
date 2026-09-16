'use client'

import { useAtom } from 'jotai'
import { valueMapAtom } from '../../store/dcuAtoms'
import type { ValueMapEntry } from '../../types'

export function ValueMapPanel({ onClose }: { onClose: () => void }) {
  const [valueMap, setValueMap] = useAtom(valueMapAtom)

  const updateRawValue = (idx: number, val: string) => {
    const updated: ValueMapEntry[] = [...valueMap]
    updated[idx] = { ...updated[idx], raw_value: val }
    setValueMap(updated)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
    >
      <div
        className="bg-surface rounded-lg shadow-lg max-w-[600px] w-[90%] max-h-[80vh] overflow-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="text-base font-semibold text-text-primary m-0">VALUE MAPPINGS</h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-xl text-text-secondary p-0 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div className="px-6 py-4 bg-background border-b border-border">
          <p className="text-xs text-text-secondary m-0 leading-relaxed">
            Edit the raw PI tag values your historian returns for each state. These are used to transform incoming data before formula evaluation.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-auto">
          {valueMap.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-6">No value mappings defined</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-background border-b border-border">
                    <th className="px-3 py-2.5 text-left font-bold text-text-primary min-w-[140px]">Label (State)</th>
                    <th className="px-3 py-2.5 text-left font-bold text-text-primary min-w-[200px]">Raw PI Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valueMap.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`${idx < valueMap.length - 1 ? 'border-b border-border' : ''} ${idx % 2 === 0 ? 'bg-surface' : 'bg-background'}`}
                    >
                      <td className="px-3 py-2.5 text-text-secondary font-medium">{row.label}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={row.raw_value}
                          onChange={e => updateRawValue(idx, e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-xs font-[inherit] focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent-blue text-white border-none rounded font-semibold text-[13px] cursor-pointer font-[inherit]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
