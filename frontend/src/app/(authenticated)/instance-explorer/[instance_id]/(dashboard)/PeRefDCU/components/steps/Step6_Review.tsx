'use client'

import { useState } from 'react'
import { useAtomValue } from 'jotai'
import {
  formStateAtom,
  buildSaveConfigPayloadAtom,
  uomIndexAtom,
  modelParametersBlueprintAtom,
  imputationPolicyAtom,
  modelsAtom,
} from '../../store/dcuAtoms'
import { generateOutputs, downloadPiTagBankExcel, buildPiTagBankExcelBase64, buildModelRegistryGroups } from '../../utils/outputGenerator'
import { submitConfig, syncModelRegistry } from '../../actions/actions'

const SHOW_ADMIN_TOOLS = process.env.NEXT_PUBLIC_PEREFDCU_SHOW_ADMIN_TOOLS === 'true'

interface Props { onBack: () => void; instanceId: string }

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ marginBottom: 14 }}>
    <div className="bg-accent-blue" style={{ padding: '9px 16px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</span>
    </div>
    <div style={{ padding: '14px 16px' }}>{children}</div>
  </div>
)

const TH = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</span>
)

export default function Step6Review({ onBack, instanceId }: Props) {
  const state = useAtomValue(formStateAtom)
  const saveConfigPayload = useAtomValue(buildSaveConfigPayloadAtom)
  const uomIndex = useAtomValue(uomIndexAtom)
  const modelParametersBlueprint = useAtomValue(modelParametersBlueprintAtom)
  const imputationPolicy = useAtomValue(imputationPolicyAtom)
  const models = useAtomValue(modelsAtom)

  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const selectedModels = models.filter(m => state.selectedModelIds.includes(m.model_id))
  const { instantiated, sensorsMapping } = generateOutputs(state, uomIndex)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const registryResult = await syncModelRegistry(instanceId, buildModelRegistryGroups(state))
      if (!registryResult.success) {
        throw new Error(`Model registry sync failed: ${registryResult.error}. Nothing was saved yet — click Submit again to retry.`)
      }

      const excelBase64 = buildPiTagBankExcelBase64(state, uomIndex, modelParametersBlueprint, imputationPolicy, registryResult.data?.rows)
      const result = await submitConfig(instanceId, saveConfigPayload, excelBase64)
      if (!result.success) {
        throw new Error(`Model registry updated successfully, but saving the configuration failed: ${result.error}. Click Submit again to retry — this step is safe to repeat.`)
      }

      if (result.data?.savedAt) localStorage.setItem('configSavedAt', result.data.savedAt)
      setSaveSuccess(true)
      setSubmitted(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to submit config:', errorMsg)
      alert(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const activeAttrs = state.tagMappings.filter(m => m.model_ids.some(id => state.selectedModelIds.includes(id)))
  const byLevel: Record<string, { pi: number; inferred: number; constant: number }> = {}
  for (const m of activeAttrs) {
    if (!byLevel[m.level]) byLevel[m.level] = { pi: 0, inferred: 0, constant: 0 }
    if (m.type === 'PI') byLevel[m.level].pi++
    else if (m.type === 'Inferred') byLevel[m.level].inferred++
    else if (m.type === 'Constant') byLevel[m.level].constant++
  }
  const levelEntries = Object.entries(byLevel)
  const totalPI = levelEntries.reduce((s, [, c]) => s + c.pi, 0)
  const totalInferred = levelEntries.reduce((s, [, c]) => s + c.inferred, 0)
  const totalConstant = levelEntries.reduce((s, [, c]) => s + c.constant, 0)

  const td = (extra?: React.CSSProperties): React.CSSProperties => ({ fontSize: 12, color: '#3d5a70', ...extra })
  const rowGrid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, padding: '7px 12px' })
  const tableHead = (cols: string): React.CSSProperties => ({ ...rowGrid(cols), background: '#f4f8fb', borderBottom: '1px solid #dce8f0' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 2px 16px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {saveSuccess && (
            <div style={{ padding: '12px 16px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 6, marginBottom: 12, color: '#155724', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg style={{ width: 16, height: 16 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Configuration saved successfully
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Review & Submit</h2>
            <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Review your configuration below before final submission.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Dashboard', value: state.dashboard.toUpperCase() || '—' },
              { label: 'Affiliate', value: state.clientId || '—' },
              { label: 'Furnaces', value: state.equipment.furnaces.length },
              { label: 'Drum Trains', value: state.equipment.drumTrains.length },
              { label: 'Models', value: selectedModels.length },
              { label: 'Attributes', value: instantiated.length },
            ].map(card => (
              <div key={card.label} className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ padding: '14px 12px', textAlign: 'center', borderTop: '3px solid #1e3a5f' }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#1c3045', margin: 0, lineHeight: 1.2 }}>{card.value}</p>
                <p style={{ fontSize: 10, color: '#7a95a8', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</p>
              </div>
            ))}
          </div>

          <SectionCard title="Equipment">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {state.equipment.furnaces.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Furnaces</p>
                  <div style={{ border: '1px solid #dce8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={tableHead('2fr 1fr 1fr 1fr')}>{['Name', 'Cells', 'Passes', 'Tubes'].map(h => <TH key={h}>{h}</TH>)}</div>
                    {state.equipment.furnaces.map((f, i) => {
                      const passes = f.cells.reduce((a, c) => a + c.passes.length, 0)
                      const tubes = f.cells.reduce((a, c) => a + c.passes.reduce((b, p) => b + p.tubes.length, 0), 0)
                      return (
                        <div key={i} style={{ ...rowGrid('2fr 1fr 1fr 1fr'), borderBottom: i < state.equipment.furnaces.length - 1 ? '1px solid #f0f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#f9fbfd' }}>
                          <span style={td({ fontWeight: 600, color: '#1c3045' })}>{f.name}</span>
                          <span style={td()}>{f.cells.length}</span>
                          <span style={td()}>{passes}</span>
                          <span style={td()}>{tubes}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {state.equipment.drumTrains.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Drum Trains</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {state.equipment.drumTrains.map((dt, i) => (
                      <div key={i} style={{ padding: '6px 14px', border: '1.5px solid #dce8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1c3045', background: '#f4f8fb' }}>
                        {dt.name}
                        <span style={{ fontWeight: 400, color: '#7a95a8', marginLeft: 6 }}>· {dt.drums.length} {dt.drums.length === 1 ? 'drum' : 'drums'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {state.equipment.fractionators.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Fractionators</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {state.equipment.fractionators.map((fr, i) => (
                      <div key={i} style={{ padding: '6px 14px', border: '1.5px solid #dce8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1c3045', background: '#f4f8fb' }}>
                        {fr.name}
                        <span style={{ fontWeight: 400, color: '#7a95a8', marginLeft: 6 }}>· {fr.columnOverheads.length} OH · {fr.columnReboilers.length} RB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {state.equipment.furnaces.length === 0 && state.equipment.drumTrains.length === 0 && state.equipment.fractionators.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af' }}>No equipment configured.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Selected Models">
            {selectedModels.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No models selected.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {selectedModels.map(m => {
                  const storeModel = models?.find(sm => sm.model_id === m.model_id)
                  const subCount = storeModel?.sub_models?.length
                  const isCokeDrum = m.group === 'coke_drum'
                  return (
                    <div key={m.model_id} style={{ border: '1.5px solid #dce8f0', borderRadius: 8, padding: '12px 14px', background: '#f9fbfd', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1c3045', marginBottom: 6 }}>{m.model_alias}</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px', background: isCokeDrum ? '#d1fae5' : '#fef3c7', color: isCokeDrum ? '#065f46' : '#92400e' }}>
                            {m.group.replace('_', ' ')}
                          </span>
                          {m.model_level && <span style={{ fontSize: 11, color: '#7a95a8' }}>· {m.model_level} level</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#dce8f0', color: '#3d5a70', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID {m.model_id}</span>
                        {subCount !== undefined && <p style={{ fontSize: 11, color: '#7a95a8', marginTop: 6 }}>{subCount} sub-models</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Tag Mapping">
            {levelEntries.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No attributes configured for selected models.</p>
            ) : (
              <div style={{ border: '1px solid #dce8f0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={tableHead('2fr 1fr 1fr 1fr 1fr')}>{['Level', 'PI', 'Inferred', 'Constant', 'Total'].map(h => <TH key={h}>{h}</TH>)}</div>
                {levelEntries.map(([level, counts], i) => (
                  <div key={level} style={{ ...rowGrid('2fr 1fr 1fr 1fr 1fr'), borderBottom: i < levelEntries.length - 1 ? '1px solid #f0f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#f9fbfd' }}>
                    <span style={td({ fontWeight: 600, color: '#1c3045' })}>{level}</span>
                    <span style={td({ color: '#264f84' })}>{counts.pi}</span>
                    <span style={td()}>{counts.inferred}</span>
                    <span style={td({ color: '#7a4f00' })}>{counts.constant}</span>
                    <span style={td({ fontWeight: 600, color: '#1c3045' })}>{counts.pi + counts.inferred + counts.constant}</span>
                  </div>
                ))}
                <div style={{ ...rowGrid('2fr 1fr 1fr 1fr 1fr'), background: '#f4f8fb', borderTop: '1.5px solid #dce8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1c3045' }}>Total</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#264f84' }}>{totalPI}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3d5a70' }}>{totalInferred}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7a4f00' }}>{totalConstant}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1c3045' }}>{activeAttrs.length}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              {[
                { label: 'Sensor Mappings', value: sensorsMapping.length, color: '#264f84' },
                { label: 'Instantiated Rows', value: instantiated.length, color: '#1c3045' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: '#7a95a8' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border pt-3">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>
          ← Back
        </button>
        <div className="flex items-center gap-2">
          {SHOW_ADMIN_TOOLS && (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary"
              onClick={() => downloadPiTagBankExcel(state, uomIndex, modelParametersBlueprint, imputationPolicy)}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Instance Configs
            </button>
          )}
          <button
            className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving...
              </>
            ) : submitted ? (
              <>
                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : 'Submit'}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  )
}
