'use client'

import { useState, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  wizardQuestionsAtom,
  setWizardQuestionsAtom,
  modelsAtom,
  tagMappingsAtom,
  multipliedAttributesAtom,
} from '../../../store/dcuAtoms'
import type { WizardQuestion, WizardChildQuestion } from '../../../types'
import Modal from '../../shared/Modal'

function sanitizeAttributeName(value: string): string {
  let v = value.replace(/[^a-zA-Z0-9_]/g, '')
  v = v.replace(/^[^a-zA-Z]+/, '')
  v = v.replace(/__+/g, '_')
  return v
}

const INPUT_TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  select:       { bg: '#dbeafe', text: '#1e40af' },
  number:       { bg: '#fef3c7', text: '#92400e' },
  target_steps: { bg: '#dcfce7', text: '#166534' },
}

const MODEL_BADGE: Record<string, { bg: string; text: string }> = {
  'PDI':       { bg: '#dbeafe', text: '#1e40af' },
  'OUTAGE':    { bg: '#f3e8ff', text: '#6b21a8' },
  'HGI':       { bg: '#dcfce7', text: '#166534' },
  'RUNLENGTH': { bg: '#fffbeb', text: '#b45309' },
  'SPALL':     { bg: '#fee2e2', text: '#991b1b' },
  'CLEAN TMT': { bg: '#ffedd5', text: '#9a3412' },
}

function badge(bg: string, text: string, label: string) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: bg, color: text, lineHeight: '1.4' }}>
      {label}
    </span>
  )
}

function deriveId(inputType: string, baseAttribute: string, attribute: string): string {
  if (inputType === 'select') return `${baseAttribute}_level`
  return attribute
}

function deriveAttribute(inputType: string, baseAttribute: string, attribute: string): string {
  if (inputType === 'select') return `${baseAttribute}_sensor_level`
  return attribute
}

const EMPTY_CHILD: WizardChildQuestion = { attribute_prefix: '', label_template: '' }

