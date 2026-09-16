'use client'

import React from 'react'
import { useAtomValue } from 'jotai'
import { modelsAtom, uomIndexAtom, imputationPolicyAtom } from '../../../store/dcuAtoms'
import { getAllCategories, getUomsByCategory } from '../../../utils/uomUtils'
import type { ModelTagMapping, AttributeSipPolicy } from '../../../types'
import { HelperPanels } from '../../shared/ExpressionBuilder'
import Modal from '../../shared/Modal'
import SipPolicyModal from '../../shared/SipPolicyModal'

// Maps NodeType level field → model_tag_mapping level string
const LEVEL_MAP: Record<string, string> = {
  system:              'System',
  furnace:             'Furnace',
  cell:                'Cell',
  pass:                'Pass',
  tube:                'Tube',
  drum_train:          'Drum train',
  drum:                'Drum',
  fractionator:        'Fractionator',
  column_overhead:     'column overhead',
  column_reboiler:     'column reboiler',
  distillation_column: 'distillation column',
}

const LEVEL_BADGE: Record<string, { bg: string; text: string }> = {
  'System':              { bg: '#e0e7ff', text: '#3730a3' },
  'Furnace':             { bg: '#ffedd5', text: '#9a3412' },
  'Cell':                { bg: '#ccfbf1', text: '#115e59' },
  'Pass':                { bg: '#dbeafe', text: '#1e40af' },
  'Tube':                { bg: '#f1f5f9', text: '#334155' },
  'Drum train':          { bg: '#fef3c7', text: '#92400e' },
  'Drum':                { bg: '#fffbeb', text: '#b45309' },
  'Fractionator':        { bg: '#f3e8ff', text: '#6b21a8' },
  'column overhead':     { bg: '#dcfce7', text: '#166534' },
  'column reboiler':     { bg: '#ffe4e6', text: '#9f1239' },
}
const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  'PI':       { bg: '#dbeafe', text: '#1e40af' },
  'Inferred': { bg: '#fffbeb', text: '#b45309' },
  'Constant': { bg: '#dcfce7', text: '#166534' },
}

const MODEL_BADGE: Record<string, { bg: string; text: string }> = {
  'PDI':       { bg: '#dbeafe', text: '#1e40af' },
  'OUTAGE':    { bg: '#f3e8ff', text: '#6b21a8' },
  'HGI':       { bg: '#dcfce7', text: '#166534' },
  'RUNLENGTH': { bg: '#fffbeb', text: '#b45309' },
  'SPALL':     { bg: '#fee2e2', text: '#991b1b' },
  'CLEAN TMT': { bg: '#ffedd5', text: '#9a3412' },
}
function modelBadgeStyle(name: string) {
  return MODEL_BADGE[name] ?? { bg: '#f3f4f6', text: '#374151' }
}

