'use client'

import { useState, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  multipliedAttributesAtom,
  setMultipliedAttributesAtom,
  modelsAtom,
  tagMappingsAtom,
  wizardQuestionsAtom,
} from '../../../store/dcuAtoms'
import type { MultipliedAttributeEntry } from '../../../types'
import Modal from '../../shared/Modal'

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
    <span key={label} style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: bg, color: text, lineHeight: '1.4' }}>
      {label}
    </span>
  )
}

export default function MultipliedAttributesTab() {
  const multipliedAttributes = useAtomValue(multipliedAttributesAtom)
  const setMultipliedAttributes = useSetAtom(setMultipliedAttributesAtom)
  const wizardQuestions = useAtomValue(wizardQuestionsAtom)
  const tagMappings = useAtomValue(tagMappingsAtom)
  const models = useAtomValue(modelsAtom)

  const [showModal, setShowModal] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const [fModelId, setFModelId] = useState<number | null>(null)
  const [fAttribute, setFAttribute] = useState('')
  const [fCountAttr, setFCountAttr] = useState('')
  const [fNodeId, setFNodeId] = useState('system_dcu')

  const attributeOptions = useMemo(() => {
    if (fModelId === null) return []
    const alreadyUsed = new Set(
      multipliedAttributes.filter((e, i) => i !== editIndex && e.model_ids.includes(fModelId)).map(e => e.attribute)
    )
    const seen = new Set<string>()
    return tagMappings
      .filter(m => m.model_ids.includes(fModelId) && !seen.has(m.attribute) && seen.add(m.attribute))
      .map(m => m.attribute)
      .filter(a => !alreadyUsed.has(a))
      .sort()
  }, [tagMappings, fModelId, multipliedAttributes, editIndex])

  const countAttrOptions = useMemo(
    () => fModelId === null ? [] : wizardQuestions
      .filter(q => q.input_type === 'target_steps' && q.model_ids.includes(fModelId))
      .map(q => q.attribute),
    [wizardQuestions, fModelId]
  )

  const isDuplicate = fModelId !== null && multipliedAttributes.some((e, i) =>
    i !== editIndex && e.attribute === fAttribute && e.model_ids.includes(fModelId)
  )
  const canSave = !!(fModelId !== null && fAttribute && fCountAttr && fNodeId.trim() && !isDuplicate)

  function openAdd() {
    setEditIndex(null); setFModelId(null); setFAttribute(''); setFCountAttr(''); setFNodeId('system_dcu')
    setShowModal(true)
  }

  function openEdit(e: MultipliedAttributeEntry, idx: number) {
    setEditIndex(idx); setFModelId(e.model_ids[0] ?? null); setFAttribute(e.attribute)
    setFCountAttr(e.countAttr); setFNodeId(e.nodeId); setShowModal(true)
  }

  function handleSave() {
    if (fModelId === null) return
    const entry: MultipliedAttributeEntry = { attribute: fAttribute, countAttr: fCountAttr, nodeId: fNodeId.trim(), model_ids: [fModelId] }
    setMultipliedAttributes((prev: MultipliedAttributeEntry[]) =>
      editIndex !== null ? prev.map((e, i) => i === editIndex ? entry : e) : [...prev, entry]
    )
    setShowModal(false)
  }

  function handleDelete(idx: number) {
    setMultipliedAttributes((prev: MultipliedAttributeEntry[]) => prev.filter((_, i) => i !== idx))
    setDeleteIndex(null)
  }

  function selectModel(id: number) {
    setFModelId(id); setFAttribute(''); setFCountAttr('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>Multiplied Attributes</div>
          <div style={{ fontSize: 11, color: '#7a95a8', marginTop: 2 }}>
            Attributes that expand into numbered copies (e.g. <code style={{ fontFamily: 'monospace' }}>hold_temp → hold_temp_1, hold_temp_2</code>) driven by a step-count constant.
          </div>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" onClick={openAdd} style={{ fontSize: 11, padding: '6px 14px' }}>+ Add Attribute</button>
      </div>

      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #dce8f0' }}>
            {['#', 'Model', 'Attribute', 'Count Attribute', 'Node ID', '', ''].map((h, i) => (
              <th key={i} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 8, fontSize: 10, fontWeight: 700, color: '#8ba3b5', textTransform: 'uppercase', letterSpacing: '0.5px', ...(i >= 5 ? { width: 40 } : {}) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {multipliedAttributes.map((e, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f4f8fb' }}>
              <td style={{ padding: '8px 8px 8px 0', color: '#7a95a8', fontWeight: 500, width: 28 }}>{idx + 1}</td>
              <td style={{ padding: '8px 8px 8px 0', minWidth: 80 }}>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {e.model_ids.map(id => {
                    const m = models.find(x => x.model_id === id)
                    const mb = MODEL_BADGE[m?.model_alias ?? ''] ?? { bg: '#f3f4f6', text: '#374151' }
                    return badge(mb.bg, mb.text, m?.model_alias ?? String(id))
                  })}
                </div>
              </td>
              <td style={{ padding: '8px 8px 8px 0', color: '#3d5a70', fontFamily: 'monospace', fontSize: 11 }}>{e.attribute}</td>
              <td style={{ padding: '8px 8px 8px 0' }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{e.countAttr}</span>
              </td>
              <td style={{ padding: '8px 8px 8px 0', color: '#7a95a8', fontFamily: 'monospace', fontSize: 10 }}>{e.nodeId}</td>
              <td style={{ padding: '4px 4px 4px 0', width: 40 }}>
                <button onClick={() => openEdit(e, idx)} title="Edit" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid #dce8f0', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#3d5a70' }}>Edit</button>
              </td>
              <td style={{ padding: '4px 0 4px 0', width: 32 }}>
                <button onClick={() => setDeleteIndex(idx)} title="Delete" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid #fecaca', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
              </td>
            </tr>
          ))}
          {multipliedAttributes.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: '20px 0', textAlign: 'center', color: '#a5b8c5', fontSize: 11 }}>
                No multiplied attributes defined. Click &quot;+ Add Attribute&quot; to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editIndex !== null ? 'Edit Multiplied Attribute' : 'Add Multiplied Attribute'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 420 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 6 }}>Model <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {models.map(m => {
                  const checked = fModelId === m.model_id
                  const mb = MODEL_BADGE[m.model_alias] ?? { bg: '#f3f4f6', text: '#374151' }
                  return (
                    <label key={m.model_id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: checked ? mb.bg : '#f9fafb', color: checked ? mb.text : '#9ca3af', border: `1px solid ${checked ? mb.bg : '#e5e7eb'}`, transition: 'all 0.15s' }}>
                      <input type="radio" name="multiplied-attr-model" checked={checked} onChange={() => selectModel(m.model_id)} disabled={editIndex !== null} style={{ margin: 0, cursor: editIndex !== null ? 'not-allowed' : 'pointer' }} />
                      {m.model_alias}
                    </label>
                  )
                })}
              </div>
              {fModelId === null && <div style={{ marginTop: 4, fontSize: 11, color: '#ef4444' }}>Select a model.</div>}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Attribute <span style={{ color: '#ef4444' }}>*</span></label>
              {editIndex !== null ? (
                <input value={fAttribute} disabled style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: '1px solid #dce8f0', borderRadius: 3, boxSizing: 'border-box', fontFamily: 'monospace', background: '#f9fafb', cursor: 'not-allowed' }} />
              ) : (
                <select value={fAttribute} onChange={e => setFAttribute(e.target.value)} disabled={fModelId === null}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fAttribute && fModelId !== null ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, background: fModelId === null ? '#f9fafb' : '#fff', fontFamily: 'monospace', cursor: fModelId === null ? 'not-allowed' : 'pointer' }}>
                  <option value="">— Select attribute —</option>
                  {attributeOptions.map(a => (<option key={a} value={a}>{a}</option>))}
                </select>
              )}
              {fModelId !== null && attributeOptions.length === 0 && editIndex === null && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>All attributes for this model are already configured.</div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>
                Count Attribute <span style={{ color: '#ef4444' }}>*</span>
                <span style={{ fontSize: 10, fontWeight: 400, color: '#7a95a8', marginLeft: 6 }}>(from Wizard Queries → target_steps)</span>
              </label>
              {countAttrOptions.length > 0 ? (
                <select value={fCountAttr} onChange={e => setFCountAttr(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fCountAttr ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, background: '#fff', fontFamily: 'monospace' }}>
                  <option value="">— Select —</option>
                  {countAttrOptions.map(a => (<option key={a} value={a}>{a}</option>))}
                </select>
              ) : (
                <>
                  <input value={fCountAttr} onChange={e => setFCountAttr(e.target.value)} placeholder="e.g. hold_temp_steps"
                    style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fCountAttr ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>No target_steps queries found for this model. Add one in Wizard Queries, or type manually.</div>
                </>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4 }}>Node ID <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={fNodeId} onChange={e => setFNodeId(e.target.value)} placeholder="e.g. system_dcu"
                style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: `1px solid ${!fNodeId.trim() ? '#ef4444' : '#dce8f0'}`, borderRadius: 3, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowModal(false)} className="inline-flex items-center gap-2 bg-background border border-border text-accent-blue font-semibold text-sm rounded-lg px-6 py-2.5 hover:bg-surface-hover cursor-pointer whitespace-nowrap transition" style={{ fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={!canSave} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition"
                style={{ fontSize: 11, opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}>
                {editIndex !== null ? 'Save Changes' : 'Add Attribute'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteIndex !== null && (
        <Modal isOpen={deleteIndex !== null} onClose={() => setDeleteIndex(null)} title="Delete Multiplied Attribute">
          <div style={{ minWidth: 300 }}>
            <p style={{ fontSize: 12, color: '#3d5a70', marginBottom: 16 }}>
              Delete <strong style={{ fontFamily: 'monospace' }}>{multipliedAttributes[deleteIndex]?.attribute}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteIndex(null)} className="inline-flex items-center gap-2 bg-background border border-border text-accent-blue font-semibold text-sm rounded-lg px-6 py-2.5 hover:bg-surface-hover cursor-pointer whitespace-nowrap transition" style={{ fontSize: 11 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteIndex)} style={{ padding: '6px 14px', fontSize: 11, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