export default function WizardQueriesTab() {
  const wizardQuestions = useAtomValue(wizardQuestionsAtom)
  const setWizardQuestions = useSetAtom(setWizardQuestionsAtom)
  const tagMappings = useAtomValue(tagMappingsAtom)
  const multipliedAttributes = useAtomValue(multipliedAttributesAtom)
  const models = useAtomValue(modelsAtom)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [fModelId, setFModelId] = useState<number | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fInputType, setFInputType] = useState<'select' | 'number' | 'target_steps'>('select')
  const [fBaseAttribute, setFBaseAttribute] = useState('')
  const [fAttribute, setFAttribute] = useState('')
  const [fMaxSteps, setFMaxSteps] = useState('3')
  const [fChildren, setFChildren] = useState<WizardChildQuestion[]>([{ ...EMPTY_CHILD }])

  const usedBaseAttributes = useMemo(
    () => new Set(wizardQuestions.filter(q => q.input_type === 'select' && q.id !== editId && q.base_attribute).map(q => q.base_attribute as string)),
    [wizardQuestions, editId]
  )

  const availableAttributes = useMemo(() => {
    if (fModelId === null) return []
    const attrLevels: Record<string, Set<string>> = {}
    for (const m of tagMappings) {
      if (!m.model_ids.includes(fModelId)) continue
      if (!attrLevels[m.attribute]) attrLevels[m.attribute] = new Set()
      attrLevels[m.attribute].add(m.level)
    }
    return Object.entries(attrLevels)
      .filter(([, levels]) => levels.size > 1)
      .filter(([attr]) => !usedBaseAttributes.has(attr))
      .map(([attribute, levels]) => ({ attribute, levels: Array.from(levels).sort() }))
      .sort((a, b) => a.attribute.localeCompare(b.attribute))
  }, [tagMappings, fModelId, usedBaseAttributes])

  const constantAttributes = useMemo(() => {
    if (fModelId === null) return []
    const seen = new Set<string>()
    return tagMappings
      .filter(m => m.type === 'Constant' && m.model_ids.includes(fModelId) && !seen.has(m.attribute) && seen.add(m.attribute))
      .map(m => m.attribute)
      .sort()
  }, [tagMappings, fModelId])

  const selectedAttrEntry = availableAttributes.find(a => a.attribute === fBaseAttribute)
  const derivedOptions = selectedAttrEntry ? selectedAttrEntry.levels : []

  const derivedId = fInputType === 'select'
    ? deriveId('select', fBaseAttribute, '')
    : deriveId(fInputType, '', fAttribute.trim())

  const isDuplicate = wizardQuestions.some(q => q.id === derivedId && q.id !== editId)

  const canSave = (() => {
    if (fModelId === null || !fLabel.trim()) return false
    if (fInputType === 'select' && !fBaseAttribute) return false
    if (fInputType !== 'select' && !fAttribute.trim()) return false
    if (fInputType === 'target_steps') {
      if (!fMaxSteps || Number(fMaxSteps) < 1) return false
      if (fChildren.some(c =>
        (c.attribute_prefix.trim() && !c.label_template.includes('{n}')) ||
        (!c.attribute_prefix.trim() && c.label_template.trim())
      )) return false
    }
    if (isDuplicate) return false
    return true
  })()

  function openAdd() {
    setEditId(null); setFModelId(null); setFLabel(''); setFInputType('select')
    setFBaseAttribute(''); setFAttribute(''); setFMaxSteps('3'); setFChildren([{ ...EMPTY_CHILD }])
    setShowModal(true)
  }

  function selectModel(id: number) {
    setFModelId(id); setFBaseAttribute(''); setFAttribute('')
  }

  function openEdit(q: WizardQuestion) {
    setEditId(q.id); setFModelId(q.model_ids[0] ?? null); setFLabel(q.label)
    setFInputType(q.input_type); setFBaseAttribute(q.base_attribute ?? '')
    setFAttribute(q.input_type !== 'select' ? q.attribute : '')
    setFMaxSteps(String(q.max_steps ?? 3))
    setFChildren(q.child_questions && q.child_questions.length > 0 ? q.child_questions.map(c => ({ ...c })) : [{ ...EMPTY_CHILD }])
    setShowModal(true)
  }

  function handleSave() {
    const id = fInputType === 'select' ? deriveId('select', fBaseAttribute, '') : fAttribute.trim()
    const attribute = fInputType === 'select' ? deriveAttribute('select', fBaseAttribute, '') : fAttribute.trim()
    const options = fInputType === 'select' ? derivedOptions : (fInputType === 'target_steps' ? Array.from({ length: Number(fMaxSteps) }, (_, i) => String(i + 1)) : undefined)

    const updated: WizardQuestion = {
      id,
      model_ids: fModelId !== null ? [fModelId] : [],
      label: fLabel.trim(),
      input_type: fInputType,
      attribute,
      ...(fInputType === 'select' ? { base_attribute: fBaseAttribute, options } : {}),
      ...(fInputType === 'target_steps' ? { options, max_steps: Number(fMaxSteps), child_questions: fChildren.filter(c => c.attribute_prefix.trim()) } : {}),
      node_id: 'system_dcu',
      order: 0,
    }

    setWizardQuestions((prev: WizardQuestion[]) => {
      let next: WizardQuestion[]
      if (editId !== null) {
        next = prev.map(q => q.id === editId ? { ...updated, order: q.order } : q)
      } else {
        const maxOrder = prev.reduce((m, q) => Math.max(m, q.order), 0)
        next = [...prev, { ...updated, order: maxOrder + 1 }]
      }
      return renormalizeOrder(next)
    })
    setShowModal(false)
  }

  function handleDelete(id: string) {
    setWizardQuestions((prev: WizardQuestion[]) => renormalizeOrder(prev.filter(q => q.id !== id)))
    setDeleteId(null)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setWizardQuestions((prev: WizardQuestion[]) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      ;[sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]]
      return renormalizeOrder(sorted)
    })
  }

  function moveDown(idx: number) {
    setWizardQuestions((prev: WizardQuestion[]) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      if (idx >= sorted.length - 1) return prev
      ;[sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]]
      return renormalizeOrder(sorted)
    })
  }

  function renormalizeOrder(qs: WizardQuestion[]): WizardQuestion[] {
    return qs.map((q, i) => ({ ...q, order: i + 1 }))
  }

  const sorted = [...wizardQuestions].sort((a, b) => a.order - b.order)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>Wizard Queries</div>
          <div style={{ fontSize: 11, color: '#7a95a8', marginTop: 2 }}>Questions shown in the SOP wizard step, filtered by model.</div>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" onClick={openAdd} style={{ fontSize: 11, padding: '6px 14px' }}>+ Add Query</button>
      </div>

      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #dce8f0' }}>
            {['#', 'Models', 'Label', 'Input Type', 'Attribute', 'Options', '', ''].map((h, i) => (
              <th key={i} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 8, fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', ...(i >= 6 ? { width: 32 } : {}) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((q, idx) => {
            const itBadge = INPUT_TYPE_BADGE[q.input_type] ?? { bg: '#f3f4f6', text: '#374151' }
            const optDisplay = q.input_type === 'select' ? (q.options ?? []).join(', ')
              : q.input_type === 'target_steps' ? `${q.max_steps} steps · ${q.child_questions?.length ?? 0} child` : '—'
            return (
              <tr key={q.id} style={{ borderBottom: '1px solid #f4f8fb' }}>
                <td style={{ padding: '8px 8px 8px 0', color: '#7a95a8', fontWeight: 500, width: 28 }}>{idx + 1}</td>
                <td style={{ padding: '8px 8px 8px 0', minWidth: 80 }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {q.model_ids.map(id => {
                      const m = models.find(x => x.model_id === id)
                      const mb = MODEL_BADGE[m?.model_alias ?? ''] ?? { bg: '#f3f4f6', text: '#374151' }
                      return badge(mb.bg, mb.text, m?.model_alias ?? String(id))
                    })}
                  </div>
                </td>
                <td style={{ padding: '8px 8px 8px 0', color: '#3d5a70', maxWidth: 280 }}>{q.label}</td>
                <td style={{ padding: '8px 8px 8px 0' }}>{badge(itBadge.bg, itBadge.text, q.input_type)}</td>
                <td style={{ padding: '8px 8px 8px 0', color: '#3d5a70', fontFamily: 'monospace', fontSize: 10 }}>{q.attribute}</td>
                <td style={{ padding: '8px 8px 8px 0', color: '#7a95a8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optDisplay}</td>
                <td style={{ padding: '4px 4px 4px 0', width: 32 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up" style={{ padding: '1px 4px', fontSize: 9, border: '1px solid #dce8f0', borderRadius: 2, background: idx === 0 ? '#f9fafb' : '#fff', cursor: idx === 0 ? 'default' : 'pointer', color: '#5a7a8a', lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1} title="Move down" style={{ padding: '1px 4px', fontSize: 9, border: '1px solid #dce8f0', borderRadius: 2, background: idx === sorted.length - 1 ? '#f9fafb' : '#fff', cursor: idx === sorted.length - 1 ? 'default' : 'pointer', color: '#5a7a8a', lineHeight: 1 }}>▼</button>
                  </div>
                </td>
                <td style={{ padding: '4px 0 4px 0', width: 64 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(q)} title="Edit" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid #dce8f0', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#3d5a70' }}>Edit</button>
                    <button onClick={() => setDeleteId(q.id)} title="Delete" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid #fecaca', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                  </div>
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '20px 0', textAlign: 'center', color: '#a5b8c5', fontSize: 11 }}>
                No queries defined. Click &quot;+ Add Query&quot; to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Wizard Query' : 'Add Wizard Query'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 480 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: fModelId === null ? '#ef4444' : '#3d5a70', display: 'block', marginBottom: 6 }}>
                Models <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {models.map(m => {
                  const checked = fModelId === m.model_id
                  const mb = MODEL_BADGE[m.model_alias] ?? { bg: '#f3f4f6', text: '#374151' }
                  return (
                    <label key={m.model_id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: checked ? mb.bg : '#f9fafb', color: checked ? mb.text : '#9ca3af', border: `1px solid ${checked ? mb.bg : '#e5e7eb'}`, transition: 'all 0.15s' }}>
                      <input type="radio" name="wizard-query-model" checked={checked} onChange={() => selectModel(m.model_id)} style={{ margin: 0, cursor: 'pointer' }} />
                      {m.model_alias}
                    </label>
                  )
                })}
              </div>
              {fModelId === null && <div style={{ marginTop: 4, fontSize: 11, color: '#ef4444' }}>Select a model.</div>}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Label / Question <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="e.g. Where does COP exist in your plant?"
                style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fLabel.trim() ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Input Type <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { type: 'select', tip: 'Dropdown — user picks a level.' },
                  { type: 'number', tip: 'Numeric entry — user types a single numeric value.' },
                  { type: 'target_steps', tip: 'Step-count picker — user selects how many steps.' },
                ] as const).map(({ type: t, tip }) => {
                  const sel = fInputType === t
                  const b = INPUT_TYPE_BADGE[t]
                  return (
                    <button key={t} title={tip} onClick={() => { setFInputType(t); setFBaseAttribute(''); setFAttribute('') }}
                      style={{ padding: '5px 14px', fontSize: 11, borderRadius: 10, cursor: 'pointer', fontWeight: 600, border: sel ? '2px solid ' + b.text : '2px solid #e5e7eb', background: sel ? b.bg : '#fff', color: sel ? b.text : '#6b7280' }}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            {fInputType === 'select' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Attribute (multi-level) <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={fBaseAttribute} onChange={e => setFBaseAttribute(e.target.value)} disabled={fModelId === null}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fBaseAttribute && fModelId !== null ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, background: fModelId === null ? '#f9fafb' : '#fff', fontFamily: 'inherit', cursor: fModelId === null ? 'not-allowed' : 'pointer' }}>
                  <option value="">{fModelId === null ? '— Select a model first —' : '— Select attribute —'}</option>
                  {availableAttributes.map(a => (
                    <option key={a.attribute} value={a.attribute}>{a.attribute} ({a.levels.join(', ')})</option>
                  ))}
                </select>
                {fBaseAttribute && derivedOptions.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#7a95a8' }}>
                    Stored attribute: <code style={{ fontFamily: 'monospace' }}>{fBaseAttribute}_sensor_level</code> · Options: <strong>{derivedOptions.join(', ')}</strong>
                  </div>
                )}
                {isDuplicate && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>A query with id &quot;{derivedId}&quot; already exists.</div>}
              </div>
            )}

            {fInputType === 'number' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Attribute <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={fAttribute} onChange={e => setFAttribute(e.target.value)} disabled={fModelId === null}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fAttribute && fModelId !== null ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, background: fModelId === null ? '#f9fafb' : '#fff', fontFamily: 'inherit', cursor: fModelId === null ? 'not-allowed' : 'pointer' }}>
                  <option value="">{fModelId === null ? '— Select a model first —' : '— Select constant attribute —'}</option>
                  {constantAttributes.map(a => (<option key={a} value={a}>{a}</option>))}
                </select>
                {isDuplicate && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>A query with id &quot;{derivedId}&quot; already exists.</div>}
              </div>
            )}

            {fInputType === 'target_steps' && (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Attribute name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={fAttribute} onChange={e => setFAttribute(sanitizeAttributeName(e.target.value))} placeholder="e.g. hold_temp_steps"
                      style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fAttribute.trim() ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    {isDuplicate && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>A query with id &quot;{derivedId}&quot; already exists.</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Max Steps <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" min="1" max="10" value={fMaxSteps} onChange={e => setFMaxSteps(e.target.value)}
                      style={{ width: 90, padding: '6px 8px', fontSize: 11, border: '1px solid #dce8f0', borderRadius: 3, fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70' }}>Child Questions <span style={{ fontSize: 10, fontWeight: 400, color: '#7a95a8', marginLeft: 6 }}>(optional)</span></label>
                    <button onClick={() => setFChildren(prev => [...prev, { ...EMPTY_CHILD }])}
                      style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #dce8f0', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#3d5a70' }}>+ Add</button>
                  </div>
                  <div style={{ fontSize: 10, color: '#7a95a8', marginBottom: 8 }}>Label template must contain <code>{'{n}'}</code> for the step number.</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingRight: fChildren.length > 1 ? 34 : 0 }}>
                    <div style={{ flex: 1, fontSize: 10, fontWeight: 600, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Attribute</div>
                    <div style={{ flex: 2, fontSize: 10, fontWeight: 600, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Label Template</div>
                  </div>
                  {fChildren.map((c, i) => {
                    const usedPrefixes = new Set(fChildren.filter((_, j) => j !== i).map(x => x.attribute_prefix))
                    const availablePrefixes = multipliedAttributes
                      .filter(e => fModelId !== null ? e.model_ids.includes(fModelId) : true)
                      .map(e => e.attribute)
                      .filter(a => !usedPrefixes.has(a))
                    const hasAttr = !!c.attribute_prefix.trim()
                    const hasTemplate = !!c.label_template.trim()
                    const partialAttr = !hasAttr && hasTemplate
                    const partialTemplate = hasAttr && (!hasTemplate || !c.label_template.includes('{n}'))
                    return (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <select value={c.attribute_prefix} onChange={e => { const next = [...fChildren]; next[i] = { ...c, attribute_prefix: e.target.value }; setFChildren(next) }}
                            style={{ width: '100%', padding: '5px 7px', fontSize: 10, border: `1px solid ${partialAttr ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, background: '#fff', fontFamily: 'monospace', boxSizing: 'border-box' }}>
                            <option value="">— Select —</option>
                            {availablePrefixes.map(a => (<option key={a} value={a}>{a}</option>))}
                          </select>
                        </div>
                        <div style={{ flex: 2 }}>
                          <input value={c.label_template} onChange={e => { const next = [...fChildren]; next[i] = { ...c, label_template: e.target.value }; setFChildren(next) }}
                            placeholder="e.g. Hold temperature for step {n}"
                            style={{ width: '100%', padding: '5px 7px', fontSize: 10, border: `1px solid ${partialTemplate ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        {fChildren.length > 1 && (
                          <button onClick={() => setFChildren(prev => prev.filter((_, j) => j !== i))}
                            style={{ padding: '4px 7px', fontSize: 10, border: '1px solid #fecaca', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#dc2626', marginTop: 1 }}>✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowModal(false)} className="inline-flex items-center gap-2 bg-background border border-border text-accent-blue font-semibold text-sm rounded-lg px-6 py-2.5 hover:bg-surface-hover cursor-pointer whitespace-nowrap transition" style={{ fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={!canSave} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition"
                style={{ fontSize: 11, opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}>
                {editId ? 'Save Changes' : 'Add Query'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Query">
          <div style={{ minWidth: 300 }}>
            <p style={{ fontSize: 12, color: '#3d5a70', marginBottom: 16 }}>
              Delete query <strong>&quot;{wizardQuestions.find(q => q.id === deleteId)?.label}&quot;</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteId(null)} className="inline-flex items-center gap-2 bg-background border border-border text-accent-blue font-semibold text-sm rounded-lg px-6 py-2.5 hover:bg-surface-hover cursor-pointer whitespace-nowrap transition" style={{ fontSize: 11 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                style={{ padding: '6px 14px', fontSize: 11, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
