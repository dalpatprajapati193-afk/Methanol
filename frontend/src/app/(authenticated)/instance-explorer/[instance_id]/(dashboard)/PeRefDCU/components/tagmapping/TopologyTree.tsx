'use client'

import { useState } from 'react'
import { useAtomValue } from 'jotai'
import type { TopologyNode } from '../../types'
import { modelsAtom } from '../../store/dcuAtoms'

interface Props {
  nodes: TopologyNode[]
  selectedId: string | null
  onSelect: (node: TopologyNode) => void
  getTagCount: (nodeId: string, level: string) => number
  getRequiredCount: (level: string) => number
  selectedModelIds?: number[]
}

const TYPE_LABELS: Record<string, string> = {
  system:              'System',
  furnace:             'Furnace',
  cell:                'Cell',
  pass:                'Pass',
  tube:                'Tube',
  drum_train:          'Drum Train',
  drum:                'Coke Drum',
  fractionator:        'Fractionator',
  column_overhead:     'Col. Overhead',
  column_reboiler:     'Col. Reboiler',
  spall_group:         'Spall Group',
}

// Type badge colors using Tailwind arbitrary values for dynamic per-type colors
const TYPE_BADGE_CLS: Record<string, string> = {
  system:          'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]',
  furnace:         'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]',
  cell:            'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
  pass:            'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]',
  tube:            'bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]',
  drum_train:      'bg-[#fff7ed] text-[#c2570a] border-[#fed7aa]',
  drum:            'bg-[#fffbeb] text-[#b45309] border-[#fde68a]',
  fractionator:    'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]',
  column_overhead: 'bg-[#ecfdf5] text-[#065f46] border-[#6ee7b7]',
  column_reboiler: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]',
  spall_group:     'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
}

function TreeNode({
  node, depth, selectedId, onSelect, getTagCount, getRequiredCount, selectedModelIds = [],
}: {
  node: TopologyNode
  depth: number
  selectedId: string | null
  onSelect: (n: TopologyNode) => void
  getTagCount: (id: string, level: string) => number
  getRequiredCount: (level: string) => number
  selectedModelIds?: number[]
}) {
  const [open, setOpen] = useState(depth < 3)
  const models = useAtomValue(modelsAtom)

  const hasFurnaceModel = selectedModelIds.some(id => {
    const model = models.find(m => m.model_id === id)
    return model?.group === 'furnace'
  })

  const filteredChildren = node.children.filter(child => {
    if (child.type === 'spall_group' && !hasFurnaceModel) return false
    if (child.type === 'tube' && child.hasTMT === false) return false
    return true
  })

  const hasChildren = filteredChildren.length > 0
  const isSelected = node.id === selectedId
  const tagCount = node.level ? getTagCount(node.id, node.level) : 0
  const required = node.level ? getRequiredCount(node.level) : 0
  const isContainer = !node.level

  const typeBadgeCls = TYPE_BADGE_CLS[node.type] ?? TYPE_BADGE_CLS.system
  const typeLabel = TYPE_LABELS[node.type] ?? node.type

  const pct = required > 0 ? Math.round((tagCount / required) * 100) : 0
  const badgeColorCls = pct >= 100
    ? 'text-accent-green bg-[#d1fae5]'
    : pct > 0
      ? 'text-accent-orange bg-[#fef3c7]'
      : 'text-text-secondary bg-[#f3f4f6]'
  const badgeLabel = `${tagCount}/${required}`

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors
          ${isContainer ? 'cursor-default' : 'cursor-pointer'}
          ${isSelected ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent hover:bg-background'}`}
        style={{ marginLeft: depth * 12 }}
        onClick={() => { if (!isContainer) onSelect(node) }}
      >
        {/* Chevron */}
        <div className="w-3.5 shrink-0 flex items-center justify-center">
          {hasChildren ? (
            <span
              onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
              className="flex cursor-pointer text-text-secondary"
            >
              <svg
                className="transition-transform duration-150"
                style={{ width: 10, height: 10, transform: open ? 'rotate(90deg)' : 'none' }}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          ) : null}
        </div>

        {/* Type badge */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 border whitespace-nowrap ${typeBadgeCls}`}>
          {typeLabel}
        </span>

        {/* Node name */}
        <span className={`text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap
          ${isSelected ? 'text-[#1d4ed8] font-bold' : isContainer ? 'text-text-secondary font-bold' : 'text-text-primary font-medium'}`}>
          {node.name}
        </span>

        {/* Completion badge */}
        {!isContainer && required > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeColorCls}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {open && hasChildren && filteredChildren.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          getTagCount={getTagCount}
          getRequiredCount={getRequiredCount}
          selectedModelIds={selectedModelIds}
        />
      ))}
    </div>
  )
}

export default function TopologyTree({ nodes, selectedId, onSelect, getTagCount, getRequiredCount, selectedModelIds = [] }: Props) {
  return (
    <div className="flex flex-col gap-px overflow-y-auto h-full">
      {nodes.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          getTagCount={getTagCount}
          getRequiredCount={getRequiredCount}
          selectedModelIds={selectedModelIds}
        />
      ))}
    </div>
  )
}
