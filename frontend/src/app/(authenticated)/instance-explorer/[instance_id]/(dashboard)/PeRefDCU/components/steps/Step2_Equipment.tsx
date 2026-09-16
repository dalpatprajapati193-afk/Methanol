'use client'

import { useState, useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  equipmentAtom,
  furnaceGeometryAtom,
  auxiliaryEquipmentConfigAtom,
  passTubeMappingAtom,
  spallConfigAtom,
  setStepAtom,
  buildEquipmentFromMatrix,
} from '../../store/dcuAtoms'
import type { MatrixRow } from '../../store/dcuAtoms'
import type { Equipment, Furnace, Fractionator } from '../../types'

interface Props { onNext: () => void; onBack: () => void }

type Phase = 'seed-furnace' | 'seed-auxiliary' | 'passmap' | 'tubes' | 'names'

interface HeaterTubeConfig {
  totalTubesPerPass: number
  radiantTubesPerPass: number
  convectionTubesPerPass: number
  tubeNumbering: 'top_to_bottom' | 'bottom_to_top'
  tmtTubes: number[]
}

interface HeaterGroups {
  numGroups: number
  assignment: Record<number, number>
}

interface HeaterOps {
  numOps: number
  assignment: Record<number, number>
}

interface SpallState {
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

const GROUP_COLORS = [
  '#ffd6d6', '#d6eaff', '#d6ffd6', '#ffffd6',
  '#ffd6f5', '#f5d6ff', '#ffd6b8', '#d6fff5',
]
const GROUP_BORDER = [
  '#ff6b6b', '#4a9eff', '#4aff6b', '#f5c200',
  '#ff6bba', '#a04aff', '#ff884a', '#4affd6',
]

function getCells(fc: 'double' | 'single') { return fc === 'double' ? 2 : 1 }

function calcTotalPasses(spall: SpallState): number {
  const cells = getCells(spall.firingConfig)
  if (spall.uniformPasses || cells === 1) return cells * spall.passesPerCell
  let total = 0
  for (let c = 1; c <= cells; c++) total += spall.passesPerCellMap[c] || spall.passesPerCell
  return total
}

function defaultCellForPass(spall: SpallState, p: number): number {
  const cells = getCells(spall.firingConfig)
  if (spall.uniformPasses || cells === 1) return Math.ceil(p / spall.passesPerCell)
  let boundary = 0
  for (let c = 1; c <= cells; c++) {
    boundary += spall.passesPerCellMap[c] || spall.passesPerCell
    if (p <= boundary) return c
  }
  return cells
}

function defaultPassToCellMap(spall: SpallState): Record<number, number> {
  const totalPasses = calcTotalPasses(spall)
  const result: Record<number, number> = {}
  for (let p = 1; p <= totalPasses; p++) result[p] = defaultCellForPass(spall, p)
  return result
}

function makeTubeConfig(_spall: SpallState): HeaterTubeConfig {
  const radiantPerPass = 17
  return {
    totalTubesPerPass: radiantPerPass,
    radiantTubesPerPass: radiantPerPass,
    convectionTubesPerPass: 0,
    tubeNumbering: 'top_to_bottom',
    tmtTubes: [],
  }
}

function makeHeaterGroups(spall: SpallState, h: number): HeaterGroups {
  const cells = getCells(spall.firingConfig)
  const totalPasses = calcTotalPasses(spall)
  const assignment: Record<number, number> = {}
  const passToCell = spall.passToCell[h] || defaultPassToCellMap(spall)
  for (let p = 1; p <= totalPasses; p++) assignment[p] = passToCell[p] || 1
  return { numGroups: cells, assignment }
}

function makeHeaterOps(spall: SpallState, h: number): HeaterOps {
  const cells = getCells(spall.firingConfig)
  const totalPasses = calcTotalPasses(spall)
  const assignment: Record<number, number> = {}
  const passToCell = spall.passToCell[h] || defaultPassToCellMap(spall)
  for (let p = 1; p <= totalPasses; p++) assignment[p] = passToCell[p] || 1
  return { numOps: cells, assignment }
}

function initSpall(): SpallState {
  return {
    numHeaters: 2,
    firingConfig: 'double',
    passesPerCell: 2,
    uniformPasses: true,
    passesPerCellMap: {},
    hasOpTags: true,
    drumsPerTrain: 2,
    uniformDrums: true,
    drumsPerTrainMap: {},
    numFractionators: 1,
    overheads: 1,
    reboilers: 1,
    passToCell: {},
    tubeConfigs: {},
    heaterGroups: {},
    spallOps: {},
  }
}

function NumInput({ label, value, onChange, min = 1, max = 99, width = 120 }: {
  label?: string; value: number; onChange: (n: number) => void; min?: number; max?: number; width?: number
}) {
  const [display, setDisplay] = useState(String(value))
  const lastExternal = useRef(value)

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value
      setDisplay(String(value))
    }
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>}
      <input
        type="number" min={min} max={max}
        value={display}
        onChange={e => {
          setDisplay(e.target.value)
          const v = parseInt(e.target.value)
          if (!isNaN(v) && v >= min && v <= max) {
            lastExternal.current = v
            onChange(v)
          }
        }}
        onBlur={e => {
          const v = parseInt(e.target.value)
          if (isNaN(v) || v < min) { setDisplay(String(min)); lastExternal.current = min; onChange(min) }
          else if (v > max) { setDisplay(String(max)); lastExternal.current = max; onChange(max) }
          else setDisplay(String(v))
        }}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-center text-[13px] font-bold text-text-primary shadow-sm focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
        style={{ width }}
      />
    </div>
  )
}