interface Props {
  sortedMappings: ModelTagMapping[]
  allMappings: ModelTagMapping[]
  searchTerm: string
  onSearchChange: (term: string) => void
  sortBy: 'level' | 'attribute' | 'models'
  sortOrder: 'asc' | 'desc'
  onSort: (col: 'level' | 'attribute' | 'models') => void
  SortIcon: ({ column }: { column: 'level' | 'attribute' | 'models' }) => React.ReactNode
  getModelNames: (ids: number[]) => string
  modelFilter: number[]
  onModelFilterChange: (modelIds: number[]) => void
  typeFilter: string[]
  onTypeFilterChange: (types: string[]) => void
  dataTypeFilter: string[]
  onDataTypeFilterChange: (dataTypes: string[]) => void
  levelFilter: string[]
  onLevelFilterChange: (levels: string[]) => void
  onEdit: (mapping: ModelTagMapping) => void
  onDelete: (level: string, attribute: string) => void
  isEditing: boolean
  editingKey: { level: string; attribute: string } | null
  editLevel: string
  onEditLevelChange: (val: string) => void
  editAttribute: string
  onEditAttributeChange: (val: string) => void
  editDisplayName: string
  onEditDisplayNameChange: (val: string) => void
  editModelIds: number[]
  onToggleEditModel: (id: number) => void
  editUomCategory: string
  onEditUomCategoryChange: (val: string) => void
  editDefaultUom: string
  onEditDefaultUomChange: (val: string) => void
  editType: string
  onEditTypeChange: (val: string) => void
  editDataType: string
  onEditDataTypeChange: (val: string) => void
  editExpression: string
  onEditExpressionChange: (val: string) => void
  editFlagMa: boolean
  onEditFlagMaChange: (val: boolean) => void
  editSipPolicies: AttributeSipPolicy[]
  onEditSipPoliciesChange: (policies: AttributeSipPolicy[]) => void
  isEditDuplicate: boolean
  canSaveEdit: boolean
  onSaveEdit: () => void
  onCancelEdit: () => void
  isAddingForm: boolean
  onToggleAddForm: (show: boolean) => void
  newLevel: string
  onNewLevelChange: (val: string) => void
  newAttribute: string
  onNewAttributeChange: (val: string) => void
  newDisplayName: string
  onNewDisplayNameChange: (val: string) => void
  newModelIds: number[]
  onToggleNewModel: (id: number) => void
  newUomCategory: string
  onNewUomCategoryChange: (val: string) => void
  newDefaultUom: string
  onNewDefaultUomChange: (val: string) => void
  newType: string
  onNewTypeChange: (val: string) => void
  newDataType: string
  onNewDataTypeChange: (val: string) => void
  newExpression: string
  onNewExpressionChange: (val: string) => void
  newFlagMa: boolean
  onNewFlagMaChange: (val: boolean) => void
  newSipPolicies: AttributeSipPolicy[]
  onNewSipPoliciesChange: (policies: AttributeSipPolicy[]) => void
  allModels: { model_id: number; model_alias: string }[]
  isDuplicate: boolean
  canAdd: boolean
  onAddMapping: () => void
}

