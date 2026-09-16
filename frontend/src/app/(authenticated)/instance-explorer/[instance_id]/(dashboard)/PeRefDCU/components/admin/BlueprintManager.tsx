'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  tagMappingsAtom, setTagMappingsAtom,
  wizardQuestionsAtom,
  multipliedAttributesAtom,
  odsRulesAtom, setOdsRulesAtom,
  modelsAtom, setModelsAtom,
  valueMapAtom,
  modelParametersBlueprintAtom,
  equipmentAtom,
  clientIdAtom,
  topologyTreeAtom,
  hydrateConfigAtom,
} from '../../store/dcuAtoms'
import { flattenTree } from '../../utils/outputGenerator'
import {
  saveTagMappings, saveModelParametersBlueprint, saveValueMappings,
  saveWizardQuestions, saveMultipliedAttributes,
  saveOdsRules, saveModels, loadSubmittedConfigFromDb,
} from '../../actions/actions'
import type {
  ModelTagMapping, AttributeSipPolicy, OdsRule, ModelEntry,
  ModelParameterWithIds,
} from '../../types'
import AttributeMappingsTab from './tabs/AttributeMappingsTab'
import ModelParametersTab from './tabs/ModelParametersTab'
import { ValueMappingsTab } from './tabs/ValueMappingsTab'
import WizardQueriesTab from './tabs/WizardQueriesTab'
import MultipliedAttributesTab from './tabs/MultipliedAttributesTab'
import OdsRulesTab from './tabs/OdsRulesTab'
import ModelsTab from './tabs/ModelsTab'

// Attribute naming rules: must start with a letter, only [a-zA-Z0-9_], no consecutive underscores
function sanitizeAttributeName(value: string): string {
  let v = value.replace(/[^a-zA-Z0-9_]/g, '')   // strip disallowed chars
  v = v.replace(/^[^a-zA-Z]+/, '')               // must start with a letter
  v = v.replace(/__+/g, '_')                     // collapse consecutive underscores
  return v
}

interface ConfirmDialog {
  type: 'add' | 'edit' | 'delete'
  title: string
  message: string
  onConfirm: () => void
}

interface BlueprintManagerProps {
  instanceId?: string
}

