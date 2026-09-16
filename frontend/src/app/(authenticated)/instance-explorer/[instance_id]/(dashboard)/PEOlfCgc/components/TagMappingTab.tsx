'use client';

/**
 * TagMappingTab.tsx — single, centralized place to map every raw input
 * (PI tag / constant / unavailable) exactly once.
 *
 * This table and config.raw_pi_tags are the single source of truth: a tag
 * mapped here is automatically used everywhere that tag appears — in every
 * KPI formula that references it (KPI Calculations tab) and in the
 * generated EFF workbook. There is nothing to re-enter per KPI.
 */

import React, { useMemo, useState } from 'react';
import type { CgcConfig } from '../types/config';
import { tagIsMapped } from '../utils/tagMapping';

type Filter = 'unmapped' | 'kpi' | 'all';

interface Props {
  config: CgcConfig;
  onUpdateRawTag: (idx: number, field: string, value: unknown) => void;
}

export default function TagMappingTab({ config, onUpdateRawTag }: Props) {
  const [filter, setFilter] = useState<Filter>('unmapped');
  const [q, setQ] = useState('');

  const stats = useMemo(() => {
    const required = config.raw_pi_tags.filter(t => t.is_kpi_input);
    const mapped = required.filter(tagIsMapped);
    return { required: required.length, mapped: mapped.length, unmapped: required.length - mapped.length };
  }, [config.raw_pi_tags]);

  const tags = useMemo(() => {
    let list = config.raw_pi_tags;
    if (filter === 'kpi') list = list.filter(t => t.is_kpi_input);
    if (filter === 'unmapped') list = list.filter(t => t.is_kpi_input && !tagIsMapped(t));
    const ql = q.toLowerCase();
    if (ql) list = list.filter(t => t.name.toLowerCase().includes(ql));
    return list;
  }, [config.raw_pi_tags, filter, q]);

  const inputCls = 'w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50';

  return (
    <div className="space-y-4">
      {/* Explanation banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-primary">
        <p className="font-semibold">Map each tag once — it's reused everywhere automatically.</p>
        <p className="mt-1 text-xs text-text-secondary">
          Set a Source (PI Tag address, a fixed Constant value, or Unavailable) for each attribute below.
          Every KPI formula that needs this attribute — anywhere in KPI Calculations — reads the same mapping,
          and it flows straight into the generated EFF file. You never need to map the same tag twice.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span>{stats.mapped} / {stats.required} required tags mapped</span>
            <span>{stats.unmapped > 0 ? `${stats.unmapped} remaining` : 'All mapped ✓'}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={['h-full transition-all', stats.unmapped === 0 ? 'bg-success' : 'bg-primary'].join(' ')}
              style={{ width: `${stats.required ? (stats.mapped / stats.required) * 100 : 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['unmapped', `Unmapped (${stats.unmapped})`],
          ['kpi', `KPI Inputs (${config.raw_pi_tags.filter(t => t.is_kpi_input).length})`],
          ['all', `All Tags (${config.raw_pi_tags.length})`],
        ] as [Filter, string][]).map(([f, lbl]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === f
                ? 'border-text-primary bg-text-primary text-surface'
                : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
            ].join(' ')}
          >
            {lbl}
          </button>
        ))}
        <input
          className="ml-auto max-w-xs flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Search tag name…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* Table */}
      {config.raw_pi_tags.length === 0 ? (
        <div className="rounded-xl border border-border py-10 text-center text-sm text-text-secondary">
          No tags configured yet. They are auto-generated as you select KPIs and configure stages.
        </div>
      ) : tags.length === 0 ? (
        <div className="rounded-xl border border-border py-10 text-center text-sm text-text-secondary">
          {filter === 'unmapped' ? 'Nothing left to map — every required tag has a source.' : 'No tags match your search.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-background">
                <tr>
                  {['', 'Tag Name', 'Source', 'PI Tag / Value', 'UOM', 'Design Value', 'Min', 'Max'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tags.map(tag => {
                  const realIdx = config.raw_pi_tags.indexOf(tag);
                  const mapped = tagIsMapped(tag);
                  return (
                    <tr key={tag.name} className="hover:bg-surface-hover">
                      <td className="px-3 py-2">
                        <span className={mapped ? 'text-success' : 'text-text-tertiary'} title={mapped ? 'Mapped' : 'Not mapped'}>
                          {mapped ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-text-primary">{tag.name}</td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                          value={tag.source_type}
                          onChange={e => onUpdateRawTag(realIdx, 'source_type', e.target.value)}
                        >
                          <option value="pi_tag">PI Tag</option>
                          <option value="constant">Constant</option>
                          <option value="inferred">Inferred</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {tag.source_type === 'constant' ? (
                          <input
                            type="number" step="any"
                            className={inputCls}
                            value={tag.design_value ?? ''}
                            placeholder="Constant value"
                            onChange={e => onUpdateRawTag(realIdx, 'design_value', e.target.value === '' ? null : parseFloat(e.target.value))}
                          />
                        ) : (
                          <input
                            className={inputCls}
                            value={tag.pi_tag || ''}
                            placeholder={tag.source_type === 'unavailable' ? '—' : 'e.g. SQ.OLF.1PT8401.PV'}
                            disabled={tag.source_type === 'unavailable'}
                            onChange={e => onUpdateRawTag(realIdx, 'pi_tag', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputCls}
                          value={tag.uom || ''}
                          onChange={e => onUpdateRawTag(realIdx, 'uom', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" step="any"
                          className={inputCls}
                          value={tag.design_value ?? ''}
                          onChange={e => onUpdateRawTag(realIdx, 'design_value', e.target.value === '' ? null : parseFloat(e.target.value))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" step="any"
                          className={inputCls}
                          value={tag.min_val ?? ''}
                          onChange={e => onUpdateRawTag(realIdx, 'min_val', e.target.value === '' ? null : parseFloat(e.target.value))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" step="any"
                          className={inputCls}
                          value={tag.max_val ?? ''}
                          onChange={e => onUpdateRawTag(realIdx, 'max_val', e.target.value === '' ? null : parseFloat(e.target.value))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
