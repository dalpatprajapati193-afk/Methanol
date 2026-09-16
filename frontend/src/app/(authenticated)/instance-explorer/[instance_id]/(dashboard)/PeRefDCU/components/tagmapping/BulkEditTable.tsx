'use client'

import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  tagMappingsAtom,
  tagEntriesAtom,
  setTagEntryAtom,
  getTagEntry,
  DEFAULT_TAG_ENTRY,
  uomIndexAtom,
} from '../../store/dcuAtoms'
import type { TopologyNode, ModelTagMapping, TagEntry } from '../../types'
import { getBaseAttribute } from '../../utils/attributeMultiplier'

interface Props {
  nodes: TopologyNode[]
  tagMappings: ModelTagMapping[]
  levelAttrsMap: Record<string, string[]>
  onClose: () => void
}

interface FlatRow {
  nodeId: string
  nodePath: string
  nodeLevel: string
  attribute: string
  blueprintDefaultUom: string
  uomCategory: string
  blueprintType: string
}

function flattenNodes(nodes: TopologyNode[]): TopologyNode[] {
  const result: TopologyNode[] = []
  const visit = (n: TopologyNode) => {
    if (n.type === 'tube' && n.hasTMT === false) return
    if (n.level) result.push(n)
    n.children.filter(c => !(c.type === 'tube' && c.hasTMT === false)).forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

const selCls = 'border border-border rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface w-full'
const inputCls = 'border border-border rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue bg-surface w-full'
const numCls = inputCls + ' [appearance:textfield]'

const AGGREGATION_OPTIONS = ['add', 'avg', 'min', 'max', 'difference']

export default function BulkEditTable({ nodes, tagMappings, levelAttrsMap, onClose }: Props) {
  const tagEntriesState = useAtomValue(tagEntriesAtom)
  const setTagEntry = useSetAtom(setTagEntryAtom)
  const uomIndex = useAtomValue(uomIndexAtom)

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'warn'; message: string }>({ type: 'idle', message: '' })
  const importRef = useRef<HTMLInputElement>(null)

  const allFlatNodes = useMemo(() => flattenNodes(nodes), [nodes])

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = []
    for (const node of allFlatNodes) {
      const attrs = levelAttrsMap[node.level] ?? []
      for (const attr of attrs) {
        const baseAttr = getBaseAttribute(attr)
        const mapping = tagMappings.find(m => m.level === node.level && m.attribute === baseAttr)
        rows.push({
          nodeId: node.id,
          nodePath: node.path,
          nodeLevel: node.level,
          attribute: attr,
          blueprintDefaultUom: mapping?.default_uom || '',
          uomCategory: mapping?.uom_category || '',
          blueprintType: mapping?.type || '',
        })
      }
    }
    return rows
  }, [allFlatNodes, levelAttrsMap, tagMappings])

  const uniqueLevels = useMemo(() => [...new Set(flatRows.map(r => r.nodeLevel))].sort(), [flatRows])

  const visibleRows = useMemo(() => {
    const q = search.toLowerCase()
    return flatRows.filter(r => {
      if (r.blueprintType === 'Inferred') return false
      if (levelFilter && r.nodeLevel !== levelFilter) return false
      if (!q) return true
      return r.nodePath.toLowerCase().includes(q) || r.attribute.toLowerCase().includes(q)
    })
  }, [flatRows, search, levelFilter, tagEntriesState])

  const uomOptionsFor = (category: string): { symbol: string; name: string }[] => {
    if (!category) return []
    return uomIndex.byCategory[category] ?? []
  }

  const getEntry = (nodeId: string, attr: string): TagEntry =>
    getTagEntry(tagEntriesState, nodeId, attr)

  const updateEntry = (nodeId: string, attr: string, patch: Partial<TagEntry>) => {
    const cur = getEntry(nodeId, attr)
    setTagEntry(nodeId, attr, { ...cur, ...patch })
  }

  const updateSensor = (nodeId: string, attr: string, sensorIdx: number, field: 'sensor_name' | 'sensor_uom', value: string) => {
    const cur = getEntry(nodeId, attr)
    const sensors = cur.pi_sensors.length > 0 ? [...cur.pi_sensors] : [{ sensor_code: 'sensor-1', sensor_name: '', sensor_uom: '' }]
    while (sensors.length <= sensorIdx) {
      sensors.push({ sensor_code: `sensor-${sensors.length + 1}`, sensor_name: '', sensor_uom: '' })
    }
    sensors[sensorIdx] = { ...sensors[sensorIdx], [field]: value }
    setTagEntry(nodeId, attr, { ...cur, pi_sensors: sensors })
  }

  // Excel download
  const handleDownload = () => {
    const dataRows = flatRows.map(r => {
      const e = getEntry(r.nodeId, r.attribute)
      const s1 = e.pi_sensors[0] ?? { sensor_name: '', sensor_uom: '' }
      const s2 = e.pi_sensors[1] ?? { sensor_name: '', sensor_uom: '' }
      const s3 = e.pi_sensors[2] ?? { sensor_name: '', sensor_uom: '' }
      return {
        node_path: r.nodePath,
        attribute: r.attribute,
        node_level: r.nodeLevel,
        uom_category: r.uomCategory,
        type: r.blueprintType,
        tag_type: e.tag_type,
        sensor1_name: s1.sensor_name,
        sensor1_uom: s1.sensor_uom || r.blueprintDefaultUom,
        sensor2_name: s2.sensor_name,
        sensor2_uom: s2.sensor_uom || (s2.sensor_name ? r.blueprintDefaultUom : ''),
        sensor3_name: s3.sensor_name,
        sensor3_uom: s3.sensor_uom || (s3.sensor_name ? r.blueprintDefaultUom : ''),
        aggregation: e.aggregation,
        attribute_uom: e.attribute_uom || r.blueprintDefaultUom,
        sip_min: e.sip_min,
        sip_max: e.sip_max,
        sip_default: e.sip_default_value,
        sip_policy: e.sip_policy,
      }
    })

    const uomRefRows = uomIndex.categories.flatMap(cat =>
      (uomIndex.byCategory[cat] ?? []).map(u => ({
        category: cat,
        symbol: u.symbol,
        name: u.name,
      }))
    )

    const aggregationRefRows = [
      { value: 'add', label: 'Add (sum)', description: 'Sum of all sensors' },
      { value: 'avg', label: 'Avg (average)', description: 'Average of all sensors' },
      { value: 'min', label: 'Min', description: 'Minimum value across sensors' },
      { value: 'max', label: 'Max', description: 'Maximum value across sensors' },
      { value: 'difference', label: 'Difference (2 sensors only)', description: 'Absolute difference between 2 sensors' },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'tag_mapping')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(uomRefRows), 'uom_reference')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aggregationRefRows), 'aggregation_reference')
    XLSX.writeFile(wb, 'tag_mapping_template.xlsx')
  }

  // Excel import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const rowLookup: Record<string, FlatRow> = {}
    flatRows.forEach(r => { rowLookup[`${r.nodePath}|${r.attribute}`] = r })

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets['tag_mapping']
        if (!ws) {
          setImportStatus({ type: 'error', message: 'Sheet "tag_mapping" not found in uploaded file.' })
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)

        let applied = 0
        const warnings: string[] = []

        for (const row of rows) {
          const key = `${row.node_path}|${row.attribute}`
          const meta = rowLookup[key]
          if (!meta) {
            warnings.push(`Unknown node/attribute: ${key}`)
            continue
          }

          const validateUom = (sym: string, field: string, rowLabel: string) => {
            if (!sym) return sym
            const found = uomIndex.bySymbol[sym] || Object.values(uomIndex.bySymbol).find(u => u.symbol.toLowerCase() === sym.toLowerCase())
            if (!found) warnings.push(`Row "${rowLabel}" — ${field} "${sym}" not in UOM bank, kept as-is`)
            return found ? found.symbol : sym
          }

          const rowLabel = `${row.node_path} / ${row.attribute}`

          const s1name = (row.sensor1_name || '').trim()
          const s1uom = validateUom((row.sensor1_uom || '').trim(), 'sensor1_uom', rowLabel)
          const s2name = (row.sensor2_name || '').trim()
          const s2uom = validateUom((row.sensor2_uom || '').trim(), 'sensor2_uom', rowLabel)
          const s3name = (row.sensor3_name || '').trim()
          const s3uom = validateUom((row.sensor3_uom || '').trim(), 'sensor3_uom', rowLabel)
          const attrUom = validateUom((row.attribute_uom || '').trim(), 'attribute_uom', rowLabel)

          const sensors = []
          if (s1name) sensors.push({ sensor_code: 'sensor-1', sensor_name: s1name, sensor_uom: s1uom || meta.blueprintDefaultUom })
          if (s2name) sensors.push({ sensor_code: 'sensor-2', sensor_name: s2name, sensor_uom: s2uom || meta.blueprintDefaultUom })
          if (s3name) sensors.push({ sensor_code: 'sensor-3', sensor_name: s3name, sensor_uom: s3uom || meta.blueprintDefaultUom })
          if (sensors.length === 0) sensors.push({ sensor_code: 'sensor-1', sensor_name: '', sensor_uom: '' })

          const tagType = (['pi', 'formula', 'constant'].includes(row.tag_type)) ? row.tag_type as TagEntry['tag_type'] : 'pi'
          const aggregation = (['add', 'avg', 'min', 'max', 'difference'].includes(row.aggregation)) ? row.aggregation as TagEntry['aggregation'] : 'add'
          const sipPolicy = row.sip_policy === 'last_good_value' ? 'last_good_value' as const : '0' as const

          setTagEntry(meta.nodeId, meta.attribute, {
            ...DEFAULT_TAG_ENTRY,
            tag_type: tagType,
            pi_sensors: sensors,
            aggregation,
            sip_min: row.sip_min ?? '',
            sip_max: row.sip_max ?? '',
            sip_default_value: row.sip_default ?? '',
            sip_policy: sipPolicy,
            constant_value: row.constant_value ?? '',
            default_uom: meta.blueprintDefaultUom,
            attribute_uom: attrUom || meta.blueprintDefaultUom,
          })
          applied++
        }

        const msg = warnings.length > 0
          ? `${applied} rows imported. ${warnings.length} warning(s):\n${warnings.slice(0, 5).join('\n')}${warnings.length > 5 ? `\n...and ${warnings.length - 5} more` : ''}`
          : `${applied} rows imported successfully.`
        setImportStatus({ type: warnings.length > 0 ? 'warn' : 'success', message: msg })
      } catch {
        setImportStatus({ type: 'error', message: 'Failed to parse Excel file. Make sure it uses the downloaded template format.' })
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-end" style={{ background: 'rgba(15,30,45,0.55)' }}>
      <div className="w-[96vw] max-w-[1400px] bg-surface flex flex-col overflow-hidden" style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="bg-accent-blue px-5 py-3 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="bg-transparent border-none text-text-secondary cursor-pointer p-0 flex">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Bulk Edit — Tag Mapping</div>
            <div className="text-xs text-text-secondary mt-0.5">{visibleRows.length} of {flatRows.length} attributes shown</div>
          </div>

          {importStatus.type !== 'idle' && (
            <div className="text-xs px-2.5 py-1 rounded-md max-w-[340px] whitespace-pre-wrap leading-relaxed"
              style={{
                background: importStatus.type === 'error' ? '#ffeef0' : importStatus.type === 'warn' ? '#fffbea' : '#eafbf0',
                color: importStatus.type === 'error' ? '#a31520' : importStatus.type === 'warn' ? '#7a5c00' : '#157a3c',
                border: `1px solid ${importStatus.type === 'error' ? '#f5c6cb' : importStatus.type === 'warn' ? '#f5c200' : '#b2dfdb'}`,
              }}>
              {importStatus.message}
              <button onClick={() => setImportStatus({ type: 'idle', message: '' })} className="ml-2 bg-transparent border-none cursor-pointer text-text-secondary">×</button>
            </div>
          )}

          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-white text-xs font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-white text-xs font-semibold cursor-pointer border-none" style={{ background: '#1e3a5f' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload &amp; Apply
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 border-b border-border flex gap-3 items-center shrink-0 bg-background">
          <input
            type="text" placeholder="Search node path or attribute…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-[280px] border border-border rounded-md px-2.5 py-1 text-xs outline-none"
          />
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1 text-xs outline-none bg-surface">
            <option value="">All levels</option>
            {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="text-xs text-text-secondary ml-auto">
            Tip: Use <b>Download Template</b> to fill in Excel, then <b>Upload &amp; Apply</b> to import all at once.
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-accent-blue text-white">
                <th style={thStyle}>Node Path</th>
                <th style={thStyle}>Attribute</th>
                <th style={{ ...thStyle, width: 80 }}>Type</th>
                <th style={thStyle}>Constant Value</th>
                <th style={thStyle}>Sensor 1 Name</th>
                <th style={{ ...thStyle, width: 100 }}>S1 UOM</th>
                <th style={thStyle}>Sensor 2 Name</th>
                <th style={{ ...thStyle, width: 100 }}>S2 UOM</th>
                <th style={thStyle}>Sensor 3 Name</th>
                <th style={{ ...thStyle, width: 100 }}>S3 UOM</th>
                <th style={{ ...thStyle, width: 90 }}>Aggregation</th>
                <th style={{ ...thStyle, width: 100 }}>User UOM</th>
                <th style={{ ...thStyle, width: 72 }}>SIP Min</th>
                <th style={{ ...thStyle, width: 72 }}>SIP Max</th>
                <th style={{ ...thStyle, width: 72 }}>SIP Def</th>
                <th style={{ ...thStyle, width: 90 }}>SIP Policy</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-10 text-text-secondary text-xs">
                    No attributes match your filter.
                  </td>
                </tr>
              ) : visibleRows.map((row, idx) => {
                const entry = getEntry(row.nodeId, row.attribute)
                const s = (i: number) => entry.pi_sensors[i] ?? { sensor_name: '', sensor_uom: '' }
                const uomOpts = uomOptionsFor(row.uomCategory)
                const isOdd = idx % 2 === 0

                const blueprintType = row.blueprintType
                const effectiveType = entry.tag_type === 'constant' ? 'Constant'
                  : entry.tag_type === 'formula' ? 'Inferred'
                  : blueprintType || 'PI'

                const isConstantType = effectiveType === 'Constant'
                const isInferredType = effectiveType === 'Inferred'
                const isSensorFieldsDisabled = isConstantType || isInferredType
                const isAggregationDisabled = isConstantType || isInferredType

                return (
                  <tr key={`${row.nodeId}-${row.attribute}`}
                    style={{ background: isOdd ? '#fff' : '#f8fbfd', borderBottom: '1px solid #eef2f7' }}>

                    <td style={tdStyle}>
                      <span className="text-xs text-text-secondary font-mono">{row.nodePath}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs font-semibold text-accent-blue">{row.attribute}</span>
                    </td>

                    <td style={tdStyle}>
                      <select
                        value={effectiveType}
                        onChange={e => {
                          const val = e.target.value
                          updateEntry(row.nodeId, row.attribute, {
                            tag_type: val === 'Constant' ? 'constant' : val === 'Inferred' ? 'formula' : 'pi'
                          })
                        }}
                        className={selCls}
                        style={{ fontWeight: 600 }}
                      >
                        <option value="PI">PI</option>
                        <option value="Inferred">Inferred</option>
                        <option value="Constant">Constant</option>
                      </select>
                    </td>

                    <td style={tdStyle}>
                      {isConstantType ? (
                        <input className={inputCls} placeholder="e.g. 85" value={entry.constant_value}
                          onChange={e => updateEntry(row.nodeId, row.attribute, { constant_value: e.target.value })} />
                      ) : (
                        <span className="text-xs text-text-secondary">—</span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <input className={inputCls} placeholder="e.g. TI_30160" value={s(0).sensor_name}
                        onChange={e => updateSensor(row.nodeId, row.attribute, 0, 'sensor_name', e.target.value)}
                        disabled={isSensorFieldsDisabled} style={{ opacity: isSensorFieldsDisabled ? 0.5 : 1 }} />
                    </td>
                    <td style={tdStyle}>
                      <UomSelect value={s(0).sensor_uom} opts={uomOpts} blueprintDefault={row.blueprintDefaultUom}
                        onChange={v => updateSensor(row.nodeId, row.attribute, 0, 'sensor_uom', v)}
                        disabled={isSensorFieldsDisabled} />
                    </td>

                    <td style={tdStyle}>
                      <input className={inputCls} placeholder="optional" value={s(1).sensor_name}
                        onChange={e => updateSensor(row.nodeId, row.attribute, 1, 'sensor_name', e.target.value)}
                        disabled={isSensorFieldsDisabled} style={{ opacity: isSensorFieldsDisabled ? 0.5 : 1 }} />
                    </td>
                    <td style={tdStyle}>
                      <UomSelect value={s(1).sensor_uom} opts={uomOpts} blueprintDefault={row.blueprintDefaultUom}
                        onChange={v => updateSensor(row.nodeId, row.attribute, 1, 'sensor_uom', v)}
                        disabled={isSensorFieldsDisabled} />
                    </td>

                    <td style={tdStyle}>
                      <input className={inputCls} placeholder="optional" value={s(2).sensor_name}
                        onChange={e => updateSensor(row.nodeId, row.attribute, 2, 'sensor_name', e.target.value)}
                        disabled={isSensorFieldsDisabled} style={{ opacity: isSensorFieldsDisabled ? 0.5 : 1 }} />
                    </td>
                    <td style={tdStyle}>
                      <UomSelect value={s(2).sensor_uom} opts={uomOpts} blueprintDefault={row.blueprintDefaultUom}
                        onChange={v => updateSensor(row.nodeId, row.attribute, 2, 'sensor_uom', v)}
                        disabled={isSensorFieldsDisabled} />
                    </td>

                    <td style={tdStyle}>
                      <select value={entry.aggregation}
                        onChange={e => updateEntry(row.nodeId, row.attribute, { aggregation: e.target.value as TagEntry['aggregation'] })}
                        className={selCls}
                        disabled={isAggregationDisabled}
                        style={{ opacity: isAggregationDisabled ? 0.5 : 1 }}>
                        {AGGREGATION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>

                    <td style={tdStyle}>
                      <UomSelect value={entry.attribute_uom ?? ''} opts={uomOpts} blueprintDefault={row.blueprintDefaultUom}
                        onChange={v => updateEntry(row.nodeId, row.attribute, { attribute_uom: v })}
                        disabled={false} />
                    </td>

                    <td style={tdStyle}>
                      <input type="number" className={numCls} placeholder="0" value={entry.sip_min}
                        onChange={e => updateEntry(row.nodeId, row.attribute, { sip_min: e.target.value })} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" className={numCls} placeholder="0" value={entry.sip_max}
                        onChange={e => updateEntry(row.nodeId, row.attribute, { sip_max: e.target.value })} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" className={numCls} placeholder="0" value={entry.sip_default_value}
                        onChange={e => updateEntry(row.nodeId, row.attribute, { sip_default_value: e.target.value })} />
                    </td>
                    <td style={tdStyle}>
                      <select value={entry.sip_policy}
                        onChange={e => updateEntry(row.nodeId, row.attribute, { sip_policy: e.target.value as '0' | 'last_good_value' })}
                        className={selCls}>
                        <option value="0">0 (zero fill)</option>
                        <option value="last_good_value">last_good_value</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border flex justify-end shrink-0 bg-background">
          <button onClick={onClose} className="px-5 py-1.5 rounded-md bg-accent-blue text-white border-none text-sm font-semibold cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function UomSelect({ value, opts, blueprintDefault, onChange, disabled }: {
  value: string
  opts: { symbol: string; name: string }[]
  blueprintDefault: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <select value={value || blueprintDefault} onChange={e => onChange(e.target.value)} className={selCls}
      disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      {blueprintDefault && !opts.find(o => o.symbol === blueprintDefault) && (
        <option value={blueprintDefault}>{blueprintDefault}</option>
      )}
      {!value && blueprintDefault && (
        <option value={blueprintDefault}>— Default: {blueprintDefault} —</option>
      )}
      {opts.map(u => <option key={u.symbol} value={u.symbol}>{u.symbol} ({u.name})</option>)}
      {!opts.length && <option value="">— No UOM list —</option>}
    </select>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.1)',
}

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', verticalAlign: 'middle', borderRight: '1px solid #eef2f7',
}
