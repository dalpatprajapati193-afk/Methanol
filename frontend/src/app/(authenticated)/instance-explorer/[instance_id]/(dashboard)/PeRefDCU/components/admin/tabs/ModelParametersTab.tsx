'use client'

import React from 'react'
import { useAtomValue } from 'jotai'
import { modelsAtom } from '../../../store/dcuAtoms'
import type { ModelParameterWithIds } from '../../../types'
import Modal from '../../shared/Modal'

interface Props {
  sortedParameters: ModelParameterWithIds[]
  searchTerm: string
  onSearchChange: (term: string) => void
  sortBy: 'parameter' | 'value' | 'models'
  sortOrder: 'asc' | 'desc'
  onSort: (col: 'parameter' | 'value' | 'models') => void
  SortIcon: ({ column }: { column: 'parameter' | 'value' | 'models' }) => React.ReactNode
  getModelNames: (ids: number[]) => string
  onEdit: (param: ModelParameterWithIds) => void
  onDelete: (paramName: string) => void
  isEditing: boolean
  editingParamKey: string | null
  editParamName: string
  onEditParamNameChange: (val: string) => void
  editParamDisplayName: string
  onEditParamDisplayNameChange: (val: string) => void
  editParamValue: string
  onEditParamValueChange: (val: string) => void
  editParamDesc: string
  onEditParamDescChange: (val: string) => void
  editParamModelIds: number[]
  onToggleEditParamModel: (id: number) => void
  isEditParamDuplicate: boolean
  canSaveParamEdit: boolean
  onSaveParamEdit: () => void
  onCancelParamEdit: () => void
  isAddingParamForm: boolean
  onToggleAddParamForm: (show: boolean) => void
  newParamName: string
  onNewParamNameChange: (val: string) => void
  newParamDisplayName: string
  onNewParamDisplayNameChange: (val: string) => void
  newParamValue: string
  onNewParamValueChange: (val: string) => void
  newParamDesc: string
  onNewParamDescChange: (val: string) => void
  newParamModelIds: number[]
  onToggleNewParamModel: (id: number) => void
  isParamDuplicate: boolean
  canAddParam: boolean
  onAddParam: () => void
}

const MODEL_BADGE: Record<string, { bg: string; text: string }> = {
  'PDI':       { bg: '#dbeafe', text: '#1e40af' },
  'Outage':    { bg: '#f3e8ff', text: '#6b21a8' },
  'HGI':       { bg: '#dcfce7', text: '#166534' },
  'Runlength': { bg: '#fffbeb', text: '#b45309' },
  'Spall':     { bg: '#fee2e2', text: '#991b1b' },
  'Clean TMT': { bg: '#ffedd5', text: '#9a3412' },
}
function modelBadgeStyle(name: string) {
  return MODEL_BADGE[name] ?? { bg: '#f3f4f6', text: '#374151' }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #d1d5db', borderRadius: 6,
  background: '#ffffff', color: '#374151', fontFamily: 'inherit',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }

