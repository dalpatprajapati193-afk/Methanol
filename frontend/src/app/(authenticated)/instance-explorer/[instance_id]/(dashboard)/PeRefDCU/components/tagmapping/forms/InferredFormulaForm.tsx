'use client'

import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import type { TagEntry, AttributeSipPolicy, ModelEntry } from '../../../types'
import { uomIndexAtom, imputationPolicyAtom } from '../../../store/dcuAtoms'
import { getUomsByCategory } from '../../../utils/uomUtils'
import SipPolicyModal from '../../shared/SipPolicyModal'

interface Props {
  entry: TagEntry
  onUpdate: (patch: Partial<TagEntry>) => void
  blueprintFormula: string
  expandedFormula: string
  blueprintDefaultUom: string
  uomCategory: string
  blueprintFlagMa?: boolean
  blueprintSipPolicies?: AttributeSipPolicy[]
  modelIds?: number[]
  models?: ModelEntry[]
}

export default function InferredFormulaForm({
  entry, onUpdate, blueprintFormula, expandedFormula, blueprintDefaultUom, uomCategory,
  blueprintFlagMa, blueprintSipPolicies = [], modelIds = [], models = [],
}: Props) {
  const uomIndex = useAtomValue(uomIndexAtom)
  const imputationPolicy = useAtomValue(imputationPolicyAtom)

  const [defaultUom, setDefaultUom] = useState(entry.default_uom)
  const [sipPolicies, setSipPolicies] = useState<AttributeSipPolicy[]>(() => entry.sip_policies || blueprintSipPolicies)
  const [showSipModal, setShowSipModal] = useState(false)

  useEffect(() => {
    setDefaultUom(entry.default_uom)
  }, [entry])

  useEffect(() => {
    onUpdate({ default_uom: defaultUom })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUom])

  const uomOptions = uomCategory ? getUomsByCategory(uomIndex, uomCategory) : []

  return (
    <div className="space-y-2 mt-2">
      {/* Editable Formula Expression */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-text-secondary">Formula Expression</label>
          {entry.expression_override && (
            <button
              type="button"
              onClick={() => onUpdate({ expression_override: undefined })}
              className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 cursor-pointer font-[inherit]"
            >
              Reset to blueprint
            </button>
          )}
        </div>
        <textarea
          value={entry.expression_override ?? expandedFormula}
          onChange={e => {
            const val = e.target.value
            onUpdate({ expression_override: val === expandedFormula ? undefined : val || undefined })
          }}
          rows={3}
          spellCheck={false}
          className={`w-full box-border font-mono text-[11px] text-text-primary border rounded-md px-2.5 py-1.5 resize-y outline-none leading-[1.55]
            ${entry.expression_override
              ? 'border-purple-300 bg-purple-50'
              : 'border-border bg-background'
            }`}
        />
        {!expandedFormula && !entry.expression_override && (
          <p className="text-xs italic text-text-secondary mt-1">No formula defined in blueprint</p>
        )}
      </div>

      {/* Default UOM + Moving Average + SIP Policy row */}
      <div className="flex gap-4 items-start">
        {uomCategory && (
          <div className="flex-1">
            <label className="text-xs font-semibold text-text-secondary mb-1 block">Default UOM</label>
            <select
              value={defaultUom}
              onChange={e => setDefaultUom(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="">— Select UOM —</option>
              {uomOptions.map(uom => (
                <option key={uom.symbol} value={uom.symbol}>
                  {uom.symbol} ({uom.name})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="shrink-0">
          <label className="text-xs font-semibold text-text-secondary mb-1 block">Moving Average Check</label>
          <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={entry.flag_ma ?? blueprintFlagMa ?? false}
              onChange={e => onUpdate({ flag_ma: e.target.checked })}
              className="w-3.5 h-3.5 cursor-pointer accent-blue-700"
            />
            <span className="text-xs text-text-secondary">Enable MA check</span>
          </label>
          {blueprintFlagMa && (
            <p className="text-xs text-accent-orange mt-1">Blueprint default: Yes</p>
          )}
        </div>
        <div className="shrink-0">
          <label className="text-xs font-semibold text-text-secondary mb-1 block">SIP Policy</label>
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