export default function AttributeMappingsTab(props: Props) {
  const models = useAtomValue(modelsAtom)
  const uomIndex = useAtomValue(uomIndexAtom)
  const imputationPolicy = useAtomValue(imputationPolicyAtom)

  const newExpressionInputRef  = React.useRef<HTMLTextAreaElement>(null)
  const editExpressionInputRef = React.useRef<HTMLTextAreaElement>(null)
  const newCursorPos  = React.useRef({ start: 0, end: 0 })
  const editCursorPos = React.useRef({ start: 0, end: 0 })
  const [showFilters, setShowFilters] = React.useState(false)
  const [showNewSipModal, setShowNewSipModal] = React.useState(false)
  const [showEditSipModal, setShowEditSipModal] = React.useState(false)

  const autoCorrectExpression = (expr: string): string => {
    return expr.replace(/\{(<<\w+>>)_\{([^}]+)\}\}/g, '{$1_$2}')
  }

  const allLevels = Array.from(new Set(props.sortedMappings.map(m => m.level))).sort()
  const hasActiveFilters = props.modelFilter.length > 0 || props.typeFilter.length > 0 || props.dataTypeFilter.length > 0 || props.levelFilter.length > 0

  const clearAllFilters = () => {
    props.onModelFilterChange([])
    props.onTypeFilterChange([])
    props.onDataTypeFilterChange([])
    props.onLevelFilterChange([])
  }

  const fieldStyle = {
    width: '100%', padding: '7px 10px', fontSize: 12,
    border: '1px solid #d1d5db', borderRadius: 5,
    background: '#ffffff', color: '#374151', fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  }
  const fieldLabel = { display: 'block', fontSize: 11, fontWeight: 500 as const, color: '#374151', marginBottom: 4 }

  const FormFields = ({ mode }: { mode: 'edit' | 'add' }) => {
    const isEdit = mode === 'edit'
    const exprInputRef = isEdit ? editExpressionInputRef : newExpressionInputRef
    const cursorPos    = isEdit ? editCursorPos : newCursorPos

    const saveCursor = () => {
      const el = exprInputRef.current
      if (el) cursorPos.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
    }

    const insertIntoExpression = (text: string, currentExpression: string, onChange: (v: string) => void) => {
      const el = exprInputRef.current
      if (!el) { onChange(currentExpression + text); return }
      const { start, end } = cursorPos.current
      const newValue  = currentExpression.substring(0, start) + text + currentExpression.substring(end)
      const newCursor = start + text.length
      cursorPos.current = { start: newCursor, end: newCursor }
      onChange(newValue)
      setTimeout(() => { el.focus(); el.setSelectionRange(newCursor, newCursor) }, 0)
    }
    const level = isEdit ? props.editLevel : props.newLevel
    const attribute = isEdit ? props.editAttribute : props.newAttribute
    const displayName = isEdit ? props.editDisplayName : props.newDisplayName
    const type = isEdit ? props.editType : props.newType
    const dataType = isEdit ? props.editDataType : props.newDataType
    const uomCategory = isEdit ? props.editUomCategory : props.newUomCategory
    const defaultUom = isEdit ? props.editDefaultUom : props.newDefaultUom
    const modelIds = isEdit ? props.editModelIds : props.newModelIds
    const expression = isEdit ? props.editExpression : props.newExpression
    const flagMa = isEdit ? props.editFlagMa : props.newFlagMa
    const onLevelChange = isEdit ? props.onEditLevelChange : props.onNewLevelChange
    const onAttributeChange = isEdit ? props.onEditAttributeChange : props.onNewAttributeChange
    const onDisplayNameChange = isEdit ? props.onEditDisplayNameChange : props.onNewDisplayNameChange
    const onTypeChange = isEdit ? props.onEditTypeChange : props.onNewTypeChange
    const onDataTypeChange = isEdit ? props.onEditDataTypeChange : props.onNewDataTypeChange
    const onUomCategoryChange = isEdit ? props.onEditUomCategoryChange : props.onNewUomCategoryChange
    const onDefaultUomChange = isEdit ? props.onEditDefaultUomChange : props.onNewDefaultUomChange
    const onToggleModel = isEdit ? props.onToggleEditModel : props.onToggleNewModel
    const onExpressionChange = isEdit ? props.onEditExpressionChange : props.onNewExpressionChange
    const onFlagMaChange = isEdit ? props.onEditFlagMaChange : props.onNewFlagMaChange
    const sipPolicies = isEdit ? props.editSipPolicies : props.newSipPolicies
    const onSipPoliciesChange = isEdit ? props.onEditSipPoliciesChange : props.onNewSipPoliciesChange
    const showSipModal = isEdit ? showEditSipModal : showNewSipModal
    const setShowSipModal = isEdit ? setShowEditSipModal : setShowNewSipModal
    const exprEnabled = type === 'Inferred' || type === 'Cause' || type === 'Effect'
    const maEnabled = type === 'PI' || type === 'Inferred'
    const sipApplicable = type !== 'Cause' && type !== 'Effect'

    const categories = getAllCategories(uomIndex)
    const categoryUoms = uomCategory ? getUomsByCategory(uomIndex, uomCategory) : []

    return (
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, height: 280 }}>
        {/* Left side (70%) - Form fields */}
        <div style={{ flex: '0 1 70%', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 8, borderRadius: 3 }}>
          {/* Row 1: Level | Attribute Name | Display Name | Type */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: '0 1 120px' }}>
              <label style={fieldLabel}>Level <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={level} onChange={(e) => onLevelChange(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', borderColor: !level ? '#ef4444' : '#d1d5db' }}>
                {isEdit
                  ? Object.values(LEVEL_MAP).map(l => (<option key={l} value={l}>{l}</option>))
                  : (<><option value="">-- Select Level --</option>{Object.values(LEVEL_MAP).map(l => (<option key={l} value={l}>{l}</option>))}</>)
                }
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Attribute Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={attribute} onChange={(e) => onAttributeChange(e.target.value)}
                placeholder={isEdit ? undefined : 'e.g., feed_inlet_temperature'}
                style={{ ...fieldStyle, borderColor: !attribute ? '#ef4444' : '#d1d5db' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Display Name</label>
              <input type="text" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder={isEdit ? undefined : 'e.g., Feed Inlet Temperature'} style={fieldStyle} />
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <label style={fieldLabel}>Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={type} onChange={(e) => onTypeChange(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', borderColor: !type ? '#ef4444' : '#d1d5db' }}>
                <option value="">— Select —</option>
                <option value="PI">PI</option>
                <option value="Inferred">Inferred</option>
                <option value="Constant">Constant</option>
                <option value="Cause">Cause</option>
                <option value="Effect">Effect</option>
              </select>
            </div>
          </div>

          {/* Row 2: Data Type | UOM Category | Default UOM */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: '0 1 120px' }}>
              <label style={fieldLabel}>
                Data Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={dataType}
                onChange={(e) => onDataTypeChange(e.target.value)}
                style={{ ...fieldStyle, cursor: 'pointer', borderColor: !dataType ? '#ef4444' : '#d1d5db' }}
              >
                <option value="">— Select —</option>
                <option value="continuous">Continuous</option>
                <option value="discrete">Discrete</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>UOM Category</label>
              <select value={uomCategory} onChange={(e) => onUomCategoryChange(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
                <option value="">— None —</option>
                {categories.map(category => (<option key={category} value={category}>{category}</option>))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Default UOM</label>
              <select value={defaultUom} onChange={(e) => onDefaultUomChange(e.target.value)} disabled={!uomCategory} style={{
                ...fieldStyle, cursor: uomCategory ? 'pointer' : 'not-allowed',
                background: uomCategory ? '#ffffff' : '#f5f5f5', fontFamily: 'monospace', opacity: uomCategory ? 1 : 0.6,
              }}>
                <option value="">— Select UOM —</option>
                {categoryUoms.map(uom => (<option key={uom.symbol} value={uom.symbol}>{uom.symbol} ({uom.name})</option>))}
              </select>
            </div>
          </div>

          {/* Row 3: Models */}
          <div>
            <label style={{ ...fieldLabel, color: modelIds.length === 0 ? '#ef4444' : '#374151' }}>
              Models <span style={{ color: '#ef4444' }}>*</span> <span style={{ fontWeight: 400 }}>(select at least one)</span>
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {models.map(model => (
                <label key={model.model_id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={modelIds.includes(model.model_id)} onChange={() => onToggleModel(model.model_id)} style={{ cursor: 'pointer' }} />
                  <span style={{ color: '#3d5a70' }}>{model.model_alias}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Row 4: Expression and Set */}
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Expression</label>
              <textarea
                ref={exprInputRef}
                value={expression}
                onChange={(e) => onExpressionChange(autoCorrectExpression(e.target.value))}
                onSelect={saveCursor}
                onKeyUp={saveCursor}
                onMouseUp={saveCursor}
                onBlur={saveCursor}
                disabled={!exprEnabled}
                placeholder="e.g. {<<pass>>_max_tmt}-{<<pass>>_cot}"
                rows={2}
                style={{
                  ...fieldStyle,
                  fontFamily: 'monospace',
                  background: exprEnabled ? '#ffffff' : '#f5f5f5',
                  cursor: exprEnabled ? 'text' : 'not-allowed',
                  opacity: exprEnabled ? 1 : 0.6,
                  resize: 'vertical',
                  lineHeight: '1.4',
                }}
              />
              {/* Math Symbol Buttons */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {['{', '}', '+', '-', '_', '(', ')'].map(symbol => (
                  <button
                    key={symbol}
                    onClick={() => {
                      if (exprEnabled) insertIntoExpression(symbol, expression, onExpressionChange)
                    }}
                    disabled={!exprEnabled}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      border: '1px solid #d1d5db',
                      borderRadius: 3,
                      background: exprEnabled ? '#ffffff' : '#f5f5f5',
                      color: '#374151',
                      cursor: exprEnabled ? 'pointer' : 'not-allowed',
                      fontFamily: 'monospace',
                      opacity: exprEnabled ? 1 : 0.6,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (exprEnabled) {
                        e.currentTarget.style.background = '#f0f7fc'
                        e.currentTarget.style.borderColor = '#1e3a5f'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (exprEnabled) {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#d1d5db'
                      }
                    }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: '0 1 110px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 8 }}>
              <div style={{ opacity: maEnabled ? 1 : 0.4 }}>
                <label style={fieldLabel}>Moving Average</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: maEnabled ? 'pointer' : 'not-allowed', marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={maEnabled ? flagMa : false}
                    onChange={(e) => maEnabled && onFlagMaChange(e.target.checked)}
                    disabled={!maEnabled}
                    style={{ width: 14, height: 14, cursor: maEnabled ? 'pointer' : 'not-allowed', accentColor: '#1e3a5f' }}
                  />
                  <span style={{ fontSize: 11, color: '#3d5a70' }}>Enable MA check</span>
                </label>
              </div>
              {sipApplicable && (
                <div>
                  <label style={fieldLabel}>SIP Policy</label>
                  <button
                    onClick={() => setShowSipModal(true)}
                    disabled={modelIds.length === 0}
                    title={modelIds.length === 0 ? 'Select at least one model first' : 'Configure SIP policy per model'}
                    style={{
                      marginTop: 2,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 5,
                      border: '1px solid #93c5fd',
                      background: modelIds.length === 0 ? '#f8fafc' : '#eff6ff',
                      color: modelIds.length === 0 ? '#94a3b8' : '#1d4ed8',
                      cursor: modelIds.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: modelIds.length === 0 ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    Configure…
                    {sipPolicies.length > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#2563eb', color: '#fff', borderRadius: 10, padding: '1px 5px' }}>
                        {sipPolicies.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          {showSipModal && (
            <SipPolicyModal
              modelIds={modelIds}
              models={props.allModels}
              sipPolicies={sipPolicies}
              imputationPolicy={imputationPolicy}
              onSave={(policies) => { onSipPoliciesChange(policies); setShowSipModal(false) }}
              onClose={() => setShowSipModal(false)}
            />
          )}
        </div>

        {/* Right side (30%) - Helper Panels */}
        <div style={{ flex: '0 1 30%', overflowY: 'auto', paddingRight: 4, borderRadius: 3 }}>
          <HelperPanels
            uniqueAttributes={Array.from(new Set(props.allMappings.map(m => m.attribute))).sort()}
            onInsertAttribute={(attr) => insertIntoExpression(attr, expression, onExpressionChange)}
            onInsertSymbol={(symbol) => insertIntoExpression(`<<${symbol}>>`, expression, onExpressionChange)}
            isDisabled={!exprEnabled}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
      {/* Main Row: Card + Filter Panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 1 }}>
        {/* Main Table Card */}
        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
          <div className="bg-accent-blue" style={{ padding: '9px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Attribute Mappings ({props.sortedMappings.length})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search attributes..."
              value={props.searchTerm}
              onChange={(e) => props.onSearchChange(e.target.value)}
              style={{
                padding: '6px 12px', fontSize: 11, borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)', color: '#ffffff', fontFamily: 'inherit', width: 180,
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            />
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.3)',
                background: showFilters ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: '#ffffff', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = showFilters ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            >
              <span>&#9881;&#65039;</span>
              <span>Filters</span>
              <span style={{ fontSize: 10, marginLeft: 2 }}>{showFilters ? '▲' : '▼'}</span>
              {hasActiveFilters && <span style={{ fontSize: 9, marginLeft: 4, background: 'rgba(255,107,107,0.8)', borderRadius: 10, padding: '1px 5px' }}>✓</span>}
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, marginRight: -6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#3d5a70', tableLayout: 'auto', marginRight: 6 }}>
            <colgroup>
              <col style={{ width: '8%', minWidth: '60px' }} />
              <col style={{ width: '12%', minWidth: '85px' }} />
              <col style={{ width: '8%', minWidth: '70px' }} />
              <col style={{ width: '12%', minWidth: '85px' }} />
              <col style={{ width: '7%', minWidth: '60px' }} />
              <col style={{ width: '7%', minWidth: '65px' }} />
              <col style={{ width: '9%', minWidth: '70px' }} />
              <col style={{ width: '9%', minWidth: '70px' }} />
              <col style={{ width: '12%', minWidth: '70px' }} />
              <col style={{ width: '5%', minWidth: '40px' }} />
              <col style={{ width: '4%', minWidth: '35px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, background: '#f4f8fb', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid #dce8f0' }}>
                {(['level', 'attribute', 'models'] as const).map(col => (
                  <th key={col} onClick={() => props.onSort(col)} style={{
                    padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: props.sortBy === col ? '#1e3a5f' : '#1c3045',
                    cursor: 'pointer', userSelect: 'none', background: props.sortBy === col ? 'rgba(30,58,95,0.06)' : 'transparent',
                  }}>
                    {col.charAt(0).toUpperCase() + col.slice(1)} <props.SortIcon column={col} />
                  </th>
                ))}
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Display Name</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Data Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>UOM Category</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Default UOM</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Expression</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#1c3045' }}>MA</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#1c3045' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {props.sortedMappings.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: '#7a95a8', fontSize: 13 }}>
                  No tag mappings defined. Click the add button below to get started.
                </td></tr>
              ) : (
                props.sortedMappings.map((mapping, idx) => (
                  <tr key={`${mapping.level}-${mapping.attribute}-${idx}`} style={{ borderBottom: '1px solid #e8ecf1' }}>
                    <td style={{ padding: '12px 14px' }}>
                      {(() => {
                        const s = LEVEL_BADGE[mapping.level] ?? { bg: '#f3f4f6', text: '#374151' }
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            borderRadius: 9999, padding: '2px 8px',
                            fontSize: 11, fontWeight: 500,
                            background: s.bg, color: s.text, whiteSpace: 'nowrap',
                          }}>{mapping.level}</span>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#3d5a70' }}>{mapping.attribute}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {props.getModelNames(mapping.model_ids).split(', ').filter(Boolean).map(name => {
                          const s = modelBadgeStyle(name)
                          return (
                            <span key={name} style={{
                              display: 'inline-flex', alignItems: 'center',
                              borderRadius: 9999, padding: '2px 8px',
                              fontSize: 11, fontWeight: 500,
                              background: s.bg, color: s.text, whiteSpace: 'nowrap',
                            }}>{name}</span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: mapping.display_name ? '#3d5a70' : '#a5b8c5', fontStyle: mapping.display_name ? 'normal' : 'italic' }}>
                      {mapping.display_name || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {mapping.type ? (() => {
                        const s = TYPE_BADGE[mapping.type] ?? { bg: '#f3f4f6', text: '#374151' }
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            borderRadius: 9999, padding: '2px 8px',
                            fontSize: 11, fontWeight: 500,
                            background: s.bg, color: s.text, whiteSpace: 'nowrap',
                          }}>{mapping.type}</span>
                        )
                      })() : <span style={{ color: '#a5b8c5' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: mapping.data_type ? '#3d5a70' : '#a5b8c5', fontSize: 11, fontWeight: mapping.data_type ? 500 : 400 }}>
                      {mapping.data_type ? (mapping.data_type === 'discrete' ? 'Discrete' : 'Continuous') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: mapping.uom_category ? '#3d5a70' : '#a5b8c5', fontSize: 11 }}>
                      {mapping.uom_category || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: mapping.default_uom ? '#1c3045' : '#a5b8c5', fontWeight: mapping.default_uom ? 600 : 400, fontFamily: mapping.default_uom ? 'monospace' : 'inherit' }}>
                      {mapping.default_uom || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: mapping.expression ? '#3d5a70' : '#a5b8c5', fontFamily: mapping.expression ? 'monospace' : 'inherit', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, cursor: mapping.expression ? 'help' : 'default' }} title={mapping.expression || ''}>
                      {mapping.expression || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 11 }}>
                      {(mapping.type === 'PI' || mapping.type === 'Inferred')
                        ? mapping.flag_ma
                          ? <span style={{ display: 'inline-block', borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#166534' }}>Yes</span>
                          : <span style={{ color: '#a5b8c5' }}>No</span>
                        : <span style={{ color: '#a5b8c5' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => props.onEdit(mapping)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#1e3a5f', fontSize: 14, padding: '0 4px', fontWeight: 600, marginRight: 8,
                      }}>✎</button>
                      <button onClick={() => props.onDelete(mapping.level, mapping.attribute)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#d9534f', fontSize: 16, padding: '0 4px', fontWeight: 600,
                      }}>✕</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer action strip */}
        <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '10px 16px', flexShrink: 0 }}>
          <button
            onClick={() => props.onToggleAddForm(!props.isAddingForm)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 6, border: `1.5px solid ${props.isAddingForm ? '#9fb8d9' : '#c5d4e8'}`,
              background: props.isAddingForm ? '#e8eef6' : '#ffffff',
              color: '#1e3a5f', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!props.isAddingForm) { e.currentTarget.style.background = '#e8eef6'; e.currentTarget.style.borderColor = '#9fb8d9' } }}
            onMouseLeave={e => { if (!props.isAddingForm) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#c5d4e8' } }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 300 }}>+</span>
            Add New Mapping
          </button>
        </div>
      </div>

        {/* Filter Panel (Floating Right) */}
        {showFilters && (
          <div style={{
            position: 'fixed', right: 6, top: 280,
            width: 240, maxHeight: 'calc(100vh - 320px)',
            borderLeft: '1px solid #dce8f0', background: '#ffffff',
            overflowY: 'auto', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: 12,
            borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 100,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1c3045', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Filters
            </div>

            {/* Models Filter */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#3d5a70', marginBottom: 6 }}>Models</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {models.map(model => (
                  <label key={model.model_id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                    <input type="checkbox" checked={props.modelFilter.includes(model.model_id)}
                      onChange={(e) => {
                        if (e.target.checked) props.onModelFilterChange([...props.modelFilter, model.model_id])
                        else props.onModelFilterChange(props.modelFilter.filter(id => id !== model.model_id))
                      }} style={{ cursor: 'pointer' }} />
                    <span style={{ color: '#3d5a70' }}>{model.model_alias}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div style={{ borderTop: '1px solid #dce8f0', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#3d5a70', marginBottom: 6 }}>Type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['PI', 'Inferred', 'Constant', 'Cause', 'Effect'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                    <input type="checkbox" checked={props.typeFilter.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) props.onTypeFilterChange([...props.typeFilter, type])
                        else props.onTypeFilterChange(props.typeFilter.filter(t => t !== type))
                      }} style={{ cursor: 'pointer' }} />
                    <span style={{ color: '#3d5a70' }}>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Data Type Filter */}
            <div style={{ borderTop: '1px solid #dce8f0', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#3d5a70', marginBottom: 6 }}>Data Type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['continuous', 'discrete'].map(dtype => (
                  <label key={dtype} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                    <input type="checkbox" checked={props.dataTypeFilter.includes(dtype)}
                      onChange={(e) => {
                        if (e.target.checked) props.onDataTypeFilterChange([...props.dataTypeFilter, dtype])
                        else props.onDataTypeFilterChange(props.dataTypeFilter.filter(d => d !== dtype))
                      }} style={{ cursor: 'pointer' }} />
                    <span style={{ color: '#3d5a70' }}>{dtype === 'continuous' ? 'Continuous' : 'Discrete'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Level Filter */}
            <div style={{ borderTop: '1px solid #dce8f0', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#3d5a70', marginBottom: 6 }}>Level</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                {allLevels.map(level => (
                  <label key={level} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                    <input type="checkbox" checked={props.levelFilter.includes(level)}
                      onChange={(e) => {
                        if (e.target.checked) props.onLevelFilterChange([...props.levelFilter, level])
                        else props.onLevelFilterChange(props.levelFilter.filter(l => l !== level))
                      }} style={{ cursor: 'pointer' }} />
                    <span style={{ color: '#3d5a70' }}>{level}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clear All Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                style={{
                  marginTop: 8, padding: '6px 10px', fontSize: 10, fontWeight: 600,
                  borderRadius: 4, border: '1px solid #dce8f0',
                  background: '#f5f5f5', color: '#3d5a70', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e8e8'; e.currentTarget.style.borderColor = '#bbb' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#dce8f0' }}
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>{/* end main row div */}

      {/* Edit Mapping Modal */}
      <Modal isOpen={props.isEditing} onClose={props.onCancelEdit} title="Edit Mapping" maxWidth={920}>
        {FormFields({ mode: 'edit' })}
        {props.isEditDuplicate && (
          <div style={{ padding: '8px 10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 3, marginBottom: 12, fontSize: 11, color: '#856404', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>⚠</span>
            Level + attribute already exists.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={props.onCancelEdit} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={props.onSaveEdit} disabled={!props.canSaveEdit} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" style={{
            padding: '8px 16px', fontSize: 13, opacity: props.canSaveEdit ? 1 : 0.5, cursor: props.canSaveEdit ? 'pointer' : 'not-allowed',
          }}>Save</button>
        </div>
      </Modal>

      {/* Add New Mapping Modal */}
      <Modal isOpen={props.isAddingForm} onClose={() => props.onToggleAddForm(false)} title="Add New Mapping" maxWidth={920}>
        {FormFields({ mode: 'add' })}
        {props.isDuplicate && (
          <div style={{ padding: '8px 10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 3, marginBottom: 12, fontSize: 11, color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>⚠</span>
            This level + attribute combination already exists. Delete the existing entry first or add different models to it.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={() => props.onToggleAddForm(false)} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={props.onAddMapping} disabled={!props.canAdd} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" style={{
            padding: '8px 16px', fontSize: 13, opacity: props.canAdd ? 1 : 0.5, cursor: props.canAdd ? 'pointer' : 'not-allowed',
          }}>+ Add Mapping</button>
        </div>
      </Modal>
    </div>
  )
}
