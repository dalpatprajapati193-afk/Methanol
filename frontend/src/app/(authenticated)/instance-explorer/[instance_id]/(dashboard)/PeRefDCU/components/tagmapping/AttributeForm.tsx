'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  tagMappingsAtom,
  tagEntriesAtom,
  setTagEntryAtom,
  getTagEntry,
  DEFAULT_TAG_ENTRY,
  modelsAtom,
  selectedModelIdsAtom,
  multipliedAttributesAtom,
  uomIndexAtom,
  equipmentAtom,
  spallConfigAtom,
} from '../../store/dcuAtoms'
import type { TopologyNode, TagEntry, TagType, AttributeSipPolicy } from '../../types'
import { expandInferredExpression } from '../../utils/inferredFormulaExpander'
import { getBaseAttribute } from '../../utils/attributeMultiplier'
import { getUomsByCategory } from '../../utils/uomUtils'
import PISensorForm from './forms/PISensorForm'
import FormulaForm from './forms/FormulaForm'
import InferredFormulaForm from './forms/InferredFormulaForm'
import ConstantForm from './forms/ConstantForm'

interface Props {
  node: TopologyNode
  attributes: string[]
}

const GRID = '1fr 1fr 88px 80px 1fr 148px'

const CATEGORY_PILL: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PI:       { label: 'PI_TAG',   bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  Inferred: { label: 'Inferred', bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  Constant: { label: 'Constant', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  Cause:    { label: 'Cause',    bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  Effect:   { label: 'Effect',   bg: '#fdf2f8', color: '#a21caf', border: '#f5d0fe' },
}

function TagRow({ attribute, nodeId, level, node }: { attribute: string; nodeId: string; level: string; node: TopologyNode }) {
  const tagMappings = useAtomValue(tagMappingsAtom)
  const tagEntries = useAtomValue(tagEntriesAtom)
  const setTagEntry = useSetAtom(setTagEntryAtom)
  const models = useAtomValue(modelsAtom)
  const selectedModelIds = useAtomValue(selectedModelIdsAtom)
  const uomIndex = useAtomValue(uomIndexAtom)
  const equipment = useAtomValue(equipmentAtom)
  const spallConfig = useAtomValue(spallConfigAtom)

  const entry = getTagEntry(tagEntries, nodeId, attribute)
  const [isExpanded, setIsExpanded] = useState(false)
  const [attributeType, setAttributeType] = useState('')
  const [attributeDataType, setAttributeDataType] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; pendingType: string }>({ isOpen: false, pendingType: '' })
  const [confirmDataTypeDialog, setConfirmDataTypeDialog] = useState<{ isOpen: boolean; pendingDataType: string }>({ isOpen: false, pendingDataType: '' })

  const mappingData = useMemo(() => {
    const baseAttribute = getBaseAttribute(attribute)
    const mapping = tagMappings.find(m => m.attribute === baseAttribute && m.level === level)
    const blueprintFormula = mapping?.expression || ''
    const nIndex = attribute !== baseAttribute ? attribute.match(/_(\d+)$/)?.[1] : undefined

    const systemConstants: Record<string, string> = {}
    const systemEntries = tagEntries['system_dcu'] ?? {}
    for (const [attr, ent] of Object.entries(systemEntries)) {
      if (ent?.tag_type === 'constant') systemConstants[attr] = ent.constant_value
    }

    const _smMid = mapping?.model_ids?.[0]
    const _smModel = _smMid !== undefined ? models.find(x => x.model_id === _smMid) : undefined
    const modelPrefix = _smModel ? _smModel.model_alias.toLowerCase().replace(/\s+/g, '_') : undefined

    const expandedFormula = expandInferredExpression(blueprintFormula, node, tagMappings, {
      equipment, spallConfig, constants: systemConstants, nIndex, modelPrefix,
    })
    return {
      uomCategory: mapping?.uom_category || '',
      blueprintDefaultUom: mapping?.default_uom || '',
      blueprintDisplayName: mapping?.display_name || attribute.replace(/_/g, ' '),
      blueprintType: mapping?.type || '',
      blueprintDataType: mapping?.data_type || '',
      blueprintFormula,
      expandedFormula,
      blueprintFlagMa: mapping?.flag_ma ?? false,
      blueprintSipPolicies: (mapping?.sip_policies || []) as AttributeSipPolicy[],
      blueprintModelIds: (mapping?.model_ids || []).filter(id => selectedModelIds.includes(id)),
    }
  }, [attribute, level, node, tagMappings, spallConfig, equipment, tagEntries, selectedModelIds, models])

  useEffect(() => {
    setAttributeType(mappingData.blueprintType)
    setAttributeDataType(mappingData.blueprintDataType)
  }, [mappingData.blueprintType, mappingData.blueprintDataType])

  useEffect(() => {
    const availableTabs = (['pi', 'formula', 'constant'] as TagType[]).filter(t => {
      if (attributeType === 'Constant') return t === 'constant'
      if (attributeType === 'Inferred') return t === 'formula'
      if (attributeType === 'Cause' || attributeType === 'Effect') return t === 'formula'
      return t === 'pi' || t === 'formula'
    })
    if (availableTabs.length === 1 && entry.tag_type !== availableTabs[0]) {
      update({ ...DEFAULT_TAG_ENTRY, tag_type: availableTabs[0] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributeType, entry.tag_type])

  const handleTypeChange = (newType: string) => {
    if (newType !== mappingData.blueprintType) {
      setConfirmDialog({ isOpen: true, pendingType: newType })
    } else {
      setAttributeType(newType)
    }
  }

  const handleDataTypeChange = (newDataType: string) => {
    if (newDataType !== mappingData.blueprintDataType) {
      setConfirmDataTypeDialog({ isOpen: true, pendingDataType: newDataType })
    } else {
      setAttributeDataType(newDataType)
      const validDataType = (newDataType === 'continuous' || newDataType === 'discrete') ? newDataType : undefined
      update({ data_type: validDataType as 'continuous' | 'discrete' | undefined })
    }
  }

  const confirmTypeChange = () => {
    setAttributeType(confirmDialog.pendingType)
    setConfirmDialog({ isOpen: false, pendingType: '' })
  }
  const cancelTypeChange = () => setConfirmDialog({ isOpen: false, pendingType: '' })

  const confirmDataTypeChange = () => {
    setAttributeDataType(confirmDataTypeDialog.pendingDataType)
    const validDataType = (confirmDataTypeDialog.pendingDataType === 'continuous' || confirmDataTypeDialog.pendingDataType === 'discrete') ? confirmDataTypeDialog.pendingDataType : undefined
    update({ data_type: validDataType as 'continuous' | 'discrete' | undefined })
    setConfirmDataTypeDialog({ isOpen: false, pendingDataType: '' })
  }
  const cancelDataTypeChange = () => setConfirmDataTypeDialog({ isOpen: false, pendingDataType: '' })

  const update = (patch: Partial<TagEntry>) => {
    const updated: TagEntry = {
      tag_type: entry.tag_type,
      pi_sensors: entry.pi_sensors,
      aggregation: entry.aggregation,
      sip_min: entry.sip_min,
      sip_max: entry.sip_max,
      sip_default_value: entry.sip_default_value,
      sip_policy: entry.sip_policy,
      constant_value: entry.constant_value,
      default_uom: entry.default_uom,
      attribute_uom: entry.attribute_uom,
      display_name: entry.display_name,
      expression_override: entry.expression_override,
      data_type: entry.data_type,
      ...patch,
    }
    setTagEntry(nodeId, attribute, updated)
  }

  const hasNonConstantData = (entry.tag_type === 'pi' || entry.tag_type === 'formula') && entry.pi_sensors.some(s => !!s.sensor_name)
  const hasConstantData = entry.tag_type === 'constant' && !!entry.constant_value
  const isConstantTabDisabled = attributeType === 'PI' || attributeType === 'Inferred'
  const isPiTabDisabled = attributeType === 'Constant'
  const isFormulaTabDisabled = attributeType === 'Constant'

  const categoryUoms = useMemo(
    () => mappingData.uomCategory ? getUomsByCategory(uomIndex, mappingData.uomCategory).map(u => u.symbol) : [],
    [mappingData.uomCategory, uomIndex]
  )
  const isUomValid = (uom: string | undefined): boolean =>
    !!uom && (categoryUoms.length === 0 || categoryUoms.includes(uom))
  const effectiveAttributeUom = isUomValid(entry.attribute_uom) ? entry.attribute_uom! : ''

  const isCauseOrEffect = mappingData.blueprintType === 'Cause' || mappingData.blueprintType === 'Effect'

  const isFulfilled = (() => {
    if (entry.tag_type === 'pi') {
      return entry.pi_sensors.some(s => !!s.sensor_name && isUomValid(s.sensor_uom)) && !!effectiveAttributeUom
    }
    if (entry.tag_type === 'formula') {
      if (isCauseOrEffect) return !!mappingData.blueprintFormula
      return !!effectiveAttributeUom
    }
    if (entry.tag_type === 'constant') {
      return !!entry.constant_value && !!effectiveAttributeUom
    }
    return false
  })()

  const valueDisplay = (() => {
    if (entry.tag_type === 'pi' || entry.tag_type === 'formula') {
      return entry.pi_sensors[0]?.sensor_name || null
    }
    if (entry.tag_type === 'constant') return entry.constant_value || null
    return null
  })()

  const catPill = CATEGORY_PILL[attributeType || mappingData.blueprintType]

  return (
    <div style={{ borderBottom: isExpanded ? '2px solid #b8cee0' : '1px solid #f4f8fb' }}>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '10px 14px', gap: 8 }}>

        {/* ATTRIBUTE */}
        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#3d5a70', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {attribute}
        </span>

        {/* DISPLAY NAME */}
        <input
          value={entry.display_name ?? mappingData.blueprintDisplayName}
          autoComplete="off"
          onChange={e => {
            const val = e.target.value
            update({ display_name: val === mappingData.blueprintDisplayName ? undefined : val || undefined })
          }}
          className="text-xs border rounded-md px-1.5 py-0.5 font-inherit outline-none min-w-0 w-full"
          style={{
            color: '#1c3045',
            borderColor: entry.display_name ? '#bfdbfe' : '#dce8f0',
            background: entry.display_name ? '#eff6ff' : '#f8fbfd',
          }}
        />

        {/* CATEGORY */}
        {catPill ? (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap', background: catPill.bg, color: catPill.color, border: `1px solid ${catPill.border}` }}>
            {catPill.label}
          </span>
        ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>}

        {/* USER UOM */}
        {(() => {
          const uom = effectiveAttributeUom || mappingData.blueprintDefaultUom
          return (
            <span style={{ fontSize: 11, color: effectiveAttributeUom ? '#1c3045' : uom ? '#5a7a8f' : '#d1d5db', fontWeight: effectiveAttributeUom ? 600 : 400 }}>
              {uom || '—'}
            </span>
          )
        })()}

        {/* VALUE */}
        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: valueDisplay ? '#1c3045' : '#9ca3af', fontStyle: valueDisplay ? 'normal' : 'italic' }}>
          {valueDisplay || 'Not mapped'}
        </span>

        {/* STATUS + Configure */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isFulfilled ? '#059669' : '#9ca3af', whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: isFulfilled ? '#10b981' : '#d1d5db' }} />
            {isFulfilled ? 'Fulfilled' : 'Pending'}
          </span>
          <button
            onClick={() => setIsExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6,
              fontFamily: 'inherit', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              transition: 'all 0.12s',
              border: `1px solid ${isExpanded ? '#bfdbfe' : '#dce8f0'}`,
              background: isExpanded ? '#eff6ff' : '#f8fbfd',
              color: isExpanded ? '#1d4ed8' : '#3d5a70',
            }}
          >
            Configure
            <svg style={{ width: 10, height: 10, flexShrink: 0, transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded configure panel */}
      <div style={{ overflow: 'hidden', maxHeight: isExpanded ? '800px' : '0', transition: isExpanded ? 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div style={{ padding: '10px 12px 14px', background: '#edf3fb', borderTop: '2px solid #bfdbfe' }}>

          {/* Tag type selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            {(() => {
              const filteredTabs = (['pi', 'formula', 'constant'] as TagType[]).filter(t => {
                if (attributeType === 'Constant') return t === 'constant'
                if (attributeType === 'Inferred') return t === 'formula'
                if (attributeType === 'Cause' || attributeType === 'Effect') return t === 'formula'
                return t === 'pi' || t === 'formula'
              })

              if (filteredTabs.length === 1) {
                const tabName = filteredTabs[0] === 'pi' ? 'PI Sensor' : filteredTabs[0] === 'formula' ? 'Formula' : 'Constant'
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}>
                    {tabName}
                  </span>
                )
              }

              return (
                <div style={{ display: 'flex', gap: 6 }}>
                  {filteredTabs.map(t => {
                    const isDisabledByData = (t === 'constant' && hasNonConstantData) || ((t === 'pi' || t === 'formula') && hasConstantData)
                    const isDisabledByType = (t === 'constant' && isConstantTabDisabled) || (t === 'pi' && isPiTabDisabled) || (t === 'formula' && isFormulaTabDisabled)
                    const isDisabled = isDisabledByData || isDisabledByType
                    const isActive = entry.tag_type === t
                    return (
                      <button key={t} disabled={isDisabled}
                        onClick={() => {
                          const isPiFormula = (entry.tag_type === 'pi' || entry.tag_type === 'formula') && (t === 'pi' || t === 'formula')
                          if (isPiFormula) update({ tag_type: t })
                          else update({ ...DEFAULT_TAG_ENTRY, tag_type: t })
                        }}
                        style={{
                          padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          fontFamily: 'inherit', cursor: isDisabled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.12s',
                          border: `1px solid ${isActive ? '#2563eb' : isDisabled ? '#e2e8f0' : '#dce8f0'}`,
                          background: isActive ? '#2563eb' : isDisabled ? '#f8f9fa' : '#fff',
                          color: isActive ? '#fff' : isDisabled ? '#cbd5e1' : '#3d5a70',
                        }}
                      >
                        {t === 'pi' ? 'PI Sensor' : t === 'formula' ? 'Formula' : 'Constant'}
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Type override select — hidden for Cause/Effect */}
            {mappingData.blueprintType && !isCauseOrEffect && (
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={attributeType}
                  onChange={e => handleTypeChange(e.target.value)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: '1px solid #dce8f0', background: '#fff', color: '#3d5a70', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <option value="">— Type —</option>
                  <option value="PI">PI</option>
                  <option value="Inferred">Inferred</option>
                  <option value="Constant">Constant</option>
                </select>
              </div>
            )}
          </div>

          {/* Sub-forms */}
          {entry.tag_type === 'pi' && !isPiTabDisabled && (
            <PISensorForm entry={entry} onUpdate={update}
              uomCategory={mappingData.uomCategory}
              blueprintDefaultUom={mappingData.blueprintDefaultUom}
              blueprintType={mappingData.blueprintType}
              blueprintDataType={mappingData.blueprintDataType}
              attributeType={attributeType}
              attributeDataType={attributeDataType}
              onAttributeTypeChange={setAttributeType}
              onAttributeDataTypeChange={handleDataTypeChange}
              blueprintFlagMa={mappingData.blueprintFlagMa}
              blueprintSipPolicies={mappingData.blueprintSipPolicies}
              modelIds={mappingData.blueprintModelIds}
              models={models}
            />
          )}
          {entry.tag_type === 'formula' && !isFormulaTabDisabled && (
            (attributeType === 'Inferred' || isCauseOrEffect)
              ? <InferredFormulaForm entry={entry} onUpdate={update}
                  blueprintFormula={mappingData.blueprintFormula}
                  expandedFormula={mappingData.expandedFormula}
                  blueprintDefaultUom={isCauseOrEffect ? '' : mappingData.blueprintDefaultUom}
                  uomCategory={isCauseOrEffect ? '' : mappingData.uomCategory}
                  blueprintFlagMa={isCauseOrEffect ? false : mappingData.blueprintFlagMa}
                  blueprintSipPolicies={isCauseOrEffect ? [] : mappingData.blueprintSipPolicies}
                  modelIds={isCauseOrEffect ? [] : mappingData.blueprintModelIds}
                  models={models} />
              : <FormulaForm entry={entry} onUpdate={update}
                  blueprintDefaultUom={mappingData.blueprintDefaultUom}
                  blueprintType={mappingData.blueprintType}
                  attributeType={attributeType}
                  onAttributeTypeChange={setAttributeType} />
          )}
          {entry.tag_type === 'constant' && !isConstantTabDisabled && (
            <ConstantForm entry={entry} onUpdate={update}
              disabled={hasNonConstantData}
              uomCategory={mappingData.uomCategory}
              blueprintType={mappingData.blueprintType}
              attributeType={attributeType}
              onAttributeTypeChange={setAttributeType}
              blueprintSipPolicies={mappingData.blueprintSipPolicies}
              modelIds={mappingData.blueprintModelIds}
              models={models} />
          )}
        </div>
      </div>

      {/* Type Change Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-surface rounded-xl shadow-2xl w-[90%] max-w-sm p-6">
            <h3 className="text-sm font-bold text-accent-blue mb-2">Change Type?</h3>
            <p className="text-xs text-text-secondary mb-5 leading-relaxed">
              This attribute&apos;s blueprint type is <strong>{mappingData.blueprintType}</strong>. Change it to <strong>{confirmDialog.pendingType}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={cancelTypeChange} className="px-4 py-1.5 rounded-lg border border-border bg-background text-text-primary text-xs font-semibold cursor-pointer">Cancel</button>
              <button onClick={confirmTypeChange} className="px-4 py-1.5 rounded-lg border-none bg-accent-blue text-white text-xs font-semibold cursor-pointer">Change Type</button>
            </div>
          </div>
        </div>
      )}

      {/* Data Type Change Confirmation Dialog */}
      {confirmDataTypeDialog.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-surface rounded-xl shadow-2xl w-[90%] max-w-sm p-6">
            <h3 className="text-sm font-bold text-accent-blue mb-2">Change Data Type?</h3>
            <p className="text-xs text-text-secondary mb-5 leading-relaxed">
              Blueprint data type is <strong>{mappingData.blueprintDataType || 'None'}</strong>. Change to <strong>{confirmDataTypeDialog.pendingDataType || 'None'}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={cancelDataTypeChange} className="px-4 py-1.5 rounded-lg border border-border bg-background text-text-primary text-xs font-semibold cursor-pointer">Cancel</button>
              <button onClick={confirmDataTypeChange} className="px-4 py-1.5 rounded-lg border-none bg-accent-blue text-white text-xs font-semibold cursor-pointer">Change Data Type</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AttributeForm({ node, attributes }: Props) {
  if (!attributes.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-2.5 p-10">
        <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm font-semibold text-text-secondary m-0 text-center">No attributes for this node</p>
        <p className="text-xs text-text-secondary m-0 text-center max-w-[260px]">
          Select a node with model-mapped attributes or add tag mappings in Step 3.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Node header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #dce8f0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="text-sm font-bold text-accent-blue">{node.name}</div>
        <div className="text-xs text-text-secondary">{attributes.length} attribute{attributes.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '7px 14px', gap: 8, background: '#f4f8fb', borderBottom: '2px solid #dce8f0' }}>
        {['Attribute', 'Display Name', 'Category', 'User UOM', 'Value', 'Status'].map(h => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</span>
        ))}
      </div>

      {/* Attribute rows */}
      {attributes.map(attr => (
        <TagRow key={attr} attribute={attr} nodeId={node.id} level={node.level} node={node} />
      ))}
    </div>
  )
}
