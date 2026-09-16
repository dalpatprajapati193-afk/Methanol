'use client'

import { useMemo, useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { imputationPolicyAtom, uomIndexAtom } from '../../../store/dcuAtoms'
import type { TagEntry, PISensor, AttributeSipPolicy, ModelEntry } from '../../../types'
import { getUomsByCategory, getAllCategories } from '../../../utils/uomUtils'
import SipPolicyModal from '../../shared/SipPolicyModal'

interface Props {
  entry: TagEntry
  onUpdate: (patch: Partial<TagEntry>) => void
  uomCategory?: string
  blueprintDefaultUom?: string
  blueprintType?: string
  blueprintDataType?: string
  attributeType?: string
  attributeDataType?: string
  onAttributeTypeChange?: (type: string) => void
  onAttributeDataTypeChange?: (dataType: string) => void
  disableSensorFields?: boolean
  blueprintFlagMa?: boolean
  blueprintSipPolicies?: AttributeSipPolicy[]
  modelIds?: number[]
  models?: ModelEntry[]
}

const inputCls = 'w-full border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface'
const labelCls = 'text-xs font-semibold text-text-secondary mb-0.5 block'
const sipInputCls = 'w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface'

export default function PISensorForm({
  entry, onUpdate, uomCategory, blueprintDefaultUom, blueprintDataType, attributeDataType,
  onAttributeDataTypeChange, disableSensorFields, blueprintFlagMa,
  blueprintSipPolicies = [], modelIds = [], models = []
}: Props) {
  const uomIndex = useAtomValue(uomIndexAtom)
  const imputationPolicy = useAtomValue(imputationPolicyAtom)
  const [sipPolicies, setSipPolicies] = useState<AttributeSipPolicy[]>(() => entry.sip_policies || blueprintSipPolicies)
  const [showSipModal, setShowSipModal] = useState(false)

  const sensors = entry.pi_sensors.length > 0 ? entry.pi_sensors : [{ sensor_code: '', sensor_name: '', sensor_uom: '' }]
  const uomOptions = useMemo(() => {
    if (!uomCategory) {
      const categories = getAllCategories(uomIndex)
      return categories.length > 0 ? getUomsByCategory(uomIndex, categories[0]) : []
    }
    return getUomsByCategory(uomIndex, uomCategory)
  }, [uomCategory, uomIndex])

  const isUomValid = (uom: string | undefined) => !!uom && uomOptions.some(u => u.symbol === uom)
  const validAttributeUom = isUomValid(entry.attribute_uom) ? entry.attribute_uom! : ''

  useEffect(() => {
    // No uomSet equivalent in Jotai version — auto-fill skipped (handled by applyUomSetAtom globally)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSensor = (idx: number, patch: Partial<PISensor>) => {
    const updated = sensors.map((s, i) => i === idx ? { ...s, ...patch } : s)
    const uomPatch: Partial<TagEntry> = { pi_sensors: updated }
    if (idx === 0 && patch.sensor_uom !== undefined) {
      uomPatch.default_uom = patch.sensor_uom
    }
    onUpdate(uomPatch)
  }

  const addSensor = () => {
    const nextIdx = sensors.length + 1
    onUpdate({ pi_sensors: [...sensors, { sensor_code: `sensor-${nextIdx}`, sensor_name: '', sensor_uom: '' }] })
  }

  const removeSensor = (idx: number) => {
    if (sensors.length === 1) return
    const updated = sensors
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, sensor_code: `sensor-${i + 1}` }))
    const uomPatch: Partial<TagEntry> = { pi_sensors: updated }
    if (idx === 0) uomPatch.default_uom = updated[0]?.sensor_uom ?? ''
    onUpdate(uomPatch)
  }

  const gridCols = blueprintDataType
    ? 'grid-cols-[80px_1fr_1fr_150px_auto]'
    : 'grid-cols-[80px_1fr_1fr_auto]'

  return (
    <div className="space-y-2">
      {/* Sensor rows */}
      <div>
        <div className={`grid ${gridCols} gap-2 mb-1`}>
          <span className={labelCls}>Sensor Code</span>
          <span className={labelCls}>Sensor Name (PI tag)</span>
          <span className={labelCls}>Sensor UOM</span>
          {blueprintDataType && <span className={labelCls}>Data Type <span className="text-text-secondary font-normal">(from Blueprint)</span></span>}
          <span />
        </div>
        <div className="space-y-2">
          {sensors.map((s, idx) => (
            <div key={idx} className="border border-border rounded p-1.5 bg-background">
              {/* Main sensor row */}
              <div className={`grid ${gridCols} gap-2 items-center mb-1`}>
                <span className="text-xs font-mono font-semibold text-accent-blue bg-surface border border-border rounded-md px-2 py-1 text-center select-none">
                  sensor-{idx + 1}
                </span>
                <input
                  className={`${inputCls} ${disableSensorFields ? 'opacity-50 cursor-not-allowed bg-surface' : ''}`}
                  placeholder="e.g. TI_30160"
                  value={s.sensor_name}
                  onChange={e => updateSensor(idx, { sensor_name: e.target.value })}
                  disabled={disableSensorFields}
                />
                <select
                  className={`${inputCls} ${blueprintDefaultUom ? 'bg-amber-50 border-amber-200' : ''} ${disableSensorFields ? 'opacity-50 cursor-not-allowed bg-surface' : ''}`}
                  value={s.sensor_uom}
                  onChange={e => updateSensor(idx, { sensor_uom: e.target.value })}
                  title={blueprintDefaultUom ? 'Sensor UOM should match the default UOM set in Blueprint Manager' : ''}
                  disabled={disableSensorFields}
                >
                  <option value="">— Select UOM —</option>
                  {uomOptions.map(u => (
                    <option key={u.symbol} value={u.symbol}>{u.symbol} ({u.name})</option>
                  ))}
                </select>
                {blueprintDataType && (
                  <select
                    className={`${inputCls} ${attributeDataType && attributeDataType !== blueprintDataType ? 'bg-amber-50 border-amber-200' : ''}`}
                    value={attributeDataType || ''}
                    onChange={e => onAttributeDataTypeChange?.(e.target.value)}
                    title={`Blueprint default: ${blueprintDataType}`}
                  >
                    <option value="">— None —</option>
                    <option value="continuous">Continuous</option>
                    <option value="discrete">Discrete</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => removeSensor(idx)}
                  disabled={sensors.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-accent-red hover:border-accent-red disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-surface"
                  title="Remove sensor"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* SIP config sub-row */}
              <div className="grid grid-cols-4 gap-2 pl-[88px]">
                <div>
                  <label className="text-xs text-text-secondary mb-0.5 block">SIP Min</label>
                  <input
                    className={sipInputCls}
                    type="number"
                    placeholder="e.g. 0"
                    value={s.sip_min ?? ''}
                    onChange={e => updateSensor(idx, { sip_min: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-0.5 block">SIP Max</label>
                  <input
                    className={sipInputCls}
                    type="number"
                    placeholder="e.g. 1200"
                    value={s.sip_max ?? ''}
                    onChange={e => updateSensor(idx, { sip_max: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-0.5 block">SIP Default</label>
                  <input
                    className={sipInputCls}
                    type="number"
                    placeholder="e.g. 0"
                    value={s.sip_default_value ?? ''}
                    onChange={e => updateSensor(idx, { sip_default_value: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-0.5 block">SIP Policy</label>
                  <select
                    className={sipInputCls}
                    value={s.sip_policy ?? '0'}
                    onChange={e => updateSensor(idx, { sip_policy: e.target.value as '0' | 'last_good_value' })}
                  >
                    <option value="0">Zero Fill (0)</option>
                    <option value="last_good_value">Last Good Value</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSensor}
          disabled={disableSensorFields}
          className={`mt-2 flex items-center gap-1.5 text-xs font-semibold border border-dashed rounded-md px-2.5 py-1 transition-colors ${
            disableSensorFields
              ? 'text-text-secondary border-border cursor-not-allowed opacity-50'
              : 'text-accent-blue hover:text-accent-blue border-accent-blue hover:border-accent-blue'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add sensor
        </button>
      </div>

      {/* Default UOM / User UOM / Moving Average / SIP Policy */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border">
        <div>
          {blueprintDefaultUom ? (
            <>
              <label className={labelCls}>Default UOM <span className="text-amber-600 font-normal">(from Blueprint, read-only)</span></label>
              <div className={`${inputCls} bg-amber-50 border-amber-200 flex items-center cursor-not-allowed`}>
                <span className="font-mono font-semibold text-amber-900">{blueprintDefaultUom}</span>
                <svg className="w-4 h-4 ml-auto text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-xs text-amber-700 mt-1">Set in Blueprint Manager.</p>
            </>
          ) : (
            <>
              <label className={labelCls}>Default UOM <span className="text-text-secondary font-normal">(auto-filled, editable)</span></label>
              <select className={inputCls} value={entry.default_uom}
                onChange={e => onUpdate({ default_uom: e.target.value })}>
                <option value="">— Select UOM —</option>
                {uomOptions.map(u => (
                  <option key={u.symbol} value={u.symbol}>{u.symbol} ({u.name})</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div>
          <label className={labelCls}>User UOM <span className="text-text-secondary font-normal">(editable)</span></label>
          <select
            className={inputCls}
            value={validAttributeUom || blueprintDefaultUom || ''}
            onChange={e => onUpdate({ attribute_uom: e.target.value })}
            title="Unit of measurement for this attribute. Defaults to the blueprint default UOM but can be changed."
          >
            {blueprintDefaultUom && !validAttributeUom && (
              <option value={blueprintDefaultUom}>— Default: {blueprintDefaultUom} —</option>
            )}
            {uomOptions.map(u => (
              <option key={u.symbol} value={u.symbol}>{u.symbol} ({u.name})</option>
            ))}
          </select>
          <p className="text-xs text-text-secondary mt-1">
            {validAttributeUom ? `Currently set to ${validAttributeUom}` : `Using blueprint default: ${blueprintDefaultUom || 'not set'}`}
          </p>
        </div>
        <div>
          <label className={labelCls}>Moving Average Check</label>
          <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={entry.flag_ma ?? blueprintFlagMa ?? false}
              onChange={e => onUpdate({ flag_ma: e.target.checked })}
              className="w-3.5 h-3.5 cursor-pointer accent-accent-blue"
            />
            <span className="text-xs text-text-primary">Enable MA check</span>
          </label>
          {blueprintFlagMa && (
            <p className="text-xs text-amber-700 mt-1">Blueprint default: Yes</p>
          )}
        </div>
        <div>
          <label className={labelCls}>SIP Policy</label>
          <button
            type="button"
            disabled={modelIds.length === 0}
            onClick={() => setShowSipModal(true)}
            className={`mt-1 flex items-center gap-1.5 text-xs font-semibold border rounded-md px-2.5 py-1.5 transition-colors ${
              modelIds.length === 0
                ? 'text-text-secondary border-border cursor-not-allowed opacity-50 bg-surface'
                : 'text-accent-blue hover:text-accent-blue border-accent-blue hover:border-accent-blue bg-surface hover:bg-surface-hover'
            }`}
            title={modelIds.length === 0 ? 'No models assigned to this attribute' : 'Configure SIP policy per model'}
          >
            Configure…
            {sipPolicies.length > 0 && (
              <span className="ml-1 bg-surface text-accent-blue text-xs font-bold px-1.5 py-0.5 rounded-full border border-accent-blue">
                {sipPolicies.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {showSipModal && modelIds.length > 0 && (
        <SipPolicyModal
          modelIds={modelIds}
          models={models.map(m => ({ model_id: m.model_id, model_alias: m.model_alias }))}
          sipPolicies={sipPolicies}
          imputationPolicy={imputationPolicy}
          onSave={policies => { setSipPolicies(policies); onUpdate({ sip_policies: policies }); setShowSipModal(false) }}
          onClose={() => setShowSipModal(false)}
        />
      )}
    </div>
  )
}
