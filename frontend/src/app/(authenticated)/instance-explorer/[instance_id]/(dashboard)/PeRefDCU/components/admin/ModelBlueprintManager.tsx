'use client'

import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  modelsAtom,
  setModelsAtom,
  equipmentAtom,
  tagMappingsAtom,
  topologyTreeAtom,
} from '../../store/dcuAtoms'
import { flattenTree } from '../../utils/outputGenerator'
import { getModelRegistry, uploadModelFile } from '../../actions/actions'
import type { ModelRegistryEntry } from '../../actions/actions'
import type {
  Equipment, ModelEntry, SubModelEntry, TopologyNode,
  SubModelTrainingConfig, ModelTypeOption, ScalerType, CleaningBound,
} from '../../types'

const LEVELS_EXCLUD_SYSTEM = [
  'Furnace', 'Cell', 'Pass', 'Tube',
  'Drum train', 'Drum',
  'Fractionator', 'Column Overhead', 'Column Reboiler', 'Spall Group',
]

const ALGORITHMS_BY_TYPE: Record<ModelTypeOption, string[]> = {
  regression:     ['Linear Regression', 'Ridge', 'Lasso', 'Random Forest', 'XGBoost', 'SVR', 'Neural Network'],
  classification: ['Logistic Regression', 'Random Forest', 'XGBoost', 'SVM', 'Neural Network', 'KNN'],
  forecasting:    ['ARIMA', 'LSTM', 'Prophet', 'TCN', 'N-BEATS'],
}

const EVAL_BY_TYPE: Record<ModelTypeOption, string[]> = {
  regression:     ['RMSE', 'MAE', 'R²', 'MAPE'],
  classification: ['Accuracy', 'Precision', 'Recall', 'F1', 'AUC-ROC'],
  forecasting:    ['RMSE', 'MAE', 'MAPE', 'sMAPE'],
}

const DEFAULT_CONFIG: SubModelTrainingConfig = {
  normalize_features: false, feature_scaler: 'min-max',
  normalize_target: false, target_scaler: 'min-max',
  data_cleaning: false, cleaning_bounds: [],
  model_type: 'regression', algorithms: [], evaluation_criteria: [],
  save_training_data: false, save_normalized_data: false, save_top5_results: false,
  retrain_frequency: '',
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #dce8f0',
  borderRadius: 4, fontFamily: 'inherit', boxSizing: 'border-box',
}
const sectionHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase',
  letterSpacing: '0.06em', background: '#f0f6fa', padding: '7px 12px',
  borderRadius: 6, marginBottom: 12, border: '1px solid #dce8f0',
}
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
const colLabel: React.CSSProperties = { ...fieldLabel, marginBottom: 0, flex: '0 0 220px' }

function resolveAttr(key: string, levelToPrefix: Map<string, string>): string {
  const pipeIdx = key.indexOf('|')
  if (pipeIdx === -1) return key
  const level = key.slice(0, pipeIdx)
  const attr = key.slice(pipeIdx + 1)
  const prefix = levelToPrefix.get(level)
  return prefix !== undefined ? (prefix ? `${prefix}_${attr}` : attr) : attr
}

