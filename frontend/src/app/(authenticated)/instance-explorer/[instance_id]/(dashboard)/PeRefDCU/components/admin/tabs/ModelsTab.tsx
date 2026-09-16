'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  equipmentAtom,
  topologyTreeAtom,
  tagMappingsAtom,
  setModelsAtom,
} from '../../../store/dcuAtoms'
import { flattenTree } from '../../../utils/outputGenerator'
import type { ModelEntry, SubModelEntry, TopologyNode, ModelTagMapping } from '../../../types'
import Modal from '../../shared/Modal'

const ALIAS_PATTERN = /^[A-Za-z0-9_]+$/

const LEVELS_EXCLUD_SYSTEM = [
  'Furnace', 'Cell', 'Pass', 'Tube',
  'Drum train', 'Drum',
  'Fractionator', 'Column Overhead', 'Column Reboiler',
  'Spall Group',
]

interface SubRow {
  sub_model_id: number
  model_level: string
  model_alias: string
  sub_model_name: string
  nodePath: string
  levelToPrefix: Map<string, string>
  attributes?: string[]
  storedTarget?: string[]
  storedCumulativeAttrs?: string[]
  storedSkipAttrs?: string[]
}

interface Props {
  models: ModelEntry[]
  onAdd: (entry: ModelEntry) => void
  onEdit: (entry: ModelEntry) => void
  onDelete: (id: string) => void
}

const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#5a7a8f', textTransform: 'uppercase',
  letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left',
  borderBottom: '1px solid #dce8f0', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  fontSize: 12, color: '#1c3045', padding: '8px 12px',
  borderBottom: '1px solid #f4f8fb', verticalAlign: 'middle',
}
const tdSub: React.CSSProperties = {
  ...td, fontSize: 11, color: '#3d5a70', background: '#f8fbfd',
  borderBottom: '1px solid #eef3f7',
}
const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#3d5a70', display: 'block', marginBottom: 4,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #dce8f0',
  borderRadius: 4, fontFamily: 'inherit', boxSizing: 'border-box',
}

function attrOnly(key: string) { return key.includes('|') ? key.split('|').slice(1).join('|') : key }

function resolveAttr(key: string, levelToPrefix: Map<string, string>): string {
  const pipeIdx = key.indexOf('|')
  if (pipeIdx === -1) return key
  const level = key.slice(0, pipeIdx)
  const attr = key.slice(pipeIdx + 1)
  const prefix = levelToPrefix.get(level)
  return prefix !== undefined ? (prefix ? `${prefix}_${attr}` : attr) : attr
}

