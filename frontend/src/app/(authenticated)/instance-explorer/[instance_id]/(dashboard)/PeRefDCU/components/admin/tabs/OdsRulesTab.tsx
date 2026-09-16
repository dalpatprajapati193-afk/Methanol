'use client'

import React from 'react'
import { useAtomValue } from 'jotai'
import { modelsAtom } from '../../../store/dcuAtoms'
import type { OdsRule, ModelTagMapping } from '../../../types'
import Modal from '../../shared/Modal'

interface Props {
  rules: OdsRule[]
  tagMappings: ModelTagMapping[]
  // add form
  isAddingForm: boolean
  onToggleAddForm: (show: boolean) => void
  newModelId: number | ''
  onNewModelIdChange: (v: number | '') => void
  newCauseTag: string
  onNewCauseTagChange: (v: string) => void
  newEffectTag: string
  onNewEffectTagChange: (v: string) => void
  newCauseMonTag: string
  onNewCauseMonTagChange: (v: string) => void
  newEffectMonTag: string
  onNewEffectMonTagChange: (v: string) => void
  newMessage: string
  onNewMessageChange: (v: string) => void
  newTolerance: string
  onNewToleranceChange: (v: string) => void
  canAdd: boolean
  onAddRule: () => void
  // edit form
  isEditing: boolean
  editingId: string | null
  editModelId: number | ''
  onEditModelIdChange: (v: number | '') => void
  editCauseTag: string
  onEditCauseTagChange: (v: string) => void
  editEffectTag: string
  onEditEffectTagChange: (v: string) => void
  editCauseMonTag: string
  onEditCauseMonTagChange: (v: string) => void
  editEffectMonTag: string
  onEditEffectMonTagChange: (v: string) => void
  editMessage: string
  onEditMessageChange: (v: string) => void
  editTolerance: string
  onEditToleranceChange: (v: string) => void
  canSaveEdit: boolean
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEdit: (rule: OdsRule) => void
  onDelete: (id: string) => void
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #d1d5db', borderRadius: 5,
  background: '#ffffff', color: '#374151', fontFamily: 'inherit',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4,
}