function OfflineLiveToggle({ value, onChange }: { value: 'offline' | 'live'; onChange: (v: 'offline' | 'live') => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #dce8f0', overflow: 'hidden' }}>
      {(['offline', 'live'] as const).map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 11, background: value === opt ? (opt === 'live' ? '#059669' : '#1e3a5f') : '#f8fbfd', color: value === opt ? '#ffffff' : '#6b7280' }}>
          {opt === 'offline' ? 'Offline' : 'Live'}
        </button>
      ))}
    </div>
  )
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #dce8f0', overflow: 'hidden' }}>
      {([true, false] as const).map(opt => (
        <button key={String(opt)} type="button" onClick={() => onChange(opt)} style={{ padding: '5px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 11, background: value === opt ? (opt ? '#2563eb' : '#6b7280') : '#f8fbfd', color: value === opt ? '#ffffff' : '#6b7280' }}>
          {opt ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

function ScalerSelect({ value, onChange }: { value: ScalerType; onChange: (v: ScalerType) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as ScalerType)} style={{ ...fieldStyle, width: 'auto', minWidth: 120, cursor: 'pointer' }}>
      <option value="min-max">Min-Max</option>
      <option value="std">Standard (Z-score)</option>
    </select>
  )
}

function ModelTypeSegment({ value, onChange }: { value: ModelTypeOption; onChange: (v: ModelTypeOption) => void }) {
  const opts: { v: ModelTypeOption; label: string }[] = [
    { v: 'regression', label: 'Regression' },
    { v: 'classification', label: 'Classification' },
    { v: 'forecasting', label: 'Forecasting' },
  ]
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #dce8f0', overflow: 'hidden' }}>
      {opts.map(opt => (
        <button key={opt.v} type="button" onClick={() => onChange(opt.v)} style={{ padding: '6px 18px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12, background: value === opt.v ? '#2563eb' : '#f8fbfd', color: value === opt.v ? '#ffffff' : '#6b7280', borderRight: '1px solid #dce8f0' }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface SubRow {
  sub_model_name: string
  levelToPrefix: Map<string, string>
  storedConfig?: SubModelTrainingConfig
  storedSubModelId: number
  storedFeatureSelection?: string[]
  storedTarget?: string[]
}

function ModelsConfigTab({ models, aliasToId, instanceId }: { models: ModelEntry[]; aliasToId: Map<string, number>; instanceId: string }) {
  const equipment = useAtomValue(equipmentAtom)
  const setModels = useSetAtom(setModelsAtom)
  const tagMappings = useAtomValue(tagMappingsAtom)
  const tree = useAtomValue(topologyTreeAtom)

  const { allNodes, nodesByLevel } = useMemo(() => {
    const allNodes: TopologyNode[] = flattenTree(tree)
    const nodesByLevel = new Map<string, TopologyNode[]>()
    allNodes.forEach(n => {
      if (!nodesByLevel.has(n.level)) nodesByLevel.set(n.level, [])
      nodesByLevel.get(n.level)!.push(n)
    })
    return { allNodes, nodesByLevel }
  }, [tree])

  function buildLevelToPrefix(nodePath: string): Map<string, string> {
    const map = new Map<string, string>()
    const sysNode = allNodes.find(n => n.type === 'system')
    if (sysNode) map.set(sysNode.level, '')
    allNodes.forEach(n => {
      if (n.type === 'system') return
      if (nodePath === n.path || nodePath.startsWith(n.path + '/'))
        map.set(n.level, n.path.replace(/\//g, '_').toLowerCase())
    })

    const furnaceAnc = allNodes.find(n => n.type === 'furnace' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))
    const dtAnc = allNodes.find(n => n.type === 'drum_train' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))
    const fracAnc = allNodes.find(n => n.type === 'fractionator' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))

    function addLinkedFrac(dtId: string) {
      const fracIds = equipment.trainFractionatorLinks[dtId] ?? []
      const frac = equipment.fractionators.find(f => fracIds.includes(f.id))
      if (frac && !map.has('Fractionator')) map.set('Fractionator', frac.name.replace(/\//g, '_').toLowerCase())
    }

    function furnaceForTrain(dtObj: Equipment['drumTrains'][0]): Equipment['furnaces'][0] | undefined {
      const linkedId = equipment.trainFurnaceLinks?.[dtObj.id]
      if (linkedId) return equipment.furnaces.find(f => f.id === linkedId)
      return equipment.furnaces[equipment.drumTrains.indexOf(dtObj)]
    }

    function trainForFurnace(furnaceObj: Equipment['furnaces'][0]): Equipment['drumTrains'][0] | undefined {
      if (equipment.trainFurnaceLinks) {
        const entry = Object.entries(equipment.trainFurnaceLinks).find(([, fId]) => fId === furnaceObj.id)
        if (entry) return equipment.drumTrains.find(dt => dt.id === entry[0])
      }
      return equipment.drumTrains[equipment.furnaces.indexOf(furnaceObj)]
    }

    if (furnaceAnc) {
      const furnaceObj = equipment.furnaces.find(f => f.name === furnaceAnc.path)
      if (furnaceObj) {
        const dt = trainForFurnace(furnaceObj)
        if (dt) { if (!map.has('Drum train')) map.set('Drum train', dt.name.replace(/\//g, '_').toLowerCase()); addLinkedFrac(dt.id) }
      }
    }

    if (dtAnc) {
      const dtObj = equipment.drumTrains.find(dt => dt.name === dtAnc.path)
      if (dtObj) {
        const furnace = furnaceForTrain(dtObj)
        if (furnace && !map.has('Furnace')) map.set('Furnace', furnace.name.replace(/\//g, '_').toLowerCase())
        addLinkedFrac(dtObj.id)
      }
    }

    if (fracAnc) {
      const frac = equipment.fractionators.find(f => f.name === fracAnc.path)
      if (frac) {
        Object.entries(equipment.trainFractionatorLinks).forEach(([trainId, fracIds]) => {
          if (!fracIds.includes(frac.id)) return
          const dt = equipment.drumTrains.find(d => d.id === trainId)
          if (dt) {
            if (!map.has('Drum train')) map.set('Drum train', dt.name.replace(/\//g, '_').toLowerCase())
            const furnace = furnaceForTrain(dt)
            if (furnace && !map.has('Furnace')) map.set('Furnace', furnace.name.replace(/\//g, '_').toLowerCase())
          }
        })
      }
    }

    const furnaceNode = allNodes.find(n => n.type === 'furnace' && n.path.replace(/\//g, '_').toLowerCase() === map.get('Furnace'))
    if (furnaceNode) {
      allNodes.forEach(n => {
        if (!map.has(n.level) && n.path.startsWith(furnaceNode.path + '/'))
          map.set(n.level, n.path.replace(/\//g, '_').toLowerCase())
      })
    }

    const fracNode = allNodes.find(n => n.type === 'fractionator' && n.path.replace(/\//g, '_').toLowerCase() === map.get('Fractionator'))
    if (fracNode) {
      allNodes.forEach(n => {
        if (!map.has(n.level) && n.path.startsWith(fracNode.path + '/'))
          map.set(n.level, n.path.replace(/\//g, '_').toLowerCase())
      })
    }

    return map
  }

  const subRowsByModelId = useMemo<Map<number, SubRow[]>>(() => {
    const result = new Map<number, SubRow[]>()
    const existingIds = new Set(models.flatMap(m => (m.sub_models ?? []).map(s => s.sub_model_id)))
    let nextId = existingIds.size > 0 ? Math.max(...existingIds) + 1 : 1
    models.forEach(model => {
      const nodes = model.model_level ? (nodesByLevel.get(model.model_level) ?? []) : []
      const prefix = model.model_alias.toLowerCase().replace(/\s+/g, '_')
      result.set(model.model_id, nodes.map(node => {
        const name = prefix + '_' + node.path.replace(/\//g, '_').toLowerCase()
        const stored = model.sub_models?.find(s => s.sub_model_name === name)
        return {
          sub_model_name: name,
          levelToPrefix: buildLevelToPrefix(node.path),
          storedConfig: stored?.training_config,
          storedSubModelId: stored?.sub_model_id ?? nextId++,
          storedFeatureSelection: stored?.feature_selection,
          storedTarget: stored?.target_variable,
        }
      }))
    })
    return result
  }, [models, nodesByLevel, allNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => [...models].sort((a, b) => a.model_id - b.model_id), [models])

  const [selectedModelId, setSelectedModelId] = useState<number>(() => sorted[0]?.model_id ?? -1)
  const [selectedSubName, setSelectedSubName] = useState<string>('')
  const [modes, setModes] = useState<Record<number, 'offline' | 'live'>>(() =>
    Object.fromEntries(models.map(m => [m.model_id, 'offline' as const]))
  )
  const [localCfg, setLocalCfg] = useState<SubModelTrainingConfig>({ ...DEFAULT_CONFIG })
  const [localFeatureSel, setLocalFeatureSel] = useState<Set<string>>(new Set())
  const [trainingDataFile, setTrainingDataFile] = useState<File | null>(null)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string>('')

  useEffect(() => {
    const rows = subRowsByModelId.get(selectedModelId) ?? []
    setSelectedSubName(rows[0]?.sub_model_name ?? '')
  }, [selectedModelId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = models.find(x => x.model_id === selectedModelId)
    const rows = subRowsByModelId.get(selectedModelId) ?? []
    const sub = rows.find(s => s.sub_model_name === selectedSubName)
    const modelFeatures = m?.attributes ?? []
    setLocalCfg(sub?.storedConfig ? { ...sub.storedConfig } : { ...DEFAULT_CONFIG })
    setLocalFeatureSel(new Set(sub?.storedFeatureSelection ?? modelFeatures))
    setTrainingDataFile(null)
    setModelFile(null)
  }, [selectedSubName]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedModel = models.find(m => m.model_id === selectedModelId)
  const subRows = subRowsByModelId.get(selectedModelId) ?? []
  const selectedSub = subRows.find(s => s.sub_model_name === selectedSubName)
  const levelToPrefix = selectedSub?.levelToPrefix ?? new Map()
  const modelFeatures = selectedModel?.attributes ?? []
  const targetVar = selectedModel?.target_variable ?? []
  const mode = modes[selectedModelId] ?? 'offline'
  const algos = ALGORITHMS_BY_TYPE[localCfg.model_type]
  const evals = EVAL_BY_TYPE[localCfg.model_type]

  function patchCfg(p: Partial<SubModelTrainingConfig>) { setLocalCfg(prev => ({ ...prev, ...p })) }

  function toggleFeature(key: string) {
    setLocalFeatureSel(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  function setModelType(mt: ModelTypeOption) {
    setLocalCfg(prev => ({ ...prev, model_type: mt, algorithms: [], evaluation_criteria: [] }))
  }

  function toggleAlgo(a: string) {
    setLocalCfg(prev => ({ ...prev, algorithms: prev.algorithms.includes(a) ? prev.algorithms.filter(x => x !== a) : [...prev.algorithms, a] }))
  }

  function toggleEval(e: string) {
    setLocalCfg(prev => ({ ...prev, evaluation_criteria: prev.evaluation_criteria.includes(e) ? prev.evaluation_criteria.filter(x => x !== e) : [...prev.evaluation_criteria, e] }))
  }

  function updateBound(feature_key: string, field: 'min' | 'max', val: string) {
    setLocalCfg(prev => {
      const existing = prev.cleaning_bounds.find(b => b.feature_key === feature_key)
      if (existing) return { ...prev, cleaning_bounds: prev.cleaning_bounds.map(b => b.feature_key === feature_key ? { ...b, [field]: val } : b) }
      return { ...prev, cleaning_bounds: [...prev.cleaning_bounds, { feature_key, min: '', max: '', [field]: val }] }
    })
  }

  function getBound(feature_key: string): CleaningBound {
    return localCfg.cleaning_bounds.find(b => b.feature_key === feature_key) ?? { feature_key, min: '', max: '' }
  }

  function getAttrDisplayName(key: string): string {
    if (!key.includes('|')) return key
    const [level, ...rest] = key.split('|'); const attr = rest.join('|')
    return tagMappings.find(m => m.level === level && m.attribute === attr)?.display_name ?? attr
  }

  async function handleSave() {
    if (!selectedModel || !selectedSub) return
    const cfgToSave: SubModelTrainingConfig = {
      ...localCfg,
      ...(trainingDataFile ? { training_data_file: trainingDataFile.name } : {}),
      ...(modelFile ? { model_file: modelFile.name } : {}),
    }
    setLocalCfg(cfgToSave)
    setModels(prev => prev.map(m => {
      if (m.model_id !== selectedModel.model_id) return m
      const existingSubs: SubModelEntry[] = m.sub_models ?? []
      const idx = existingSubs.findIndex(s => s.sub_model_name === selectedSub.sub_model_name)
      const updated: SubModelEntry = idx >= 0
        ? { ...existingSubs[idx], training_config: cfgToSave, feature_selection: Array.from(localFeatureSel) }
        : { sub_model_id: selectedSub.storedSubModelId, sub_model_name: selectedSub.sub_model_name, training_config: cfgToSave, feature_selection: Array.from(localFeatureSel) }
      return { ...m, sub_models: idx >= 0 ? existingSubs.map((s, i) => i === idx ? updated : s) : [...existingSubs, updated] }
    }))

    if (modelFile) {
      const dbModelId = aliasToId.get(selectedSubName) ?? null
      if (dbModelId !== null) {
        setUploadStatus('uploading')
        try {
          const ab = await modelFile.arrayBuffer()
          const bytes = new Uint8Array(ab)
          let binary = ''
          for (const b of bytes) binary += String.fromCharCode(b)
          const base64 = btoa(binary)

          const ext = modelFile.name.includes('.') ? modelFile.name.slice(modelFile.name.lastIndexOf('.')) : ''
          const generatedFileName = `${selectedSubName}${ext}`

          const targets = selectedSub?.storedTarget?.length
            ? selectedSub.storedTarget
            : targetVar.map(t => t.includes('|') ? t.split('|').slice(1).join('|') : t)
          const metadata = {
            level: selectedModel.model_level || null,
            mode,
            target_y: targets,
            features_x: Array.from(localFeatureSel).map(key => resolveAttr(key, levelToPrefix)),
          }

          const res = await uploadModelFile(instanceId, dbModelId, generatedFileName, selectedSubName, base64, metadata)
          if (res.success) {
            setUploadStatus('done')
            setUploadError('')
          } else {
            setUploadStatus('error')
            setUploadError(res.error ?? 'Unknown error')
          }
        } catch (e) {
          setUploadStatus('error')
          setUploadError(e instanceof Error ? e.message : String(e))
        }
      }
    }
  }

  function downloadModelConfig() {
    const rows: { model_id: number; sub_model_id: number | ''; parameter: string; value: string }[] = []
    sorted.forEach(model => {
      const sRows = subRowsByModelId.get(model.model_id) ?? []
      const dlMode = modes[model.model_id] ?? 'offline'
      const attrs = model.attributes ?? []
      const target = model.target_variable ?? []
      const ltp0 = sRows[0]?.levelToPrefix ?? new Map()
      rows.push({ model_id: model.model_id, sub_model_id: '', parameter: 'level', value: model.model_level || '' })
      rows.push({ model_id: model.model_id, sub_model_id: '', parameter: 'mode', value: dlMode })
      if (attrs.length > 0) rows.push({ model_id: model.model_id, sub_model_id: '', parameter: 'features', value: attrs.map(a => resolveAttr(a, ltp0)).join(', ') })
      if (target.length > 0) rows.push({ model_id: model.model_id, sub_model_id: '', parameter: 'target', value: target.map(t => resolveAttr(t, ltp0)).join(', ') })
      sRows.forEach(sub => {
        const cfg = sub.storedConfig
        if (!cfg) return
        const ltp = sub.levelToPrefix
        const sid = sub.storedSubModelId
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'normalize_features', value: cfg.normalize_features ? 'yes' : 'no' })
        if (cfg.normalize_features) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'feature_scaler', value: cfg.feature_scaler })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'normalize_target', value: cfg.normalize_target ? 'yes' : 'no' })
        if (cfg.normalize_target) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'target_scaler', value: cfg.target_scaler })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'data_cleaning', value: cfg.data_cleaning ? 'yes' : 'no' })
        if (cfg.data_cleaning && cfg.cleaning_bounds.length > 0) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'cleaning_bounds', value: cfg.cleaning_bounds.map(b => `${resolveAttr(b.feature_key, ltp)}:${b.min}-${b.max}`).join(', ') })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'model_type', value: cfg.model_type })
        if (cfg.algorithms.length > 0) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'algorithms', value: cfg.algorithms.join(', ') })
        if (cfg.evaluation_criteria.length > 0) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'eval_criteria', value: cfg.evaluation_criteria.join(', ') })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'save_training_data', value: cfg.save_training_data ? 'yes' : 'no' })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'save_normalized_data', value: cfg.save_normalized_data ? 'yes' : 'no' })
        rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'save_top5_results', value: cfg.save_top5_results ? 'yes' : 'no' })
        if (dlMode === 'live' && cfg.retrain_frequency) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'retrain_frequency', value: cfg.retrain_frequency })
        if (cfg.training_data_file) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'training_data_file', value: cfg.training_data_file })
        if (cfg.model_file) rows.push({ model_id: model.model_id, sub_model_id: sid, parameter: 'model_file', value: cfg.model_file })
      })
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'model_config')
    XLSX.writeFile(wb, 'model_manager_config.xlsx')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ flex: '0 0 200px' }}>
          <label style={fieldLabel}>Model Name</label>
          <select value={selectedModelId} onChange={e => setSelectedModelId(Number(e.target.value))} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {sorted.length === 0
              ? <option value={-1}>— No models —</option>
              : sorted.map(m => <option key={m.model_id} value={m.model_id}>{m.model_alias}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={{ ...fieldLabel, marginBottom: 0 }}>Sub Model Name</label>
            {(() => {
              const dbId = selectedSubName ? (aliasToId.get(selectedSubName) ?? null) : null
              return (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: dbId !== null ? 'rgba(0,159,223,0.1)' : '#f4f8fb',
                  color: dbId !== null ? '#009FDF' : '#9ca3af',
                  border: `1px solid ${dbId !== null ? '#009FDF' : '#dce8f0'}`,
                }}>
                  {dbId !== null ? `Model ID: ${dbId}` : 'Model ID: null'}
                </span>
              )
            })()}
          </div>
          <select value={selectedSubName} onChange={e => setSelectedSubName(e.target.value)} style={{ ...fieldStyle, cursor: subRows.length > 0 ? 'pointer' : 'not-allowed' }} disabled={subRows.length === 0}>
            {subRows.length === 0
              ? <option value="">— Complete topology to generate submodels —</option>
              : subRows.map(s => <option key={s.sub_model_name} value={s.sub_model_name}>{s.sub_model_name}</option>)}
          </select>
        </div>
        <button onClick={downloadModelConfig} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, height: 34 }}>
          <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Config
        </button>
      </div>

      {selectedModel && selectedSub ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #dce8f0', borderRadius: 8, padding: 24 }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <label style={fieldLabel}>Level</label>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', padding: '6px 10px', background: '#f0f6fa', border: '1px solid #dce8f0', borderRadius: 4, display: 'inline-block', minWidth: 120 }}>
                {selectedModel?.model_level || '—'}
              </span>
            </div>
            <div>
              <label style={fieldLabel}>Mode</label>
              <OfflineLiveToggle value={mode} onChange={v => setModes(prev => ({ ...prev, [selectedModelId]: v }))} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>Target (Y)</label>
            {(() => {
              const targets = selectedSub?.storedTarget?.length
                ? selectedSub.storedTarget
                : targetVar.map(t => t.includes('|') ? t.split('|').slice(1).join('|') : t)
              return targets.length > 0
                ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {targets.map(t => (
                      <span key={t} style={{ fontSize: 12, fontFamily: 'monospace', padding: '3px 10px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>{t}</span>
                    ))}
                  </div>
                : <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
            })()}
          </div>

          <div style={sectionHeader}>Features (X)</div>
          {modelFeatures.length === 0
            ? <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginBottom: 16 }}>No features set on this model.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {modelFeatures.map(key => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', padding: '4px 10px', borderRadius: 4, border: `1px solid ${localFeatureSel.has(key) ? '#2563eb' : '#dce8f0'}`, background: localFeatureSel.has(key) ? '#eff6ff' : '#fafbfc', color: localFeatureSel.has(key) ? '#1d4ed8' : '#6b7280' }}>
                    <input type="checkbox" checked={localFeatureSel.has(key)} onChange={() => toggleFeature(key)} style={{ margin: 0 }} />
                    <span style={{ fontFamily: 'monospace' }}>{resolveAttr(key, levelToPrefix)}</span>
                  </label>
                ))}
              </div>}

          <div style={sectionHeader}>Training Data</div>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Training Data File <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Excel / CSV)</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 6, border: '1px solid #dce8f0', background: '#f8fbfd', color: '#1e3a5f', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose file
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0] ?? null; setTrainingDataFile(f); if (f) setLocalCfg(prev => ({ ...prev, training_data_file: f.name })); e.target.value = '' }} />
              </label>
              {(trainingDataFile ?? localCfg.training_data_file) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: '#1c3045', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trainingDataFile?.name ?? localCfg.training_data_file}</span>
                  <button type="button" onClick={() => { setTrainingDataFile(null); setLocalCfg(prev => ({ ...prev, training_data_file: undefined })) }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Remove">×</button>
                </div>
              ) : <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No file selected</span>}
            </div>
          </div>

          <div style={rowStyle}>
            <span style={colLabel}>Normalize Features</span>
            <YesNoToggle value={localCfg.normalize_features} onChange={v => patchCfg({ normalize_features: v })} />
            {localCfg.normalize_features && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Scaler:</span>
                <ScalerSelect value={localCfg.feature_scaler} onChange={v => patchCfg({ feature_scaler: v })} />
              </div>
            )}
          </div>

          <div style={rowStyle}>
            <span style={colLabel}>Normalize Target</span>
            <YesNoToggle value={localCfg.normalize_target} onChange={v => patchCfg({ normalize_target: v })} />
            {localCfg.normalize_target && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Scaler:</span>
                <ScalerSelect value={localCfg.target_scaler} onChange={v => patchCfg({ target_scaler: v })} />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: localCfg.data_cleaning ? 10 : 0 }}>
              <span style={colLabel}>Data Cleaning</span>
              <YesNoToggle value={localCfg.data_cleaning} onChange={v => patchCfg({ data_cleaning: v })} />
            </div>
            {localCfg.data_cleaning && (
              modelFeatures.length === 0
                ? <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Set features on the model first.</p>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: '#f8fbfd' }}>
                        <th style={{ fontSize: 10, fontWeight: 700, color: '#5a7a8f', padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #dce8f0' }}>Feature</th>
                        <th style={{ fontSize: 10, fontWeight: 700, color: '#5a7a8f', padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #dce8f0', width: 110 }}>Min</th>
                        <th style={{ fontSize: 10, fontWeight: 700, color: '#5a7a8f', padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #dce8f0', width: 110 }}>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelFeatures.filter(k => localFeatureSel.has(k)).map(key => {
                        const b = getBound(key)
                        return (
                          <tr key={key}>
                            <td style={{ padding: '4px 10px', fontSize: 11, color: '#1c3045', borderBottom: '1px solid #f4f8fb' }}>
                              <span style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{resolveAttr(key, levelToPrefix)}</span>
                              <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 6 }}>({getAttrDisplayName(key)})</span>
                            </td>
                            <td style={{ padding: '4px 10px', borderBottom: '1px solid #f4f8fb' }}>
                              <input type="number" value={b.min} onChange={e => updateBound(key, 'min', e.target.value)} placeholder="—" style={{ ...fieldStyle, width: 90, textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '4px 10px', borderBottom: '1px solid #f4f8fb' }}>
                              <input type="number" value={b.max} onChange={e => updateBound(key, 'max', e.target.value)} placeholder="—" style={{ ...fieldStyle, width: 90, textAlign: 'right' }} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
            )}
          </div>

          <div style={sectionHeader}>Training Configuration</div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Model Type</label>
            <ModelTypeSegment value={localCfg.model_type} onChange={setModelType} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Algorithms to Test <span style={{ color: '#9ca3af', fontWeight: 400 }}>— best performer will be selected</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {algos.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, border: `1px solid ${localCfg.algorithms.includes(a) ? '#2563eb' : '#dce8f0'}`, background: localCfg.algorithms.includes(a) ? '#eff6ff' : '#fafbfc', color: localCfg.algorithms.includes(a) ? '#1d4ed8' : '#374151' }}>
                  <input type="checkbox" checked={localCfg.algorithms.includes(a)} onChange={() => toggleAlgo(a)} style={{ margin: 0 }} />
                  {a}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Evaluation Criteria</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {evals.map(e => (
                <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, border: `1px solid ${localCfg.evaluation_criteria.includes(e) ? '#059669' : '#dce8f0'}`, background: localCfg.evaluation_criteria.includes(e) ? '#ecfdf5' : '#fafbfc', color: localCfg.evaluation_criteria.includes(e) ? '#065f46' : '#374151' }}>
                  <input type="checkbox" checked={localCfg.evaluation_criteria.includes(e)} onChange={() => toggleEval(e)} style={{ margin: 0 }} />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {([
              { key: 'save_training_data' as const, label: 'Save training data' },
              { key: 'save_normalized_data' as const, label: 'Save training data after normalization' },
              { key: 'save_top5_results' as const, label: 'Save top 5 model results with evaluation metrics' },
            ]).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...colLabel, flex: '1 1 auto' }}>{label}</span>
                <YesNoToggle value={localCfg[key]} onChange={v => patchCfg({ [key]: v })} />
              </div>
            ))}
          </div>

          <div style={sectionHeader}>ML Model File</div>
          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>Model Artifact <span style={{ color: '#9ca3af', fontWeight: 400 }}>(pickle / joblib)</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 6, border: '1px solid #dce8f0', background: '#f8fbfd', color: '#1e3a5f', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose file
                <input type="file" accept=".pkl,.pickle,.joblib" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0] ?? null; setModelFile(f); if (f) { setLocalCfg(prev => ({ ...prev, model_file: f.name })); setUploadStatus('idle') } e.target.value = '' }} />
              </label>
              {(modelFile ?? localCfg.model_file) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: '#1c3045', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelFile?.name ?? localCfg.model_file}</span>
                  <button type="button" onClick={() => { setModelFile(null); setLocalCfg(prev => ({ ...prev, model_file: undefined })) }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Remove">×</button>
                </div>
              ) : <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No file selected</span>}
            </div>
          </div>

          {mode === 'live' && (
            <>
              <div style={sectionHeader}>Live Model</div>
              <div style={{ marginBottom: 20 }}>
                <label style={fieldLabel}>Frequency of Retraining</label>
                <select value={localCfg.retrain_frequency} onChange={e => patchCfg({ retrain_frequency: e.target.value })} style={{ ...fieldStyle, cursor: 'pointer', maxWidth: 240 }}>
                  <option value="">— Select frequency —</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '1px solid #f0f6fa', marginTop: 8 }}>
            {uploadStatus === 'uploading' && (
              <span style={{ fontSize: 11, color: '#009FDF' }}>Uploading model file…</span>
            )}
            {uploadStatus === 'done' && (
              <span style={{ fontSize: 11, color: '#059669' }}>✓ Model file uploaded to registry</span>
            )}
            {uploadStatus === 'error' && (
              <span style={{ fontSize: 11, color: '#dc2626', maxWidth: 400, wordBreak: 'break-word' }}>
                Upload failed: {uploadError || 'Unknown error'}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={uploadStatus === 'uploading'}
              style={{ padding: '8px 28px', borderRadius: 6, border: 'none', background: uploadStatus === 'uploading' ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #dce8f0', borderRadius: 8, background: '#f9fafb' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '0 24px' }}>
            {sorted.length === 0
              ? 'No models configured. Define models in Blueprint Manager → Models tab first.'
              : 'Complete topology setup to generate submodels.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function ModelBlueprintManager({ instanceId }: { instanceId: string }) {
  const models = useAtomValue(modelsAtom)
  const [aliasToId, setAliasToId] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    getModelRegistry(instanceId).then(res => {
      if (res.success && res.data) {
        setAliasToId(new Map(res.data.map((r: ModelRegistryEntry) => [r.model_alias, r.model_id])))
      }
    })
  }, [instanceId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
      <div style={{ marginBottom: 12, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Model Blueprint Manager</h2>
        <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Configure offline / live mode, feature attributes, target variable, and full training config per submodel.</p>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', padding: 20 }}>
        <ModelsConfigTab models={models} aliasToId={aliasToId} instanceId={instanceId} />
      </div>
    </div>
  )
}
