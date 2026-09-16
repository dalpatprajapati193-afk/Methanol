'use client'

import { useState, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  equipmentAtom,
  spallConfigAtom,
  passTubeMappingAtom,
  furnaceGeometryAtom,
  selectedModelIdsAtom,
  toggleModelAtom,
  modelsAtom,
  modelParametersAtom,
  setModelParametersAtom,
  modelParametersBlueprintAtom,
} from '../../store/dcuAtoms'
import { SpallGroupsPanel } from '../spall/SpallGroupsPanel'
import { SpallOpsPanel } from '../spall/SpallOpsPanel'
import { SpallSOPPanel } from '../spall/SpallSOPPanel'
import type { SpallState } from '../spall/helpers'
import type { ModelGroup, ModelEntry, SpallGroup } from '../../types'

interface Props { onNext: () => void; onBack: () => void }

type SpallView = 'models' | 'parameters' | 'steamgroups' | 'spallgroups' | 'spallsop'

const GROUP_LABELS: Record<ModelGroup, string> = {
  coke_drum: 'Coke Drum',
  furnace: 'Furnace',
}

const GROUP_COLORS: Record<ModelGroup, string> = {
  coke_drum: '#f97316',
  furnace: '#1e3a5f',
}

const MODEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Predicts pressure drop index across coke drum cycles',
  2: 'Estimates drum outage (ullage) throughout the coking cycle',
  3: 'Monitors coke hardgrove grindability index over time',
  4: 'Predicts remaining furnace run length before decoking',
  5: 'Detects and tracks spallation events in furnace tubes',
  6: 'Estimates clean-tube metal temperature for fouling baseline',
}