export default function ModelParametersTab(props: Props) {
  const models = useAtomValue(modelsAtom)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
      {/* Main Table Card */}
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginBottom: 0 }}>
        <div className="bg-accent-blue" style={{ padding: '9px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Model Parameters ({props.sortedParameters.length})
          </span>
          <input
            type="text"
            placeholder="Search parameters..."
            value={props.searchTerm}
            onChange={(e) => props.onSearchChange(e.target.value)}
            style={{
              padding: '6px 12px', fontSize: 11, borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)', color: '#ffffff', fontFamily: 'inherit', width: 200,
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
          />
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#3d5a70', tableLayout: 'auto' }}>
            <colgroup>
              <col style={{ width: '18%', minWidth: '110px' }} />
              <col style={{ width: '18%', minWidth: '110px' }} />
              <col style={{ width: '8%', minWidth: '70px' }} />
              <col style={{ width: '24%', minWidth: '140px' }} />
              <col style={{ width: '22%', minWidth: '150px' }} />
              <col style={{ width: '10%', minWidth: '80px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, background: '#f4f8fb', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid #dce8f0' }}>
                <th onClick={() => props.onSort('parameter')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: props.sortBy === 'parameter' ? '#1e3a5f' : '#1c3045', cursor: 'pointer', userSelect: 'none', background: props.sortBy === 'parameter' ? 'rgba(30,58,95,0.06)' : 'transparent' }}>
                  Parameter <props.SortIcon column="parameter" />
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Display Name</th>
                <th onClick={() => props.onSort('value')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: props.sortBy === 'value' ? '#1e3a5f' : '#1c3045', cursor: 'pointer', userSelect: 'none', background: props.sortBy === 'value' ? 'rgba(30,58,95,0.06)' : 'transparent' }}>
                  Value <props.SortIcon column="value" />
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Description</th>
                <th onClick={() => props.onSort('models')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: props.sortBy === 'models' ? '#1e3a5f' : '#1c3045', cursor: 'pointer', userSelect: 'none', background: props.sortBy === 'models' ? 'rgba(30,58,95,0.06)' : 'transparent' }}>
                  Models <props.SortIcon column="models" />
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#1c3045' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {props.sortedParameters.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#7a95a8', fontSize: 13 }}>
                  No model parameters defined. Click the add button below to get started.
                </td></tr>
              ) : (
                props.sortedParameters.map((param) => (
                  <tr key={param.parameter} style={{ borderBottom: '1px solid #e8ecf1' }}>
                    <td style={{ padding: '12px 14px', color: '#1c3045', fontWeight: 500 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#3d5a70', background: '#f4f8fb', border: '1px solid #dce8f0', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
                        {param.parameter}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#3d5a70' }}>{param.display_name}</td>
                    <td style={{ padding: '12px 14px', color: '#3d5a70' }}>{param.value}</td>
                    <td style={{ padding: '12px 14px', color: '#3d5a70', maxWidth: 260 }}>
                      <span title={param.description} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                        {param.description}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {props.getModelNames(param.model_ids).split(', ').filter(Boolean).map(name => {
                          const s = modelBadgeStyle(name)
                          return (
                            <span key={name} style={{
                              display: 'inline-flex', alignItems: 'center',
                              borderRadius: 9999, padding: '2px 8px',
                              fontSize: 11, fontWeight: 500,
                              background: s.bg, color: s.text, whiteSpace: 'nowrap',
                            }}>{name}</span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => props.onEdit(param)} className="bg-transparent border-none cursor-pointer text-accent-blue text-sm p-1 font-semibold mr-2">✎</button>
                      <button onClick={() => props.onDelete(param.parameter)} className="bg-transparent border-none cursor-pointer text-accent-red text-base p-1 font-semibold">✕</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer strip */}
        <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '10px 16px', flexShrink: 0 }}>
          <button
            onClick={() => props.onToggleAddParamForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 6, border: '1.5px solid #c5d4e8',
              background: '#ffffff', color: '#1e3a5f', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e8eef6'; e.currentTarget.style.borderColor = '#9fb8d9' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#c5d4e8' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 300 }}>+</span>
            Add New Parameter
          </button>
        </div>
      </div>

      {/* Edit Parameter Modal */}
      <Modal isOpen={props.isEditing} onClose={props.onCancelParamEdit} title="Edit Parameter">
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 200px' }}>
            <label style={labelStyle}>Parameter Name</label>
            <input type="text" value={props.editParamName} onChange={(e) => props.onEditParamNameChange(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Display Name</label>
            <input type="text" value={props.editParamDisplayName} onChange={(e) => props.onEditParamDisplayNameChange(e.target.value)} placeholder="e.g. Data Granularity Mins" style={inputStyle} />
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={labelStyle}>Value</label>
            <input type="text" value={props.editParamValue} onChange={(e) => props.onEditParamValueChange(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea rows={2} value={props.editParamDesc} onChange={(e) => props.onEditParamDescChange(e.target.value)} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Models</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {models.map(model => (
              <label key={model.model_id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={props.editParamModelIds.includes(model.model_id)} onChange={() => props.onToggleEditParamModel(model.model_id)} style={{ cursor: 'pointer' }} />
                <span style={{ color: '#3d5a70' }}>{model.model_alias}</span>
              </label>
            ))}
          </div>
        </div>
        {props.isEditParamDuplicate && (
          <div style={{ padding: '8px 10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 3, marginBottom: 12, fontSize: 11, color: '#856404', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>⚠</span>
            Parameter name already exists.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={props.onCancelParamEdit} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={props.onSaveParamEdit} disabled={!props.canSaveParamEdit} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" style={{ padding: '8px 16px', fontSize: 13, opacity: props.canSaveParamEdit ? 1 : 0.5, cursor: props.canSaveParamEdit ? 'pointer' : 'not-allowed' }}>Save</button>
        </div>
      </Modal>

      {/* Add Parameter Modal */}
      <Modal isOpen={props.isAddingParamForm} onClose={() => props.onToggleAddParamForm(false)} title="Add New Parameter">
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 250px' }}>
            <label style={labelStyle}>Parameter Name</label>
            <input type="text" value={props.newParamName} onChange={(e) => props.onNewParamNameChange(e.target.value)} placeholder="e.g. typical_drum_cycle_hours" style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Display Name</label>
            <input type="text" value={props.newParamDisplayName} onChange={(e) => props.onNewParamDisplayNameChange(e.target.value)} placeholder="e.g. Typical Drum Cycle Hours" style={inputStyle} />
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={labelStyle}>Value</label>
            <input type="text" value={props.newParamValue} onChange={(e) => props.onNewParamValueChange(e.target.value)} placeholder="e.g. 48" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea rows={2} value={props.newParamDesc} onChange={(e) => props.onNewParamDescChange(e.target.value)} placeholder="Description of this parameter" style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Models</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {models.map(model => (
              <label key={model.model_id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={props.newParamModelIds.includes(model.model_id)} onChange={() => props.onToggleNewParamModel(model.model_id)} style={{ cursor: 'pointer' }} />
                <span style={{ color: '#3d5a70' }}>{model.model_alias}</span>
              </label>
            ))}
          </div>
        </div>
        {props.isParamDuplicate && (
          <div style={{ padding: '8px 10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 3, marginBottom: 12, fontSize: 11, color: '#856404', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>⚠</span>
            Parameter name already exists. Delete the existing entry first or use a different name.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={() => props.onToggleAddParamForm(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={props.onAddParam} disabled={!props.canAddParam} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition" style={{ padding: '8px 16px', fontSize: 13, opacity: props.canAddParam ? 1 : 0.5, cursor: props.canAddParam ? 'pointer' : 'not-allowed' }}>+ Add Parameter</button>
        </div>
      </Modal>
    </div>
  )
}