function FormFields({
  modelId, onModelIdChange,
  causeTag, onCauseTagChange,
  effectTag, onEffectTagChange,
  causeMonTag, onCauseMonTagChange,
  effectMonTag, onEffectMonTagChange,
  message, onMessageChange,
  tolerance, onToleranceChange,
  tagMappings, takenCauseTags, models,
}: {
  modelId: number | ''
  onModelIdChange: (v: number | '') => void
  causeTag: string
  onCauseTagChange: (v: string) => void
  effectTag: string
  onEffectTagChange: (v: string) => void
  causeMonTag: string
  onCauseMonTagChange: (v: string) => void
  effectMonTag: string
  onEffectMonTagChange: (v: string) => void
  message: string
  onMessageChange: (v: string) => void
  tolerance: string
  onToleranceChange: (v: string) => void
  tagMappings: ModelTagMapping[]
  takenCauseTags: string[]
  models: { model_id: number; model_alias: string }[]
}) {
  const numModelId = modelId === '' ? null : modelId

  const causeOptions = numModelId !== null
    ? tagMappings.filter(m => m.model_ids.includes(numModelId) && m.type === 'Cause' && (!takenCauseTags.includes(m.attribute) || m.attribute === causeTag))
    : []
  const effectOptions = numModelId !== null
    ? tagMappings.filter(m => m.model_ids.includes(numModelId) && m.type === 'Effect')
    : []
  const allAttrOptions = numModelId !== null
    ? tagMappings.filter(m => m.model_ids.includes(numModelId))
    : []

  const handleModelChange = (val: number | '') => {
    onModelIdChange(val)
    onCauseTagChange(''); onEffectTagChange(''); onCauseMonTagChange(''); onEffectMonTagChange('')
  }

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }
  const grid1: React.CSSProperties = { marginBottom: 12 }

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={grid1}>
        <label style={labelStyle}>Model <span style={{ color: '#ef4444' }}>*</span></label>
        <select style={fieldStyle} value={modelId === '' ? '' : String(modelId)}
          onChange={e => handleModelChange(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">— Select model —</option>
          {models.map(m => (<option key={m.model_id} value={String(m.model_id)}>{m.model_alias}</option>))}
        </select>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Cause Tag <span style={{ color: '#ef4444' }}>*</span></label>
          <select style={fieldStyle} value={causeTag} onChange={e => onCauseTagChange(e.target.value)} disabled={numModelId === null}>
            <option value="">— Select cause —</option>
            {causeOptions.map(m => (<option key={m.attribute} value={m.attribute}>{m.attribute}</option>))}
          </select>
          {numModelId !== null && causeOptions.length === 0 && (
            <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>No &quot;Cause&quot; attributes for this model. Add them in Attribute Tags Mappings.</p>
          )}
        </div>
        <div>
          <label style={labelStyle}>Effect Tag <span style={{ color: '#ef4444' }}>*</span></label>
          <select style={fieldStyle} value={effectTag} onChange={e => onEffectTagChange(e.target.value)} disabled={numModelId === null}>
            <option value="">— Select effect —</option>
            {effectOptions.map(m => (<option key={m.attribute} value={m.attribute}>{m.attribute}</option>))}
          </select>
          {numModelId !== null && effectOptions.length === 0 && (
            <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>No &quot;Effect&quot; attributes for this model. Add them in Attribute Tags Mappings.</p>
          )}
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Cause Monitoring Tag</label>
          <select style={fieldStyle} value={causeMonTag} onChange={e => onCauseMonTagChange(e.target.value)} disabled={numModelId === null}>
            <option value="">— Select attribute —</option>
            {allAttrOptions.map(m => (<option key={m.attribute} value={m.attribute}>{m.attribute}</option>))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Effect Monitoring Tag</label>
          <select style={fieldStyle} value={effectMonTag} onChange={e => onEffectMonTagChange(e.target.value)} disabled={numModelId === null}>
            <option value="">— Select attribute —</option>
            {allAttrOptions.map(m => (<option key={m.attribute} value={m.attribute}>{m.attribute}</option>))}
          </select>
        </div>
      </div>

      <div style={grid1}>
        <label style={labelStyle}>Message</label>
        <input type="text" style={fieldStyle} placeholder="e.g. Increase Spall steam in Pass<<pass_N>> to increase velocity" value={message} onChange={e => onMessageChange(e.target.value)} />
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          {(() => {
            const chipStyle: React.CSSProperties = { display: 'inline-block', fontFamily: 'monospace', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 3, padding: '0 4px', marginLeft: 4, cursor: 'help', color: '#374151' }
            return (
              <>
                Dynamic placeholders:{' '}
                {[['<<fur_N>>', 'Furnace'], ['<<cell_N>>', 'Cell'], ['<<pass_N>>', 'Pass'], ['<<tube_N>>', 'Tube'], ['<<drum_N>>', 'Drum'], ['<<dt_N>>', 'Drum train'], ['<<sg_N>>', 'Spall Group'], ['<<frac_N>>', 'Fractionator'], ['<<oh_N>>', 'Column Overhead'], ['<<rb_N>>', 'Column Reboiler']].map(([kw, label], i) => (
                  <span key={kw} title={label} style={{ ...chipStyle, marginLeft: i === 0 ? 0 : 4 }}>{kw}</span>
                ))}
              </>
            )
          })()}
        </div>
      </div>

      <div style={{ ...grid1, marginBottom: 0 }}>
        <label style={labelStyle}>Actionable Tolerance <span style={{ color: '#9ca3af', fontWeight: 400 }}>(numeric, leave blank for null)</span></label>
        <input type="number" style={fieldStyle} placeholder="e.g. 0.05" value={tolerance} onChange={e => onToleranceChange(e.target.value)} />
      </div>
    </div>
  )
}

export default function OdsRulesTab(props: Props) {
  const models = useAtomValue(modelsAtom)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)

  const allUsedCauseTags = props.rules.map(r => r.cause_tag)
  const takenForEdit = props.editingId
    ? props.rules.filter(r => r.id !== props.editingId).map(r => r.cause_tag)
    : allUsedCauseTags

  const footerBtnBase: React.CSSProperties = {
    padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 12, color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
  }

  const tagBadge = (text: string, color: string) => (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: color === 'cause' ? '#fff7ed' : color === 'effect' ? '#fdf2f8' : '#f3f4f6',
      color: color === 'cause' ? '#c2410c' : color === 'effect' ? '#a21caf' : '#374151',
      border: `1px solid ${color === 'cause' ? '#fed7aa' : color === 'effect' ? '#f5d0fe' : '#e5e7eb'}`,
    }}>
      {text}
    </span>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          Define cause-effect relationships between attributes for ODS (Operational Decision Support) rules.
        </p>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer' }}
          onClick={() => props.onToggleAddForm(true)}
        >
          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add ODS Rule
        </button>
      </div>

      {props.rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 8 }}>
          <svg style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>No ODS rules yet</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Click &quot;Add ODS Rule&quot; to create the first rule.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Cause Tag</th>
                <th style={thStyle}>Effect Tag</th>
                <th style={thStyle}>Cause Monitoring</th>
                <th style={thStyle}>Effect Monitoring</th>
                <th style={thStyle}>Message</th>
                <th style={thStyle}>Tolerance</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {props.rules.map(rule => {
                const modelEntry = models.find(m => m.model_id === rule.model_id)
                const modelName = modelEntry?.model_alias ?? String(rule.model_id)
                return (
                  <tr key={rule.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                        {modelName}
                      </span>
                    </td>
                    <td style={tdStyle}>{tagBadge(rule.cause_tag, 'cause')}</td>
                    <td style={tdStyle}>{tagBadge(rule.effect_tag, 'effect')}</td>
                    <td style={tdStyle}>{rule.cause_monitoring_tag || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={tdStyle}>{rule.effect_monitoring_tag || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: 200 }}>
                      <span title={rule.message} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: rule.message ? '#374151' : '#d1d5db' }}>
                        {rule.message || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {rule.actionable_tolerance !== null
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{rule.actionable_tolerance}</span>
                        : <span style={{ color: '#d1d5db' }}>null</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button title="Edit" onClick={() => props.onEdit(rule)}
                          style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLButtonElement).style.color = '#1d4ed8' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}>
                          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
                          </svg>
                        </button>
                        <button title="Delete" onClick={() => setDeleteConfirmId(rule.id)}
                          style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}>
                          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={props.isAddingForm} onClose={() => props.onToggleAddForm(false)} title="Add ODS Rule" maxWidth={680}>
        <FormFields
          modelId={props.newModelId} onModelIdChange={props.onNewModelIdChange}
          causeTag={props.newCauseTag} onCauseTagChange={props.onNewCauseTagChange}
          effectTag={props.newEffectTag} onEffectTagChange={props.onNewEffectTagChange}
          causeMonTag={props.newCauseMonTag} onCauseMonTagChange={props.onNewCauseMonTagChange}
          effectMonTag={props.newEffectMonTag} onEffectMonTagChange={props.onNewEffectMonTagChange}
          message={props.newMessage} onMessageChange={props.onNewMessageChange}
          tolerance={props.newTolerance} onToleranceChange={props.onNewToleranceChange}
          tagMappings={props.tagMappings} takenCauseTags={allUsedCauseTags} models={models}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #e5e7eb', marginTop: 16 }}>
          <button style={{ ...footerBtnBase, background: '#f3f4f6', color: '#374151' }} onClick={() => props.onToggleAddForm(false)}>Cancel</button>
          <button style={{ ...footerBtnBase, background: props.canAdd ? '#1d4ed8' : '#93c5fd', color: '#fff', cursor: props.canAdd ? 'pointer' : 'not-allowed' }} onClick={props.onAddRule} disabled={!props.canAdd}>+ Add Rule</button>
        </div>
      </Modal>

      <Modal isOpen={props.isEditing} onClose={props.onCancelEdit} title="Edit ODS Rule" maxWidth={680}>
        <FormFields
          modelId={props.editModelId} onModelIdChange={props.onEditModelIdChange}
          causeTag={props.editCauseTag} onCauseTagChange={props.onEditCauseTagChange}
          effectTag={props.editEffectTag} onEffectTagChange={props.onEditEffectTagChange}
          causeMonTag={props.editCauseMonTag} onCauseMonTagChange={props.onEditCauseMonTagChange}
          effectMonTag={props.editEffectMonTag} onEffectMonTagChange={props.onEditEffectMonTagChange}
          message={props.editMessage} onMessageChange={props.onEditMessageChange}
          tolerance={props.editTolerance} onToleranceChange={props.onEditToleranceChange}
          tagMappings={props.tagMappings} takenCauseTags={takenForEdit} models={models}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #e5e7eb', marginTop: 16 }}>
          <button style={{ ...footerBtnBase, background: '#f3f4f6', color: '#374151' }} onClick={props.onCancelEdit}>Cancel</button>
          <button style={{ ...footerBtnBase, background: props.canSaveEdit ? '#1d4ed8' : '#93c5fd', color: '#fff', cursor: props.canSaveEdit ? 'pointer' : 'not-allowed' }} onClick={props.onSaveEdit} disabled={!props.canSaveEdit}>Save Changes</button>
        </div>
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Delete ODS Rule" maxWidth={420}>
        <p style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Are you sure you want to delete this ODS rule? This action cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={{ ...footerBtnBase, background: '#f3f4f6', color: '#374151' }} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
          <button style={{ ...footerBtnBase, background: '#dc2626', color: '#fff' }}
            onClick={() => { if (deleteConfirmId) props.onDelete(deleteConfirmId); setDeleteConfirmId(null) }}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