export default function Step3Models({ onNext, onBack }: Props) {
  const equipment = useAtomValue(equipmentAtom)
  const [spallConfig, setSpallConfig] = useAtom(spallConfigAtom)
  const passTubeMapping = useAtomValue(passTubeMappingAtom)
  const furnaceGeometry = useAtomValue(furnaceGeometryAtom)
  const selectedModelIds = useAtomValue(selectedModelIdsAtom)
  const toggleModel = useSetAtom(toggleModelAtom)
  const models = useAtomValue(modelsAtom)
  const modelParameters = useAtomValue(modelParametersAtom)
  const setModelParameters = useSetAtom(setModelParametersAtom)
  const modelParametersBlueprint = useAtomValue(modelParametersBlueprintAtom)
  const [, setEquipment] = useAtom(equipmentAtom)

  const [selectedCategories, setSelectedCategories] = useState<Set<ModelGroup>>(() => {
    const categories = new Set<ModelGroup>()
    selectedModelIds.forEach(id => {
      const model = models.find(m => m.model_id === id)
      if (model?.group) categories.add(model.group)
    })
    return categories
  })

  useEffect(() => {
    const categories = new Set<ModelGroup>()
    selectedModelIds.forEach(id => {
      const model = models.find(m => m.model_id === id)
      if (model?.group) categories.add(model.group)
    })
    setSelectedCategories(categories)
  }, [selectedModelIds, models])

  const [spallView, setSpallView] = useState<SpallView>('models')
  const [activeParamModel, setActiveParamModel] = useState<number | null>(null)

  const numHeaters = equipment.furnaces.length
  const [spall, setSpall] = useState<SpallState>(() => ({
    numHeaters: furnaceGeometry?.numHeaters ?? Math.max(1, numHeaters),
    firingConfig: furnaceGeometry?.firingConfig ?? 'double',
    passesPerCell: furnaceGeometry?.passesPerCell ?? 2,
    uniformPasses: furnaceGeometry?.uniformPasses ?? true,
    passesPerCellMap: furnaceGeometry?.passesPerCellMap ? Object.fromEntries(
      Object.entries(furnaceGeometry.passesPerCellMap).map(([k, v]) => [Number(k), v])
    ) : {},
    hasOpTags: spallConfig?.hasOpTags ?? false,
    drumsPerTrain: 2,
    uniformDrums: true,
    drumsPerTrainMap: {},
    numFractionators: equipment.fractionators?.length ?? 1,
    overheads: 1,
    reboilers: 1,
    passToCell: passTubeMapping?.passToCell ? Object.fromEntries(
      Object.entries(passTubeMapping.passToCell).map(([h, ptc]) => [
        Number(h),
        Object.fromEntries(Object.entries(ptc).map(([p, c]) => [Number(p), c]))
      ])
    ) : {},
    tubeConfigs: passTubeMapping?.tubeConfigs ? Object.fromEntries(
      Object.entries(passTubeMapping.tubeConfigs).map(([h, conf]) => [Number(h), conf])
    ) : {},
    heaterGroups: spallConfig?.heaterGroups ? Object.fromEntries(
      Object.entries(spallConfig.heaterGroups).map(([h, g]) => [
        Number(h),
        { numGroups: g.numGroups, assignment: Object.fromEntries(Object.entries(g.assignment).map(([p, c]) => [Number(p), c])) }
      ])
    ) : {},
    spallOps: spallConfig?.spallOps ? Object.fromEntries(
      Object.entries(spallConfig.spallOps).map(([h, o]) => [
        Number(h),
        { numOps: o.numOps, assignment: Object.fromEntries(Object.entries(o.assignment).map(([p, c]) => [Number(p), c])) }
      ])
    ) : {},
  }))
  const [mirrorMap, setMirrorMap] = useState<Record<number, number>>({})

  useEffect(() => {
    setSpallConfig(spall)
  }, [spall, setSpallConfig])

  useEffect(() => {
    if (Object.keys(spall.heaterGroups).length === 0) return
    const cells = spall.firingConfig === 'double' ? 2 : 1
    const totalPasses = spall.uniformPasses || cells === 1
      ? cells * spall.passesPerCell
      : Object.values(spall.passesPerCellMap).reduce((s, v) => s + v, 0) || cells * spall.passesPerCell

    let hasChanges = false
    const updatedFurnaces = equipment.furnaces.map((furnace, hIdx) => {
      const h = hIdx + 1
      const groups = spall.heaterGroups[h]
      if (!groups) return furnace
      const spallGroups: SpallGroup[] = []
      for (let g = 1; g <= groups.numGroups; g++) {
        const passesCodes: string[] = []
        for (let p = 1; p <= totalPasses; p++) {
          if (groups.assignment[p] === g) passesCodes.push(`H${h}P${p}`)
        }
        if (passesCodes.length > 0) {
          spallGroups.push({
            id: `${furnace.id}_sg${g}`,
            name: passesCodes.map(pc => pc.slice(2)).join('_'),
            groupNum: g,
            passCodes: passesCodes,
          })
        }
      }
      if (JSON.stringify(furnace.spallGroups) !== JSON.stringify(spallGroups)) {
        hasChanges = true
        return { ...furnace, spallGroups }
      }
      return furnace
    })
    if (hasChanges) setEquipment({ ...equipment, furnaces: updatedFurnaces })
  }, [spall, setEquipment, equipment.furnaces])

  const handleMirrorChange = (targetH: number, sourceH: number) => {
    setMirrorMap(prev => ({ ...prev, [targetH]: sourceH }))
  }
  const handleCopyFrom = (targetH: number, sourceH: number) => {
    setSpall(prev => {
      const next = { ...prev }
      const src = prev.heaterGroups[sourceH]
      if (src) next.heaterGroups = { ...prev.heaterGroups, [targetH]: { ...src, assignment: { ...src.assignment } } }
      return next
    })
  }

  const hasFurnaceModel = selectedModelIds.some(id => {
    const model = models.find(m => m.model_id === id)
    return model?.group === 'furnace'
  })

  const toggleCategory = (category: ModelGroup) => {
    const newCategories = new Set<ModelGroup>()
    const otherCategory = category === 'furnace' ? 'coke_drum' : 'furnace'
    if (selectedCategories.has(category)) {
      const modelsInCategory = models.filter(m => m.group === category)
      modelsInCategory.forEach(m => { if (selectedModelIds.includes(m.model_id)) toggleModel(m.model_id) })
    } else {
      newCategories.add(category)
      const modelsInOtherCategory = models.filter(m => m.group === otherCategory)
      modelsInOtherCategory.forEach(m => { if (selectedModelIds.includes(m.model_id)) toggleModel(m.model_id) })
    }
    setSelectedCategories(newCategories)
  }

  const selectedModels = models.filter(m => selectedModelIds.includes(m.model_id))
  const grouped = models.reduce<Record<ModelGroup, ModelEntry[]>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = []
    acc[m.group].push(m)
    return acc
  }, {} as Record<ModelGroup, ModelEntry[]>)

  const updateParam = (modelId: number, idx: number, field: 'value' | 'description', val: string) => {
    const params = modelParameters[modelId] || []
    setModelParameters(modelId, params.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }
  const removeParam = (modelId: number, idx: number) => {
    setModelParameters(modelId, (modelParameters[modelId] || []).filter((_, i) => i !== idx))
  }
  const loadDefaults = (modelId: number) => {
    const applicableParams = modelParametersBlueprint.filter(p => p.model_ids.includes(modelId))
    setModelParameters(modelId, applicableParams.map(p => ({ parameter: p.parameter, display_name: p.display_name, value: p.value, description: p.description })))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>
          {spallView === 'models' ? 'Model Selection' : spallView === 'parameters' ? 'Model Parameters' : 'Spall Configuration'}
        </h2>
        <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>
          {spallView === 'models'
            ? 'Select the models you want to configure.'
            : spallView === 'parameters'
            ? 'Review and adjust configuration parameters for each selected model.'
            : 'Configure steam groups and spall operations for furnace models.'}
        </p>
      </div>

      {(selectedModels.length > 0 || hasFurnaceModel) && spallView !== 'models' && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dce8f0', marginBottom: 12, flexShrink: 0 }}>
          {selectedModels.length > 0 && (
            <button onClick={() => setSpallView('parameters')} style={{ padding: '7px 14px', border: 'none', borderBottom: spallView === 'parameters' ? '3px solid #1e3a5f' : '3px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: spallView === 'parameters' ? '#1e3a5f' : '#7a95a8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
              1. Model Parameters
            </button>
          )}
          {hasFurnaceModel && (
            <>
              <button onClick={() => setSpallView('steamgroups')} style={{ padding: '7px 14px', border: 'none', borderBottom: spallView === 'steamgroups' ? '3px solid #1e3a5f' : '3px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: spallView === 'steamgroups' ? '#1e3a5f' : '#7a95a8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                {selectedModels.length > 0 ? '2. Steam Groups' : '1. Steam Groups'}
              </button>
              <button onClick={() => setSpallView('spallgroups')} style={{ padding: '7px 14px', border: 'none', borderBottom: spallView === 'spallgroups' ? '3px solid #1e3a5f' : '3px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: spallView === 'spallgroups' ? '#1e3a5f' : '#7a95a8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                {selectedModels.length > 0 ? '3. Spall Groups' : '2. Spall Groups'}
              </button>
              <button onClick={() => setSpallView('spallsop')} style={{ padding: '7px 14px', border: 'none', borderBottom: spallView === 'spallsop' ? '3px solid #1e3a5f' : '3px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: spallView === 'spallsop' ? '#1e3a5f' : '#7a95a8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                {selectedModels.length > 0 ? '4. Spall SOP' : '3. Spall SOP'}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {spallView === 'models' && (
          <>
            <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ marginBottom: 18 }}>
              <div className="bg-accent-blue" style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Select Models</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', gap: 10, borderBottom: '1px solid #dce8f0' }}>
                {(['furnace', 'coke_drum'] as ModelGroup[]).map(category => {
                  const isSelected = selectedCategories.has(category)
                  return (
                    <button key={category} onClick={() => toggleCategory(category)} style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: `2px solid ${isSelected ? GROUP_COLORS[category] : '#dce8f0'}`, background: isSelected ? `${GROUP_COLORS[category]}15` : '#ffffff', color: isSelected ? GROUP_COLORS[category] : '#7a95a8', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', flex: 1 }}>
                      {GROUP_LABELS[category]} Models
                    </button>
                  )
                })}
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {(['furnace', 'coke_drum'] as ModelGroup[]).filter(group => selectedCategories.has(group)).map(group => (
                  <div key={group}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 4, height: 18, background: GROUP_COLORS[group], borderRadius: 2, flexShrink: 0 }} />
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1c3045', margin: 0 }}>{GROUP_LABELS[group]}</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                      {(grouped[group] || []).map(model => {
                        const selected = selectedModelIds.includes(model.model_id)
                        return (
                          <button key={model.model_id} type="button" onClick={() => toggleModel(model.model_id)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '14px 14px 12px', borderRadius: 10, border: `2px solid ${selected ? GROUP_COLORS[group] : '#dce8f0'}`, background: selected ? `${GROUP_COLORS[group]}10` : '#ffffff', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'left', boxShadow: selected ? `0 2px 8px ${GROUP_COLORS[group]}30` : '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? GROUP_COLORS[group] : '#dce8f0'}`, background: selected ? GROUP_COLORS[group] : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {selected && (
                                <svg style={{ width: 11, height: 11, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 7px', borderRadius: 20, background: `${GROUP_COLORS[group]}18`, color: GROUP_COLORS[group], border: `1px solid ${GROUP_COLORS[group]}40` }}>
                              {GROUP_LABELS[group]}
                            </span>
                            <div style={{ paddingRight: 22 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1c3045', lineHeight: 1.2 }}>{model.model_alias}</div>
                              {MODEL_DESCRIPTIONS[model.model_id] && (
                                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{MODEL_DESCRIPTIONS[model.model_id]}</div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {spallView === 'parameters' && selectedModels.length > 0 && (() => {
          const activeModel = selectedModels.find(m => m.model_id === activeParamModel) ?? selectedModels[0]
          const params = modelParameters[activeModel.model_id] || []
          const accentColor = GROUP_COLORS[activeModel.group]
          return (
            <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: '2', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {selectedModels.length > 1 && (
                    <div style={{ display: 'flex', borderBottom: '2px solid #dce8f0', overflowX: 'auto', background: '#f8fbfd', borderRadius: '8px 8px 0 0' }}>
                      {selectedModels.map(m => {
                        const isActive = m.model_id === activeModel.model_id
                        return (
                          <button key={m.model_id} type="button" onClick={() => setActiveParamModel(m.model_id)} style={{ flex: '0 1 auto', minWidth: 100, padding: '9px 16px', fontSize: 12, fontWeight: 700, color: isActive ? '#2563eb' : '#7a95a8', background: isActive ? 'rgba(37,99,235,0.06)' : 'transparent', border: 'none', borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                            {m.model_alias}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="bg-accent-blue" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{activeModel.model_alias}</span>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: activeModel.group === 'coke_drum' ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.15)', color: activeModel.group === 'coke_drum' ? '#fdba74' : '#bfdbfe', border: `1px solid ${activeModel.group === 'coke_drum' ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.25)'}` }}>{GROUP_LABELS[activeModel.group]}</span>
                    <button className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10" onClick={() => loadDefaults(activeModel.model_id)}>Load Defaults</button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}>
                        <tr style={{ borderBottom: '2px solid #dce8f0' }}>
                          {['Parameter', 'Description', 'Value', ''].map((h, i) => (
                            <th key={i} style={{ textAlign: 'left', padding: '10px 12px 8px', fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', width: i === 0 ? 200 : i === 2 ? 110 : i === 3 ? 32 : 'auto' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {params.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f4f8fb' }}>
                            <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#3d5a70', background: '#f4f8fb', border: '1px solid #dce8f0', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>{p.parameter}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <textarea rows={2} className="rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text-primary shadow-sm focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/40" style={{ width: '100%', resize: 'none', lineHeight: 1.5 }} value={p.description} onChange={e => updateParam(activeModel.model_id, i, 'description', e.target.value)} placeholder="Description of this parameter" />
                            </td>
                            <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                              <input className="rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text-primary shadow-sm focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/40" style={{ width: '100%', fontWeight: 700 }} value={p.value} onChange={e => updateParam(activeModel.model_id, i, 'value', e.target.value)} placeholder="—" />
                            </td>
                            <td style={{ paddingTop: 10, paddingRight: 8, verticalAlign: 'top' }}>
                              <button onClick={() => removeParam(activeModel.model_id, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0d4e0', padding: 0, transition: 'color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = '#dc3545')} onMouseLeave={e => (e.currentTarget.style.color = '#c0d4e0')}>
                                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {params.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 14px', color: '#8ba3b5', fontSize: 12 }}>
                        No parameters yet.{' '}
                        <button onClick={() => loadDefaults(activeModel.model_id)} style={{ background: 'none', border: 'none', color: '#1e3a5f', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline' }}>Load defaults</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ flex: '1', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                <div style={{ background: `${accentColor}08`, border: `1.5px solid ${accentColor}25`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1c3045' }}>{activeModel.model_alias}</span>
                  </div>
                  {MODEL_DESCRIPTIONS[activeModel.model_id] && (
                    <p style={{ fontSize: 11, color: '#5a7a8f', lineHeight: 1.55, margin: '0 0 12px' }}>{MODEL_DESCRIPTIONS[activeModel.model_id]}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      { label: 'Category', value: GROUP_LABELS[activeModel.group] },
                      { label: 'Fields', value: String(params.length) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#7a95a8' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1c3045' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>Configuration tips</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#3b82f6', lineHeight: 1.7 }}>
                    <li>Run frequency controls how often the model re-evaluates predictions.</li>
                    <li>Lower values give more real-time results but use more compute.</li>
                    <li>Leave optional fields blank to use defaults defined in the model schema.</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        })()}

        {spallView === 'steamgroups' && hasFurnaceModel && (
          <SpallGroupsPanel spall={spall} setSpall={setSpall} onNext={() => setSpallView('spallgroups')} onBack={() => setSpallView('models')} mirrorMap={mirrorMap} onMirrorChange={handleMirrorChange} onCopyFrom={handleCopyFrom} />
        )}
        {spallView === 'spallgroups' && hasFurnaceModel && (
          <SpallOpsPanel spall={spall} setSpall={setSpall} onNext={() => setSpallView('spallsop')} onBack={() => setSpallView('steamgroups')} mirrorMap={mirrorMap} onMirrorChange={handleMirrorChange} onCopyFrom={handleCopyFrom} />
        )}
        {spallView === 'spallsop' && hasFurnaceModel && (
          <SpallSOPPanel onNext={onNext} onBack={() => setSpallView('spallgroups')} />
        )}
      </div>

      {(spallView === 'models' || spallView === 'parameters') && (
        <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border pt-3">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary"
            onClick={spallView === 'models' ? onBack : () => setSpallView('models')}
          >
            {spallView === 'models' ? '← Back' : '← Back to Models'}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (spallView === 'models') {
                if (selectedModels.length > 0) setSpallView('parameters')
                else if (hasFurnaceModel) setSpallView('steamgroups')
                else onNext()
              } else {
                if (hasFurnaceModel) setSpallView('steamgroups')
                else onNext()
              }
            }}
            disabled={spallView === 'models' && selectedModelIds.length === 0}
          >
            {spallView === 'models'
              ? selectedModels.length > 0 ? 'Next: Parameters →' : hasFurnaceModel ? 'Next: Steam Groups →' : 'Next: Tag Mapping →'
              : hasFurnaceModel ? 'Next: Steam Groups →' : 'Next: Tag Mapping →'}
          </button>
        </div>
      )}
    </div>
  )
}
