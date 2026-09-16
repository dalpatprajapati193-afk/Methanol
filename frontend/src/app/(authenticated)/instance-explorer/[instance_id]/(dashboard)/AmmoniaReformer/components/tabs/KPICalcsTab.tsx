"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  kpiAtom,
  hierarchyAtom,
  sensorsAtom,
  loadKpiPackagesAtom,
  loadCalcOptionalityAtom,
  loadCalcRequirementsAtom,
  loadSensorMappingAtom,
  updateSensorMappingAtom,
} from "../../store/Index";
import type { FlatNode, HierarchyNode, SensorMappingRow } from "../../types/Index";
import PIAttributeRow from "../shared/PIAttributeRow";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type Status = "ready" | "partial" | "insufficient" | "no_data";

type SensorPath = {
  attr: string;
  level: string | null;
  parent: string | null;
  parent_path?: string;
  path: string;
};

interface CalcAtNode {
  calcName: string;
  packageNames: string[];
  requiredAttrs: string[];
  optionalAttrs: string[];
  mappedRequired: number;
  requiredCount: number;
  status: Status;
  requiredLevels: string[];
  optionalLevels: string[];
}

function isMapped(r: SensorMappingRow): boolean {
  return !!(r.sensor_name || r.constant_value || r.formula || r._is_calc_override);
}

function StatusDot({ status }: { status: Status }) {
  if (status === "ready")        return <span className="text-[10px] font-bold leading-none shrink-0 text-accent-green">✓</span>;
  if (status === "insufficient") return <span className="text-[10px] font-bold leading-none shrink-0 text-accent-red">✗</span>;
  if (status === "partial")      return <span className="text-[10px] font-bold leading-none shrink-0 text-accent-yellow">–</span>;
  return                                <span className="text-[10px] font-bold leading-none shrink-0 text-text-secondary">–</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { cls: string; label: string }> = {
    ready: { cls: "bg-surface text-accent-green border-accent-green", label: "Ready" },
    partial: { cls: "bg-surface text-accent-yellow border-accent-yellow", label: "Partial" },
    insufficient: { cls: "bg-surface text-accent-red border-accent-red", label: "Insufficient" },
    no_data: { cls: "bg-background text-text-secondary border-border", label: "Optional" },
  };
  const { cls, label } = cfg[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cls)}>
      <StatusDot status={status} />
      {label}
    </span>
  );
}

