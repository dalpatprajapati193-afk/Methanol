'use client'

import { useState } from 'react'
import type { HeaterOps } from './helpers'
import { makeHeaterOps, getCells, calcTotalPasses, defaultPassToCellMap } from './helpers'
import type { SpallState } from './helpers'
import { NumInput, HeaterTabs } from './components'

// Tailwind-safe color palette for operation group cards (bg + border via inline style is unavoidable
// here because the colours are data-driven and cannot be expressed as static Tailwind classes)
const GROUP_COLORS = [
  '#ffd6d6', '#d6eaff', '#d6ffd6', '#ffffd6',
  '#ffd6f5', '#f5d6ff', '#ffd6b8', '#d6fff5',
]
const GROUP_BORDER = [
  '#ff6b6b', '#4a9eff', '#4aff6b', '#f5c200',
  '#ff6bba', '#a04aff', '#ff884a', '#4affd6',
]

export function SpallOpsPanel({ spall, setSpall, onNext, onBack, mirrorMap, onMirrorChange, onCopyFrom }: {
  spall: SpallState
  setSpall: (s: SpallState) => void
  onNext: () => void
  onBack: () => void
  mirrorMap: Record<number, number>
  onMirrorChange: (h: number, src: number) => void
  onCopyFrom: (target: number, source: number) => void
}) {
  const [activeTab, setActiveTab] = useState(1)
  const totalPasses = calcTotalPasses(spall)
  const cells = getCells(spall.firingConfig)

  const getOps = (h: number): HeaterOps =>
    spall.spallOps[h] || makeHeaterOps(spall, h)

  const setOps = (h: number, patch: Partial<HeaterOps>) => {
    const updated = { ...getOps(h), ...patch }
    const newOps = { ...spall.spallOps, [h]: updated }
    Object.entries(mirrorMap).forEach(([th, src]) => {
      if (Number(src) === h) newOps[Number(th)] = { ...updated }
    })
    setSpall({ ...spall, spallOps: newOps })
  }

  const applyPattern = (h: number, pattern: string) => {
    const ops = getOps(h)
    const ptc = spall.passToCell[h] || defaultPassToCellMap(spall)
    let assignment: Record<number, number> = {}
    let numOps = ops.numOps

    if (pattern === 'per_pass') {
      numOps = totalPasses
      for (let p = 1; p <= totalPasses; p++) assignment[p] = p
    } else if (pattern === 'by_cell') {
      numOps = cells
      for (let p = 1; p <= totalPasses; p++) assignment[p] = ptc[p] || 1
    }

    setOps(h, { numOps, assignment })
  }

  const isValid = (h: number) => {
    const ops = getOps(h)
    for (let p = 1; p <= totalPasses; p++) { if (!ops.assignment[p]) return false }
    return true
  }
  const allValid = Array.from({ length: spall.numHeaters }, (_, i) => i + 1).every(isValid)

  return (
    <div className="flex flex-col flex-1 min-h-0">

      <div className="flex gap-[18px] flex-1 min-h-0 items-stretch">

        {/* Left: configuration */}
        <div className="flex-[2] min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-accent-blue px-4 py-3">
                <span className="text-[12px] font-bold text-white uppercase tracking-wide">Spall Operation Groups</span>
              </div>
              <div className="p-4">

                <HeaterTabs
                  numHeaters={spall.numHeaters} activeTab={activeTab} onSwitch={setActiveTab}
                  mirrorMap={mirrorMap} onMirrorChange={onMirrorChange} onCopyFrom={onCopyFrom}
                />

                {Array.from({ length: spall.numHeaters }, (_, i) => i + 1).map(h => {
                  if (h !== activeTab) return null
                  const ops = getOps(h)

                  const detectOpsPattern = (): string | null => {
                    const ptc = spall.passToCell[h] || defaultPassToCellMap(spall)
                    const passes = Array.from({ length: totalPasses }, (_, i) => i + 1)
                    const a = ops.assignment
                    if (passes.every(p => a[p] === p)) return 'per_pass'
                    if (passes.every(p => a[p] === (ptc[p] || 1))) return 'by_cell'
                    return null
                  }
                  const activeOpsPattern = detectOpsPattern()

                  const opsBtnClass = (key: string, valid: boolean) => {
                    const isActive = activeOpsPattern === key
                    return [
                      'px-3.5 py-[7px] rounded-md text-[12px] font-semibold font-[inherit] border transition-colors',
                      !valid ? 'opacity-50 cursor-not-allowed border-border bg-surface text-text-secondary' :
                        isActive ? 'bg-accent-blue text-white border-accent-blue' :
                          'bg-surface text-accent-blue border-accent-blue hover:bg-surface-hover cursor-pointer',
                    ].join(' ')
                  }

                  return (
                    <div key={h} className="flex flex-col gap-4">
                      <NumInput
                        label="Number of Spall Operation Groups"
                        value={ops.numOps}
                        onChange={v => setOps(h, { numOps: v })}
                        min={1} max={totalPasses}
                      />

                      <div>
                        <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wide mb-2">Quick Patterns:</div>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { key: 'per_pass', label: 'Per Pass', valid: true },
                            { key: 'by_cell', label: 'By Cell', valid: ops.numOps === cells },
                          ].map(pat => (
                            <button key={pat.key} onClick={() => applyPattern(h, pat.key)} disabled={!pat.valid}
                              className={opsBtnClass(pat.key, pat.valid)}>
                              {pat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-6 flex-wrap">
                        <div>
                          <div className="text-[11px] font-bold text-text-secondary uppercase mb-2">Assign pass → operation:</div>
                          <div className="border border-border rounded-md overflow-hidden inline-block">
                            <div className="flex bg-surface border-b border-border">
                              <div className="px-3.5 py-2 w-[70px] text-[11px] font-bold text-text-secondary">Pass</div>
                              {Array.from({ length: ops.numOps }, (_, oi) => (
                                <div key={oi} className="px-2.5 py-2 w-[60px] text-[11px] font-bold text-text-primary border-l border-border text-center">Op {oi + 1}</div>
                              ))}
                            </div>
                            {Array.from({ length: totalPasses }, (_, pi) => {
                              const p = pi + 1
                              return (
                                <div key={p} className={['flex border-b border-border last:border-b-0', pi % 2 === 0 ? 'bg-background' : 'bg-surface'].join(' ')}>
                                  <div className="px-3.5 py-2 w-[70px] text-[12px] font-semibold text-text-primary">Pass {p}</div>
                                  {Array.from({ length: ops.numOps }, (_, oi) => (
                                    <div key={oi} className="w-[60px] flex items-center justify-center border-l border-border">
                                      <input type="radio" name={`op-${h}-${p}`} value={oi + 1}
                                        checked={ops.assignment[p] === oi + 1}
                                        onChange={() => setOps(h, { assignment: { ...ops.assignment, [p]: oi + 1 } })}
                                        className="cursor-pointer accent-accent-blue" />
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold text-text-secondary uppercase mb-2">Operation Groups:</div>
                          <div className="flex gap-2 flex-wrap max-w-[320px]">
                            {Array.from({ length: ops.numOps }, (_, oi) => {
                              const op = oi + 1
                              const passesInOp = Array.from({ length: totalPasses }, (_, pi) => pi + 1).filter(p => ops.assignment[p] === op)
                              return (
                                <div key={op} style={{
                                  padding: '10px 14px', borderRadius: 8, minWidth: 70,
                                  background: GROUP_COLORS[oi % GROUP_COLORS.length],
                                  border: `2px solid ${GROUP_BORDER[oi % GROUP_BORDER.length]}`,
                                }}>
                                  <div className="text-[11px] font-bold text-text-primary mb-1">Op {op}</div>
                                  {passesInOp.map(p => (
                                    <div key={p} className="text-[12px] text-text-primary">Pass {p}</div>
                                  ))}
                                  {passesInOp.length === 0 && <div className="text-[11px] text-text-secondary">—</div>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isValid(h)
                          ? <span className="text-[12px] text-accent-green bg-accent-green/10 border border-accent-green/30 px-3 py-1.5 rounded">✓ All passes assigned</span>
                          : <span className="text-[12px] text-accent-red bg-accent-red/10 border border-accent-red/30 px-3 py-1.5 rounded">✗ Some passes not assigned</span>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: info sidebar */}
        <div className="flex-1 min-w-[200px] flex flex-col gap-3 overflow-y-auto">
          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-[14px_16px]">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
              <span className="text-[13px] font-bold text-text-primary">Spall Operations</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-[1.55] mb-3">
              Define which passes are spalled together. The <code className="text-[10px] bg-surface rounded px-1">spall_status</code> formula monitors these operation groups to detect and track active spallation events per heater.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Category', value: 'Furnace' },
                { label: 'Step', value: '2 of 3' },
                { label: 'Heaters', value: String(spall.numHeaters) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-text-secondary">{label}</span>
                  <span className="text-[11px] font-bold text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-[12px_14px]">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] font-bold text-accent-blue">Configuration tips</span>
            </div>
            <ul className="m-0 pl-4 text-[11px] text-accent-blue leading-[1.7]">
              <li>Passes in the same operation group are treated as spalled simultaneously.</li>
              <li><b>By Cell</b> is only available when the number of ops equals the cell count.</li>
              <li>Operation groups must cover every pass before you can proceed.</li>
            </ul>
          </div>
        </div>

      </div>

      <div className="shrink-0 flex justify-between pt-3.5 border-t border-border">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>← Back</button>
        <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50" disabled={!allValid} onClick={onNext}>
          Next: Spall SOP →
        </button>
      </div>

    </div>
  )
}