function NameInput({ value, onChange, width = 96, mono = false }: {
  value: string; onChange: (v: string) => void; width?: number; mono?: boolean
}) {
  return (
    <input
      className="rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] font-semibold text-text-primary shadow-sm focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
      style={{ width, fontFamily: mono ? 'monospace' : 'inherit' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function HeaterTabs({ numHeaters, activeTab, onSwitch, mirrorMap, onMirrorChange, onCopyFrom }: {
  numHeaters: number
  activeTab: number
  onSwitch: (h: number) => void
  mirrorMap: Record<number, number>
  onMirrorChange: (h: number, source: number) => void
  onCopyFrom: (target: number, source: number) => void
}) {
  const [copyMenuOpen, setCopyMenuOpen] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid #dce8f0', marginBottom: 16, flexWrap: 'wrap' }}>
      {Array.from({ length: numHeaters }, (_, i) => {
        const h = i + 1
        return (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => onSwitch(h)}
              style={{
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 600, borderBottom: activeTab === h ? '3px solid #009FDF' : '3px solid transparent',
                color: activeTab === h ? '#009FDF' : '#7a95a8', borderRadius: 0, fontSize: 13,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
              Heater {h}
            </button>

            {numHeaters > 1 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setCopyMenuOpen(copyMenuOpen === h ? null : h)}
                  title="Copy settings from another heater"
                  style={{
                    padding: '4px 8px', fontSize: 11, fontWeight: 600,
                    border: `1px solid ${mirrorMap[h] ? '#009FDF' : '#dce8f0'}`,
                    borderRadius: 4, background: mirrorMap[h] ? 'rgba(0,159,223,0.08)' : '#f4f8fb',
                    color: mirrorMap[h] ? '#009FDF' : '#7a95a8', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {mirrorMap[h] ? `↔ Synced with H${mirrorMap[h]}` : '⧉ Copy'}
                </button>

                {copyMenuOpen === h && (
                  <div style={{
                    position: 'absolute', top: '110%', left: 0, zIndex: 100,
                    background: '#fff', border: '1.5px solid #dce8f0', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180, padding: 8,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, padding: '0 4px' }}>Copy from:</div>
                    {Array.from({ length: numHeaters }, (_, j) => j + 1).filter(src => src !== h).map(src => (
                      <button key={src} onClick={() => { onCopyFrom(h, src); setCopyMenuOpen(null) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                          border: 'none', borderRadius: 5, background: 'transparent',
                          fontSize: 13, fontWeight: 600, color: '#1c3045', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f4f8fb')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Heater {src}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid #dce8f0', marginTop: 4, paddingTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!mirrorMap[h]} onChange={e => {
                          if (!e.target.checked) onMirrorChange(h, 0)
                          else onMirrorChange(h, Array.from({ length: numHeaters }, (_, j) => j + 1).filter(s => s !== h)[0] ?? 0)
                        }} style={{ accentColor: '#1e3a5f', cursor: 'pointer' }} />
                        Keep in sync
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FurnaceGeometryPanel({ spall, setSpall }: {
  spall: SpallState; setSpall: (s: SpallState) => void
}) {
  const set = <K extends keyof SpallState>(k: K, v: SpallState[K]) => setSpall({ ...spall, [k]: v })
  const totalPasses = calcTotalPasses(spall)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-accent-blue" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Furnace Geometry</span>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-section">
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#1c3045' }}>Select Number of Heaters:</label>
            <NumInput value={spall.numHeaters} onChange={v => set('numHeaters', v)} min={1} max={10} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#1c3045' }}>Select Heater Firing Configuration:</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['double', 'single'] as const).map(fc => (
                <div key={fc} onClick={() => setSpall({
                  ...spall, firingConfig: fc,
                  uniformPasses: fc === 'single' ? true : spall.uniformPasses,
                })} style={{
                  flex: 1, padding: '12px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${spall.firingConfig === fc ? '#009FDF' : '#dce8f0'}`,
                  background: spall.firingConfig === fc ? 'rgba(0,159,223,0.06)' : '#fafafa',
                  boxShadow: spall.firingConfig === fc ? '0 4px 12px rgba(0,159,223,0.2)' : 'none',
                  transition: 'all 0.2s', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: spall.firingConfig === fc ? '#009FDF' : '#333', marginBottom: 4 }}>
                    {fc === 'double' ? 'Double-Fired' : 'Single-Fired'}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                    {fc === 'double' ? 'Two fireboxes (2 cells per heater)' : 'One firebox (1 cell per heater)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {spall.firingConfig === 'single' || spall.uniformPasses ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#1c3045' }}>Select Passes per Cell per Firebox:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumInput value={spall.passesPerCell} onChange={v => set('passesPerCell', v)} min={1} max={20} width={80} />
              </div>
            </div>
          ) : null}
          {spall.firingConfig === 'double' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
                <input type="checkbox" checked={spall.uniformPasses}
                  onChange={e => set('uniformPasses', e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#1e3a5f', width: 14, height: 14 }} />
                All cells have the same number of passes
              </label>
              {!spall.uniformPasses && (
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #009FDF', marginTop: 8 }}>
                  {[1, 2].map(c => {
                    const cur = spall.passesPerCellMap[c] || spall.passesPerCell
                    return (
                      <div key={c} style={{ marginBottom: c < 2 ? 10 : 0 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#1c3045' }}>Cell {c}:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <NumInput value={cur} min={1} max={20} width={70}
                            onChange={v => setSpall({ ...spall, passesPerCellMap: { ...spall.passesPerCellMap, [c]: v } })} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AuxiliaryEquipmentPanel({ spall, setSpall }: {
  spall: SpallState; setSpall: (s: SpallState) => void
}) {
  const set = <K extends keyof SpallState>(k: K, v: SpallState[K]) => setSpall({ ...spall, [k]: v })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-accent-blue" style={{ padding: '9px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Auxiliary Equipment</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Coke Drum</p>
            <p style={{ fontSize: 10, color: '#8ba3b5', marginBottom: 10 }}>One drum train per furnace — total trains = total heaters.</p>
            {spall.numHeaters <= 1 || spall.uniformDrums ? (
              <>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#1c3045' }}>Drums per Train:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <NumInput value={spall.drumsPerTrain} onChange={v => set('drumsPerTrain', v)} min={1} max={20} width={80} />
                </div>
              </>
            ) : null}
            {spall.numHeaters > 1 && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
                  <input type="checkbox" checked={spall.uniformDrums}
                    onChange={e => set('uniformDrums', e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#1e3a5f', width: 14, height: 14 }} />
                  All trains have the same number of drums
                </label>
                {!spall.uniformDrums && (
                  <div style={{ padding: 14, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #009FDF' }}>
                    {Array.from({ length: spall.numHeaters }, (_, i) => i + 1).map(t => {
                      const cur = spall.drumsPerTrainMap[t] || spall.drumsPerTrain
                      return (
                        <div key={t} style={{ marginBottom: t < spall.numHeaters ? 14 : 0 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#1c3045' }}>Train {t}:</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <NumInput value={cur} min={1} max={20} width={70}
                              onChange={v => setSpall({ ...spall, drumsPerTrainMap: { ...spall.drumsPerTrainMap, [t]: v } })} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ borderTop: '1px solid #dce8f0', paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Fractionator</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <NumInput label="Fractionators" value={spall.numFractionators} onChange={v => set('numFractionators', v)} />
              <NumInput label="Overheads" value={spall.overheads} onChange={v => set('overheads', v)} />
              <NumInput label="Reboilers" value={spall.reboilers} onChange={v => set('reboilers', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PassMapSVG({ spall, passToCell, totalPasses }: {
  spall: SpallState; passToCell: Record<number, number>; totalPasses: number
}) {
  const cells = getCells(spall.firingConfig)
  const isDbl = spall.firingConfig === 'double'
  const W = 240, H = 180
  const pad = 20
  const cellColors = ['#FFE5E5', '#E5F3FF', '#E5FFE5', '#FFFFE5']
  const cellW = isDbl ? (W - 2 * pad - 10) / 2 : W - 2 * pad
  const cellH = H - 2 * pad - 20
  const passesInCell: Record<number, number[]> = {}
  for (let c = 1; c <= cells; c++) passesInCell[c] = []
  for (let p = 1; p <= totalPasses; p++) {
    const c = passToCell[p] || 1
    if (!passesInCell[c]) passesInCell[c] = []
    passesInCell[c].push(p)
  }
  return (
    <svg width={W} height={H} style={{ border: '1px solid #dce8f0', borderRadius: 4, background: '#fafafa' }}>
      {Array.from({ length: cells }, (_, ci) => {
        const c = ci + 1
        const x = pad + ci * (cellW + 10)
        const passes = passesInCell[c] || []
        const pH = passes.length > 0 ? Math.min(cellH / passes.length - 4, 30) : cellH
        return (
          <g key={c}>
            <text x={x + cellW / 2} y={pad - 4} textAnchor="middle" fontSize={10} fill="#666">Cell {c}</text>
            <rect x={x} y={pad} width={cellW} height={cellH} fill={cellColors[ci % cellColors.length]} stroke="#aaa" strokeWidth={1} rx={3} />
            {passes.map((p, pi) => {
              const py = pad + pi * (pH + 4) + 2
              return (
                <g key={p}>
                  <rect x={x + 4} y={py} width={cellW - 8} height={pH} fill="rgba(0,0,0,0.08)" rx={2} />
                  <text x={x + cellW / 2} y={py + pH / 2 + 5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#333">P{p}</text>
                </g>
              )
            })}
          </g>
        )
      })}
      {isDbl && (
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#f97316">Firebox</text>
      )}
    </svg>
  )
}

function PassMapPanel({ spall, setSpall, mirrorMap, onMirrorChange, onCopyFrom }: {
  spall: SpallState; setSpall: (s: SpallState) => void
  mirrorMap: Record<number, number>; onMirrorChange: (h: number, src: number) => void
  onCopyFrom: (target: number, source: number) => void
}) {
  const [activeTab, setActiveTab] = useState(1)
  const cells = getCells(spall.firingConfig)
  const totalPasses = calcTotalPasses(spall)

  const ensure = (h: number): SpallState => {
    if (spall.passToCell[h]) return spall
    const ptc = defaultPassToCellMap(spall)
    return { ...spall, passToCell: { ...spall.passToCell, [h]: ptc } }
  }

  const setPassCell = (h: number, p: number, c: number) => {
    const s = ensure(h)
    const ptc = { ...s.passToCell[h], [p]: c }
    const updated = { ...s, passToCell: { ...s.passToCell, [h]: ptc } }
    const mirroredUpdates = { ...updated.passToCell }
    Object.entries(mirrorMap).forEach(([th, src]) => {
      if (Number(src) === h) mirroredUpdates[Number(th)] = { ...ptc }
    })
    setSpall({ ...updated, passToCell: mirroredUpdates })
  }

  const mergedPtc = (h: number) => ({ ...defaultPassToCellMap(spall), ...(spall.passToCell[h] || {}) })
  const getPassCell = (h: number, p: number) => mergedPtc(h)[p] || 0

  const isValid = (h: number) => {
    const ptc = mergedPtc(h)
    for (let p = 1; p <= totalPasses; p++) { if (!ptc[p]) return false }
    return true
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-accent-blue" style={{ padding: '9px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pass-to-Cell Mapping</span>
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Assign each pass to its corresponding cell.</p>
          <HeaterTabs
            numHeaters={spall.numHeaters} activeTab={activeTab} onSwitch={setActiveTab}
            mirrorMap={mirrorMap} onMirrorChange={onMirrorChange} onCopyFrom={onCopyFrom}
          />
          {Array.from({ length: spall.numHeaters }, (_, i) => i + 1).map(h => {
            if (h !== activeTab) return null
            const ptc = mergedPtc(h)
            return (
              <div key={h}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', marginBottom: 8 }}>Assign pass → cell:</div>
                    <div style={{ border: '1px solid #dce8f0', borderRadius: 6, overflow: 'hidden', display: 'inline-block' }}>
                      <div style={{ display: 'flex', background: '#f4f8fb', borderBottom: '1px solid #dce8f0' }}>
                        <div style={{ padding: '8px 14px', width: 70, fontSize: 11, fontWeight: 700, color: '#7a95a8' }}>Pass</div>
                        {Array.from({ length: cells }, (_, ci) => (
                          <div key={ci} style={{ padding: '8px 14px', width: 70, fontSize: 11, fontWeight: 700, color: '#1c3045', borderLeft: '1px solid #dce8f0', textAlign: 'center' }}>Cell {ci + 1}</div>
                        ))}
                      </div>
                      {Array.from({ length: totalPasses }, (_, pi) => {
                        const p = pi + 1
                        return (
                          <div key={p} style={{ display: 'flex', borderBottom: pi < totalPasses - 1 ? '1px solid #dce8f0' : 'none', background: pi % 2 === 0 ? '#fff' : '#f9fbfc' }}>
                            <div style={{ padding: '8px 14px', width: 70, fontSize: 12, fontWeight: 600, color: '#3d5a70' }}>Pass {p}</div>
                            {Array.from({ length: cells }, (_, ci) => (
                              <div key={ci} style={{ width: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #dce8f0' }}>
                                <input type="radio" name={`ptc-${h}-${p}`} value={ci + 1}
                                  checked={getPassCell(h, p) === ci + 1}
                                  onChange={() => setPassCell(h, p, ci + 1)}
                                  style={{ cursor: 'pointer', accentColor: '#1e3a5f' }} />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', marginBottom: 8 }}>Visual layout:</div>
                    <PassMapSVG spall={spall} passToCell={ptc} totalPasses={totalPasses} />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  {isValid(h)
                    ? <span style={{ fontSize: 12, color: '#155724', background: '#d4edda', border: '1px solid #c3e6cb', padding: '6px 12px', borderRadius: 4 }}>All passes assigned</span>
                    : <span style={{ fontSize: 12, color: '#721c24', background: '#f8d7da', border: '1px solid #f5c6cb', padding: '6px 12px', borderRadius: 4 }}>Some passes not assigned</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TubeCircleSelector({ conf, onToggle }: {
  conf: HeaterTubeConfig; onToggle: (displayNum: number) => void
}) {
  const { radiantTubesPerPass, tubeNumbering, tmtTubes } = conf
  const convectionPerPass = Math.max(0, conf.totalTubesPerPass - radiantTubesPerPass)
  const getDisplayNum = (idx: number) =>
    tubeNumbering === 'top_to_bottom' ? convectionPerPass + idx : idx
  const first = getDisplayNum(1)
  const last = getDisplayNum(radiantTubesPerPass)
  return (
    <div>
      <div style={{ fontSize: 11, color: '#7a95a8', marginBottom: 8 }}>
        {tubeNumbering === 'top_to_bottom'
          ? `Convection: 1–${convectionPerPass || '—'} (top) | Radiant: ${first}–${last} (below)`
          : `Radiant: ${first}–${last} (bottom) | Convection: ${radiantTubesPerPass + 1}–${radiantTubesPerPass + convectionPerPass || '—'} (above)`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 12, background: '#f0f5f9', borderRadius: 6, maxWidth: 440 }}>
        {Array.from({ length: radiantTubesPerPass }, (_, i) => {
          const d = getDisplayNum(i + 1)
          const isTMT = tmtTubes.includes(d)
          return (
            <div key={i} onClick={() => onToggle(d)}
              title={`Tube ${d}${isTMT ? ' (TMT)' : ''}`}
              style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                background: isTMT ? '#f97316' : '#d0d8e0',
                color: isTMT ? '#fff' : '#3d5a70',
                border: `2px solid ${isTMT ? '#c2570a' : 'transparent'}`,
                boxShadow: isTMT ? '0 2px 8px rgba(249,115,22,0.35)' : 'none',
              }}>
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TubeConfigPanel({ spall, setSpall, mirrorMap, onMirrorChange, onCopyFrom }: {
  spall: SpallState; setSpall: (s: SpallState) => void
  mirrorMap: Record<number, number>; onMirrorChange: (h: number, src: number) => void
  onCopyFrom: (target: number, source: number) => void
}) {
  const [activeTab, setActiveTab] = useState(1)

  const getConf = (h: number): HeaterTubeConfig => {
    const src = mirrorMap[h] || h
    return spall.tubeConfigs[src] || makeTubeConfig(spall)
  }

  const setConf = (h: number, patch: Partial<HeaterTubeConfig>) => {
    const updated = { ...getConf(h), ...patch }
    const newConfigs = { ...spall.tubeConfigs, [h]: updated }
    Object.entries(mirrorMap).forEach(([th, src]) => {
      if (Number(src) === h) newConfigs[Number(th)] = { ...updated }
    })
    setSpall({ ...spall, tubeConfigs: newConfigs })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-accent-blue" style={{ padding: '9px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Tube Configuration & TMT Tags</span>
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Define tube layout and select which tubes have temperature monitoring (TMT) tags for spall detection.</p>
          <HeaterTabs
            numHeaters={spall.numHeaters} activeTab={activeTab} onSwitch={setActiveTab}
            mirrorMap={mirrorMap} onMirrorChange={onMirrorChange} onCopyFrom={onCopyFrom}
          />
          {Array.from({ length: spall.numHeaters }, (_, i) => i + 1).map(h => {
            if (h !== activeTab) return null
            const conf = getConf(h)
            return (
              <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 14, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #009FDF' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1c3045', marginBottom: 12 }}>Tube Counts</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
                    <NumInput
                      label="Total tubes per pass"
                      value={conf.totalTubesPerPass}
                      onChange={v => {
                        const convection = Math.max(0, v - conf.radiantTubesPerPass)
                        setConf(h, { totalTubesPerPass: v, convectionTubesPerPass: convection })
                      }}
                      min={1} max={500}
                    />
                    <NumInput
                      label="Radiant tubes per pass"
                      value={conf.radiantTubesPerPass}
                      onChange={v => {
                        const convection = Math.max(0, conf.totalTubesPerPass - v)
                        setConf(h, { radiantTubesPerPass: v, convectionTubesPerPass: convection })
                      }}
                      min={1} max={500}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Convection tubes per pass</label>
                      <div style={{ padding: '8px 14px', background: '#e8f0f7', border: '1px solid #dce8f0', borderRadius: 5, fontSize: 13, fontWeight: 700, color: '#3d5a70', width: 120, textAlign: 'center' }}>
                        {conf.convectionTubesPerPass}
                        <span style={{ fontSize: 10, fontWeight: 400, color: '#8ba3b5', marginLeft: 4 }}>(auto)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: 14, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #009FDF' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1c3045', marginBottom: 10 }}>Tube Numbering</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { value: 'top_to_bottom' as const, label: 'Top → Bottom (Tube 1 = top)' },
                      { value: 'bottom_to_top' as const, label: 'Bottom → Top (Tube 1 = bottom)' },
                    ].map(opt => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input type="radio" name={`tubeNum-${h}`} value={opt.value}
                          checked={conf.tubeNumbering === opt.value}
                          onChange={() => setConf(h, { tubeNumbering: opt.value })}
                          style={{ cursor: 'pointer', accentColor: '#1e3a5f' }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 14, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #009FDF' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1c3045', marginBottom: 6 }}>TMT Tags</div>
                  <TubeCircleSelector
                    conf={conf}
                    onToggle={displayNum => {
                      const idx = conf.tmtTubes.indexOf(displayNum)
                      const next = idx > -1 ? conf.tmtTubes.filter(x => x !== displayNum) : [...conf.tmtTubes, displayNum].sort((a, b) => a - b)
                      setConf(h, { tmtTubes: next })
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NameEditor({ eq, setEquipment, phase }: {
  eq: Equipment; setEquipment: (e: Equipment) => void; phase: 'heaters' | 'drums' | 'fracs'
}) {
  const [openHeaters, setOpenHeaters] = useState<Set<number>>(
    () => new Set(eq.furnaces.map((_, i) => i))
  )
  const toggleHeater = (fi: number) => setOpenHeaters(prev => {
    const next = new Set(prev); if (next.has(fi)) next.delete(fi); else next.add(fi); return next
  })
  const mutateFurnace = (fi: number, fn: (f: Furnace) => Furnace) =>
    setEquipment({ ...eq, furnaces: eq.furnaces.map((f, i) => i === fi ? fn(f) : f) })
  const renameFurnace = (fi: number, name: string) => mutateFurnace(fi, f => ({ ...f, name }))
  const renameCell = (fi: number, ci: number, name: string) =>
    mutateFurnace(fi, f => ({ ...f, cells: f.cells.map((c, j) => j === ci ? { ...c, name } : c) }))
  const renamePass = (fi: number, ci: number, pi: number, name: string) =>
    mutateFurnace(fi, f => ({
      ...f, cells: f.cells.map((c, j) => j !== ci ? c : {
        ...c, passes: c.passes.map((p, k) => k === pi ? { ...p, name } : p),
      }),
    }))
  const renameTube = (fi: number, ci: number, pi: number, ti: number, name: string) =>
    mutateFurnace(fi, f => ({
      ...f, cells: f.cells.map((c, j) => j !== ci ? c : {
        ...c, passes: c.passes.map((p, k) => k !== pi ? p : {
          ...p, tubes: p.tubes.map((t, l) => l === ti ? { ...t, name } : t),
        }),
      }),
    }))
  const renameTrain = (ti: number, name: string) => {
    const trains = eq.drumTrains.map((dt, i) => i !== ti ? dt : { ...dt, name })
    setEquipment({ ...eq, drumTrains: trains })
  }
  const renameDrum = (ti: number, di: number, name: string) => {
    const trains = eq.drumTrains.map((dt, i) => {
      if (i !== ti) return dt
      const drums = dt.drums.map((d, j) => j === di ? { ...d, name } : d)
      return { ...dt, drums }
    })
    setEquipment({ ...eq, drumTrains: trains })
  }
  const mutateFrac = (fi: number, fn: (f: Fractionator) => Fractionator) =>
    setEquipment({ ...eq, fractionators: eq.fractionators.map((f, i) => i === fi ? fn(f) : f) })
  const renameFrac = (fi: number, name: string) => mutateFrac(fi, f => ({ ...f, name }))
  const renameSubItem = <K extends 'columnOverheads' | 'columnReboilers'>(
    fi: number, field: K, idx: number, name: string
  ) => mutateFrac(fi, f => ({
    ...f,
    [field]: (f[field] as { id: string; name: string }[]).map((x, i) => i === idx ? { ...x, name } : x),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {phase === 'heaters' && eq.furnaces.map((f, fi) => {
        const totalPasses = f.cells.reduce((s, c) => s + c.passes.length, 0)
        const totalTubes = f.cells.reduce((s, c) => s + c.passes.reduce((ss, p) => ss + p.tubes.length, 0), 0)
        const isOpen = openHeaters.has(fi)
        return (
          <div key={f.id} className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ padding: 0 }}>
            <button type="button" onClick={() => toggleHeater(fi)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: isOpen ? 'rgba(30,58,95,0.05)' : '#f8fbfd', border: 'none',
              borderBottom: isOpen ? '1px solid #dce8f0' : 'none',
              borderRadius: isOpen ? '8px 8px 0 0' : 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <svg style={{ width: 13, height: 13, color: '#1e3a5f', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1c3045' }}>H{fi + 1} — {f.name}</span>
                <span style={{ fontSize: 11, color: '#8ba3b5' }}>{f.cells.length} cells · {totalPasses} passes · {totalTubes} tubes</span>
              </div>
              <span style={{ fontSize: 10, color: isOpen ? '#1e3a5f' : '#8ba3b5', fontWeight: 600, flexShrink: 0 }}>
                {isOpen ? '▲ Collapse' : '▼ Expand'}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #dce8f0' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#7a95a8' }}>Furnace Name</span>
                  <input
                    style={{ width: 120, background: '#f4f8fb', border: '1px solid #dce8f0', borderRadius: 5, padding: '6px 10px', fontSize: 13, fontWeight: 700, color: '#1c3045', outline: 'none', fontFamily: 'inherit' }}
                    value={f.name} onChange={e => renameFurnace(fi, e.target.value)} />
                </div>
                <div style={{ border: '1px solid #dce8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#f4f8fb', borderBottom: '2px solid #dce8f0' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', width: 140, fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dce8f0' }}>Cell</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', width: 96, fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dce8f0' }}>Pass</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#264f84', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Tubes <span style={{ fontWeight: 400, color: '#8ba3b5' }}>(◆ = TMT)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.cells.map((c, ci) =>
                          c.passes.map((p, pi) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #dce8f0', background: ci % 2 === 0 ? '#ffffff' : '#f4f8fb' }}>
                              {pi === 0 && (
                                <td style={{ padding: '8px 12px', verticalAlign: 'middle', borderRight: '1px solid #dce8f0' }} rowSpan={c.passes.length}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: '#1e3a5f', flexShrink: 0, minHeight: 20 }} />
                                    <NameInput value={c.name} onChange={v => renameCell(fi, ci, v)} />
                                  </div>
                                </td>
                              )}
                              <td style={{ padding: '8px 12px', verticalAlign: 'middle', borderRight: '1px solid #dce8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <div style={{ width: 3, height: 16, borderRadius: 2, background: '#c4b5fd', flexShrink: 0 }} />
                                  <NameInput value={p.name} onChange={v => renamePass(fi, ci, pi, v)} width={80} />
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {p.tubes.map((t, ti) => (
                                    <div key={t.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 2, borderRadius: 20,
                                      paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                                      border: `1px solid ${t.hasTMT ? '#1e3a5f' : '#dce8f0'}`,
                                      background: t.hasTMT ? 'rgba(30,58,95,0.06)' : '#f4f8fb',
                                    }}>
                                      {t.hasTMT && <span style={{ fontSize: 9, color: '#1e3a5f', fontWeight: 700, marginRight: 2 }}>◆</span>}
                                      <input style={{ width: 32, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, color: '#1c3045', fontFamily: 'inherit' }}
                                        value={t.name} onChange={e => renameTube(fi, ci, pi, ti, e.target.value)} />
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {phase === 'drums' && eq.drumTrains.map((dt, ti) => (
        <div key={dt.id ?? ti} className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #dce8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#7a95a8' }}>H{ti + 1} Train Name</span>
            <input
              style={{ width: 120, background: '#fff8f3', border: '1px solid rgba(249,115,22,0.45)', borderRadius: 5, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#c2570a', outline: 'none', fontFamily: 'monospace' }}
              value={dt.name}
              onChange={e => renameTrain(ti, e.target.value)}
            />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#7a95a8', display: 'block', marginBottom: 6 }}>Drum Names</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dt.drums.map((d, di) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 20, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#f97316', fontWeight: 700 }}>D</span>
                  <input style={{ width: 40, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', fontWeight: 700, color: '#1c3045', fontFamily: 'inherit' }}
                    value={d.name} onChange={e => renameDrum(ti, di, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {phase === 'fracs' && eq.fractionators.length > 0 && (
        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(0,180,216,0.05)', borderBottom: '1px solid rgba(0,180,216,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#006b80' }}>
              Fractionators
              <span style={{ fontSize: 11, fontWeight: 400, color: '#8ba3b5', marginLeft: 8 }}>{eq.fractionators.length} unit{eq.fractionators.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f4f8fb', borderBottom: '2px solid #dce8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 14px', width: 160, fontSize: 10, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                  {['Column Overheads', 'Column Reboilers'].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: (['#264f84', '#28a745'] as string[])[i], textTransform: 'uppercase', letterSpacing: '0.5px', borderLeft: '1px solid #dce8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eq.fractionators.map((fr, fi) => (
                  <tr key={fr.id} style={{ borderBottom: '1px solid #dce8f0', background: fi % 2 === 1 ? '#f4f8fb' : '#ffffff' }}>
                    <td style={{ padding: '8px 14px' }}><NameInput value={fr.name} onChange={v => renameFrac(fi, v)} width={140} /></td>
                    {(
                      [
                        { field: 'columnOverheads' as const, color: 'rgba(0,180,216,0.06)', border: 'rgba(0,180,216,0.35)', text: '#006b80' },
                        { field: 'columnReboilers' as const, color: 'rgba(40,167,69,0.06)', border: 'rgba(40,167,69,0.35)', text: '#157a3c' },
                      ] as const
                    ).map(({ field, color, border, text }) => (
                      <td key={field} style={{ padding: '8px 12px', borderLeft: '1px solid #dce8f0' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {fr[field].map((x, i) => (
                            <div key={x.id} style={{ background: color, border: `1px solid ${border}`, borderRadius: 20, padding: '2px 8px' }}>
                              <input style={{ width: 128, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, color: text, fontFamily: 'inherit' }}
                                value={x.name} onChange={e => renameSubItem(fi, field, i, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ProcessFlowMap({ matrix, setMatrix, numFracs, fracLinks, setFracLinks }: {
  matrix: MatrixRow[]; setMatrix: (m: MatrixRow[]) => void
  numFracs: number; fracLinks: Record<number, number[]>; setFracLinks: (l: Record<number, number[]>) => void
}) {
  const tempFracs = Array.from({ length: numFracs }, (_, i) => `Fractionator ${String.fromCharCode(65 + i)}`)

  const toggleFrac = (rowIdx: number, fi: number) => {
    const cur = fracLinks[rowIdx] ?? [0]
    const next = cur.includes(fi) ? cur.filter(x => x !== fi) : [...cur, fi]
    setFracLinks({ ...fracLinks, [rowIdx]: next.length > 0 ? next : [0] })
  }

  const swapFurnace = (trainIdx: number, clickedName: string) => {
    const otherIdx = matrix.findIndex(r => r.furnaceName === clickedName)
    if (otherIdx === -1 || otherIdx === trainIdx) return
    setMatrix(matrix.map((r, i) => {
      if (i === trainIdx) return { ...r, furnaceName: matrix[otherIdx].furnaceName }
      if (i === otherIdx) return { ...r, furnaceName: matrix[trainIdx].furnaceName }
      return r
    }))
  }

  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="bg-accent-blue" style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Global Process Flow Map</div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Click a furnace chip to re-assign it to this train. Click fractionator chips to link/unlink.</p>
        </div>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {matrix.map((row, ri) => {
          const linked = fracLinks[ri] ?? [0]
          return (
            <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #dce8f0', borderRadius: 8, padding: '10px 12px', background: '#f4f8fb' }}>
              <div style={{ width: 180, flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Upstream Furnace</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {matrix.map((mr, mri) => {
                    const isThis = row.furnaceName === mr.furnaceName
                    return (
                      <button key={mri} type="button" onClick={() => swapFurnace(ri, mr.furnaceName)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${isThis ? '#f97316' : '#dce8f0'}`,
                          background: isThis ? 'rgba(249,115,22,0.10)' : '#ffffff',
                          color: isThis ? '#c2570a' : '#7a95a8',
                          cursor: isThis ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                        }}>
                        {isThis && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />}
                        {mr.furnaceName}
                      </button>
                    )
                  })}
                </div>
              </div>
              <svg style={{ width: 18, height: 18, color: '#c0d4e0', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #1e3a5f', background: 'rgba(30,58,95,0.06)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 110 }}>
                <p style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{row.trainName}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>Drum Train</p>
              </div>
              <svg style={{ width: 18, height: 18, color: '#c0d4e0', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div style={{ width: 180, flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Downstream Fractionators</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tempFracs.map((name, fi) => (
                    <button key={fi} type="button" onClick={() => toggleFrac(ri, fi)}
                      style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        border: `1.5px solid ${linked.includes(fi) ? '#264f84' : '#dce8f0'}`,
                        background: linked.includes(fi) ? 'rgba(0,180,216,0.10)' : '#ffffff',
                        color: linked.includes(fi) ? '#006b80' : '#7a95a8',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildEquipmentFromSpall(spall: SpallState, fracLinks: Record<number, number[]>, existing?: Equipment): Equipment {
  const cells = getCells(spall.firingConfig)
  const rows: MatrixRow[] = Array.from({ length: spall.numHeaters }, (_, i) => {
    const h = i + 1
    const conf = spall.tubeConfigs[h]
    const radiantPerPass = conf?.radiantTubesPerPass || 17
    const convPerPass = conf?.convectionTubesPerPass || 0
    const numbering = conf?.tubeNumbering || 'top_to_bottom'
    const tmtDisplayNums = conf?.tmtTubes || []
    let tmtTubeIndices: number[] = []
    if (numbering === 'top_to_bottom') {
      tmtTubeIndices = tmtDisplayNums.map(d => d - convPerPass - 1).filter(idx => idx >= 0 && idx < radiantPerPass)
    } else {
      tmtTubeIndices = tmtDisplayNums.map(d => d - 1).filter(idx => idx >= 0 && idx < radiantPerPass)
    }
    const tubeDisplayStart = numbering === 'top_to_bottom' ? convPerPass + 1 : 1
    return {
      trainName: `Train${h}`,
      furnaceName: `H${h}`,
      cells,
      passesPerCell: spall.uniformPasses || cells === 1 ? spall.passesPerCell : (spall.passesPerCellMap[h] || spall.passesPerCell),
      tubesPerPass: radiantPerPass,
      tmtTubeIndices,
      drumsPerTrain: spall.uniformDrums || spall.numHeaters <= 1 ? spall.drumsPerTrain : (spall.drumsPerTrainMap[h] || spall.drumsPerTrain),
      tubeDisplayStart,
    }
  })
  return buildEquipmentFromMatrix(rows, fracLinks, spall.numFractionators, spall.overheads, spall.reboilers, existing)
}

type SectionId = 'furnace' | 'auxiliary' | 'passmap' | 'tubes' | 'names'
type SectionState = 'locked' | 'open' | 'done'

const SECTION_ORDER: SectionId[] = ['furnace', 'auxiliary', 'passmap', 'tubes', 'names']
const SECTION_LABELS: Record<SectionId, string> = {
  furnace: 'Furnace Geometry',
  auxiliary: 'Auxiliary Equipment',
  passmap: 'Pass Map',
  tubes: 'Tubes Map',
  names: 'Edit Names',
}

function sectionSummary(id: SectionId, spall: SpallState): string {
  switch (id) {
    case 'furnace': return `${spall.numHeaters} heater(s), ${spall.firingConfig}-fired, ${calcTotalPasses(spall)} passes/heater`
    case 'auxiliary': return `${spall.drumsPerTrain} drum(s)/train · ${spall.numFractionators} fractionator(s) · ${spall.overheads} overhead(s)`
    case 'passmap': return `Pass-to-cell mapping confirmed for ${spall.numHeaters} heater(s)`
    case 'tubes': {
      const first = Object.values(spall.tubeConfigs)[0]
      const rad = first?.radiantTubesPerPass ?? 17
      return `${rad} radiant tubes/pass · TMT tags selected`
    }
    case 'names': return 'Equipment names customised'
    default: return ''
  }
}

// ── PFD layout constants ──────────────────────────────────────────────────────
const PFD_SVG_W    = 860
const PFD_H        = 480
const PFD_X_FEED   = 18
const PFD_X_FH     = 128
const PFD_X_DM     = 400
const PFD_X_FR     = 690
const PFD_FH_W     = 90
const PFD_NZ       = 12
const PFD_FR_W     = 72
const PFD_FR_RY    = 10
const PFD_FIRST_CY = 150
const PFD_C_HOT    = '#b45309'
const PFD_C_VAP    = '#1d4ed8'
const PFD_C_PRD    = '#15803d'

interface PFDProps {
  spall: SpallState
  equipment?: Equipment
  sections: Record<SectionId, SectionState>
}

function EquipmentPFD({ spall, equipment, sections }: PFDProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const wrapRef   = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const vbRef     = useRef({ vbW: PFD_SVG_W, vbH: PFD_H, svgH: PFD_H })

  const showAux    = sections.auxiliary !== 'locked'
  const showPasses = sections.passmap   !== 'locked'
  const showTubes  = sections.tubes     !== 'locked'

  const numH  = Math.max(1, spall.numHeaters)
  const cells = getCells(spall.firingConfig)
  const numF  = showAux ? Math.max(1, spall.numFractionators) : 0

  const drumsForTrain    = (ti: number) => spall.uniformDrums || numH <= 1 ? spall.drumsPerTrain : (spall.drumsPerTrainMap[ti + 1] || spall.drumsPerTrain)
  const passesPerCellForH = (hi: number) => spall.uniformPasses ? spall.passesPerCell : (spall.passesPerCellMap[hi + 1] || spall.passesPerCell)
  const tubesPerPassForH  = (hi: number) => spall.tubeConfigs[hi + 1]?.radiantTubesPerPass ?? 17

  const DM_IW = 44, DM_IH = 70, DM_IRY = 5, DM_IGAP = 8, TPAD = 10
  const TBOX_W = 72

  const trainBoxH = (ti: number) => {
    const nd = drumsForTrain(ti)
    return 2 * TPAD + nd * (DM_IH + DM_IGAP) - DM_IGAP
  }

  const fhH = (hi: number) => showPasses ? Math.max(110, 46 + passesPerCellForH(hi) * 22) : 110

  const maxRowH       = Math.max(...Array.from({ length: numH }, (_, ti) => Math.max(fhH(ti), trainBoxH(ti))))
  const PFD_ROW_PITCH = maxRowH + 56

  const totalSpan      = (numH - 1) * PFD_ROW_PITCH
  const FRAC_MIN_PITCH = 130
  const fracSpacing    = numF <= 1 ? 0 : Math.max(FRAC_MIN_PITCH, numH > 1 ? totalSpan / (numF - 1) : FRAC_MIN_PITCH)
  const fracHalfSpan   = numF > 1 ? (numF - 1) * fracSpacing / 2 : 0
  const fracColH = (_fi: number): number => {
    const base = Math.max(DM_IH * 2, totalSpan / Math.max(numF, 1) + 60)
    if (numF <= 1) return base
    const maxH = fracSpacing - 2 * PFD_FR_RY - 36
    return Math.max(80, Math.min(base, maxH))
  }

  const topClearance = Math.max(
    Math.ceil(maxRowH / 2) + 28,
    fracHalfSpan - totalSpan / 2 + fracColH(0) / 2 + PFD_FR_RY + 34
  )
  const firstRowCY = Math.max(PFD_FIRST_CY, topClearance)
  const rowCY = (ti: number) => firstRowCY + ti * PFD_ROW_PITCH

  const fracCY = (fi: number): number => {
    if (numF <= 1) return firstRowCY + totalSpan / 2
    const mid = firstRowCY + totalSpan / 2
    return mid - fracHalfSpan + fi * fracSpacing
  }

  const lastRowBottom = firstRowCY + (numH - 1) * PFD_ROW_PITCH + maxRowH / 2
  const lastFracBottom = numF > 0 ? fracCY(numF - 1) + fracColH(numF - 1) / 2 + PFD_FR_RY + PFD_NZ + 50 : 0
  const svgH = Math.max(PFD_H, lastRowBottom + 60, lastFracBottom)

  const vbW = PFD_SVG_W / zoom
  const vbH = svgH / zoom
  const vbX = Math.max(0, Math.min(Math.max(0, PFD_SVG_W - vbW), pan.x))
  const vbY = Math.max(0, Math.min(Math.max(0, svgH - vbH), pan.y))
  vbRef.current = { vbW, vbH, svgH }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { vbW: w, vbH: h, svgH: sh } = vbRef.current
      const hScrollable = Math.max(0, PFD_SVG_W - w)
      const vScrollable = Math.max(0, sh - h)
      const hScale = w / (el.clientWidth  || 1)
      const vScale = h / (el.clientHeight || 1)
      setPan(p => ({
        x: hScrollable > 0 ? Math.max(0, Math.min(hScrollable, p.x + e.deltaX * hScale)) : p.x,
        y: vScrollable > 0 ? Math.max(0, Math.min(vScrollable, p.y + e.deltaY * vScale)) : p.y,
      }))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragging.current  = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    const wrap = wrapRef.current
    if (!wrap) return
    const { vbW: w, vbH: h, svgH: sh } = vbRef.current
    const scale = w / wrap.clientWidth
    setPan(p => ({
      x: Math.max(0, Math.min(Math.max(0, PFD_SVG_W - w), p.x - dx * scale)),
      y: Math.max(0, Math.min(Math.max(0, sh - h), p.y - dy * scale)),
    }))
  }
  const stopDrag = () => { dragging.current = false }

  const zoomIn  = () => setZoom(z => Math.min(4, z * 1.2))
  const zoomOut = () => setZoom(z => Math.max(0.35, z / 1.2))
  const reset   = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const vScrollable    = Math.max(0, svgH - vbH)
  const vThumbPct      = vScrollable > 0 ? Math.min(100, (vbH / svgH) * 100) : 100
  const vThumbTopPct   = vScrollable > 0 ? (vbY / vScrollable) * (100 - vThumbPct) : 0
  const hScrollable    = Math.max(0, PFD_SVG_W - vbW)
  const hThumbPct      = hScrollable > 0 ? Math.min(100, (vbW / PFD_SVG_W) * 100) : 100
  const hThumbLeftPct  = hScrollable > 0 ? (vbX / hScrollable) * (100 - hThumbPct) : 0

  const junctionX = (PFD_X_FH + PFD_FH_W / 2 + PFD_NZ + PFD_X_DM - TBOX_W / 2) / 2
  const manifoldX = PFD_X_DM + Math.round(((PFD_X_FR - PFD_FR_W / 2) - (PFD_X_DM + TBOX_W / 2)) * 0.38)

  const btnSty: React.CSSProperties = {
    width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4,
    background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', userSelect: 'none', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px', flexShrink: 0 }}>
        Process Flow Preview
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          ref={wrapRef}
          style={{ width: '100%', height: '100%', cursor: 'grab', userSelect: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          <svg width="100%" height="100%" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
              <marker id="pfd-hot" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                <polygon points="0 0,7 2.5,0 5" fill={PFD_C_HOT} />
              </marker>
              <marker id="pfd-vap" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                <polygon points="0 0,7 2.5,0 5" fill={PFD_C_VAP} />
              </marker>
              <marker id="pfd-prd" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                <polygon points="0 0,7 2.5,0 5" fill={PFD_C_PRD} />
              </marker>
            </defs>

            {/* Grid */}
            <rect width={PFD_SVG_W} height={svgH} fill="#fafafa" />
            {Array.from({ length: Math.ceil(PFD_SVG_W / 20) }, (_, i) => (
              <line key={`vg${i}`} x1={i * 20} y1={0} x2={i * 20} y2={svgH} stroke="#f0f0f0" strokeWidth="0.5" />
            ))}
            {Array.from({ length: Math.ceil(svgH / 20) }, (_, i) => (
              <line key={`hg${i}`} x1={0} y1={i * 20} x2={PFD_SVG_W} y2={i * 20} stroke="#f0f0f0" strokeWidth="0.5" />
            ))}

            {/* Feed arrows */}
            {Array.from({ length: numH }, (_, ti) => {
              const cy = rowCY(ti)
              return (
                <g key={`feed-${ti}`}>
                  <line x1={PFD_X_FEED} y1={cy} x2={PFD_X_FH - PFD_FH_W / 2 - PFD_NZ} y2={cy} stroke={PFD_C_HOT} strokeWidth="2" markerEnd="url(#pfd-hot)" />
                  <text x={PFD_X_FEED} y={cy - 6} fontSize="7.5" fill={PFD_C_HOT}>Preheated</text>
                  <text x={PFD_X_FEED} y={cy + 9} fontSize="7.5" fill={PFD_C_HOT}>Feed</text>
                </g>
              )
            })}

            {/* Hot-oil streams */}
            {showAux && Array.from({ length: numH }, (_, ti) => {
              const cy   = rowCY(ti)
              const fOutX = PFD_X_FH + PFD_FH_W / 2 + PFD_NZ
              const tInX  = PFD_X_DM - TBOX_W / 2
              return (
                <path key={`hot-${ti}`} d={`M ${fOutX} ${cy} H ${junctionX} V ${cy} H ${tInX}`}
                  fill="none" stroke={PFD_C_HOT} strokeWidth="2" markerEnd="url(#pfd-hot)" />
              )
            })}

            {/* Overhead vapour to fracs */}
            {showAux && numF > 0 && Array.from({ length: numF }, (_, fi) => {
              const trainIdxs = Array.from({ length: numH }, (_, ti) => ti)
                .filter(ti => Math.min(Math.floor(ti * numF / Math.max(numH, 1)), numF - 1) === fi)
              if (!trainIdxs.length) return null
              const tipYs  = trainIdxs.map(ti => rowCY(ti) - trainBoxH(ti) / 2 - PFD_NZ)
              const topY   = Math.min(...tipYs)
              const botY   = Math.max(...tipYs)
              const fcy    = fracCY(fi)
              const fColH  = fracColH(fi)
              const inletY = (fcy - fColH / 2 + PFD_FR_RY + 8) + (fColH - 2 * PFD_FR_RY - 16) * 0.18
              const xTurn  = PFD_X_FR - PFD_FR_W / 2 - 28
              return (
                <g key={`vap-group-${fi}`}>
                  {trainIdxs.map((ti, k) => (
                    <line key={`vap-leg-${ti}`} x1={PFD_X_DM} y1={tipYs[k]} x2={manifoldX} y2={tipYs[k]} stroke={PFD_C_VAP} strokeWidth="2" strokeDasharray="6 3" />
                  ))}
                  {trainIdxs.length > 1 && (
                    <line x1={manifoldX} y1={topY} x2={manifoldX} y2={botY} stroke={PFD_C_VAP} strokeWidth="2" strokeDasharray="6 3" />
                  )}
                  {tipYs.map((ty, k) => (
                    <circle key={`vap-dot-${trainIdxs[k]}`} cx={manifoldX} cy={ty} r={3} fill={PFD_C_VAP} />
                  ))}
                  <path d={`M ${manifoldX} ${topY} H ${xTurn} V ${inletY} H ${PFD_X_FR - PFD_FR_W / 2}`}
                    fill="none" stroke={PFD_C_VAP} strokeWidth="2" strokeDasharray="6 3" markerEnd="url(#pfd-vap)" />
                </g>
              )
            })}

            {/* Fired Heaters */}
            {Array.from({ length: numH }, (_, ti) => {
              const cy  = rowCY(ti)
              const h   = fhH(ti)
              const x   = PFD_X_FH - PFD_FH_W / 2
              const y   = cy - h / 2
              const ppc = passesPerCellForH(ti)
              const tpp = tubesPerPassForH(ti)
              const cw  = PFD_FH_W / cells
              const plH = showPasses ? Math.max(0, (h - 46) / ppc) : 0
              const name = equipment?.furnaces[ti]?.name ?? `H${ti + 1}`
              return (
                <g key={`fh-${ti}`}>
                  <rect x={x} y={y} width={PFD_FH_W} height={h} rx={2} fill="#fffbeb" stroke={PFD_C_HOT} strokeWidth="2.5" />
                  {!showPasses && (
                    <>
                      {[0.45, 0.55, 0.65, 0.75, 0.87].map((f, i) => (
                        <line key={i} x1={x + 10} y1={y + h * f} x2={x + PFD_FH_W - 10} y2={y + h * f} stroke="#d97706" strokeWidth="1.5" />
                      ))}
                      {[0, 1, 2].map(i => {
                        const ya = y + h * (0.45 + i * 0.20)
                        const yb = y + h * (0.55 + i * 0.20)
                        return <path key={i} d={`M ${x + 10} ${ya} Q ${x + 2} ${(ya + yb) / 2} ${x + 10} ${yb}`} fill="none" stroke="#d97706" strokeWidth="1.5" />
                      })}
                      <ellipse cx={PFD_X_FH}     cy={y + h * 0.23} rx={10}  ry={14}  fill="#fde68a" />
                      <ellipse cx={PFD_X_FH - 9} cy={y + h * 0.27} rx={6}   ry={10}  fill="#f97316" />
                      <ellipse cx={PFD_X_FH + 9} cy={y + h * 0.27} rx={6}   ry={10}  fill="#f97316" />
                      <ellipse cx={PFD_X_FH}     cy={y + h * 0.30} rx={4.5} ry={7.5} fill="#ef4444" />
                    </>
                  )}
                  {showPasses && (
                    <>
                      <ellipse cx={PFD_X_FH}     cy={y + 14} rx={8}   ry={11}  fill="#fde68a" />
                      <ellipse cx={PFD_X_FH - 7} cy={y + 17} rx={5}   ry={8}   fill="#f97316" />
                      <ellipse cx={PFD_X_FH + 7} cy={y + 17} rx={5}   ry={8}   fill="#f97316" />
                      <ellipse cx={PFD_X_FH}     cy={y + 19} rx={3.5} ry={5.5} fill="#ef4444" />
                      <line x1={x} y1={y + 32} x2={x + PFD_FH_W} y2={y + 32} stroke="#f0c060" strokeWidth="1" strokeDasharray="3,2" />
                      {cells === 2 && (
                        <>
                          <line x1={PFD_X_FH} y1={y + 32} x2={PFD_X_FH} y2={y + h} stroke="#d97706" strokeWidth="1" strokeDasharray="3,2" />
                          <text x={x + cw * 0.5} y={y + 43} textAnchor="middle" fontSize={7} fill="#92400e" fontWeight="700">A</text>
                          <text x={x + cw * 1.5} y={y + 43} textAnchor="middle" fontSize={7} fill="#92400e" fontWeight="700">B</text>
                        </>
                      )}
                      {cells === 1 && <text x={PFD_X_FH} y={y + 43} textAnchor="middle" fontSize={7} fill="#92400e" fontWeight="700">Cell</text>}
                      {Array.from({ length: cells }, (_, ci) =>
                        Array.from({ length: ppc }, (_, pi) => {
                          const pw = cw - 4
                          const px = x + ci * cw + 2
                          const py = y + 46 + pi * plH
                          const ph = Math.max(0, plH - 2)
                          return (
                            <g key={`p-${ci}-${pi}`}>
                              <rect x={px} y={py} width={pw} height={ph} rx={1} fill={pi % 2 === 0 ? '#fffde7' : '#fef9c3'} stroke="#f0c060" strokeWidth="0.5" />
                              <text x={px + 4} y={py + ph / 2 + 3} fontSize={7} fill="#78350f" fontWeight="600">{equipment?.furnaces[ti]?.cells[ci]?.passes[pi]?.name ?? `P${pi + 1}`}</text>
                              {showTubes && <>
                                <text x={px + pw - 3} y={py + ph / 2 + 3} textAnchor="end" fontSize={6.5} fill="#a16207">{(equipment?.furnaces[ti]?.cells[ci]?.passes[pi]?.tubes.length ?? tpp)}T</text>
                                {ph > 12 && <line x1={px + 16} y1={py + ph * 0.45} x2={px + pw - 20} y2={py + ph * 0.45} stroke="#d97706" strokeWidth="0.8" opacity={0.5} />}
                              </>}
                            </g>
                          )
                        })
                      )}
                    </>
                  )}
                  <text x={PFD_X_FH} y={y - 8} textAnchor="middle" fontSize="9" fontStyle="italic" fill="#92400e">F-0{ti + 1}</text>
                  <line x1={x - PFD_NZ} y1={cy} x2={x} y2={cy} stroke={PFD_C_HOT} strokeWidth="2.5" />
                  <line x1={x + PFD_FH_W} y1={cy} x2={x + PFD_FH_W + PFD_NZ} y2={cy} stroke={PFD_C_HOT} strokeWidth="2.5" />
                  <text x={PFD_X_FH} y={y + h + 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#78350f">{name}</text>
                </g>
              )
            })}

            {/* Drum Trains */}
            {showAux && Array.from({ length: numH }, (_, ti) => {
              const cy    = rowCY(ti)
              const nd    = drumsForTrain(ti)
              const boxH  = trainBoxH(ti)
              const boxX  = PFD_X_DM - TBOX_W / 2
              const boxY  = cy - boxH / 2
              const trainName = equipment?.drumTrains[ti]?.name ?? `Train ${ti + 1}`
              return (
                <g key={`train-${ti}`}>
                  <rect x={boxX} y={boxY} width={TBOX_W} height={boxH} rx={5} fill="#f0f7ff" stroke="#1e3a5f" strokeWidth="2" />
                  <line x1={PFD_X_DM} y1={boxY} x2={PFD_X_DM} y2={boxY - PFD_NZ} stroke={PFD_C_VAP} strokeWidth="2" />
                  {Array.from({ length: nd }, (_, di) => {
                    const drumTop = boxY + TPAD + di * (DM_IH + DM_IGAP)
                    const drumBtm = drumTop + DM_IH
                    const drumCx  = PFD_X_DM
                    const dname   = equipment?.drumTrains[ti]?.drums[di]?.name ?? `D${di + 1}`
                    return (
                      <g key={`d-${ti}-${di}`}>
                        <rect x={drumCx - DM_IW / 2} y={drumTop} width={DM_IW} height={DM_IH} fill="#fff7ed" stroke="#c2410c" strokeWidth="1.5" />
                        <ellipse cx={drumCx} cy={drumTop} rx={DM_IW / 2} ry={DM_IRY} fill="#fde8d0" stroke="#c2410c" strokeWidth="1.5" />
                        <ellipse cx={drumCx} cy={drumBtm} rx={DM_IW / 2} ry={DM_IRY} fill="#fde8d0" stroke="#c2410c" strokeWidth="1.5" />
                        <text x={drumCx + DM_IW / 2 + 4} y={drumTop + DM_IH / 2 + 4} fontSize="9" fontWeight="700" fill="#7c2d12">{dname}</text>
                      </g>
                    )
                  })}
                  <text x={PFD_X_DM} y={boxY + boxH + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e3a5f">{trainName}</text>
                </g>
              )
            })}

            {/* Fractionators */}
            {showAux && Array.from({ length: numF }, (_, fi) => {
              const cy    = fracCY(fi)
              const colH  = fracColH(fi)
              const x     = PFD_X_FR - PFD_FR_W / 2
              const y     = cy - colH / 2
              const bY    = cy + colH / 2
              const nTrays  = Math.max(6, Math.floor(colH / 26))
              const nSides  = Math.min(3, Math.max(1, numH))
              const sideLabels = ['Heavy GO', 'Light GO', 'Naphtha']
              const frName = equipment?.fractionators[fi]?.name ?? `Frac ${String.fromCharCode(65 + fi)}`
              return (
                <g key={`fr-${fi}`}>
                  <rect x={x} y={y} width={PFD_FR_W} height={colH} fill="#f0fdf4" stroke="#15803d" strokeWidth="2.5" />
                  <ellipse cx={PFD_X_FR} cy={y}  rx={PFD_FR_W / 2} ry={PFD_FR_RY} fill="#dcfce7" stroke="#15803d" strokeWidth="2.5" />
                  <ellipse cx={PFD_X_FR} cy={bY} rx={PFD_FR_W / 2} ry={PFD_FR_RY} fill="#dcfce7" stroke="#15803d" strokeWidth="2.5" />
                  {Array.from({ length: nTrays }, (_, k) => {
                    const ty   = y + colH * (0.09 + (k / nTrays) * 0.82)
                    const even = k % 2 === 0
                    return (
                      <line key={k}
                        x1={even ? x + 4 : x + PFD_FR_W * 0.44} y1={ty}
                        x2={even ? x + PFD_FR_W * 0.56 : x + PFD_FR_W - 4} y2={ty}
                        stroke="#16a34a" strokeWidth="1.5" />
                    )
                  })}
                  <line x1={PFD_X_FR} y1={y  - PFD_FR_RY} x2={PFD_X_FR} y2={y  - PFD_FR_RY - PFD_NZ} stroke={PFD_C_PRD} strokeWidth="2.5" markerEnd="url(#pfd-prd)" />
                  <line x1={PFD_X_FR} y1={bY + PFD_FR_RY} x2={PFD_X_FR} y2={bY + PFD_FR_RY + PFD_NZ} stroke={PFD_C_PRD} strokeWidth="2.5" markerEnd="url(#pfd-prd)" />
                  <text x={PFD_X_FR + 5} y={y  - PFD_FR_RY - 14} fontSize="7.5" fill={PFD_C_PRD}>Gas / Naphtha</text>
                  <text x={PFD_X_FR + 5} y={bY + PFD_FR_RY + 20} fontSize="7.5" fill={PFD_C_PRD}>Slop / Bottoms</text>
                  {Array.from({ length: nSides }, (_, k) => {
                    const sy = y + colH * (0.14 + k * (0.70 / Math.max(nSides - 1, 1)))
                    return (
                      <g key={k}>
                        <line x1={x + PFD_FR_W} y1={sy} x2={x + PFD_FR_W + PFD_NZ + 28} y2={sy} stroke={PFD_C_PRD} strokeWidth="1.5" markerEnd="url(#pfd-prd)" />
                        <text x={x + PFD_FR_W + PFD_NZ + 32} y={sy + 4} fontSize="7.5" fill="#14532d">{sideLabels[k]}</text>
                      </g>
                    )
                  })}
                  <text x={PFD_X_FR} y={y - PFD_FR_RY - 26} textAnchor="middle" fontSize="9" fontStyle="italic" fill="#14532d">C-0{fi + 1}</text>
                  <text x={PFD_X_FR} y={bY + PFD_FR_RY + 36} textAnchor="middle" fontSize="11" fontWeight="700" fill="#14532d">{frName}</text>
                </g>
              )
            })}

            {/* Legend */}
            <g transform={`translate(${vbX + 8},${vbY + vbH - 52})`}>
              <rect width={178} height={48} rx={4} fill="white" stroke="#e2e8f0" strokeWidth="1" opacity={0.93} />
              {[
                { color: PFD_C_HOT, dash: undefined,  label: 'Hot Oil Feed',    id: 'pfd-hot' },
                { color: PFD_C_VAP, dash: '6 3',      label: 'Overhead Vapour', id: 'pfd-vap' },
                { color: PFD_C_PRD, dash: undefined,  label: 'Products',        id: 'pfd-prd' },
              ].map(({ color, dash, label, id }, i) => (
                <g key={i} transform={`translate(8,${8 + i * 13})`}>
                  <line x1={0} y1={4} x2={22} y2={4} stroke={color} strokeWidth="2" strokeDasharray={dash} markerEnd={`url(#${id})`} />
                  <text x={28} y={8} fontSize="8.5" fill="#374151">{label}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {vScrollable > 0 && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: 8, bottom: hScrollable > 0 ? 8 : 0, background: '#f1f5f9', borderLeft: '1px solid #e2e8f0', zIndex: 6, cursor: 'pointer', userSelect: 'none' }}
            onClick={e => {
              const { top, height } = e.currentTarget.getBoundingClientRect()
              const frac = (e.clientY - top) / height
              setPan(p => ({ ...p, y: Math.max(0, Math.min(vScrollable, frac * svgH)) }))
            }}>
            <div style={{ position: 'absolute', left: 1, right: 1, height: `${vThumbPct}%`, top: `${vThumbTopPct}%`, background: '#94a3b8', borderRadius: 4 }} />
          </div>
        )}

        {hScrollable > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: vScrollable > 0 ? 8 : 0, height: 8, background: '#f1f5f9', borderTop: '1px solid #e2e8f0', zIndex: 6, cursor: 'pointer', userSelect: 'none' }}
            onClick={e => {
              const { left, width } = e.currentTarget.getBoundingClientRect()
              const frac = (e.clientX - left) / width
              setPan(p => ({ ...p, x: Math.max(0, Math.min(hScrollable, frac * PFD_SVG_W)) }))
            }}>
            <div style={{ position: 'absolute', top: 1, bottom: 1, width: `${hThumbPct}%`, left: `${hThumbLeftPct}%`, background: '#94a3b8', borderRadius: 4 }} />
          </div>
        )}

        <div style={{ position: 'absolute', bottom: hScrollable > 0 ? 18 : 10, right: vScrollable > 0 ? 18 : 10, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          <button style={btnSty} onClick={zoomIn}  title="Zoom in">+</button>
          <button style={btnSty} onClick={zoomOut} title="Zoom out">−</button>
          <button style={{ ...btnSty, fontSize: 9 }} onClick={reset} title="Reset">{Math.round(zoom * 100)}%</button>
        </div>
      </div>
    </div>
  )
}

function SectionDone({ stepNum, title, summary, onEdit }: {
  stepNum: number; title: string; summary: string; onEdit: () => void
}) {
  return (
    <div style={{ border: '1.5px solid #86efac', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{stepNum}. {title}</span>
          {summary && <span style={{ fontSize: 11, color: '#6b7280' }}>{summary}</span>}
        </div>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#059669', fontWeight: 600, fontFamily: 'inherit', padding: '2px 4px' }}>
          Edit
        </button>
      </div>
    </div>
  )
}

export default function Step2Equipment({ onNext, onBack }: Props) {
  const [equipment, setEquipment] = useAtom(equipmentAtom)
  const [furnaceGeometry, setFurnaceGeometry] = useAtom(furnaceGeometryAtom)
  const [auxiliaryEquipmentConfig, setAuxiliaryEquipmentConfig] = useAtom(auxiliaryEquipmentConfigAtom)
  const [passTubeMapping, setPassTubeMapping] = useAtom(passTubeMappingAtom)
  const [spallConfig, setSpallConfig] = useAtom(spallConfigAtom)

  const [spall, setSpallRaw] = useState<SpallState>(() => {
    if (furnaceGeometry || auxiliaryEquipmentConfig || equipment?.furnaces.length > 0) {
      return {
        numHeaters: furnaceGeometry?.numHeaters || equipment?.furnaces.length || 2,
        firingConfig: furnaceGeometry?.firingConfig || 'double',
        passesPerCell: furnaceGeometry?.passesPerCell || 2,
        uniformPasses: furnaceGeometry?.uniformPasses ?? true,
        passesPerCellMap: furnaceGeometry?.passesPerCellMap
          ? Object.fromEntries(Object.entries(furnaceGeometry.passesPerCellMap).map(([k, v]) => [Number(k), v])) : {},
        hasOpTags: spallConfig?.hasOpTags ?? false,
        drumsPerTrain: auxiliaryEquipmentConfig?.drumsPerTrain || equipment?.drumTrains[0]?.drums.length || 2,
        uniformDrums: auxiliaryEquipmentConfig?.uniformDrums ?? true,
        drumsPerTrainMap: auxiliaryEquipmentConfig?.drumsPerTrainMap
          ? Object.fromEntries(Object.entries(auxiliaryEquipmentConfig.drumsPerTrainMap).map(([k, v]) => [Number(k), v])) : {},
        numFractionators: auxiliaryEquipmentConfig?.numFractionators || equipment?.fractionators?.length || 1,
        overheads: auxiliaryEquipmentConfig?.overheads || equipment?.fractionators?.[0]?.columnOverheads.length || 1,
        reboilers: auxiliaryEquipmentConfig?.reboilers || equipment?.fractionators?.[0]?.columnReboilers.length || 1,
        passToCell: passTubeMapping?.passToCell
          ? Object.fromEntries(Object.entries(passTubeMapping.passToCell).map(([h, ptc]) => [Number(h), Object.fromEntries(Object.entries(ptc || {}).map(([p, c]) => [Number(p), c]))]))
          : {},
        tubeConfigs: passTubeMapping?.tubeConfigs
          ? Object.fromEntries(Object.entries(passTubeMapping.tubeConfigs).map(([h, conf]) => [Number(h), conf]))
          : {},
        heaterGroups: spallConfig?.heaterGroups
          ? Object.fromEntries(Object.entries(spallConfig.heaterGroups).map(([h, g]) => [Number(h), { numGroups: g.numGroups, assignment: Object.fromEntries(Object.entries(g.assignment || {}).map(([p, c]) => [Number(p), c])) }]))
          : {},
        spallOps: spallConfig?.spallOps
          ? Object.fromEntries(Object.entries(spallConfig.spallOps).map(([h, o]) => [Number(h), { numOps: o.numOps, assignment: Object.fromEntries(Object.entries(o.assignment || {}).map(([p, c]) => [Number(p), c])) }]))
          : {},
      }
    }
    return initSpall()
  })

  const [sections, setSections] = useState<Record<SectionId, SectionState>>(() => ({
    furnace: 'open', auxiliary: 'locked', passmap: 'locked', tubes: 'locked', names: 'locked',
  }))
  const [namesPhase, setNamesPhase] = useState<'heaters' | 'drums' | 'fracs' | 'flowmap'>('heaters')
  const sectionsColRef = useRef<HTMLDivElement>(null)
  const [fracLinks, setFracLinks] = useState<Record<number, number[]>>({})
  const [mirrorMap, setMirrorMap] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {}
    for (let h = 2; h <= spall.numHeaters; h++) map[h] = 1
    return map
  })

  const setSpall = (s: SpallState) => setSpallRaw(s)

  const buildAndSaveEquipment = (s: SpallState): Equipment => {
    const filled = { ...s }
    for (let h = 1; h <= s.numHeaters; h++) {
      if (!filled.passToCell[h]) filled.passToCell = { ...filled.passToCell, [h]: defaultPassToCellMap(filled) }
      if (!filled.tubeConfigs[h]) filled.tubeConfigs = { ...filled.tubeConfigs, [h]: makeTubeConfig(filled) }
      if (!filled.heaterGroups[h]) filled.heaterGroups = { ...filled.heaterGroups, [h]: makeHeaterGroups(filled, h) }
      if (!filled.spallOps[h]) filled.spallOps = { ...filled.spallOps, [h]: makeHeaterOps(filled, h) }
    }
    const eq = buildEquipmentFromSpall(filled, fracLinks, equipment)
    setEquipment(eq)

    const toStrKeys = (obj: Record<number, number>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [String(k), v]))

    setFurnaceGeometry({ numHeaters: filled.numHeaters, firingConfig: filled.firingConfig, passesPerCell: filled.passesPerCell, uniformPasses: filled.uniformPasses, passesPerCellMap: toStrKeys(filled.passesPerCellMap) })
    setAuxiliaryEquipmentConfig({ drumsPerTrain: filled.drumsPerTrain, uniformDrums: filled.uniformDrums, drumsPerTrainMap: toStrKeys(filled.drumsPerTrainMap), numFractionators: filled.numFractionators, overheads: filled.overheads, reboilers: filled.reboilers })
    setPassTubeMapping({ passToCell: Object.fromEntries(Object.entries(filled.passToCell).map(([h, ptc]) => [String(h), toStrKeys(ptc)])), tubeConfigs: Object.fromEntries(Object.entries(filled.tubeConfigs).map(([h, conf]) => [String(h), conf])) })
    setSpallConfig({ hasOpTags: filled.hasOpTags, heaterGroups: Object.fromEntries(Object.entries(filled.heaterGroups).map(([h, g]) => [String(h), { ...g, assignment: toStrKeys(g.assignment) }])), spallOps: Object.fromEntries(Object.entries(filled.spallOps).map(([h, o]) => [String(h), { ...o, assignment: toStrKeys(o.assignment) }])) })

    return eq
  }

  const confirmSection = (id: SectionId) => {
    const idx = SECTION_ORDER.indexOf(id)
    const nextId = idx + 1 < SECTION_ORDER.length ? SECTION_ORDER[idx + 1] : null
    if (id === 'tubes') buildAndSaveEquipment(spall)
    setSections(prev => ({ ...prev, [id]: 'done', ...(nextId ? { [nextId]: 'open' } : {}) }))
    setTimeout(() => { sectionsColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 0)
  }

  const editSection = (id: SectionId) => {
    const idx = SECTION_ORDER.indexOf(id)
    const updates: Partial<Record<SectionId, SectionState>> = { [id]: 'open' }
    for (let i = idx + 1; i < SECTION_ORDER.length; i++) updates[SECTION_ORDER[i]] = 'locked'
    setSections(prev => ({ ...prev, ...updates }))
    if (id === 'names') setNamesPhase('heaters')
  }

  const handleMirrorChange = (targetH: number, sourceH: number) => setMirrorMap(prev => ({ ...prev, [targetH]: sourceH }))
  const handleCopyFromPassMap = (targetH: number, sourceH: number) => {
    setSpallRaw(prev => {
      const src = prev.passToCell[sourceH] || defaultPassToCellMap(prev)
      return { ...prev, passToCell: { ...prev.passToCell, [targetH]: { ...src } } }
    })
  }
  const handleCopyFromTubes = (targetH: number, sourceH: number) => {
    setSpallRaw(prev => {
      const src = prev.tubeConfigs[sourceH] || makeTubeConfig(prev)
      return { ...prev, tubeConfigs: { ...prev.tubeConfigs, [targetH]: { ...src } } }
    })
  }

  const makeMatrixForFlowMap = (): MatrixRow[] => {
    const cells = getCells(spall.firingConfig)
    return Array.from({ length: spall.numHeaters }, (_, i) => {
      const h = i + 1
      return {
        trainName: equipment.drumTrains[i]?.name ?? `Train${h}`,
        furnaceName: equipment.furnaces[i]?.name ?? `H${h}`,
        cells,
        passesPerCell: spall.uniformPasses || cells === 1 ? spall.passesPerCell : (spall.passesPerCellMap[h] || spall.passesPerCell),
        tubesPerPass: spall.tubeConfigs[h]?.radiantTubesPerPass || 17,
        tmtTubeIndices: [],
        drumsPerTrain: spall.uniformDrums || spall.numHeaters <= 1 ? spall.drumsPerTrain : (spall.drumsPerTrainMap[h] || spall.drumsPerTrain),
      }
    })
  }

  const allDone = SECTION_ORDER.every(id => sections[id] === 'done')

  const passMapAllValid = (() => {
    const totalPasses = calcTotalPasses(spall)
    return Array.from({ length: spall.numHeaters }, (_, i) => i + 1).every(h => {
      const ptc = { ...defaultPassToCellMap(spall), ...(spall.passToCell[h] || {}) }
      for (let p = 1; p <= totalPasses; p++) { if (!ptc[p]) return false }
      return true
    })
  })()

  const tubesAllValid = Array.from({ length: spall.numHeaters }, (_, i) => {
    const h = i + 1
    const src = mirrorMap[h] || h
    const c = spall.tubeConfigs[src] || makeTubeConfig(spall)
    return c.radiantTubesPerPass > 0
  }).every(Boolean)

  if (sections.names === 'open' && equipment.furnaces.length > 0) {
    return (
      <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Edit Equipment Names</h2>
          <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Customize names for heaters, drums, fractionators, and the process flow map.</p>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 20, overflow: 'hidden' }}>
          <div style={{ flex: '0 0 56%', minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: '#92610a', background: '#fff8e1', border: '1px solid #f5c200', padding: '6px 12px', borderRadius: 6, fontWeight: 500 }}>
                Name edits are preserved. Going back to an earlier section will regenerate equipment and reset names.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {(['heaters', 'drums', 'fracs', 'flowmap'] as const).map((p, i, arr) => {
                  const labels: Record<typeof p, string> = { heaters: 'Heaters', drums: 'Drums', fracs: 'Fracs', flowmap: 'Flow Map' }
                  const done = arr.indexOf(namesPhase) > i
                  const active = namesPhase === p
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div
                        onClick={done ? () => setNamesPhase(p) : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20,
                          background: active ? '#009FDF' : done ? '#d1fae5' : '#f4f8fb',
                          border: `1.5px solid ${active ? '#009FDF' : done ? '#6ee7b7' : '#dce8f0'}`,
                          flexShrink: 0,
                          cursor: done ? 'pointer' : 'default',
                        }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#fff' : done ? '#10b981' : '#dce8f0', fontSize: 9, fontWeight: 700, color: active ? '#009FDF' : done ? '#fff' : '#8ba3b5', flexShrink: 0 }}>
                          {done ? '✓' : i + 1}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : done ? '#059669' : '#8ba3b5', whiteSpace: 'nowrap' }}>{labels[p]}</span>
                      </div>
                      {i < arr.length - 1 && <div style={{ flex: 1, height: 1.5, background: done ? '#6ee7b7' : '#dce8f0', margin: '0 4px' }} />}
                    </div>
                  )
                })}
              </div>
              {namesPhase !== 'flowmap' && (
                <NameEditor eq={equipment} setEquipment={setEquipment} phase={namesPhase} />
              )}
              {namesPhase === 'flowmap' && (
                <ProcessFlowMap
                  matrix={makeMatrixForFlowMap()}
                  setMatrix={() => {}}
                  numFracs={spall.numFractionators}
                  fracLinks={fracLinks}
                  setFracLinks={setFracLinks}
                />
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <EquipmentPFD spall={spall} equipment={equipment} sections={sections} />
          </div>
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border pt-3">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary"
            onClick={() => {
              if (namesPhase === 'heaters') editSection('tubes')
              else if (namesPhase === 'drums') setNamesPhase('heaters')
              else if (namesPhase === 'fracs') setNamesPhase('drums')
              else setNamesPhase('fracs')
            }}
          >
            ← Back
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg"
            onClick={() => {
              if (namesPhase === 'heaters') setNamesPhase('drums')
              else if (namesPhase === 'drums') setNamesPhase('fracs')
              else if (namesPhase === 'fracs') setNamesPhase('flowmap')
              else confirmSection('names')
            }}
          >
            {namesPhase === 'heaters' ? 'Confirm Heater Names →'
              : namesPhase === 'drums' ? 'Confirm Drum Names →'
              : namesPhase === 'fracs' ? 'Confirm Frac Names →'
              : 'Confirm Names'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Equipment Configuration</h2>
        <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Complete each section in order to configure your equipment hierarchy.</p>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 20, overflow: 'hidden' }}>
        <div style={{ flex: '0 0 56%', minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
            {(['furnace', 'auxiliary', 'passmap', 'tubes'] as const).map((s, i, arr) => {
              const labels: Record<typeof s, string> = { furnace: 'Furnace', auxiliary: 'Auxiliary', passmap: 'Pass Map', tubes: 'Tube & TMT' }
              const done = sections[s] === 'done'
              const active = sections[s] === 'open'
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div
                    onClick={done ? () => editSection(s) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20,
                      background: active ? '#009FDF' : done ? '#d1fae5' : '#f4f8fb',
                      border: `1.5px solid ${active ? '#009FDF' : done ? '#6ee7b7' : '#dce8f0'}`,
                      flexShrink: 0,
                      cursor: done ? 'pointer' : 'default',
                    }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#fff' : done ? '#10b981' : '#dce8f0', fontSize: 9, fontWeight: 700, color: active ? '#009FDF' : done ? '#fff' : '#8ba3b5', flexShrink: 0 }}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : done ? '#059669' : '#8ba3b5', whiteSpace: 'nowrap' }}>{labels[s]}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ flex: 1, height: 1.5, background: done ? '#6ee7b7' : '#dce8f0', margin: '0 4px' }} />}
                </div>
              )
            })}
          </div>
          <div ref={sectionsColRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.furnace === 'open' && (
              <FurnaceGeometryPanel spall={spall} setSpall={setSpall} />
            )}
            {sections.auxiliary === 'open' && (
              <AuxiliaryEquipmentPanel spall={spall} setSpall={setSpall} />
            )}
            {sections.passmap === 'open' && (
              <PassMapPanel spall={spall} setSpall={setSpall}
                mirrorMap={mirrorMap} onMirrorChange={handleMirrorChange} onCopyFrom={handleCopyFromPassMap}
              />
            )}
            {sections.tubes === 'open' && (
              <TubeConfigPanel spall={spall} setSpall={setSpall}
                mirrorMap={mirrorMap} onMirrorChange={handleMirrorChange} onCopyFrom={handleCopyFromTubes}
              />
            )}
            {allDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', background: '#f4f8fb', borderRadius: 8, border: '1px solid #dce8f0' }}>
                {([
                  { id: 'furnace', label: 'Furnace' },
                  { id: 'auxiliary', label: 'Auxiliary' },
                  { id: 'passmap', label: 'Pass Map' },
                  { id: 'tubes', label: 'Tube & TMT' },
                  { id: 'names', label: 'Names' },
                ] as { id: SectionId; label: string }[]).map(({ id, label }) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#009FDF', minWidth: 80 }}>{label}</span>
                    <span style={{ color: '#4b5563' }}>{sectionSummary(id, spall)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <EquipmentPFD spall={spall} equipment={equipment} sections={sections} />
        </div>
      </div>
      {(() => {
        const anyOpen = sections.furnace === 'open' || sections.auxiliary === 'open' || sections.passmap === 'open' || sections.tubes === 'open'
        const backClick =
          sections.furnace === 'open' ? onBack :
          sections.auxiliary === 'open' ? () => editSection('furnace') :
          sections.passmap === 'open' ? () => editSection('auxiliary') :
          () => editSection('passmap')
        return (
          <div className={`mt-3 flex shrink-0 items-center border-t border-border pt-3 ${anyOpen ? 'justify-between' : 'justify-end'}`}>
            {anyOpen && (
              <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={backClick}>
                ← Back
              </button>
            )}
            {sections.furnace === 'open' && (
              <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={() => confirmSection('furnace')}>
                Auxiliary Equipment →
              </button>
            )}
            {sections.auxiliary === 'open' && (
              <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={() => confirmSection('auxiliary')}>
                Define Pass-to-Cell Mapping →
              </button>
            )}
            {sections.passmap === 'open' && (
              <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50" disabled={!passMapAllValid} onClick={() => confirmSection('passmap')}>
                Configure Tubes →
              </button>
            )}
            {sections.tubes === 'open' && (
              <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50" disabled={!tubesAllValid} onClick={() => confirmSection('tubes')}>
                Next: Edit Names →
              </button>
            )}
            {allDone && !anyOpen && (
              <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={onNext}>
                Next: Models →
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}
