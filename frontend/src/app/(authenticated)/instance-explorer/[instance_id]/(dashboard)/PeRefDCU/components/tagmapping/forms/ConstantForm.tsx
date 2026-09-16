'use client'

import { useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import type { TagEntry, AttributeSipPolicy, ModelEntry } from '../../../types'
import { getUomsByCategory, getAllCategories } from '../../../utils/uomUtils'
import { uomIndexAtom, imputationPolicyAtom } from '../../../store/dcuAtoms'
import SipPolicyModal from '../../shared/SipPolicyModal'

interface Props {
  entry: TagEntry
  onUpdate: (patch: Partial<TagEntry>) => void
  disabled?: boolean
  uomCategory?: string
  blueprintType?: string
  attributeType?: string
  onAttributeTypeChange?: (type: string) => void
  blueprintSipPolicies?: AttributeSipPolicy[]
  modelIds?: number[]
  models?: ModelEntry[]
}

const inputCls = 'w-full border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface'
const labelCls = 'text-xs font-semibold text-text-secondary mb-0.5 block'

export default function ConstantForm({
  entry, onUpdate, disabled, uomCategory,
  blueprintSipPolicies = [], modelIds = [], models = [],
}: Props) {
  const uomIndex = useAtomValue(uomIndexAtom)
  const imputationPolicy = useAtomValue(imputationPolicyAtom)

  const uomOptions = useMemo(() => {
    if (!uomCategory) {
      const cats = getAllCategories(uomIndex)
      return cats.length > 0 ? getUomsByCategory(uomIndex, cats[0]) : []
    }
    return getUomsByCategory(uomIndex, uomCategory)
  }, [uomCategory, uomIndex])

  const [sipPolicies, setSipPolicies] = useState<AttributeSipPolicy[]>(() => entry.sip_policies || blueprintSipPolicies)
  const [showSipModal, setShowSipModal] = useState(false)

  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      {disabled && (
        <div className="col-span-3 text-xs text-accent-orange bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-2">
          Constant is disabled because PI Sensor or Formula data is present.
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls}>Constant Value</label>
          <input
            className={inputCls}
            placeholder="e.g. radiant, 48"
            value={entry.constant_value}
            onChange={e => onUpdate({ constant_value: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Default UOM</label>
          <select
            className={inputCls}
            value={entry.default_uom}
            onChange={e => onUpdate({ default_uom: e.target.value })}
          >
            <option value="">— Select UOM —</option>
            {uomOptions.map(u => (
              <option key={u.symbol} value={u.symbol}>{u.symbol} ({u.name})</option>
            ))}
          </select>
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
                : 'text-accent-blue hover:text-blue-700 border-blue-300 hover:border-blue-400 bg-surface hover:bg-blue-50'
            }`}
            title={modelIds.length === 0 ? 'No models assigned to this attribute' : 'Configure SIP policy per model'}
          >
            Configure…
            {sipPolicies.length > 0 && (
              <span className="ml-1 bg-blue-100 text-accent-blue text-xs font-bold px-1.5 py-0.5 rounded-full">
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