function DependentKpisChip({ calcs }: { calcs: CalcAtNode[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const grouped = new Map<string, CalcAtNode[]>();
  for (const calc of calcs) {
    for (const pkg of calc.packageNames) {
      if (!grouped.has(pkg)) grouped.set(pkg, []);
      grouped.get(pkg)!.push(calc);
    }
  }
  const entries = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className={cn(
          "text-[10.5px] px-2 py-0.5 rounded-full border font-medium transition-colors whitespace-nowrap",
          calcs.length > 0
            ? "text-accent-blue border-border bg-surface hover:bg-surface-hover cursor-pointer"
            : "text-text-secondary border-border bg-surface opacity-50 cursor-default"
        )}
        disabled={calcs.length === 0}
        onClick={() => setOpen((o) => !o)}
        title={calcs.length > 0 ? "Show dependent KPIs" : "No KPI calcs depend on this attribute"}
      >
        {calcs.length} {calcs.length === 1 ? "KPI" : "KPIs"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-80 max-h-72 overflow-auto bg-surface border border-border rounded-lg shadow-lg p-2 flex flex-col gap-2">
          <span className="text-[10.5px] font-semibold text-text-secondary uppercase tracking-wide px-1">Dependent KPIs</span>
          {entries.map(([pkgName, pkgCalcs]) => (
            <div key={pkgName} className="flex flex-col">
              <span className="px-1 py-0.5 text-xs font-semibold text-text-primary">{pkgName}</span>
              {pkgCalcs.map((calc) => (
                <div key={calc.calcName} className="flex items-center gap-2 px-1 py-1 border-t border-border/60">
                  <StatusDot status={calc.status} />
                  <span className="font-mono text-xs text-text-primary truncate flex-1">{calc.calcName}</span>
                  <StatusBadge status={calc.status} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildCodeMap(flatNodes: FlatNode[]): Map<string, FlatNode> {
  const map = new Map<string, FlatNode>();
  for (const fn of flatNodes) { if (fn.id) map.set(fn.id, fn); }
  return map;
}

function buildRowsByCode(rows: SensorMappingRow[]): Map<string, SensorMappingRow[]> {
  const map = new Map<string, SensorMappingRow[]>();
  for (const r of rows) {
    if (r._is_calc_override) continue;
    const key = `${String(r.element_path ?? "")}|${String(r.element_code ?? "")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function subtreeCoverage(node: HierarchyNode, codeMap: Map<string, FlatNode>, rowsByCode: Map<string, SensorMappingRow[]>): { mapped: number; total: number } {
  const fn = codeMap.get(node.id);
  const elementPath = fn?.element_path || "";
  const elementCode = fn?.element_code || node.name;
  const rows = rowsByCode.get(`${elementPath}|${elementCode}`) ?? [];
  let mapped = rows.filter(isMapped).length;
  let total = rows.length;
  for (const child of node.children ?? []) {
    const c = subtreeCoverage(child, codeMap, rowsByCode);
    mapped += c.mapped; total += c.total;
  }
  return { mapped, total };
}

const DEPTH_ACCENTS = [
  "border-l-accent-blue",
  "border-l-accent-orange",
  "border-l-accent-green",
  "border-l-accent-yellow",
  "border-l-border",
];
function depthAccent(depth: number) {
  return DEPTH_ACCENTS[Math.min(Math.max(depth - 1, 0), DEPTH_ACCENTS.length - 1)];
}

function sensorPathMatchesInstance(s: SensorPath, instanceLevel: string, instanceLevelPath: string): boolean {
  const levelMatch = !s.level || (s.level ?? "").toLowerCase() === instanceLevel.toLowerCase();
  if (!levelMatch) return false;
  if (s.parent_path) return instanceLevelPath.toLowerCase().endsWith(s.parent_path.toLowerCase());
  const sParent = (s.parent ?? "").toLowerCase();
  return !s.parent || instanceLevelPath.toLowerCase().includes(sParent);
}

function nodeMeta(node: HierarchyNode, parentLevels: string[], codeMap: Map<string, FlatNode>) {
  const fn = codeMap.get(node.id);
  const derivedLevelPath = node.level === "System" ? "" : `${parentLevels.join("/")}/`;
  return {
    level: node.level,
    levelPath: fn?.level_path || derivedLevelPath,
    elementPath: fn?.element_path || "",
    elementCode: fn?.element_code || node.name,
  };
}

export default function KPICalcsTab() {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});
  const kpi = useAtomValue(kpiAtom);
  const hierarchy = useAtomValue(hierarchyAtom);
  const sensors = useAtomValue(sensorsAtom);
  const loadKpiPackages = useSetAtom(loadKpiPackagesAtom);
  const loadCalcOptionality = useSetAtom(loadCalcOptionalityAtom);
  const loadCalcRequirements = useSetAtom(loadCalcRequirementsAtom);
  const loadSensorMapping = useSetAtom(loadSensorMappingAtom);
  const updateSensorMapping = useSetAtom(updateSensorMappingAtom);

  const handleRowChange = useCallback((updatedRow: SensorMappingRow) => {
    const newRows = sensors.mappingRows.map((r) =>
      r.element_path === updatedRow.element_path &&
      r.element_code === updatedRow.element_code &&
      r.attribute === updatedRow.attribute
        ? updatedRow : r
    );
    updateSensorMapping(newRows);
  }, [sensors.mappingRows, updateSensorMapping]);

  useEffect(() => {
    loadCalcOptionality().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hierarchy.root && sensors.mappingRows.length === 0) {
      loadSensorMapping().catch(() => {});
    }
  }, [hierarchy.root, sensors.mappingRows.length, loadSensorMapping]);

  useEffect(() => {
    loadKpiPackages().catch(() => {});
  }, [loadKpiPackages]);

  const mappingTemplateKey = useMemo(
    () => sensors.mappingRows.map((row) => `${row.element_path ?? ""}|${row.element_code ?? ""}|${row.attribute ?? ""}`).join("||"),
    [sensors.mappingRows]
  );

  useEffect(() => {
    if (!hierarchy.root) return;
    loadCalcRequirements().catch(() => {});
  }, [hierarchy.root, mappingTemplateKey, loadCalcRequirements]);

  const codeMap = useMemo(() => buildCodeMap(hierarchy.flatNodes), [hierarchy.flatNodes]);
  const rowsByCode = useMemo(() => buildRowsByCode(sensors.mappingRows), [sensors.mappingRows]);

  const packageByCalc = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pkg of kpi.packages) {
      for (const calc of pkg.calcs) {
        if (!map.has(calc)) map.set(calc, []);
        map.get(calc)!.push(pkg.name);
      }
    }
    return map;
  }, [kpi.packages]);

  const allCalcs = useMemo(() => {
    const set = new Set<string>();
    for (const pkg of kpi.packages) { for (const calc of pkg.calcs) set.add(calc); }
    for (const calc of Object.keys(kpi.calcRequirements)) set.add(calc);
    return Array.from(set.values());
  }, [kpi.packages, kpi.calcRequirements]);

  const nodeCalcs = useMemo(() => {
    const out = new Map<string, CalcAtNode[]>();
    if (!hierarchy.root || allCalcs.length === 0) return out;

    function walk(node: HierarchyNode, parentLevels: string[]) {
      const meta = nodeMeta(node, parentLevels, codeMap);
      const rows = rowsByCode.get(`${meta.elementPath}|${meta.elementCode}`) ?? [];
      const calcList: CalcAtNode[] = [];

      for (const calcName of allCalcs) {
        const req = kpi.calcRequirements[calcName] ?? { required: [], optional: [], required_sensor_paths: [], optional_sensor_paths: [] };
        const requiredPaths = (req.required_sensor_paths ?? []) as SensorPath[];
        const optionalPaths = (req.optional_sensor_paths ?? []) as SensorPath[];
        const hasExplicitPaths = requiredPaths.length > 0 || optionalPaths.length > 0;
        const matchedRequiredPaths = requiredPaths.filter((p) => sensorPathMatchesInstance(p, meta.level, meta.levelPath));
        const matchedOptionalPaths = optionalPaths.filter((p) => sensorPathMatchesInstance(p, meta.level, meta.levelPath));
        const levelRequired = (req.required ?? []).some((lv) => lv.toLowerCase() === meta.level.toLowerCase());
        const levelOptional = (req.optional ?? []).some((lv) => lv.toLowerCase() === meta.level.toLowerCase());
        const isApplicable = hasExplicitPaths
          ? (matchedRequiredPaths.length > 0 || matchedOptionalPaths.length > 0)
          : (levelRequired || levelOptional);
        if (!isApplicable) continue;

        const requiredAttrs = Array.from(new Set(matchedRequiredPaths.map((p) => p.attr)));
        const optionalAttrs = Array.from(new Set(matchedOptionalPaths.map((p) => p.attr).filter((a) => !requiredAttrs.includes(a))));
        const mappedRequired = requiredAttrs.filter((a) => rows.some((r) => (r.attribute ?? "") === a && isMapped(r))).length;

        let status: Status = "no_data";
        if (requiredAttrs.length > 0) {
          if (mappedRequired === requiredAttrs.length) status = "ready";
          else if (mappedRequired > 0) status = "partial";
          else status = "insufficient";
        }

        calcList.push({
          calcName, packageNames: packageByCalc.get(calcName) ?? ["Unpackaged"],
          requiredAttrs, optionalAttrs, mappedRequired, requiredCount: requiredAttrs.length, status,
          requiredLevels: req.required ?? [], optionalLevels: req.optional ?? [],
        });
      }

      out.set(node.id, calcList.sort((a, b) => a.calcName.localeCompare(b.calcName)));
      for (const child of node.children ?? []) { walk(child, [...parentLevels, node.level]); }
    }

    walk(hierarchy.root, []);
    return out;
  }, [hierarchy.root, allCalcs, codeMap, rowsByCode, kpi.calcRequirements, packageByCalc]);

  const totalApplicableCalcs = useMemo(() => { let n = 0; for (const list of nodeCalcs.values()) n += list.length; return n; }, [nodeCalcs]);

  const overallStatusCounts = useMemo(() => {
    const counts: Record<Status, number> = { ready: 0, partial: 0, insufficient: 0, no_data: 0 };
    for (const list of nodeCalcs.values()) { for (const calc of list) counts[calc.status] += 1; }
    return counts;
  }, [nodeCalcs]);

  if (!hierarchy.root) {
    return <div className="py-16 text-center text-text-secondary">Build the hierarchy first (System Config tab) to view KPI calc applicability.</div>;
  }

  const toggleNode = (id: string, defaultOpen: boolean) => {
    setExpandedNodeIds((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultOpen) }));
  };

  const renderNode = (node: HierarchyNode, depth: number, parentLevels: string[]): React.ReactNode => {
    if (depth === 0 && node.level === "System") {
      return (
        <div className="flex flex-col gap-3">
          {(node.children ?? []).map((child) => renderNode(child, depth + 1, [...parentLevels, node.level]))}
        </div>
      );
    }

    const defaultOpen = depth < 2;
    const open = expandedNodeIds[node.id] ?? defaultOpen;
    const calcs = nodeCalcs.get(node.id) ?? [];
    const meta = nodeMeta(node, parentLevels, codeMap);
    const rows = rowsByCode.get(`${meta.elementPath}|${meta.elementCode}`) ?? [];
    const { mapped: mappedCount, total: subtreeTotal } = subtreeCoverage(node, codeMap, rowsByCode);

    return (
      <div key={node.id} className={cn("border border-border border-l-2 rounded-xl bg-surface shadow-sm", depthAccent(depth))}>
        <button
          className={cn("w-full flex items-center gap-3 px-4 py-2.5 bg-background hover:bg-surface-hover transition-colors text-left rounded-t-[11px]", !open && "rounded-b-[11px]")}
          onClick={() => toggleNode(node.id, defaultOpen)}
        >
          <span className="text-xs text-text-secondary w-3 shrink-0">{open ? "▾" : "▸"}</span>
          <span className="text-sm font-semibold text-text-primary flex-1 truncate">{node.name}</span>
          <span className="text-xs text-text-secondary border border-border bg-surface px-1.5 py-0.5 rounded shrink-0">{node.level}</span>
          <span className={cn("text-xs shrink-0", mappedCount === subtreeTotal && subtreeTotal > 0 ? "text-accent-green" : "text-text-secondary")}>
            {mappedCount}/{subtreeTotal} attrs
          </span>
          <span className="text-xs text-text-secondary shrink-0">{calcs.length} calcs</span>
        </button>

        {open && (
          <div className="p-3 flex flex-col gap-2">
            {rows.map((row) => {
                const attrName = row.attribute ?? "";
                const dependentCalcs = calcs.filter(
                  (c) => c.requiredAttrs.includes(attrName) || c.optionalAttrs.includes(attrName)
                );
                return (
                  <PIAttributeRow
                    key={`${row.element_path}|${row.element_code}|${attrName}`}
                    row={row}
                    onChange={handleRowChange}
                    trailing={<DependentKpisChip calcs={dependentCalcs} />}
                  />
                );
              })}
            {(node.children ?? []).length > 0 && (
              <div className="pt-1 flex flex-col gap-2.5 border-t border-border">
                {(node.children ?? []).map((child) => renderNode(child, depth + 1, [...parentLevels, node.level]))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary">{allCalcs.length} calcs, {totalApplicableCalcs} applicable placements</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span className="text-text-secondary">Legend:</span>
        <StatusBadge status="ready" /><span>{overallStatusCounts.ready}</span>
        <StatusBadge status="partial" /><span>{overallStatusCounts.partial}</span>
        <StatusBadge status="insufficient" /><span>{overallStatusCounts.insufficient}</span>
        <StatusBadge status="no_data" /><span>{overallStatusCounts.no_data}</span>
      </div>
      {allCalcs.length === 0 ? (
        <div className="py-16 text-center text-text-secondary">No calc blueprint/package data loaded yet.</div>
      ) : (
        <div className="flex flex-col gap-3">{renderNode(hierarchy.root, 0, [])}</div>
      )}
    </div>
  );
}