function AttrPills({ attrs, levelToPrefix }: { attrs: string[], levelToPrefix: Map<string, string> }) {
  const MAX = 3
  const items = attrs.map(a => resolveAttr(a, levelToPrefix))
  const visible = items.slice(0, MAX)
  const extra = items.length - MAX
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {visible.map(s => (
        <span key={s} style={{ fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{s}</span>
      ))}
      {extra > 0 && (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer', fontFamily: 'inherit' }}>+{extra} more</button>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100, background: '#fff', border: '1px solid #dce8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360, maxHeight: 200, overflowY: 'auto' }}>
              {items.slice(MAX).map(s => (<span key={s} style={{ fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{s}</span>))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AttrNamePills({ attrs }: { attrs: string[] }) {
  const MAX = 3
  const all = attrs.map(attrOnly)
  const visible = all.slice(0, MAX)
  const extra = all.length - MAX
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {visible.map(a => (<span key={a} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{a}</span>))}
      {extra > 0 && (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer', fontFamily: 'inherit' }}>+{extra} more</button>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100, background: '#fff', border: '1px solid #dce8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360, maxHeight: 200, overflowY: 'auto' }}>
              {all.slice(MAX).map(a => (<span key={a} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{a}</span>))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TargetNamePills({ keys }: { keys: string[] }) {
  const MAX = 3
  const all = keys.map(attrOnly)
  const visible = all.slice(0, MAX)
  const extra = all.length - MAX
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {visible.map(a => (<span key={a} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>{a}</span>))}
      {extra > 0 && (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer', fontFamily: 'inherit' }}>+{extra} more</button>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100, background: '#fff', border: '1px solid #dce8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360, maxHeight: 200, overflowY: 'auto' }}>
              {all.slice(MAX).map(a => (<span key={a} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>{a}</span>))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AttrDropdownProps {
  modelId: number
  selected: string[]
  onChange: (selected: string[]) => void
  validLevels?: Set<string>
  tagMappings: ModelTagMapping[]
}

function AttrDropdown({ modelId, selected, onChange, validLevels, tagMappings }: AttrDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const available = useMemo(() =>
    tagMappings.filter(m =>
      m.model_ids.includes(modelId) &&
      m.type !== 'Constant' && m.type !== 'Cause' && m.type !== 'Effect' &&
      (!validLevels || validLevels.size === 0 || validLevels.has(m.level))
    ), [tagMappings, modelId, validLevels])

  const filtered = useMemo(() => {
    if (!search.trim()) return available
    const q = search.toLowerCase()
    return available.filter(m => m.attribute.toLowerCase().includes(q) || (m.display_name ?? '').toLowerCase().includes(q))
  }, [available, search])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    filtered.forEach(m => { if (!map.has(m.level)) map.set(m.level, []); map.get(m.level)!.push(m) })
    return map
  }, [filtered])

  useEffect(() => {
    function onDown(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function ck(level: string, attr: string) { return `${level}|${attr}` }
  function toggle(key: string) { onChange(selected.includes(key) ? selected.filter(a => a !== key) : [...selected, key]) }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <span style={{ color: selected.length ? '#1c3045' : '#9ca3af' }}>
          {selected.length ? `${selected.length} attribute${selected.length > 1 ? 's' : ''} selected` : 'Select attributes…'}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #dce8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2 }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f6fa' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attributes…" style={{ ...fieldStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
            {available.length === 0 && (<div style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No attributes available for this model.</div>)}
            {[...grouped.entries()].map(([level, items]) => (
              <div key={level}>
                <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 700, color: '#5a7a8f', background: '#f8fbfd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{level}</div>
                {items.map(m => (
                  <label key={ck(m.level, m.attribute)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, color: '#1c3045' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <input type="checkbox" checked={selected.includes(ck(m.level, m.attribute))} onChange={() => toggle(ck(m.level, m.attribute))} style={{ margin: 0, cursor: 'pointer' }} />
                    <span style={{ flex: 1 }}>{m.display_name ?? m.attribute}</span>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: m.type === 'PI' ? '#eff6ff' : '#fef9c3', color: m.type === 'PI' ? '#1d4ed8' : '#854d0e', border: `1px solid ${m.type === 'PI' ? '#bfdbfe' : '#fde047'}` }}>{m.type}</span>
                  </label>
                ))}
              </div>
            ))}
            {available.length > 0 && filtered.length === 0 && (<div style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No matches.</div>)}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '6px 10px', borderTop: '1px solid #f0f6fa', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => onChange([])} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ModelsTab({ models, onAdd, onEdit, onDelete }: Props) {
  const equipment = useAtomValue(equipmentAtom)
  const topologyTree = useAtomValue(topologyTreeAtom)
  const tagMappings = useAtomValue(tagMappingsAtom)
  const setModels = useSetAtom(setModelsAtom)

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLevel, setNewLevel] = useState('')
  const [newAttributes, setNewAttributes] = useState<string[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<ModelEntry | null>(null)
  const [editName, setEditName] = useState('')
  const [editLevel, setEditLevel] = useState('')
  const [editAttributes, setEditAttributes] = useState<string[]>([])
  const [newDisplay, setNewDisplay] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [newTarget, setNewTarget] = useState<string[]>([])
  const [editTarget, setEditTarget] = useState<string[]>([])
  const [newCumulativeAttrs, setNewCumulativeAttrs] = useState<string[]>([])
  const [editCumulativeAttrs, setEditCumulativeAttrs] = useState<string[]>([])
  const [newSkipAttrs, setNewSkipAttrs] = useState<string[]>([])
  const [editSkipAttrs, setEditSkipAttrs] = useState<string[]>([])

  const isEquipmentEmpty = equipment.furnaces.length === 0 && equipment.drumTrains.length === 0 && equipment.fractionators.length === 0

  const { allNodes, nodesByLevel } = useMemo(() => {
    const allNodes: TopologyNode[] = flattenTree(topologyTree)
    const nodesByLevel = new Map<string, TopologyNode[]>()
    allNodes.forEach(n => {
      if (!nodesByLevel.has(n.level)) nodesByLevel.set(n.level, [])
      nodesByLevel.get(n.level)!.push(n)
    })
    return { allNodes, nodesByLevel }
  }, [topologyTree])

  function enrichAttributes(attrs: string[], modelId: number): string[] {
    return attrs.map(a => {
      if (a.includes('|')) return a
      const entry = tagMappings.find(m => m.attribute === a && m.model_ids.includes(modelId) && m.type !== 'Constant' && m.type !== 'Cause' && m.type !== 'Effect')
      return entry ? `${entry.level}|${a}` : a
    })
  }

  function buildLevelToPrefix(nodePath: string): Map<string, string> {
    const map = new Map<string, string>()
    const sysNode = allNodes.find(n => n.type === 'system')
    if (sysNode) map.set(sysNode.level, '')
    allNodes.forEach(n => {
      if (n.type === 'system') return
      if (nodePath === n.path || nodePath.startsWith(n.path + '/')) {
        map.set(n.level, n.path.replace(/\//g, '_').toLowerCase())
      }
    })
    const furnaceAnc = allNodes.find(n => n.type === 'furnace' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))
    const dtAnc = allNodes.find(n => n.type === 'drum_train' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))
    const fracAnc = allNodes.find(n => n.type === 'fractionator' && (nodePath === n.path || nodePath.startsWith(n.path + '/')))

    function addLinkedFrac(dtId: string) {
      const fracIds = equipment.trainFractionatorLinks[dtId] ?? []
      const frac = equipment.fractionators.find(f => fracIds.includes(f.id))
      if (frac && !map.has('Fractionator')) map.set('Fractionator', frac.name.replace(/\//g, '_').toLowerCase())
    }

    if (furnaceAnc) {
      const fIdx = equipment.furnaces.findIndex(f => f.name === furnaceAnc.path)
      if (fIdx >= 0 && equipment.drumTrains[fIdx]) {
        const dt = equipment.drumTrains[fIdx]
        if (!map.has('Drum train')) map.set('Drum train', dt.name.replace(/\//g, '_').toLowerCase())
        addLinkedFrac(dt.id)
      }
    }
    if (dtAnc) {
      const dtIdx = equipment.drumTrains.findIndex(dt => dt.name === dtAnc.path)
      if (dtIdx >= 0) {
        if (equipment.furnaces[dtIdx] && !map.has('Furnace')) map.set('Furnace', equipment.furnaces[dtIdx].name.replace(/\//g, '_').toLowerCase())
        addLinkedFrac(equipment.drumTrains[dtIdx].id)
      }
    }
    if (fracAnc) {
      const frac = equipment.fractionators.find(f => f.name === fracAnc.path)
      if (frac) {
        Object.entries(equipment.trainFractionatorLinks).forEach(([trainId, fracIds]) => {
          if (!fracIds.includes(frac.id)) return
          const dt = equipment.drumTrains.find(d => d.id === trainId)
          if (dt && !map.has('Drum train')) map.set('Drum train', dt.name.replace(/\//g, '_').toLowerCase())
          const dtIdx = equipment.drumTrains.findIndex(d => d.id === trainId)
          if (dtIdx >= 0 && equipment.furnaces[dtIdx] && !map.has('Furnace')) map.set('Furnace', equipment.furnaces[dtIdx].name.replace(/\//g, '_').toLowerCase())
        })
      }
    }
    return map
  }

  function getValidLevels(modelLevel: string): Set<string> {
    if (!modelLevel) return new Set()
    const nodes = nodesByLevel.get(modelLevel) ?? []
    if (nodes.length === 0) return new Set()
    return new Set(buildLevelToPrefix(nodes[0].path).keys())
  }

  const subRowsByModelId = useMemo(() => {
    let counter = 1
    const result = new Map<number, SubRow[]>()
    ;[...models].sort((a, b) => a.model_id - b.model_id).forEach(model => {
      const modelPrefix = model.model_alias.toLowerCase().replace(/\s+/g, '_')
      if (!model.model_level) {
        const s0 = model.sub_models?.[0]
        result.set(model.model_id, [{ sub_model_id: counter++, model_level: '', model_alias: model.model_alias, sub_model_name: modelPrefix, nodePath: '', levelToPrefix: new Map(), attributes: s0?.attributes, storedTarget: s0?.target_variable, storedCumulativeAttrs: s0?.cumulative_attributes, storedSkipAttrs: s0?.model_skip_attributes }])
      } else {
        const nodes = nodesByLevel.get(model.model_level) ?? []
        if (nodes.length > 0) {
          result.set(model.model_id, nodes.map(node => {
            const smName = modelPrefix + '_' + node.path.replace(/\//g, '_').toLowerCase()
            const storedSub = model.sub_models?.find(s => s.sub_model_name === smName)
            return { sub_model_id: counter++, model_level: model.model_level, model_alias: model.model_alias, sub_model_name: smName, nodePath: node.path.replace(/\//g, '_').toLowerCase(), levelToPrefix: buildLevelToPrefix(node.path), attributes: storedSub?.attributes, storedTarget: storedSub?.target_variable, storedCumulativeAttrs: storedSub?.cumulative_attributes, storedSkipAttrs: storedSub?.model_skip_attributes }
          }))
        } else {
          const stored = model.sub_models ?? []
          result.set(model.model_id, stored.map(s => {
            const np = s.sub_model_name.startsWith(modelPrefix + '_') ? s.sub_model_name.slice(modelPrefix.length + 1) : s.sub_model_name
            return { sub_model_id: counter++, model_level: model.model_level, model_alias: model.model_alias, sub_model_name: s.sub_model_name, nodePath: np, levelToPrefix: new Map(), attributes: s.attributes, storedTarget: s.target_variable, storedCumulativeAttrs: s.cumulative_attributes, storedSkipAttrs: s.model_skip_attributes }
          }))
        }
      }
    })
    return result
  }, [models, nodesByLevel, allNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEquipmentEmpty || nodesByLevel.size === 0) return
    let seq = 1
    let anyChanged = false
    const updated = [...models].sort((a, b) => a.model_id - b.model_id).map(m => {
      const subRows = nodesByLevel.get(m.model_level) ?? []
      const prefix = m.model_alias.toLowerCase().replace(/\s+/g, '_')
      const enriched = (arr: string[]) => arr.map(a => {
        if (a.includes('|')) return a
        const entry = tagMappings.find(e => e.attribute === a && e.model_ids.includes(m.model_id) && e.type !== 'Constant' && e.type !== 'Cause' && e.type !== 'Effect')
        return entry ? `${entry.level}|${a}` : a
      })
      const enrichedAttrs = enriched(m.attributes ?? [])
      const enrichedCumulative = enriched(m.cumulative_attributes ?? [])
      const enrichedSkip = enriched(m.model_skip_attributes ?? [])

      const newSubModels: SubModelEntry[] = !m.model_level
        ? [{ sub_model_id: seq++, sub_model_name: prefix, attributes: enrichedAttrs.map(a => resolveAttr(a, new Map())), ...((m.target_variable?.length) ? { target_variable: m.target_variable.map(t => resolveAttr(t, new Map())) } : {}), ...(enrichedCumulative.length ? { cumulative_attributes: enrichedCumulative.map(a => resolveAttr(a, new Map())) } : {}), ...(enrichedSkip.length ? { model_skip_attributes: enrichedSkip.map(a => resolveAttr(a, new Map())) } : {}) }]
        : subRows.map(n => {
            const ltp = buildLevelToPrefix(n.path)
            return { sub_model_id: seq++, sub_model_name: prefix + '_' + n.path.replace(/\//g, '_').toLowerCase(), attributes: enrichedAttrs.map(a => resolveAttr(a, ltp)), ...((m.target_variable?.length) ? { target_variable: m.target_variable.map(t => resolveAttr(t, ltp)) } : {}), ...(enrichedCumulative.length ? { cumulative_attributes: enrichedCumulative.map(a => resolveAttr(a, ltp)) } : {}), ...(enrichedSkip.length ? { model_skip_attributes: enrichedSkip.map(a => resolveAttr(a, ltp)) } : {}) }
          })
      if (JSON.stringify(newSubModels) !== JSON.stringify(m.sub_models ?? [])) anyChanged = true
      return { ...m, sub_models: newSubModels }
    })
    if (anyChanged) setModels(updated)
  }, [models, nodesByLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextModelId = models.length === 0 ? 1 : Math.max(...models.map(m => m.model_id)) + 1

  function aliasError(v: string, excludeId?: string) {
    if (!v) return 'Required'
    if (v.length > 50) return 'Max 50 characters'
    if (!ALIAS_PATTERN.test(v)) return 'Only A–Z, a–z, 0–9, underscore'
    if (models.some(m => m.id !== excludeId && m.model_alias.toLowerCase() === v.toLowerCase())) return 'Must be unique'
    return ''
  }
  const newAliasError = aliasError(newName.trim())
  const editAliasError = aliasError(editName.trim(), editEntry?.id)
  const canAdd = !newAliasError

  function handleAdd() {
    if (!canAdd) return
    const prefix = newName.trim().toLowerCase().replace(/\s+/g, '_')
    const nodes = newLevel ? (nodesByLevel.get(newLevel) ?? []) : []
    const sub_models: SubModelEntry[] = !newLevel || nodes.length === 0
      ? [{ sub_model_id: 1, sub_model_name: prefix, attributes: newAttributes.map(a => resolveAttr(a, new Map())), ...(newTarget.length ? { target_variable: newTarget.map(t => resolveAttr(t, new Map())) } : {}), ...(newCumulativeAttrs.length ? { cumulative_attributes: newCumulativeAttrs.map(a => resolveAttr(a, new Map())) } : {}), ...(newSkipAttrs.length ? { model_skip_attributes: newSkipAttrs.map(a => resolveAttr(a, new Map())) } : {}) }]
      : nodes.map((node, i) => {
          const ltp = buildLevelToPrefix(node.path)
          return { sub_model_id: i + 1, sub_model_name: prefix + '_' + node.path.replace(/\//g, '_').toLowerCase(), attributes: newAttributes.map(a => resolveAttr(a, ltp)), ...(newTarget.length ? { target_variable: newTarget.map(t => resolveAttr(t, ltp)) } : {}), ...(newCumulativeAttrs.length ? { cumulative_attributes: newCumulativeAttrs.map(a => resolveAttr(a, ltp)) } : {}), ...(newSkipAttrs.length ? { model_skip_attributes: newSkipAttrs.map(a => resolveAttr(a, ltp)) } : {}) }
        })
    onAdd({ id: Math.random().toString(36).slice(2), model_id: nextModelId, model_level: newLevel, model_alias: newName.trim(), name: newName.trim().toLowerCase().replace(/\s+/g, '_'), group: 'coke_drum', model_display: newDisplay.trim() || undefined, model_description: newDescription.trim() || undefined, attributes: newAttributes, target_variable: newTarget.length > 0 ? newTarget : undefined, cumulative_attributes: newCumulativeAttrs.length > 0 ? newCumulativeAttrs : undefined, model_skip_attributes: newSkipAttrs.length > 0 ? newSkipAttrs : undefined, sub_models })
    setNewName(''); setNewLevel(''); setNewAttributes([]); setNewDisplay(''); setNewDescription(''); setNewTarget([]); setNewCumulativeAttrs([]); setNewSkipAttrs([])
    setShowAdd(false)
  }

  function openEdit(model: ModelEntry) {
    setEditEntry(model); setEditName(model.model_alias); setEditLevel(model.model_level)
    setEditDisplay(model.model_display ?? ''); setEditDescription(model.model_description ?? '')
    setEditTarget(model.target_variable ?? [])
    const migrate = (attrs: string[]) => attrs.map(a => {
      if (a.includes('|')) return a
      const entry = tagMappings.find(m => m.attribute === a && m.model_ids.includes(model.model_id) && m.type !== 'Constant' && m.type !== 'Cause' && m.type !== 'Effect')
      return entry ? `${entry.level}|${a}` : a
    })
    setEditAttributes(migrate(model.attributes ?? []))
    setEditCumulativeAttrs(migrate(model.cumulative_attributes ?? []))
    setEditSkipAttrs(migrate(model.model_skip_attributes ?? []))
  }

  function handleEdit() {
    if (!editEntry || editAliasError) return
    const prefix = editName.trim().toLowerCase().replace(/\s+/g, '_')
    const nodes = editLevel ? (nodesByLevel.get(editLevel) ?? []) : []
    const sub_models: SubModelEntry[] = nodes.length > 0
      ? nodes.map(node => {
          const smName = prefix + '_' + node.path.replace(/\//g, '_').toLowerCase()
          const ltp = buildLevelToPrefix(node.path)
          return { sub_model_id: editEntry.sub_models?.find(s => s.sub_model_name === smName)?.sub_model_id ?? 0, sub_model_name: smName, attributes: editAttributes.map(a => resolveAttr(a, ltp)), ...(editTarget.length ? { target_variable: editTarget.map(t => resolveAttr(t, ltp)) } : {}), ...(editCumulativeAttrs.length ? { cumulative_attributes: editCumulativeAttrs.map(a => resolveAttr(a, ltp)) } : {}), ...(editSkipAttrs.length ? { model_skip_attributes: editSkipAttrs.map(a => resolveAttr(a, ltp)) } : {}) }
        })
      : (editEntry.sub_models ?? []).map(s => ({ ...s, attributes: editAttributes.map(a => resolveAttr(a, new Map())), ...(editTarget.length ? { target_variable: editTarget.map(t => resolveAttr(t, new Map())) } : { target_variable: undefined }), ...(editCumulativeAttrs.length ? { cumulative_attributes: editCumulativeAttrs.map(a => resolveAttr(a, new Map())) } : { cumulative_attributes: undefined }), ...(editSkipAttrs.length ? { model_skip_attributes: editSkipAttrs.map(a => resolveAttr(a, new Map())) } : { model_skip_attributes: undefined }) }))
    onEdit({ ...editEntry, model_alias: editName.trim(), model_display: editDisplay.trim() || undefined, model_description: editDescription.trim() || undefined, model_level: editLevel, attributes: editAttributes, target_variable: editTarget.length > 0 ? editTarget : undefined, cumulative_attributes: editCumulativeAttrs.length > 0 ? editCumulativeAttrs : undefined, model_skip_attributes: editSkipAttrs.length > 0 ? editSkipAttrs : undefined, sub_models })
    setEditEntry(null)
  }

  function toggleExpand(modelId: number) {
    setExpandedIds(prev => { const next = new Set(prev); next.has(modelId) ? next.delete(modelId) : next.add(modelId); return next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#5a7a8f' }}>
          Define models and their topology level. Each model expands into one sub-model row per entity at that level.
        </p>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          + Add Model
        </button>
      </div>

      <div style={{ border: '1px solid #dce8f0', borderRadius: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#f0f6fa' }}>
              <th style={{ ...th, width: 32 }}></th>
              <th style={th}>Model ID</th>
              <th style={th}>Level</th>
              <th style={th}>Model Name</th>
              <th style={th}>Display Name</th>
              <th style={th}>Description</th>
              <th style={th}>Feature (X)</th>
              <th style={th}>Target (Y)</th>
              <th style={th}>Cumulative Attr</th>
              <th style={th}>Skip Attr</th>
              <th style={th}>Submodel ID</th>
              <th style={th}>Submodel Name</th>
              <th style={{ ...th, width: 60 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 && (
              <tr><td colSpan={13} style={{ ...td, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', padding: '24px 12px' }}>No models defined. Click &quot;+ Add Model&quot; to get started.</td></tr>
            )}
            {[...models].sort((a, b) => a.model_id - b.model_id).map(model => {
              const isExpanded = expandedIds.has(model.model_id)
              const subRows = subRowsByModelId.get(model.model_id) ?? []
              const modelAttrs = enrichAttributes(model.attributes ?? [], model.model_id)
              return (
                <>
                  <tr key={model.id} style={{ background: '#fff' }}>
                    <td style={{ ...td, textAlign: 'center', cursor: 'pointer', color: '#2563eb' }} onClick={() => toggleExpand(model.model_id)}>
                      <span style={{ fontSize: 10, display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                    </td>
                    <td style={td}><span style={{ fontWeight: 700, color: '#2563eb' }}>{model.model_id}</span></td>
                    <td style={td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>{model.model_level}</span></td>
                    <td style={{ ...td, fontWeight: 600 }}>{model.model_alias}</td>
                    <td style={td}>{model.model_display || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={{ ...td, color: '#5a7a8f', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.model_description}>{model.model_description || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={td}>{modelAttrs.length > 0 ? <AttrNamePills attrs={modelAttrs} /> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={td}>{model.target_variable?.length ? <TargetNamePills keys={model.target_variable} /> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={td}>{(model.cumulative_attributes?.length ?? 0) > 0 ? <AttrNamePills attrs={enrichAttributes(model.cumulative_attributes!, model.model_id)} /> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={td}>{(model.model_skip_attributes?.length ?? 0) > 0 ? <AttrNamePills attrs={enrichAttributes(model.model_skip_attributes!, model.model_id)} /> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={{ ...td, color: '#9ca3af' }}>-</td>
                    <td style={{ ...td, color: '#9ca3af' }}>-</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(model)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '2px 4px', borderRadius: 4, marginRight: 2 }} title="Edit model">
                        <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => setConfirmDeleteId(model.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', borderRadius: 4 }} title="Delete model">
                        <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                  {isExpanded && subRows.map((sub, i) => (
                    <tr key={`${model.id}-sub-${i}`}>
                      <td style={tdSub}></td>
                      <td style={{ ...tdSub, color: '#6b7280' }}>{model.model_id}</td>
                      <td style={tdSub}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0f6fa', color: '#3d5a70', border: '1px solid #dce8f0', fontWeight: 500 }}>{model.model_level}</span></td>
                      <td style={{ ...tdSub, fontWeight: 500 }}>{model.model_alias}</td>
                      <td style={tdSub}>{model.model_display || ''}</td>
                      <td style={tdSub}>{model.model_description || ''}</td>
                      <td style={tdSub}>
                        {sub.attributes?.length ? <AttrPills attrs={sub.attributes} levelToPrefix={new Map()} />
                          : modelAttrs.length > 0 ? <AttrPills attrs={modelAttrs} levelToPrefix={sub.levelToPrefix} />
                          : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={tdSub}>
                        {(() => {
                          const targets = sub.storedTarget?.length ? sub.storedTarget : (model.target_variable?.length ? model.target_variable.map(t => resolveAttr(t, sub.levelToPrefix)) : [])
                          return targets.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{targets.map(t => (<span key={t} style={{ fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>{t}</span>))}</div> : <span style={{ color: '#9ca3af' }}>—</span>
                        })()}
                      </td>
                      <td style={tdSub}>
                        {(() => {
                          const attrs = sub.storedCumulativeAttrs?.length ? sub.storedCumulativeAttrs : (model.cumulative_attributes?.length ? model.cumulative_attributes.map(a => resolveAttr(a, sub.levelToPrefix)) : [])
                          return attrs.length > 0 ? <AttrPills attrs={attrs} levelToPrefix={new Map()} /> : <span style={{ color: '#9ca3af' }}>—</span>
                        })()}
                      </td>
                      <td style={tdSub}>
                        {(() => {
                          const attrs = sub.storedSkipAttrs?.length ? sub.storedSkipAttrs : (model.model_skip_attributes?.length ? model.model_skip_attributes.map(a => resolveAttr(a, sub.levelToPrefix)) : [])
                          return attrs.length > 0 ? <AttrPills attrs={attrs} levelToPrefix={new Map()} /> : <span style={{ color: '#9ca3af' }}>—</span>
                        })()}
                      </td>
                      <td style={{ ...tdSub, color: '#6b7280' }}>{sub.sub_model_id}</td>
                      <td style={{ ...tdSub, fontFamily: 'monospace', color: '#374151' }}>{sub.sub_model_name}</td>
                      <td style={tdSub}></td>
                    </tr>
                  ))}
                  {isExpanded && subRows.length === 0 && (
                    <tr key={`${model.id}-empty`}>
                      <td colSpan={13} style={{ ...tdSub, paddingLeft: 32 }}>
                        <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 11 }}>No sub-model rows — load a client configuration or complete Step 1 to populate topology.</span>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal isOpen={showAdd} title="Add Model" onClose={() => { setShowAdd(false); setNewName(''); setNewLevel(''); setNewAttributes([]); setNewDisplay(''); setNewDescription(''); setNewTarget([]); setNewCumulativeAttrs([]); setNewSkipAttrs([]) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            <div><label style={fieldLabel}>Model ID <span style={{ color: '#9ca3af', fontWeight: 400 }}>(auto-assigned)</span></label><input type="text" value={nextModelId} disabled style={{ ...fieldStyle, background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }} /></div>
            <div>
              <label style={fieldLabel}>Model Name <span style={{ color: '#ef4444' }}>*</span><span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 10 }}>^[A-Za-z0-9_]+, max 50 chars, unique</span></label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. PDI, Outage, Spall" maxLength={50} style={{ ...fieldStyle, borderColor: newName.trim() && newAliasError ? '#ef4444' : '#dce8f0' }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              {newName.trim() && newAliasError && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 3, display: 'block' }}>{newAliasError}</span>}
            </div>
            <div><label style={fieldLabel}>Display Name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><input type="text" value={newDisplay} onChange={e => setNewDisplay(e.target.value)} placeholder="e.g. Predictive Decoking Index" style={fieldStyle} /></div>
            <div>
              <label style={fieldLabel}>Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional, max 100 chars)</span></label>
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description of what this model does" rows={2} maxLength={100} style={{ ...fieldStyle, resize: 'vertical' }} />
              <span style={{ fontSize: 10, color: newDescription.length >= 90 ? '#ef4444' : '#9ca3af', display: 'block', textAlign: 'right', marginTop: 2 }}>{newDescription.length}/100</span>
            </div>
            <div><label style={fieldLabel}>Model Level <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><select value={newLevel} onChange={e => setNewLevel(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}><option value="">— No level (use model name only) —</option>{LEVELS_EXCLUD_SYSTEM.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <div>
              <label style={fieldLabel}>Attributes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — PI &amp; Inferred only)</span></label>
              <AttrDropdown modelId={nextModelId} selected={newAttributes} onChange={setNewAttributes} validLevels={getValidLevels(newLevel)} tagMappings={tagMappings} />
            </div>
            <div><label style={fieldLabel}>Target Variable (Y) <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={nextModelId} selected={newTarget} onChange={setNewTarget} validLevels={getValidLevels(newLevel)} tagMappings={tagMappings} /></div>
            <div><label style={fieldLabel}>Cumulative Attribute <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={nextModelId} selected={newCumulativeAttrs} onChange={setNewCumulativeAttrs} validLevels={getValidLevels(newLevel)} tagMappings={tagMappings} /></div>
            <div><label style={fieldLabel}>Skip Attribute <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={nextModelId} selected={newSkipAttrs} onChange={setNewSkipAttrs} validLevels={getValidLevels(newLevel)} tagMappings={tagMappings} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setShowAdd(false); setNewName(''); setNewLevel(''); setNewAttributes([]); setNewDisplay(''); setNewDescription(''); setNewTarget([]); setNewCumulativeAttrs([]); setNewSkipAttrs([]) }} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #dce8f0', background: '#f8fbfd', color: '#3d5a70', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleAdd} disabled={!canAdd} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: canAdd ? '#2563eb' : '#93c5fd', color: '#fff', fontSize: 12, fontWeight: 600, cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Add Model</button>
            </div>
          </div>
        </Modal>
      )}

      {editEntry && (
        <Modal isOpen={!!editEntry} title="Edit Model" onClose={() => setEditEntry(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            <div><label style={fieldLabel}>Model ID <span style={{ color: '#9ca3af', fontWeight: 400 }}>(read-only)</span></label><input type="text" value={editEntry.model_id} disabled style={{ ...fieldStyle, background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }} /></div>
            <div>
              <label style={fieldLabel}>Model Name <span style={{ color: '#ef4444' }}>*</span><span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 10 }}>^[A-Za-z0-9_]+, max 50 chars, unique</span></label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. PDI, Outage, Spall" maxLength={50} style={{ ...fieldStyle, borderColor: editName.trim() && editAliasError ? '#ef4444' : '#dce8f0' }} onKeyDown={e => e.key === 'Enter' && handleEdit()} />
              {editName.trim() && editAliasError && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 3, display: 'block' }}>{editAliasError}</span>}
            </div>
            <div><label style={fieldLabel}>Display Name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><input type="text" value={editDisplay} onChange={e => setEditDisplay(e.target.value)} placeholder="e.g. Predictive Decoking Index" style={fieldStyle} /></div>
            <div>
              <label style={fieldLabel}>Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional, max 100 chars)</span></label>
              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Brief description of what this model does" rows={2} maxLength={100} style={{ ...fieldStyle, resize: 'vertical' }} />
              <span style={{ fontSize: 10, color: editDescription.length >= 90 ? '#ef4444' : '#9ca3af', display: 'block', textAlign: 'right', marginTop: 2 }}>{editDescription.length}/100</span>
            </div>
            <div><label style={fieldLabel}>Model Level <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><select value={editLevel} onChange={e => setEditLevel(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}><option value="">— No level (use model name only) —</option>{LEVELS_EXCLUD_SYSTEM.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label style={fieldLabel}>Attributes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — PI &amp; Inferred only)</span></label><AttrDropdown modelId={editEntry.model_id} selected={editAttributes} onChange={setEditAttributes} validLevels={getValidLevels(editLevel)} tagMappings={tagMappings} /></div>
            <div><label style={fieldLabel}>Target Variable (Y) <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={editEntry.model_id} selected={editTarget} onChange={setEditTarget} validLevels={getValidLevels(editLevel)} tagMappings={tagMappings} /></div>
            <div><label style={fieldLabel}>Cumulative Attribute <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={editEntry.model_id} selected={editCumulativeAttrs} onChange={setEditCumulativeAttrs} validLevels={getValidLevels(editLevel)} tagMappings={tagMappings} /></div>
            <div><label style={fieldLabel}>Skip Attribute <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><AttrDropdown modelId={editEntry.model_id} selected={editSkipAttrs} onChange={setEditSkipAttrs} validLevels={getValidLevels(editLevel)} tagMappings={tagMappings} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setEditEntry(null)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #dce8f0', background: '#f8fbfd', color: '#3d5a70', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleEdit} disabled={!!editAliasError} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: !editAliasError ? '#2563eb' : '#93c5fd', color: '#fff', fontSize: 12, fontWeight: 600, cursor: !editAliasError ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDeleteId && (
        <Modal isOpen={!!confirmDeleteId} title="Delete Model?" onClose={() => setConfirmDeleteId(null)}>
          <p style={{ fontSize: 12, color: '#5a7a8f', margin: '0 0 16px' }}>This will remove the model and all its sub-model rows. This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #dce8f0', background: '#f8fbfd', color: '#3d5a70', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null) }} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
