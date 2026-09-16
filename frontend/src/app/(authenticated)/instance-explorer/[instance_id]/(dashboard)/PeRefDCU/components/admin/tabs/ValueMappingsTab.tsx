'use client'

import { useState } from 'react'
import { useAtom } from 'jotai'
import { valueMapAtom } from '../../../store/dcuAtoms'
import type { ValueMapEntry } from '../../../types'
import Modal from '../../shared/Modal'

interface ConfirmDialog {
  type: 'add' | 'edit' | 'delete'
  title: string
  message: string
  onConfirm: () => void
}

export function ValueMappingsTab() {
  const [valueMap, setValueMap] = useAtom(valueMapAtom)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editRawValue, setEditRawValue] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newRawValue, setNewRawValue] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const filteredEntries = valueMap.filter((e: ValueMapEntry) =>
    e.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.raw_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hasDuplicateLabel = (label: string, excludeIdx?: number) => {
    return label && valueMap.some((e: ValueMapEntry, i: number) => (excludeIdx === undefined || i !== excludeIdx) && e.label === label)
  }

  const startEdit = (idx: number) => {
    const entry = valueMap[idx]
    setEditingIdx(idx)
    setEditLabel(entry.label)
    setEditRawValue(entry.raw_value)
    setEditCode(entry.code)
    setEditCategory(entry.category || '')
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setEditLabel('')
    setEditRawValue('')
    setEditCode('')
    setEditCategory('')
  }

  const handleSaveEditWithConfirm = () => {
    if (!editLabel || !editRawValue || !editCode || editingIdx === null) return
    setConfirmDialog({
      type: 'edit',
      title: 'Confirm Edit Entry',
      message: `Update "${editLabel}" → raw_value: "${editRawValue}" (code: ${editCode})?`,
      onConfirm: () => {
        const updated = [...valueMap]
        updated[editingIdx] = { label: editLabel, raw_value: editRawValue, code: editCode, ...(editCategory ? { category: editCategory } : {}) }
        setValueMap(updated)
        cancelEdit()
        setConfirmDialog(null)
      },
    })
  }

  const handleDeleteWithConfirm = (idx: number) => {
    const entry = valueMap[idx]
    setConfirmDialog({
      type: 'delete',
      title: 'Confirm Delete Entry',
      message: `Delete "${entry.label}"? This cannot be undone.`,
      onConfirm: () => {
        setValueMap(valueMap.filter((_: ValueMapEntry, i: number) => i !== idx))
        setConfirmDialog(null)
      },
    })
  }

  const handleAddWithConfirm = () => {
    if (!newLabel || !newRawValue || !newCode) return
    setConfirmDialog({
      type: 'add',
      title: 'Confirm Add Entry',
      message: `Add "${newLabel}" → raw_value: "${newRawValue}" (code: ${newCode})?`,
      onConfirm: () => {
        setValueMap([...valueMap, { label: newLabel, raw_value: newRawValue, code: newCode, ...(newCategory ? { category: newCategory } : {}) }])
        setNewLabel('')
        setNewRawValue('')
        setNewCode('')
        setNewCategory('')
        setShowAddForm(false)
        setConfirmDialog(null)
      },
    })
  }

  const isDuplicateLabel = !!(newLabel && hasDuplicateLabel(newLabel))
  const isEditDuplicateLabel = !!(editLabel && editingIdx !== null && hasDuplicateLabel(editLabel, editingIdx))
  const canAdd = !!(newLabel && newRawValue && newCode && !isDuplicateLabel)
  const canSaveEdit = !!(editLabel && editRawValue && editCode && !isEditDuplicateLabel)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 6,
    background: '#ffffff', color: '#374151', fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
      {/* Main Table Card */}
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="bg-accent-blue" style={{ padding: '9px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Value Mappings ({valueMap.length})
          </span>
          <input
            type="text"
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#ffffff', fontFamily: 'inherit', width: 200 }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
          />
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#3d5a70', tableLayout: 'auto' }}>
            <colgroup>
              <col style={{ width: '22%', minWidth: '90px' }} />
              <col style={{ width: '30%', minWidth: '120px' }} />
              <col style={{ width: '12%', minWidth: '70px' }} />
              <col style={{ width: '18%', minWidth: '80px' }} />
              <col style={{ width: '18%', minWidth: '80px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, background: '#f4f8fb', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid #dce8f0' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Label</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Raw PI Value</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Code</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#1c3045' }}>Category</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#1c3045' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#7a95a8', fontSize: 13 }}>
                    {valueMap.length === 0 ? 'No value mappings defined. Click the add button below to get started.' : 'No matching mappings found.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry: ValueMapEntry) => {
                  const actualIdx = valueMap.indexOf(entry)
                  return (
                    <tr key={actualIdx} style={{ borderBottom: '1px solid #e8ecf1' }}>
                      <td style={{ padding: '12px 14px', color: '#1c3045', fontWeight: 500 }}>{entry.label}</td>
                      <td style={{ padding: '12px 14px', color: '#3d5a70' }}>{entry.raw_value}</td>
                      <td style={{ padding: '12px 14px', color: '#3d5a70', fontFamily: 'monospace' }}>{entry.code}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {entry.category ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            {entry.category}
                          </span>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(actualIdx)} className="bg-transparent border-none cursor-pointer text-accent-blue text-sm p-1 font-semibold mr-2" title="Edit">✎</button>
                        <button onClick={() => handleDeleteWithConfirm(actualIdx)} className="bg-transparent border-none cursor-pointer text-accent-red text-base p-1 font-semibold" title="Delete">✕</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer strip */}
        <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '10px 16px', flexShrink: 0 }}>
          <button
            onClick={() => setShowAddForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1.5px solid #c5d4e8', background: '#ffffff', color: '#1e3a5f', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e8eef6'; e.currentTarget.style.borderColor = '#9fb8d9' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#c5d4e8' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 300 }}>+</span>
            Add New Entry
          </button>
        </div>
      </div>

      {/* Edit Entry Modal */}
      <Modal isOpen={editingIdx !== null} onClose={cancelEdit} title="Edit Entry">
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 200px' }}>
            <label style={labelStyle}>Label</label>
            <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              style={{ ...inputStyle, borderColor: isEditDuplicateLabel ? '#dc3545' : '#d1d5db' }} />
            {isEditDuplicateLabel && <div className="text-xs text-accent-red mt-1">Duplicate label</div>}
          </div>
          <div style={{ flex: '0 1 200px' }}>
            <label style={labelStyle}>Raw PI Value</label>
            <input type="text" value={editRawValue} onChange={(e) => setEditRawValue(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <label style={labelStyle}>Code</label>
            <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={labelStyle}>Category <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(optional)</span></label>
            <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. mode" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={handleSaveEditWithConfirm} disabled={!canSaveEdit} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition"
            style={{ padding: '8px 16px', fontSize: 13, opacity: canSaveEdit ? 1 : 0.5, cursor: canSaveEdit ? 'pointer' : 'not-allowed' }}>Save</button>
        </div>
      </Modal>

      {/* Add Entry Modal */}
      <Modal isOpen={showAddForm} onClose={() => setShowAddForm(false)} title="Add New Entry">
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 220px' }}>
            <label style={labelStyle}>Label</label>
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Auto"
              style={{ ...inputStyle, borderColor: isDuplicateLabel ? '#dc3545' : '#d1d5db' }} />
            {isDuplicateLabel && <div className="text-xs text-accent-red mt-1">Label already exists</div>}
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label style={labelStyle}>Raw PI Value</label>
            <input type="text" value={newRawValue} onChange={(e) => setNewRawValue(e.target.value)} placeholder="e.g. Auto" style={inputStyle} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={labelStyle}>Code</label>
            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. 0" style={{ ...inputStyle, fontFamily: 'monospace' }} />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={labelStyle}>Category <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(optional)</span></label>
            <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. mode" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >Cancel</button>
          <button onClick={handleAddWithConfirm} disabled={!canAdd} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold text-sm rounded-lg px-6 py-2.5 shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition"
            style={{ padding: '8px 16px', fontSize: 13, opacity: canAdd ? 1 : 0.5, cursor: canAdd ? 'pointer' : 'not-allowed' }}>Add Entry</button>
        </div>
      </Modal>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-[1100]" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-surface rounded-lg p-5 max-w-[400px] shadow-xl">
            <h3 className="text-sm font-bold text-accent-blue mt-0 mb-3">{confirmDialog.title}</h3>
            <p className="text-xs text-text-secondary mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="inline-flex items-center gap-2 bg-background border border-border text-accent-blue font-semibold rounded-lg hover:bg-surface-hover cursor-pointer whitespace-nowrap transition px-4 py-2 text-xs">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="inline-flex items-center gap-2 bg-accent-blue text-white font-bold rounded-lg shadow-md hover:brightness-90 disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition px-4 py-2 text-xs">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
