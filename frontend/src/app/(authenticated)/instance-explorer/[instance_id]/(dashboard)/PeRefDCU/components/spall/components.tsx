'use client'

import React from 'react'

export function NumInput({ label, value, onChange, min = 1, max = 99 }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = Math.max(min, Math.min(max, Number(e.target.value) || min))
          onChange(v)
        }}
        min={min}
        max={max}
        className="w-[120px] px-[10px] py-2 text-[12px] border border-border rounded bg-background text-text-primary font-[inherit] box-border"
      />
    </div>
  )
}

export function HeaterTabs({ numHeaters, activeTab, onSwitch, mirrorMap, onMirrorChange, onCopyFrom }: {
  numHeaters: number
  activeTab: number
  onSwitch: (h: number) => void
  mirrorMap: Record<number, number>
  onMirrorChange: (h: number, src: number) => void
  onCopyFrom: (target: number, source: number) => void
}) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap items-center">
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: numHeaters }, (_, i) => i + 1).map(h => (
          <button
            key={h}
            onClick={() => onSwitch(h)}
            className={[
              'px-3 py-2 text-[11px] font-semibold rounded-md border border-border font-[inherit] cursor-pointer transition-colors',
              activeTab === h
                ? 'bg-accent-blue text-white border-accent-blue'
                : 'bg-surface text-text-primary hover:bg-surface-hover',
            ].join(' ')}
          >
            H{h}
          </button>
        ))}
      </div>

      {numHeaters > 1 && activeTab > 0 && (
        <div className="flex gap-1.5 items-center ml-3">
          <label className="text-[10px] font-semibold text-text-secondary">Mirror from:</label>
          <select
            value={mirrorMap[activeTab] || ''}
            onChange={e => {
              const src = Number(e.target.value)
              if (src) onMirrorChange(activeTab, src)
            }}
            className="px-2 py-1.5 text-[11px] border border-border rounded bg-surface text-text-primary cursor-pointer"
          >
            <option value="">—</option>
            {Array.from({ length: numHeaters }, (_, i) => i + 1)
              .filter(h => h !== activeTab)
              .map(h => (
                <option key={h} value={h}>
                  H{h}
                </option>
              ))}
          </select>

          <button
            onClick={() => {
              const src = mirrorMap[activeTab]
              if (src) onCopyFrom(activeTab, src)
            }}
            disabled={!mirrorMap[activeTab]}
            className={[
              'px-2.5 py-1.5 text-[10px] font-semibold rounded border border-border font-[inherit] transition-colors',
              mirrorMap[activeTab]
                ? 'bg-surface text-accent-blue cursor-pointer hover:bg-surface-hover'
                : 'bg-surface text-text-secondary cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            Copy Config
          </button>
        </div>
      )}
    </div>
  )
}
