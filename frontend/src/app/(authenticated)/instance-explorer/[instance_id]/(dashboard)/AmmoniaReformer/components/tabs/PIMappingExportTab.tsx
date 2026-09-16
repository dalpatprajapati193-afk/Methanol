"use client";

import { useEffect, useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  sensorsAtom,
  hierarchyAtom,
  loadSensorMappingAtom,
  updateSensorMappingAtom,
} from "../../store/Index";
import PIAttributeRow from "../shared/PIAttributeRow";
import type { SensorMappingRow, HierarchyNode, FlatNode } from "../../types/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

function isMapped(r: SensorMappingRow) {
  return !!(r.sensor_name || r.constant_value || r.formula);
}

function buildCodeMap(flatNodes: FlatNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const fn of flatNodes) { if (fn.id && fn.element_code) map.set(fn.id, fn.element_code); }
  return map;
}

function buildPathMap(flatNodes: FlatNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const fn of flatNodes) { if (fn.id) map.set(fn.id, fn.element_path ?? ""); }
  return map;
}

function buildRowMap(rows: SensorMappingRow[]): Map<string, SensorMappingRow[]> {
  const map = new Map<string, SensorMappingRow[]>();
  for (const r of rows ?? []) {
    if (r._is_calc_override) continue;
    const key = `${String(r.element_path ?? "")}|${String(r.element_code ?? "")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

const DEPTH_PALETTE = [
  { ring: "border-accent-blue",   header: "bg-surface-hover", title: "text-text-primary" },
  { ring: "border-accent-orange", header: "bg-surface-hover", title: "text-text-primary" },
  { ring: "border-accent-green",  header: "bg-surface-hover", title: "text-text-primary" },
  { ring: "border-accent-yellow", header: "bg-surface-hover", title: "text-text-primary" },
  { ring: "border-border",        header: "bg-background",     title: "text-text-secondary" },
];
function palette(depth: number) {
  return DEPTH_PALETTE[Math.min(depth, DEPTH_PALETTE.length - 1)];
}


function subtreeCoverage(node: HierarchyNode, codeMap: Map<string, string>, pathMap: Map<string, string>, rowMap: Map<string, SensorMappingRow[]>): { mapped: number; total: number } {
  const code = codeMap.get(node.id) ?? "";
  const path = pathMap.get(node.id) ?? "";
  const rows = rowMap.get(`${path}|${code}`) ?? [];
  let mapped = rows.filter(isMapped).length;
  let total = rows.length;
  for (const child of node.children ?? []) {
    const c = subtreeCoverage(child, codeMap, pathMap, rowMap);
    mapped += c.mapped; total += c.total;
  }
  return { mapped, total };
}

function PINodeBox({ node, depth, codeMap, pathMap, rowMap, onChange }: {
  node: HierarchyNode; depth: number;
  codeMap: Map<string, string>; pathMap: Map<string, string>;
  rowMap: Map<string, SensorMappingRow[]>;
  onChange: (r: SensorMappingRow) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const elementCode = codeMap.get(node.id) ?? "";
  const elementPath = pathMap.get(node.id) ?? "";
  const rows = rowMap.get(`${elementPath}|${elementCode}`) ?? [];
  const { mapped: mappedCount, total: totalCount } = subtreeCoverage(node, codeMap, pathMap, rowMap);
  const allMapped = totalCount > 0 && mappedCount === totalCount;
  const progress = totalCount > 0 ? (mappedCount / totalCount) * 100 : 0;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const p = palette(depth);

  if (depth === 0 && node.level === "System") {
    return (
      <div className="flex flex-col gap-3">
        {(node.children ?? []).map((child) => (
          <PINodeBox key={child.id} node={child} depth={depth + 1} codeMap={codeMap} pathMap={pathMap} rowMap={rowMap} onChange={onChange} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("border-2 rounded-xl overflow-hidden shadow-sm", p.ring)}>
      <button
        className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:brightness-95 transition-all text-left", p.header)}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs text-text-secondary w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
        <span className={cn("text-sm font-semibold flex-1 min-w-0 truncate", p.title)}>{node.name}</span>
        <span className="text-xs text-text-secondary border border-border bg-surface px-1.5 py-0.5 rounded shrink-0">{node.level}</span>
        {totalCount > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs font-medium", allMapped ? "text-accent-green" : mappedCount > 0 ? "text-accent-yellow" : "text-text-secondary")}>
              {mappedCount}/{totalCount}
            </span>
            <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", allMapped ? "bg-accent-green" : "bg-accent-yellow")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="bg-surface">
          {rows.map((row, i) => (
            <PIAttributeRow key={`${row.attribute}-${i}`} row={row} onChange={onChange} />
          ))}
          {hasChildren && (
            <div className={cn("p-3 flex flex-col gap-2.5", rows.length > 0 ? "border-t border-border" : "")}>
              {children.map((child) => (
                <PINodeBox key={child.id} node={child} depth={depth + 1} codeMap={codeMap} pathMap={pathMap} rowMap={rowMap} onChange={onChange} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PIMappingExportTab() {
  const [loading, setLoading] = useState(false);

  const sensors = useAtomValue(sensorsAtom);
  const hierarchy = useAtomValue(hierarchyAtom);
  const loadSensorMapping = useSetAtom(loadSensorMappingAtom);
  const updateSensorMapping = useSetAtom(updateSensorMappingAtom);

  useEffect(() => {
    if (hierarchy.root && sensors.mappingRows.length === 0) {
      setLoading(true);
      loadSensorMapping().finally(() => setLoading(false));
    }
  }, [hierarchy.root]); // eslint-disable-line react-hooks/exhaustive-deps

  const codeMap = buildCodeMap(hierarchy.flatNodes);
  const pathMap = buildPathMap(hierarchy.flatNodes);
  const rowMap = buildRowMap(sensors.mappingRows);
  const { total = 0, mapped = 0 } = sensors.coverage ?? {};
  const progress = total > 0 ? Math.round((mapped / total) * 100) : 0;

  const handleRowChange = useCallback((updatedRow: SensorMappingRow) => {
    const newRows = sensors.mappingRows.map((r) =>
      r.element_path === updatedRow.element_path && r.element_code === updatedRow.element_code && r.attribute === updatedRow.attribute
        ? updatedRow : r
    );
    updateSensorMapping(newRows);
  }, [sensors.mappingRows, updateSensorMapping]);

  if (!hierarchy.root) {
    return <div className="py-16 text-center text-text-secondary">Build the hierarchy first (System Config tab) to configure PI mapping.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover" disabled={loading} onClick={() => { setLoading(true); loadSensorMapping().finally(() => setLoading(false)); }}>Refresh</button>

        <div className="flex items-center gap-2 ml-auto">
          <span className={cn("text-xs font-medium", progress === 100 ? "text-accent-green" : "text-text-secondary")}>
            {mapped}/{total} mapped ({progress}%)
          </span>
          <div className="w-32 h-1.5 bg-surface-hover rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-accent-green" : "bg-accent-yellow")} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-text-secondary">Loading sensor template…</div>
      ) : (
        <PINodeBox node={hierarchy.root} depth={0} codeMap={codeMap} pathMap={pathMap} rowMap={rowMap} onChange={handleRowChange} />
      )}

    </div>
  );
}
