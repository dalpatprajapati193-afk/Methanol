'use client'

import { useState } from 'react'
import { useAtomValue } from 'jotai'
import {
  formStateAtom,
  uomIndexAtom,
  modelParametersBlueprintAtom,
  imputationPolicyAtom,
} from '../../store/dcuAtoms'
import { generateOutputs } from '../../utils/outputGenerator'
import type { ModelTagMapping, TagEntry, OutputRow_InstantiatedAttributes } from '../../types'

interface Props { onNext: () => void; onBack: () => void }

interface InstIssue {
  ownerTag: string
  refTag: string
  issue: 'missing' | 'pi_unmapped' | 'constant_empty'
}

function toShortName(row: OutputRow_InstantiatedAttributes): string {
  if (row.level === 'System') return row.attribute
  return row.element_path.replace(/\//g, '_').toLowerCase() + '_' + row.attribute
}

function buildInstantiatedIssues(
  instantiated: OutputRow_InstantiatedAttributes[],
  selectedModelIds: number[],
  tagMappings: ModelTagMapping[],
  tagEntries: Record<string, Record<string, TagEntry>>,
): InstIssue[] {
  const issues: InstIssue[] = []
  const active = tagMappings.filter(m => m.model_ids.some(id => selectedModelIds.includes(id)))
  const activePiAttrs = new Set<string>()
  const activeConstantAttrs = new Set<string>()
  for (const m of active) {
    if (m.type === 'PI') activePiAttrs.add(m.attribute)
    if (m.type === 'Constant') activeConstantAttrs.add(m.attribute)
  }
  const toNodeId = (elementPath: string) => elementPath === 'DCU' ? 'system_dcu' : elementPath
  const isMappedPi = (row: OutputRow_InstantiatedAttributes) => {
    const e = tagEntries[toNodeId(row.element_path)]?.[row.attribute]
    return !!e?.pi_sensors.some(s => s.sensor_name?.trim())
  }
  const hasConstantValue = (row: OutputRow_InstantiatedAttributes) => {
    const e = tagEntries[toNodeId(row.element_path)]?.[row.attribute]
    return !!e?.constant_value?.trim()
  }
  const allShortNames = new Set<string>()
  for (const row of instantiated) allShortNames.add(toShortName(row))
  const seen = new Set<string>()
  for (const row of instantiated) {
    if (!row.formula) continue
    const ownerTag = toShortName(row)
    const noStrings = row.formula.replace(/"[^"]*"/g, '""')
    const tokens = noStrings.match(/\{([^}]+)\}/g) ?? []
    for (const token of tokens) {
      const refTag = token.slice(1, -1).trim()
      if (!refTag || refTag === ownerTag) continue
      const dedupKey = `${ownerTag}|${refTag}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      if (!allShortNames.has(refTag)) issues.push({ ownerTag, refTag, issue: 'missing' })
    }
  }
  for (const row of instantiated) {
    if (!activePiAttrs.has(row.attribute)) continue
    if (!isMappedPi(row)) issues.push({ ownerTag: toShortName(row), refTag: '', issue: 'pi_unmapped' })
  }
  for (const row of instantiated) {
    if (!activeConstantAttrs.has(row.attribute)) continue
    if (!hasConstantValue(row)) issues.push({ ownerTag: toShortName(row), refTag: '', issue: 'constant_empty' })
  }
  return issues
}

export default function StepSanityCheck({ onNext, onBack }: Props) {
  const state = useAtomValue(formStateAtom)
  const uomIndex = useAtomValue(uomIndexAtom)
  const [instExpanded, setInstExpanded] = useState(true)

  const { instantiated } = generateOutputs(state, uomIndex)

  const instIssues = buildInstantiatedIssues(instantiated, state.selectedModelIds, state.tagMappings, state.tagEntries)
  const instMissingIssues = instIssues.filter(i => i.issue === 'missing')
  const instPiIssues = instIssues.filter(i => i.issue === 'pi_unmapped')
  const instConstIssues = instIssues.filter(i => i.issue === 'constant_empty')
  const instAllClear = instIssues.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 2px 80px' }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Sanity Check</h2>
          <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Review tag reference issues before proceeding to the final review.</p>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: instAllClear ? '#d4edda' : '#fff3cd', border: `1px solid ${instAllClear ? '#c3e6cb' : '#ffc107'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          {instAllClear ? (
            <svg style={{ width: 18, height: 18, color: '#155724', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg style={{ width: 18, height: 18, color: '#856404', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: instAllClear ? '#155724' : '#856404' }}>
            {instAllClear ? 'All checks passed — no issues found.' : `${instIssues.length} issue${instIssues.length !== 1 ? 's' : ''} found.`}
          </span>
        </div>

        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => setInstExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: instAllClear ? '#d4edda' : '#fff3cd', border: 'none', borderRadius: instExpanded ? '8px 8px 0 0' : 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            {instAllClear ? (
              <svg style={{ width: 16, height: 16, color: '#155724', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg style={{ width: 16, height: 16, color: '#856404', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', flex: 1, color: instAllClear ? '#155724' : '#856404' }}>
              Instantiated Tag Check
              {instAllClear ? ' — All generated tags accounted for' : ` — ${instIssues.length} issue${instIssues.length !== 1 ? 's' : ''} found`}
            </span>
            <span style={{ fontSize: 10, color: instAllClear ? '#155724' : '#856404', fontWeight: 600 }}>{instExpanded ? '▲' : '▼'}</span>
          </button>

          {instExpanded && (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #eef2f7' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' }}>Formula Tags</p>
                {instMissingIssues.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#155724', fontSize: 12 }}>
                    <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    All formula tag references are accounted for
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid #f5c6cb', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: 12, padding: '6px 12px', background: '#f8d7da', borderBottom: '1px solid #f5c6cb' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#721c24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Short Names</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#721c24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Missing tag used in formula</span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {instMissingIssues.map((issue, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: 12, alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #f0f5f9', background: i % 2 === 0 ? '#fff' : '#fff8f8' }}>
                          <span style={{ fontFamily: 'monospace', color: '#1c3045', fontWeight: 600, fontSize: 11, wordBreak: 'break-all' }}>{issue.ownerTag}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#721c24', wordBreak: 'break-all' }}>{issue.refTag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #eef2f7' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' }}>PI Tags</p>
                {instPiIssues.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#155724', fontSize: 12 }}>
                    <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    All PI tags have sensors mapped
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid #9ecbf1', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', padding: '6px 12px', background: '#cce5ff', borderBottom: '1px solid #9ecbf1' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#004085', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tag (no sensor mapped)</span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {instPiIssues.map((issue, i) => (
                        <div key={i} style={{ padding: '7px 12px', borderBottom: '1px solid #f0f5f9', background: i % 2 === 0 ? '#fff' : '#f0f7ff' }}>
                          <span style={{ fontFamily: 'monospace', color: '#1c3045', fontWeight: 600, fontSize: 11, wordBreak: 'break-all' }}>{issue.ownerTag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' }}>Constant Tags</p>
                {instConstIssues.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#155724', fontSize: 12 }}>
                    <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    All constants have values set
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid #c5a8e8', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', padding: '6px 12px', background: '#e2d9f3', borderBottom: '1px solid #c5a8e8' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#4a235a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tag (no value set)</span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {instConstIssues.map((issue, i) => (
                        <div key={i} style={{ padding: '7px 12px', borderBottom: '1px solid #f0f5f9', background: i % 2 === 0 ? '#fff' : '#f9f5ff' }}>
                          <span style={{ fontFamily: 'monospace', color: '#1c3045', fontWeight: 600, fontSize: 11, wordBreak: 'break-all' }}>{issue.ownerTag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border pt-3">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>
          ← Back to Tag Mapping
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={onNext}>
          Continue to Review →
        </button>
      </div>
    </div>
  )
}
