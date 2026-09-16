'use client'

import { useState } from 'react'
import type { AttributeSipPolicy, ImputationPolicyEntry } from '../../types'

interface PolicyOption {
  value: string
  label: string
}

const optionsFor = (imputationPolicy: ImputationPolicyEntry[], policyType: string): PolicyOption[] =>
  imputationPolicy
    .filter(p => p.policy_type === policyType)
    .map(p => ({ value: p.policy_action, label: p.policy_description }))

const DEFAULT_ROW = (model_id: number): AttributeSipPolicy => ({
  model_id,
  sip_min: null,
  sip_max: null,
  sip_default: null,
  tag_oob_switch: 'no_check',
  tag_stuck_switch: 'no_check',
  tag_nan_switch: 'no_check',
  default_switch: 'no_check',
})

type SyncField = 'sip_min' | 'sip_max' | 'sip_default' | 'tag_oob_switch' | 'tag_stuck_switch' | 'tag_nan_switch' | 'default_switch'

interface Props {
  modelIds: number[]
  models: { model_id: number; model_alias: string }[]
  sipPolicies: AttributeSipPolicy[]
  imputationPolicy: ImputationPolicyEntry[]
  onSave: (policies: AttributeSipPolicy[]) => void
  onClose: () => void
}

const inputCls = 'w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface'
const selectCls = 'w-full border border-border rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface'

function SyncPill({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border-none cursor-pointer tracking-[0.2px] transition-colors whitespace-nowrap ${
        on
          ? 'bg-accent-green/20 text-accent-green'
          : 'bg-surface text-text-secondary'
      }`}
      title={on ? 'Synced — click to set per-model values' : 'Individual — click to sync all models'}
    >
      {on ? (
        <>
          <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Synced
        </>
      ) : (
        <>
          <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            <line x1="2" y1="2" x2="22" y2="22" strokeWidth={2.5} />
          </svg>
          Individual
        </>
      )}
    </button>
  )
}

export default function SipPolicyModal({ modelIds, models, sipPolicies, imputationPolicy, onSave, onClose }: Props) {
  const [rows, setRows] = useState<AttributeSipPolicy[]>(() =>
    modelIds.map(mid => {
      const existing = sipPolicies.find(p => p.model_id === mid)
      return existing ? { ...existing } : DEFAULT_ROW(mid)
    })
  )

  const [sync, setSync] = useState<Record<SyncField, boolean>>({
    sip_min: true, sip_max: true, sip_default: true,
    tag_oob_switch: true, tag_stuck_switch: true,
    tag_nan_switch: true, default_switch: true,
  })

  const OOB_OPTIONS     = optionsFor(imputationPolicy, 'tag_out_of_bound_switch')
  const STUCK_OPTIONS   = optionsFor(imputationPolicy, 'tag_stuck_switch')
  const NAN_OPTIONS     = optionsFor(imputationPolicy, 'tag_nan_switch')
  const DEFAULT_OPTIONS = optionsFor(imputationPolicy, 'default_switch')

  const update = (mid: number, field: SyncField, value: number | null | string) =>
    setRows(prev =>
      sync[field]
        ? prev.map(r => ({ ...r, [field]: value }))
        : prev.map(r => r.model_id === mid ? { ...r, [field]: value } : r)
    )

  const toggleSync = (field: SyncField) => {
    const turningOn = !sync[field]
    if (turningOn && rows.length > 0) {
      const firstVal = rows[0][field]
      setRows(prev => prev.map(r => ({ ...r, [field]: firstVal })))
    }
    setSync(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const modelName = (mid: number) =>
    models.find(m => m.model_id === mid)?.model_alias ?? String(mid)

  const parseNum = (val: string) => val.trim() === '' ? null : Number(val)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(98vw, 1280px)', maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <div className="text-sm font-bold text-text-primary">SIP Policy Configuration</div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              Toggle <span className="text-accent-green font-semibold">Synced</span> per column to propagate changes to all models, or <span className="text-text-secondary font-semibold">Individual</span> for per-model values.
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-text-secondary p-1 rounded-md hover:text-text-primary transition-colors shrink-0"
          >
            <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">Model</th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>SIP Min</div>
                  <SyncPill on={sync.sip_min} onToggle={() => toggleSync('sip_min')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>SIP Max</div>
                  <SyncPill on={sync.sip_max} onToggle={() => toggleSync('sip_max')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>SIP Default</div>
                  <SyncPill on={sync.sip_default} onToggle={() => toggleSync('sip_default')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>Tag OOB Switch</div>
                  <SyncPill on={sync.tag_oob_switch} onToggle={() => toggleSync('tag_oob_switch')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>Tag Stuck Switch</div>
                  <SyncPill on={sync.tag_stuck_switch} onToggle={() => toggleSync('tag_stuck_switch')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>Tag NaN Switch</div>
                  <SyncPill on={sync.tag_nan_switch} onToggle={() => toggleSync('tag_nan_switch')} />
                </th>
                <th className="px-2 pt-2 pb-1.5 text-left text-[11px] font-semibold text-text-secondary bg-surface-hover border-b border-border sticky top-0 z-10 align-top">
                  <div>Default Switch</div>
                  <SyncPill on={sync.default_switch} onToggle={() => toggleSync('default_switch')} />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.model_id} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-surface'}`}>
                  <td className="px-2 py-2">
                    <span className="inline-block text-[11px] font-semibold bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-md px-1.5 py-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {modelName(row.model_id)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      className={inputCls}
                      value={row.sip_min ?? ''}
                      placeholder="e.g. 0"
                      onChange={e => update(row.model_id, 'sip_min', parseNum(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      className={inputCls}
                      value={row.sip_max ?? ''}
                      placeholder="e.g. 1200"
                      onChange={e => update(row.model_id, 'sip_max', parseNum(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      className={inputCls}
                      value={row.sip_default ?? ''}
                      placeholder="e.g. 0"
                      onChange={e => update(row.model_id, 'sip_default', parseNum(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={selectCls} value={row.tag_oob_switch} onChange={e => update(row.model_id, 'tag_oob_switch', e.target.value)}>
                      {OOB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={selectCls} value={row.tag_stuck_switch} onChange={e => update(row.model_id, 'tag_stuck_switch', e.target.value)}>
                      {STUCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={selectCls} value={row.tag_nan_switch} onChange={e => update(row.model_id, 'tag_nan_switch', e.target.value)}>
                      {NAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={selectCls} value={row.default_switch} onChange={e => update(row.model_id, 'default_switch', e.target.value)}>
                      {DEFAULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface-hover text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(rows)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border-none bg-accent-blue text-white cursor-pointer hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