export default function BlueprintManager({ instanceId = '' }: BlueprintManagerProps) {
  // ─── Jotai atoms ─────────────────────────────────────────────────────────────
  const tagMappings = useAtomValue(tagMappingsAtom)
  const setLocalMappings = useSetAtom(setTagMappingsAtom)
  const localMappings = tagMappings

  const wizardQuestions = useAtomValue(wizardQuestionsAtom)
  const multipliedAttributes = useAtomValue(multipliedAttributesAtom)
  const odsRules = useAtomValue(odsRulesAtom)
  const setOdsRules = useSetAtom(setOdsRulesAtom)
  const models = useAtomValue(modelsAtom)
  const setModels = useSetAtom(setModelsAtom)
  const valueMap = useAtomValue(valueMapAtom)
  const modelParametersBlueprint = useAtomValue(modelParametersBlueprintAtom)
  const equipment = useAtomValue(equipmentAtom)
  const clientId = useAtomValue(clientIdAtom)
  const topologyTree = useAtomValue(topologyTreeAtom)
  const setHydrateConfig = useSetAtom(hydrateConfigAtom)

  // ─── Config loading state ──────────────────────────────────────────────────────
  const [configLoading, setConfigLoading] = useState(true)
  const [loadedClientId, setLoadedClientId] = useState<string>('')

  useEffect(() => {
    async function fetchEquipment() {
      try {
        if (!instanceId) return

        // If equipment already loaded (wizard session), just record which client
        const isEqLoaded = equipment.furnaces.length > 0 || equipment.drumTrains.length > 0 || equipment.fractionators.length > 0
        if (isEqLoaded) { setLoadedClientId(clientId); return }

        const res = await loadSubmittedConfigFromDb(instanceId)
        const config = res.data?.config
        if (!config) return // nothing submitted yet for this instance

        const eq = config.equipment
        const hasData = (eq.furnaces?.length ?? 0) > 0 || (eq.drumTrains?.length ?? 0) > 0 || (eq.fractionators?.length ?? 0) > 0
        if (hasData) {
          setHydrateConfig(config)
          setLoadedClientId(config.clientId)
        }
      } catch { /* silently ignore — BM still usable without topology */ }
      finally { setConfigLoading(false) }
    }
    fetchEquipment()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'attributes' | 'parameters' | 'valuemappings' | 'queries' | 'multiplied' | 'ods' | 'models'>('attributes')

  // ─── Local state for model parameters ────────────────────────────────────────
  const [localParameters, setLocalParameters] = useState<ModelParameterWithIds[]>(() => [...modelParametersBlueprint])

  // ─── Local UOM bank ───────────────────────────────────────────────────────────

  // Model Parameters search and sort
  const [paramSearchTerm, setParamSearchTerm] = useState('')
  const [paramSortBy, setParamSortBy] = useState<'parameter' | 'value' | 'models'>('parameter')
  const [paramSortOrder, setParamSortOrder] = useState<'asc' | 'desc'>('asc')

  // Model Parameters add form
  const [showAddParamForm, setShowAddParamForm] = useState(false)
  const [newParamName, setNewParamName] = useState('')
  const [newParamDisplayName, setNewParamDisplayName] = useState('')
  const [newParamValue, setNewParamValue] = useState('')
  const [newParamDesc, setNewParamDesc] = useState('')
  const [newParamModelIds, setNewParamModelIds] = useState<number[]>([])

  // Model Parameters edit form
  const [editingParamKey, setEditingParamKey] = useState<string | null>(null)
  const [editParamName, setEditParamName] = useState('')
  const [editParamDisplayName, setEditParamDisplayName] = useState('')
  const [editParamValue, setEditParamValue] = useState('')
  const [editParamDesc, setEditParamDesc] = useState('')
  const [editParamModelIds, setEditParamModelIds] = useState<number[]>([])

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLevel, setNewLevel] = useState('')
  const [newAttribute, setNewAttribute] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newModelIds, setNewModelIds] = useState<number[]>([])
  const [newType, setNewType] = useState('')
  const [newUomCategory, setNewUomCategory] = useState('')
  const [newDefaultUom, setNewDefaultUom] = useState('')
  const [newDataType, setNewDataType] = useState<'continuous' | 'discrete' | ''>('')
  const [newExpression, setNewExpression] = useState('')
  const [newFlagMa, setNewFlagMa] = useState(false)
  const [newSipPolicies, setNewSipPolicies] = useState<AttributeSipPolicy[]>([])

  // Edit form state
  const [editingKey, setEditingKey] = useState<{ level: string; attribute: string } | null>(null)
  const [editLevel, setEditLevel] = useState('')
  const [editAttribute, setEditAttribute] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editModelIds, setEditModelIds] = useState<number[]>([])
  const [editType, setEditType] = useState('')
  const [editUomCategory, setEditUomCategory] = useState('')
  const [editDefaultUom, setEditDefaultUom] = useState('')
  const [editDataType, setEditDataType] = useState<'continuous' | 'discrete' | ''>('')
  const [editExpression, setEditExpression] = useState('')
  const [editFlagMa, setEditFlagMa] = useState(false)
  const [editSipPolicies, setEditSipPolicies] = useState<AttributeSipPolicy[]>([])

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  // Save status state
  const [saveStatus, setSaveStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })

  // ODS Rules add form
  const [showAddOdsForm, setShowAddOdsForm] = useState(false)
  const [newOdsModelId, setNewOdsModelId] = useState<number | ''>('')
  const [newOdsCauseTag, setNewOdsCauseTag] = useState('')
  const [newOdsEffectTag, setNewOdsEffectTag] = useState('')
  const [newOdsCauseMonTag, setNewOdsCauseMonTag] = useState('')
  const [newOdsEffectMonTag, setNewOdsEffectMonTag] = useState('')
  const [newOdsMessage, setNewOdsMessage] = useState('')
  const [newOdsTolerance, setNewOdsTolerance] = useState('')

  // ODS Rules edit form
  const [editingOdsId, setEditingOdsId] = useState<string | null>(null)
  const [editOdsModelId, setEditOdsModelId] = useState<number | ''>('')
  const [editOdsCauseTag, setEditOdsCauseTag] = useState('')
  const [editOdsEffectTag, setEditOdsEffectTag] = useState('')
  const [editOdsCauseMonTag, setEditOdsCauseMonTag] = useState('')
  const [editOdsEffectMonTag, setEditOdsEffectMonTag] = useState('')
  const [editOdsMessage, setEditOdsMessage] = useState('')
  const [editOdsTolerance, setEditOdsTolerance] = useState('')

  // Search, filter and sort state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'level' | 'attribute' | 'models'>('level')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [modelFilter, setModelFilter] = useState<number[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [dataTypeFilter, setDataTypeFilter] = useState<string[]>([])
  const [levelFilter, setLevelFilter] = useState<string[]>([])

  // Sorted and filtered mappings for display
  const sortedMappings = useMemo(() => {
    let filtered = localMappings.filter(m => {
      const matchesSearch = m.attribute.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesModel = modelFilter.length === 0 || modelFilter.some(id => m.model_ids.includes(id))
      const matchesType = typeFilter.length === 0 || typeFilter.includes(m.type || '')
      const matchesDataType = dataTypeFilter.length === 0 || (m.data_type && dataTypeFilter.includes(m.data_type))
      const matchesLevel = levelFilter.length === 0 || levelFilter.includes(m.level)
      return matchesSearch && matchesModel && matchesType && matchesDataType && matchesLevel
    })

    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'level') {
        comparison = a.level.localeCompare(b.level)
        if (comparison === 0) comparison = a.attribute.localeCompare(b.attribute)
      } else if (sortBy === 'attribute') {
        comparison = a.attribute.localeCompare(b.attribute)
      } else if (sortBy === 'models') {
        comparison = a.model_ids.length - b.model_ids.length
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [localMappings, searchTerm, sortBy, sortOrder, modelFilter, typeFilter, dataTypeFilter, levelFilter])

  // Get model display names from ids
  const getModelNames = (modelIds: number[]): string => {
    return modelIds.map(id => models.find(m => m.model_id === id)?.model_alias || `ID ${id}`).join(', ')
  }

  // Toggle sort for a column
  const handleSort = (column: 'level' | 'attribute' | 'models') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Get sort indicator icon
  const SortIcon = ({ column }: { column: 'level' | 'attribute' | 'models' }) => {
    if (sortBy !== column) return <span className="opacity-30">⇅</span>
    return sortOrder === 'asc' ? <>↑</> : <>↓</>
  }

  // ─── Model Parameters helpers ─────────────────────────────────────────────────

  const sortedParameters = useMemo(() => {
    let filtered = localParameters.filter(p =>
      p.parameter.toLowerCase().includes(paramSearchTerm.toLowerCase())
    )

    filtered.sort((a, b) => {
      let comparison = 0
      if (paramSortBy === 'parameter') {
        comparison = a.parameter.localeCompare(b.parameter)
      } else if (paramSortBy === 'value') {
        comparison = a.value.localeCompare(b.value)
      } else if (paramSortBy === 'models') {
        comparison = a.model_ids.length - b.model_ids.length
      }
      return paramSortOrder === 'asc' ? comparison : -comparison
    })
    return filtered
  }, [localParameters, paramSearchTerm, paramSortBy, paramSortOrder])

  const handleParamSort = (column: 'parameter' | 'value' | 'models') => {
    if (paramSortBy === column) {
      setParamSortOrder(paramSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setParamSortBy(column)
      setParamSortOrder('asc')
    }
  }

  const ParamSortIcon = ({ column }: { column: 'parameter' | 'value' | 'models' }) => {
    if (paramSortBy !== column) return <span className="opacity-30">⇅</span>
    return paramSortOrder === 'asc' ? <>↑</> : <>↓</>
  }

  const isParamDuplicate = !!(newParamName && sortedParameters.some(p => p.parameter === newParamName))
  const isEditParamDuplicate = !!(editParamName && editingParamKey &&
    sortedParameters.some(p => p.parameter === editParamName && p.parameter !== editingParamKey))
  const canAddParam = !!(newParamName && newParamValue && newParamModelIds.length > 0 && !isParamDuplicate)
  const canSaveParamEdit = !!(editParamName && editParamValue && editParamModelIds.length > 0 && !isEditParamDuplicate)

  const startEditParam = (param: ModelParameterWithIds) => {
    setEditingParamKey(param.parameter)
    setEditParamName(param.parameter)
    setEditParamDisplayName(param.display_name)
    setEditParamValue(param.value)
    setEditParamDesc(param.description)
    setEditParamModelIds([...param.model_ids])
  }

  const cancelEditParam = () => {
    setEditingParamKey(null)
    setEditParamName('')
    setEditParamDisplayName('')
    setEditParamValue('')
    setEditParamDesc('')
    setEditParamModelIds([])
  }

  const toggleModelInEditParamForm = (modelId: number) => {
    setEditParamModelIds(ids =>
      ids.includes(modelId) ? ids.filter(id => id !== modelId) : [...ids, modelId]
    )
  }

  const toggleModelInAddParamForm = (modelId: number) => {
    setNewParamModelIds(ids =>
      ids.includes(modelId) ? ids.filter(id => id !== modelId) : [...ids, modelId]
    )
  }

  const handleAddParamWithConfirm = () => {
    if (!canAddParam) return
    setConfirmDialog({
      type: 'add',
      title: 'Confirm Add Parameter',
      message: `Add new parameter: ${newParamName} = ${newParamValue} (${getModelNames(newParamModelIds)})?`,
      onConfirm: () => {
        setLocalParameters([
          ...localParameters,
          {
            parameter: newParamName,
            display_name: newParamDisplayName,
            value: newParamValue,
            description: newParamDesc,
            model_ids: newParamModelIds,
          },
        ])
        setNewParamName('')
        setNewParamDisplayName('')
        setNewParamValue('')
        setNewParamDesc('')
        setNewParamModelIds([])
        setShowAddParamForm(false)
        setConfirmDialog(null)
      },
    })
  }

  const handleSaveParamEditWithConfirm = () => {
    if (!canSaveParamEdit || !editingParamKey) return
    setConfirmDialog({
      type: 'edit',
      title: 'Confirm Edit Parameter',
      message: `Save changes to ${editParamName}?`,
      onConfirm: () => {
        setLocalParameters(localParameters.map(p =>
          p.parameter === editingParamKey
            ? {
                parameter: editParamName,
                display_name: editParamDisplayName,
                value: editParamValue,
                description: editParamDesc,
                model_ids: editParamModelIds,
              }
            : p
        ))
        cancelEditParam()
        setConfirmDialog(null)
      },
    })
  }

  const handleDeleteParamWithConfirm = (paramName: string) => {
    setConfirmDialog({
      type: 'delete',
      title: 'Confirm Delete Parameter',
      message: `Delete parameter "${paramName}"? This cannot be undone.`,
      onConfirm: () => {
        setLocalParameters(localParameters.filter(p => p.parameter !== paramName))
        setConfirmDialog(null)
      },
    })
  }

  const handleAddMappingWithConfirm = () => {
    if (!newLevel || !newAttribute || newModelIds.length === 0) return
    setConfirmDialog({
      type: 'add',
      title: 'Confirm Add Mapping',
      message: `Add new mapping: ${newLevel} → ${newAttribute} (${getModelNames(newModelIds)})?`,
      onConfirm: () => {
        const newMapping: ModelTagMapping = {
          model_ids: [...newModelIds].sort((a, b) => a - b),
          level: newLevel,
          attribute: newAttribute,
          display_name: newDisplayName || undefined,
          type: newType || undefined,
          uom_category: newUomCategory || undefined,
          default_uom: newDefaultUom || undefined,
          data_type: newDataType as 'continuous' | 'discrete' | undefined,
          expression: newExpression || undefined,
          flag_ma: newFlagMa || undefined,
          sip_policies: newSipPolicies.length ? newSipPolicies : undefined,
        }
        setLocalMappings(s => {
          const idx = s.findIndex(e => e.level === newMapping.level && e.attribute === newMapping.attribute)
          if (idx === -1) {
            return [...s, newMapping]
          } else {
            const merged = [...new Set([...s[idx].model_ids, ...newMapping.model_ids])]
            return s.map((m, i) => i === idx ? { ...m, model_ids: merged } : m)
          }
        })
        setNewLevel('')
        setNewAttribute('')
        setNewDisplayName('')
        setNewModelIds([])
        setNewUomCategory('')
        setNewDefaultUom('')
        setNewType('')
        setNewDataType('')
        setNewExpression('')
        setNewFlagMa(false)
        setNewSipPolicies([])
        setShowAddForm(false)
        setConfirmDialog(null)
      },
    })
  }

  const toggleModelInForm = (modelId: number) => {
    setNewModelIds(ids =>
      ids.includes(modelId)
        ? ids.filter(id => id !== modelId)
        : [...ids, modelId].sort((a, b) => a - b)
    )
  }

  const toggleModelInEditForm = (modelId: number) => {
    setEditModelIds(ids =>
      ids.includes(modelId)
        ? ids.filter(id => id !== modelId)
        : [...ids, modelId].sort((a, b) => a - b)
    )
  }

  const startEdit = (mapping: ModelTagMapping) => {
    setEditingKey({ level: mapping.level, attribute: mapping.attribute })
    setEditLevel(mapping.level)
    setEditAttribute(mapping.attribute)
    setEditDisplayName(mapping.display_name || '')
    setEditModelIds([...mapping.model_ids])
    setEditUomCategory(mapping.uom_category || '')
    setEditDefaultUom(mapping.default_uom || '')
    setEditType(mapping.type || '')
    setEditDataType(mapping.data_type || '')
    setEditExpression(mapping.expression || '')
    setEditFlagMa(mapping.flag_ma ?? false)
    setEditSipPolicies(mapping.sip_policies || [])
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditLevel('')
    setEditAttribute('')
    setEditDisplayName('')
    setEditModelIds([])
    setEditUomCategory('')
    setEditDefaultUom('')
    setEditType('')
    setEditDataType('')
    setEditExpression('')
    setEditFlagMa(false)
    setEditSipPolicies([])
  }

  const toggleAddForm = (show: boolean) => {
    if (!show) {
      setNewLevel('')
      setNewAttribute('')
      setNewDisplayName('')
      setNewModelIds([])
      setNewType('')
      setNewUomCategory('')
      setNewDefaultUom('')
      setNewDataType('')
      setNewExpression('')
      setNewFlagMa(false)
      setNewSipPolicies([])
    }
    setShowAddForm(show)
  }

  const handleSaveEditWithConfirm = () => {
    if (!editLevel || !editAttribute || editModelIds.length === 0 || !editingKey) return
    setConfirmDialog({
      type: 'edit',
      title: 'Confirm Edit Mapping',
      message: `Update mapping to: ${editLevel} → ${editAttribute} (${getModelNames(editModelIds)})?`,
      onConfirm: () => {
        setLocalMappings(s => {
          let updated = s.filter(m => !(m.level === editingKey.level && m.attribute === editingKey.attribute))
          const idx = updated.findIndex(e => e.level === editLevel && e.attribute === editAttribute)
          const updatedMapping: ModelTagMapping = {
            model_ids: [...editModelIds].sort((a, b) => a - b),
            level: editLevel,
            attribute: editAttribute,
            display_name: editDisplayName || undefined,
            type: editType || undefined,
            uom_category: editUomCategory || undefined,
            default_uom: editDefaultUom || undefined,
            data_type: editDataType as 'continuous' | 'discrete' | undefined,
            expression: editExpression || undefined,
            flag_ma: editFlagMa || undefined,
            sip_policies: editSipPolicies.length ? editSipPolicies : undefined,
          }
          if (idx === -1) {
            updated.push(updatedMapping)
          } else {
            const merged = [...new Set([...updated[idx].model_ids, ...updatedMapping.model_ids])]
            updated[idx] = { ...updated[idx], model_ids: merged }
          }
          return updated
        })
        cancelEdit()
        setConfirmDialog(null)
      },
    })
  }

  const handleDeleteWithConfirm = (level: string, attribute: string) => {
    setConfirmDialog({
      type: 'delete',
      title: 'Confirm Delete Mapping',
      message: `Delete mapping: ${level} → ${attribute}?`,
      onConfirm: () => {
        setLocalMappings(s => s.filter(m => !(m.level === level && m.attribute === attribute)))
        setConfirmDialog(null)
      },
    })
  }

  const isDuplicate = !!(newLevel && newAttribute && sortedMappings.some(m => m.level === newLevel && m.attribute === newAttribute))
  const isEditDuplicate = !!(editLevel && editAttribute && editingKey &&
    sortedMappings.some(m => m.level === editLevel && m.attribute === editAttribute && !(m.level === editingKey.level && m.attribute === editingKey.attribute)))
  const canAdd = !!(newLevel && newAttribute && newType && newModelIds.length > 0 && newDataType && !isDuplicate)
  const canSaveEdit = !!(editLevel && editAttribute && editType && editModelIds.length > 0 && editDataType && !isEditDuplicate)

  // ─── ODS Rules handlers ───────────────────────────────────────────────────────
  const canAddOds = newOdsModelId !== '' && !!newOdsCauseTag && !!newOdsEffectTag
  const canSaveOdsEdit = editOdsModelId !== '' && !!editOdsCauseTag && !!editOdsEffectTag

  const handleAddOdsRule = () => {
    if (!canAddOds) return
    const rule: OdsRule = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      model_id: newOdsModelId as number,
      cause_tag: newOdsCauseTag,
      effect_tag: newOdsEffectTag,
      cause_monitoring_tag: newOdsCauseMonTag,
      effect_monitoring_tag: newOdsEffectMonTag,
      message: newOdsMessage,
      actionable_tolerance: newOdsTolerance !== '' ? Number(newOdsTolerance) : null,
    }
    setOdsRules(prev => [...prev, rule])
    setShowAddOdsForm(false)
    setNewOdsModelId('')
    setNewOdsCauseTag('')
    setNewOdsEffectTag('')
    setNewOdsCauseMonTag('')
    setNewOdsEffectMonTag('')
    setNewOdsMessage('')
    setNewOdsTolerance('')
  }

  const handleEditOds = (rule: OdsRule) => {
    setEditingOdsId(rule.id)
    setEditOdsModelId(rule.model_id)
    setEditOdsCauseTag(rule.cause_tag)
    setEditOdsEffectTag(rule.effect_tag)
    setEditOdsCauseMonTag(rule.cause_monitoring_tag)
    setEditOdsEffectMonTag(rule.effect_monitoring_tag)
    setEditOdsMessage(rule.message)
    setEditOdsTolerance(rule.actionable_tolerance !== null ? String(rule.actionable_tolerance) : '')
  }

  const handleSaveOdsEdit = () => {
    if (!canSaveOdsEdit || !editingOdsId) return
    setOdsRules(prev => prev.map(r => r.id !== editingOdsId ? r : {
      ...r,
      model_id: editOdsModelId as number,
      cause_tag: editOdsCauseTag,
      effect_tag: editOdsEffectTag,
      cause_monitoring_tag: editOdsCauseMonTag,
      effect_monitoring_tag: editOdsEffectMonTag,
      message: editOdsMessage,
      actionable_tolerance: editOdsTolerance !== '' ? Number(editOdsTolerance) : null,
    }))
    setEditingOdsId(null)
  }

  const handleCancelOdsEdit = () => setEditingOdsId(null)

  const handleDeleteOds = (id: string) => {
    setOdsRules(prev => prev.filter(r => r.id !== id))
  }

  // ─── Save to file via Server Actions ─────────────────────────────────────────
  const handleSaveToFile = async () => {
    setSaveStatus({ type: 'saving', message: 'Saving to file...' })
    try {
      let result: { success: boolean; error?: string; data?: unknown }

      if (activeTab === 'attributes') {
        result = await saveTagMappings(localMappings)
      } else if (activeTab === 'parameters') {
        result = await saveModelParametersBlueprint(localParameters)
      } else if (activeTab === 'valuemappings') {
        result = await saveValueMappings(valueMap)
      } else if (activeTab === 'queries') {
        result = await saveWizardQuestions(wizardQuestions)
      } else if (activeTab === 'multiplied') {
        result = await saveMultipliedAttributes(multipliedAttributes)
      } else if (activeTab === 'ods') {
        result = await saveOdsRules(odsRules)
      } else {
        // models tab
        const isEqEmpty = equipment.furnaces.length === 0 && equipment.drumTrains.length === 0 && equipment.fractionators.length === 0
        const allNodes = isEqEmpty ? [] : flattenTree(topologyTree)
        const byLevel = new Map<string, typeof allNodes>()
        allNodes.forEach(n => { if (!byLevel.has(n.level)) byLevel.set(n.level, []); byLevel.get(n.level)!.push(n) })
        let seq = 1
        const withSubs = [...models].sort((a, b) => a.model_id - b.model_id).map(m => {
          const prefix = m.model_alias.toLowerCase().replace(/\s+/g, '_')
          let sub_models
          if (!m.model_level) {
            const existingSub = m.sub_models?.[0]
            sub_models = [{
              sub_model_id: seq++,
              sub_model_name: prefix,
              ...(existingSub?.attributes?.length ? { attributes: existingSub.attributes } : {}),
              ...(existingSub?.target_variable ? { target_variable: existingSub.target_variable } : {}),
            }]
          } else if (isEqEmpty) {
            const existing = m.sub_models?.length ? m.sub_models : []
            sub_models = existing.map(s => ({ ...s, sub_model_id: seq++ }))
          } else {
            sub_models = (byLevel.get(m.model_level) ?? []).map(n => {
              const smName = prefix + '_' + n.path.replace(/\//g, '_').toLowerCase()
              const storedSub = m.sub_models?.find(s => s.sub_model_name === smName)
              return {
                sub_model_id: seq++,
                sub_model_name: smName,
                ...(storedSub?.attributes?.length ? { attributes: storedSub.attributes } : {}),
                ...(storedSub?.feature_selection?.length ? { feature_selection: storedSub.feature_selection } : {}),
                ...(storedSub?.training_config ? { training_config: storedSub.training_config } : {}),
                ...(storedSub?.target_variable ? { target_variable: storedSub.target_variable } : {}),
                ...(storedSub?.cumulative_attributes?.length ? { cumulative_attributes: storedSub.cumulative_attributes } : {}),
                ...(storedSub?.model_skip_attributes?.length ? { model_skip_attributes: storedSub.model_skip_attributes } : {}),
              }
            })
          }
          return { ...m, sub_models }
        })
        result = await saveModels(withSubs)
      }

      if (result.success) {
        setSaveStatus({ type: 'success', message: 'Saved successfully' })
        setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 6000)
      } else {
        setSaveStatus({ type: 'error', message: `Error: ${result.error ?? 'Unknown error'}` })
      }
    } catch (err) {
      console.error('Save error:', err)
      setSaveStatus({ type: 'error', message: 'Failed to save' })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-0">
      {configLoading && (
        <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md mb-2 text-xs text-blue-700 shrink-0">
          Loading configuration…
        </div>
      )}

      {/* Header */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-accent-blue m-0">Blueprint Manager</h2>
            <p className="text-xs text-text-secondary mt-1">
              Manage tag mapping blueprints. Define which attributes appear on which topology levels for each model.
            </p>
            {loadedClientId && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold text-text-secondary">Topology source:</span>
                <span className="text-xs text-text-primary">{loadedClientId}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-green/20 text-accent-green border border-accent-green/40">
                  loaded
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleSaveToFile}
            disabled={saveStatus.type === 'saving'}
            className={`px-4 py-2 text-xs font-semibold rounded-md border-none bg-accent-blue text-white whitespace-nowrap ml-4 cursor-pointer ${saveStatus.type === 'saving' ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {saveStatus.type === 'saving' ? 'Saving...' :
              activeTab === 'attributes' ? 'Save Attributes' :
              activeTab === 'parameters' ? 'Save Parameters' :
              activeTab === 'valuemappings' ? 'Save Value Mappings' :
              activeTab === 'queries' ? 'Save Queries' :
              activeTab === 'multiplied' ? 'Save Multiplied Attrs' :
              activeTab === 'ods' ? 'Save ODS Rules' :
              'Save Models'}
          </button>
        </div>
      </div>

      {/* Combined card: tab row + content */}
      <div className="bg-background rounded-xl border-[1.5px] border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Tab row */}
        <div className="flex bg-surface border-b border-border shrink-0 overflow-x-auto">
          {([
            { id: 'attributes',    label: 'Attribute Tags Mappings', count: localMappings.length },
            { id: 'parameters',    label: 'Model Configuration',     count: localParameters.length },
            { id: 'valuemappings', label: 'Value Mappings',          count: null },
            { id: 'queries',       label: 'Wizard Queries',          count: wizardQuestions.length },
            { id: 'multiplied',    label: 'Multiplied Attributes',   count: multipliedAttributes.length },
            { id: 'ods',           label: 'ODS Rules',               count: odsRules.length },
            { id: 'models',        label: 'Models',                  count: models.length },
          ] as const).map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-[18px] py-[11px] text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 border-t-0 border-l-0 border-r-0 cursor-pointer font-inherit outline-none transition-colors -mb-px ${
                  isActive
                    ? 'text-accent-blue bg-background border-b-2 border-accent-blue'
                    : 'text-text-secondary bg-transparent border-b-2 border-transparent hover:text-text-primary'
                }`}
              >
                {tab.label}
                {tab.count != null && (
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
                    isActive ? 'bg-accent-blue text-white' : 'bg-border text-text-primary'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col">
          {activeTab === 'attributes' && (
            <AttributeMappingsTab
              sortedMappings={sortedMappings}
              allMappings={localMappings}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              SortIcon={SortIcon}
              getModelNames={getModelNames}
              modelFilter={modelFilter}
              onModelFilterChange={setModelFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              dataTypeFilter={dataTypeFilter}
              onDataTypeFilterChange={setDataTypeFilter}
              levelFilter={levelFilter}
              onLevelFilterChange={setLevelFilter}
              onEdit={startEdit}
              onDelete={handleDeleteWithConfirm}
              isEditing={!!editingKey}
              editingKey={editingKey}
              editLevel={editLevel}
              onEditLevelChange={setEditLevel}
              editAttribute={editAttribute}
              onEditAttributeChange={v => setEditAttribute(sanitizeAttributeName(v))}
              editDisplayName={editDisplayName}
              onEditDisplayNameChange={setEditDisplayName}
              editModelIds={editModelIds}
              onToggleEditModel={toggleModelInEditForm}
              editUomCategory={editUomCategory}
              onEditUomCategoryChange={(val) => { setEditUomCategory(val); if (val !== editUomCategory) setEditDefaultUom('') }}
              editDefaultUom={editDefaultUom}
              onEditDefaultUomChange={setEditDefaultUom}
              editType={editType}
              onEditTypeChange={setEditType}
              editDataType={editDataType}
              onEditDataTypeChange={(val) => setEditDataType(val as 'continuous' | 'discrete' | '')}
              editExpression={editExpression}
              onEditExpressionChange={setEditExpression}
              editFlagMa={editFlagMa}
              onEditFlagMaChange={setEditFlagMa}
              editSipPolicies={editSipPolicies}
              onEditSipPoliciesChange={setEditSipPolicies}
              isEditDuplicate={isEditDuplicate}
              canSaveEdit={canSaveEdit}
              onSaveEdit={handleSaveEditWithConfirm}
              onCancelEdit={cancelEdit}
              isAddingForm={showAddForm}
              onToggleAddForm={toggleAddForm}
              newLevel={newLevel}
              onNewLevelChange={setNewLevel}
              newAttribute={newAttribute}
              onNewAttributeChange={v => setNewAttribute(sanitizeAttributeName(v))}
              newDisplayName={newDisplayName}
              onNewDisplayNameChange={setNewDisplayName}
              newModelIds={newModelIds}
              onToggleNewModel={toggleModelInForm}
              newUomCategory={newUomCategory}
              onNewUomCategoryChange={(val) => { setNewUomCategory(val); if (val !== newUomCategory) setNewDefaultUom('') }}
              newDefaultUom={newDefaultUom}
              onNewDefaultUomChange={setNewDefaultUom}
              newType={newType}
              onNewTypeChange={setNewType}
              newDataType={newDataType}
              onNewDataTypeChange={(val) => setNewDataType(val as 'continuous' | 'discrete' | '')}
              newExpression={newExpression}
              onNewExpressionChange={setNewExpression}
              newFlagMa={newFlagMa}
              onNewFlagMaChange={setNewFlagMa}
              newSipPolicies={newSipPolicies}
              onNewSipPoliciesChange={setNewSipPolicies}
              allModels={models}
              isDuplicate={isDuplicate}
              canAdd={canAdd}
              onAddMapping={handleAddMappingWithConfirm}
            />
          )}

          {activeTab === 'parameters' && (
            <ModelParametersTab
              sortedParameters={sortedParameters}
              searchTerm={paramSearchTerm}
              onSearchChange={setParamSearchTerm}
              sortBy={paramSortBy}
              sortOrder={paramSortOrder}
              onSort={handleParamSort}
              SortIcon={ParamSortIcon}
              getModelNames={getModelNames}
              onEdit={startEditParam}
              onDelete={handleDeleteParamWithConfirm}
              isEditing={!!editingParamKey}
              editingParamKey={editingParamKey}
              editParamName={editParamName}
              onEditParamNameChange={setEditParamName}
              editParamDisplayName={editParamDisplayName}
              onEditParamDisplayNameChange={setEditParamDisplayName}
              editParamValue={editParamValue}
              onEditParamValueChange={setEditParamValue}
              editParamDesc={editParamDesc}
              onEditParamDescChange={setEditParamDesc}
              editParamModelIds={editParamModelIds}
              onToggleEditParamModel={toggleModelInEditParamForm}
              isEditParamDuplicate={isEditParamDuplicate}
              canSaveParamEdit={!!canSaveParamEdit}
              onSaveParamEdit={handleSaveParamEditWithConfirm}
              onCancelParamEdit={cancelEditParam}
              isAddingParamForm={showAddParamForm}
              onToggleAddParamForm={setShowAddParamForm}
              newParamName={newParamName}
              onNewParamNameChange={setNewParamName}
              newParamDisplayName={newParamDisplayName}
              onNewParamDisplayNameChange={setNewParamDisplayName}
              newParamValue={newParamValue}
              onNewParamValueChange={setNewParamValue}
              newParamDesc={newParamDesc}
              onNewParamDescChange={setNewParamDesc}
              newParamModelIds={newParamModelIds}
              onToggleNewParamModel={toggleModelInAddParamForm}
              isParamDuplicate={isParamDuplicate}
              canAddParam={canAddParam}
              onAddParam={handleAddParamWithConfirm}
            />
          )}

          {activeTab === 'valuemappings' && (
            <ValueMappingsTab />
          )}

          {activeTab === 'queries' && (
            <WizardQueriesTab />
          )}

          {activeTab === 'multiplied' && (
            <MultipliedAttributesTab />
          )}

          {activeTab === 'ods' && (
            <OdsRulesTab
              rules={odsRules}
              tagMappings={tagMappings}
              isAddingForm={showAddOdsForm}
              onToggleAddForm={setShowAddOdsForm}
              newModelId={newOdsModelId}
              onNewModelIdChange={setNewOdsModelId}
              newCauseTag={newOdsCauseTag}
              onNewCauseTagChange={setNewOdsCauseTag}
              newEffectTag={newOdsEffectTag}
              onNewEffectTagChange={setNewOdsEffectTag}
              newCauseMonTag={newOdsCauseMonTag}
              onNewCauseMonTagChange={setNewOdsCauseMonTag}
              newEffectMonTag={newOdsEffectMonTag}
              onNewEffectMonTagChange={setNewOdsEffectMonTag}
              newMessage={newOdsMessage}
              onNewMessageChange={setNewOdsMessage}
              newTolerance={newOdsTolerance}
              onNewToleranceChange={setNewOdsTolerance}
              canAdd={canAddOds}
              onAddRule={handleAddOdsRule}
              isEditing={editingOdsId !== null}
              editingId={editingOdsId}
              editModelId={editOdsModelId}
              onEditModelIdChange={setEditOdsModelId}
              editCauseTag={editOdsCauseTag}
              onEditCauseTagChange={setEditOdsCauseTag}
              editEffectTag={editOdsEffectTag}
              onEditEffectTagChange={setEditOdsEffectTag}
              editCauseMonTag={editOdsCauseMonTag}
              onEditCauseMonTagChange={setEditOdsCauseMonTag}
              editEffectMonTag={editOdsEffectMonTag}
              onEditEffectMonTagChange={setEditOdsEffectMonTag}
              editMessage={editOdsMessage}
              onEditMessageChange={setEditOdsMessage}
              editTolerance={editOdsTolerance}
              onEditToleranceChange={setEditOdsTolerance}
              canSaveEdit={canSaveOdsEdit}
              onSaveEdit={handleSaveOdsEdit}
              onCancelEdit={handleCancelOdsEdit}
              onEdit={handleEditOds}
              onDelete={handleDeleteOds}
            />
          )}

          {activeTab === 'models' && (
            <ModelsTab
              models={models}
              onAdd={(entry: ModelEntry) => setModels(prev => [...prev, entry])}
              onEdit={(entry: ModelEntry) => setModels(prev => prev.map(m => m.id === entry.id ? entry : m))}
              onDelete={(id: string) => setModels(prev => prev.filter(m => m.id !== id))}
            />
          )}

          {/* Confirmation Dialog Modal */}
          {confirmDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
              <div className="bg-background rounded-lg p-5 max-w-sm shadow-lg border border-border">
                <h3 className="text-sm font-bold text-accent-blue mt-0 mb-3">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-text-secondary mb-5 leading-relaxed">
                  {confirmDialog.message}
                </p>
                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-xs font-medium rounded-md border border-border bg-surface text-text-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDialog.onConfirm}
                    className="px-4 py-2 text-xs font-semibold rounded-md border-none bg-accent-blue text-white cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {saveStatus.type !== 'idle' && (
        <div className="fixed bottom-6 right-6 z-[1000]">
          <div className={`px-5 py-4 rounded-lg text-sm font-medium shadow-lg min-w-[280px] flex items-center gap-3 ${
            saveStatus.type === 'success' ? 'bg-accent-green text-white' :
            saveStatus.type === 'error' ? 'bg-accent-red text-white' :
            'bg-accent-blue text-white'
          }`}>
            <span>{saveStatus.type === 'success' ? '✓' : saveStatus.type === 'error' ? '✕' : '⏳'}</span>
            <span className="flex-1">{saveStatus.message}</span>
            <button
              onClick={() => setSaveStatus({ type: 'idle', message: '' })}
              className="bg-transparent border-none text-white cursor-pointer text-lg px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
