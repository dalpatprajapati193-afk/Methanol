'use client'

import { useState, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import {
  tagMappingsAtom,
  tagEntriesAtom,
  equipmentAtom,
  spallConfigAtom,
  selectedModelIdsAtom,
  modelsAtom,
  uomIndexAtom,
  multipliedAttributesAtom,
  topologyTreeAtom,
  getTagEntry,
} from '../../store/dcuAtoms'
import { isAttributeMappingVisible } from '../../utils/attributeVisibility'
import { expandMultipliedMapping, getBaseAttribute } from '../../utils/attributeMultiplier'
import { getUomsByCategory } from '../../utils/uomUtils'
import TopologyTree from '../tagmapping/TopologyTree'
import AttributeForm from '../tagmapping/AttributeForm'
import BulkEditTable from '../tagmapping/BulkEditTable'
import { ValueMapPanel } from '../tagmapping/ValueMapPanel'
import UomSetPanel from '../tagmapping/UomSetPanel'
import type { TopologyNode } from '../../types'

interface Props { onNext: () => void; onBack: () => void }

export default function Step4TagMapping({ onNext, onBack }: Props) {
  const equipment = useAtomValue(equipmentAtom)
  const selectedModelIds = useAtomValue(selectedModelIdsAtom)
  const tagEntries = useAtomValue(tagEntriesAtom)
  const tagMappings = useAtomValue(tagMappingsAtom)
  const multipliedAttributes = useAtomValue(multipliedAttributesAtom)
  const uomIndex = useAtomValue(uomIndexAtom)

  const getTagEntryFn = (nodeId: string, attribute: string) => getTagEntry(tagEntries, nodeId, attribute)

  const multipliedAttrsMap = useMemo(() => {
    const map: Record<string, { countAttr: string; nodeId?: string }> = {}
    for (const e of multipliedAttributes) {
      if (e.model_ids.some(id => selectedModelIds.includes(id)))
        map[e.attribute] = { countAttr: e.countAttr, nodeId: e.nodeId }
    }
    return map
  }, [multipliedAttributes, selectedModelIds])

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [valueMapOpen, setValueMapOpen] = useState(false)
  const [uomSetOpen, setUomSetOpen] = useState(false)

  const tree = useAtomValue(topologyTreeAtom)

  const levelAttrsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const mapping of tagMappings) {
      if (!mapping.model_ids.some(id => selectedModelIds.includes(id))) continue
      if (!isAttributeMappingVisible(mapping, getTagEntryFn)) continue
      const expanded = expandMultipliedMapping(mapping, getTagEntryFn, multipliedAttributes)
      for (const m of expanded) {
        if (!map[m.level]) map[m.level] = []
        if (!map[m.level].includes(m.attribute)) map[m.level].push(m.attribute)
      }
    }
    return map
  }, [selectedModelIds, tagMappings, tagEntries, getTagEntryFn, multipliedAttrsMap])

  const levelRequiredAttrsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const mapping of tagMappings) {
      if (mapping.type === 'Inferred') continue
      if (!mapping.model_ids.some(id => selectedModelIds.includes(id))) continue
      if (!isAttributeMappingVisible(mapping, getTagEntryFn)) continue
      const expanded = expandMultipliedMapping(mapping, getTagEntryFn, multipliedAttributes)
      for (const m of expanded) {
        if (!map[m.level]) map[m.level] = []
        if (!map[m.level].includes(m.attribute)) map[m.level].push(m.attribute)
      }
    }
    return map
  }, [selectedModelIds, tagMappings, tagEntries, getTagEntryFn, multipliedAttrsMap])

  const getAttributesForNode = (node: TopologyNode): string[] => levelAttrsMap[node.level] || []

  const getTagCount = (nodeId: string, level: string): number => {
    const entries = tagEntries[nodeId]
    if (!entries) return 0
    return Object.entries(entries).filter(([attribute, e]) => {
      const baseAttr = getBaseAttribute(attribute)
      const mapping = tagMappings.find(m => m.attribute === baseAttr && m.level === level)
      if (!mapping || mapping.type === 'Inferred') return false
      const catUoms = mapping.uom_category ? getUomsByCategory(uomIndex, mapping.uom_category).map(u => u.symbol) : []
      const isValidUom = (uom: string | undefined) => !!uom && (catUoms.length === 0 || catUoms.includes(uom))
      const hasValidAttrUom = isValidUom(e.attribute_uom)
      if (e.tag_type === 'pi') return e.pi_sensors.some(s => !!s.sensor_name && isValidUom(s.sensor_uom)) && hasValidAttrUom
      if (e.tag_type === 'constant') return !!e.constant_value && hasValidAttrUom
      return false
    }).length
  }

  const getRequiredCount = (level: string): number => levelRequiredAttrsMap[level]?.length || 0

  const selectedAttrs = selectedNode ? getAttributesForNode(selectedNode) : []

  const typeTotals = useMemo(() => {
    const levelTypeMap: Record<string, Record<string, string[]>> = {}
    for (const mapping of tagMappings) {
      if (!mapping.model_ids.some(id => selectedModelIds.includes(id))) continue
      if (!isAttributeMappingVisible(mapping, getTagEntryFn)) continue
      const expanded = expandMultipliedMapping(mapping, getTagEntryFn, multipliedAttributes)
      for (const m of expanded) {
        if (!levelTypeMap[m.level]) levelTypeMap[m.level] = {}
        const t = m.type ?? 'PI'
        if (!levelTypeMap[m.level][t]) levelTypeMap[m.level][t] = []
        if (!levelTypeMap[m.level][t].includes(m.attribute)) levelTypeMap[m.level][t].push(m.attribute)
      }
    }
    const counts = { PI: 0, Inferred: 0, Constant: 0 }
    const visit = (node: TopologyNode) => {
      if (node.type === 'tube' && node.hasTMT === false) return
      if (node.level) {
        const tm = levelTypeMap[node.level] || {}
        counts.PI += (tm['PI'] || []).length
        counts.Inferred += (tm['Inferred'] || []).length
        counts.Constant += (tm['Constant'] || []).length
      }
      node.children.filter(c => !(c.type === 'tube' && c.hasTMT === false)).forEach(visit)
    }
    tree.forEach(visit)
    return counts
  }, [tree, tagMappings, tagEntries, selectedModelIds, getTagEntryFn, multipliedAttrsMap])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c3045', margin: 0 }}>Tag Mapping</h2>
              {[
                { label: 'PI', count: typeTotals.PI, bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
                { label: 'Inferred', count: typeTotals.Inferred, bg: '#f3e8ff', text: '#6b21a8', dot: '#a855f7' },
                { label: 'Constant', count: typeTotals.Constant, bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
              ].map(({ label, count, bg, text, dot }) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: bg, color: text }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot, display: 'inline-block' }} />
                  {label}: {count}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#7a95a8', marginTop: 4 }}>Select a node from the topology tree, then configure its sensor/formula tags.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={() => setUomSetOpen(true)}>UOM Set</button>
            <button className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={() => setBulkEditOpen(true)}>Bulk Edit</button>
            <button className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={() => setValueMapOpen(true)}>Value Map</button>
          </div>
        </div>
      </div>

      {uomSetOpen && <UomSetPanel onClose={() => setUomSetOpen(false)} />}
      {bulkEditOpen && (
        <BulkEditTable nodes={tree} tagMappings={tagMappings} levelAttrsMap={levelAttrsMap} onClose={() => setBulkEditOpen(false)} />
      )}
      {valueMapOpen && <ValueMapPanel onClose={() => setValueMapOpen(false)} />}

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #dce8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7a95a8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assets</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 6px' }}>
            <TopologyTree
              nodes={tree}
              selectedId={selectedNode?.id || null}
              onSelect={setSelectedNode}
              getTagCount={getTagCount}
              getRequiredCount={getRequiredCount}
              selectedModelIds={selectedModelIds}
            />
          </div>
        </div>

        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedNode ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AttributeForm node={selectedNode} attributes={selectedAttrs} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8ba3b5', gap: 10, padding: 40 }}>
              <svg style={{ width: 60, height: 60, opacity: 0.15 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10M4 18h6" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#7a95a8', margin: 0 }}>Select a node from the topology tree</p>
              <p style={{ fontSize: 12, color: '#8ba3b5', textAlign: 'center', maxWidth: 280, margin: 0 }}>Click any node in the left panel to view and configure its tag attributes for the selected models.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border pt-3">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>
          ← Back
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={onNext}>
          Next: Parameters →
        </button>
      </div>
    </div>
  )
}
