"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  hierarchyAtom,
  sensorsAtom,
  kpiAtom,
  blueprintAtom,
  loadSensorMappingAtom,
  updateSensorMappingAtom,
  updateCalcOverridesAtom,
  ensureCalcBlueprintAtom,
} from "../../store/Index";
import { SYSTEM_NAME, formatSystemName } from "../../Constants";
import type { SensorMappingRow, FlatNode } from "../../types/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

interface KpiPackage {
  name: string;
  description?: string;
  calcs: string[];
}

interface CalcAttrDef {
  name: string;
  levels: string[];
}

function extractLevels(rawLevel: unknown): string[] {
  if (!rawLevel) return [];
  const toLeaf = (s: string) =>
    s.split(/[/>]/).map((p) => p.trim()).filter(Boolean).pop() ?? "";

  if (Array.isArray(rawLevel)) {
    return rawLevel.flatMap((item) => {
      if (typeof item === "string") {
        const leaf = toLeaf(item);
        return leaf ? [leaf] : [];
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const raw = String(obj.child ?? obj.child_level ?? obj.level ?? obj.hierarchy_level ?? "");
        const leaf = toLeaf(raw);
        return leaf ? [leaf] : [];
      }
      return [];
    });
  }
  if (typeof rawLevel === "string") {
    const leaf = toLeaf(rawLevel);
    return leaf ? [leaf] : [];
  }
  return [];
}

function extractPackages(data: Record<string, unknown> | null): KpiPackage[] {
  if (!data) return [];
  const pkgs = data.kpi_packages;
  if (!Array.isArray(pkgs)) return [];
  return (pkgs as unknown[]).map((p) => {
    const pkg = p as Record<string, unknown>;
    return {
      name: String(pkg.name ?? ""),
      description: pkg.description ? String(pkg.description) : undefined,
      calcs: Array.isArray(pkg.calcs) ? (pkg.calcs as unknown[]).map(String) : [],
    };
  });
}

function extractCalcAttrMap(data: Record<string, unknown> | null): Map<string, CalcAttrDef> {
  const map = new Map<string, CalcAttrDef>();
  if (!data) return map;
  const attrs = data.attributes;
  if (!Array.isArray(attrs)) return map;
  for (const a of attrs as unknown[]) {
    const attr = a as Record<string, unknown>;
    const levels = extractLevels(attr.hierarchy_level ?? attr.level ?? null);
    const name = String(attr.attribute_name ?? attr.name ?? "").trim();
    if (name) map.set(name, { name, levels });
    const outputs = attr.outputs;
    if (Array.isArray(outputs)) {
      for (const o of outputs as unknown[]) {
        const out = o as Record<string, unknown>;
        const outName = String(out.attribute_name ?? "").trim();
        if (!outName) continue;
        const existing = map.get(outName);
        if (existing) {
          map.set(outName, { name: outName, levels: [...new Set([...existing.levels, ...levels])] });
        } else {
          map.set(outName, { name: outName, levels });
        }
      }
    }
  }
  return map;
}

function overrideKey(ep: string, ec: string, attr: string) {
  return `${ep}|${ec}|${attr}`;
}

function buildOverrideMap(rows: SensorMappingRow[]): Map<string, SensorMappingRow> {
  const map = new Map<string, SensorMappingRow>();
  for (const r of rows) {
    if (!r._is_calc_override) continue;
    const key = overrideKey(String(r.element_path ?? ""), String(r.element_code ?? ""), String(r.attribute ?? "").trim());
    if (key) map.set(key, r);
  }
  return map;
}

function instancesForCalc(levels: string[], flatNodes: FlatNode[]): FlatNode[] {
  if (levels.length === 0) return [];
  const levelSet = new Set(levels.map((l) => l.trim().toLowerCase()));
  return flatNodes.filter((n) => levelSet.has((n.level ?? "").trim().toLowerCase()));
}

function Toggle({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none",
        on ? "bg-accent-blue" : "bg-surface-hover",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow-sm transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

function InstanceRow({ calcName, node, overrideRow, busy, onToggle, onTagBlur }: {
  calcName: string;
  node: FlatNode;
  overrideRow: SensorMappingRow | undefined;
  busy: boolean;
  onToggle: (ep: string, ec: string, enabled: boolean) => void;
  onTagBlur: (ep: string, ec: string, tag: string) => void;
}) {
  const isOn = !!overrideRow;
  const hasMappedTag = !!(overrideRow?.sensor_name);
  const crumbs = [
    ...(node.element_path ? node.element_path.split("/").map((s) => s.trim()).filter(Boolean) : []),
    node.element_name || node.element_code,
  ];

  return (
    <div className={cn("border-t border-border transition-colors", isOn && hasMappedTag ? "bg-surface" : isOn ? "bg-surface" : "")}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className={cn("w-0.5 h-7 rounded-full shrink-0 ml-5", hasMappedTag ? "bg-accent-green" : isOn ? "bg-accent-yellow" : "bg-border")} />
        <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
          {crumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-text-secondary text-xs">›</span>}
              <span className={cn("text-xs", i === crumbs.length - 1 ? "font-medium text-text-primary" : "text-text-secondary")}>{seg}</span>
            </span>
          ))}
        </div>
        {busy ? (
          <span className="text-xs text-text-secondary shrink-0">Saving…</span>
        ) : isOn && hasMappedTag ? (
          <span className="text-xs text-accent-green font-medium shrink-0">PI Override</span>
        ) : isOn ? (
          <span className="text-xs text-accent-yellow shrink-0">Tag required</span>
        ) : null}
        <Toggle on={isOn} disabled={busy} onToggle={() => onToggle(node.element_path, node.element_code, !isOn)} />
      </div>

      {isOn && (
        <div className={cn("mx-4 mb-2.5 ml-12 rounded-lg border px-3 py-2 flex items-center gap-3", hasMappedTag ? "border-accent-green bg-surface" : "border-accent-yellow bg-surface")}>
          <span className={cn("text-xs font-medium shrink-0", hasMappedTag ? "text-accent-green" : "text-accent-yellow")}>PI Tag</span>
          <input
            key={String(overrideRow?.sensor_name ?? "")}
            className={cn("flex-1 bg-surface border rounded px-2 py-1 text-xs font-mono focus:outline-none min-w-0", hasMappedTag ? "border-accent-green" : "border-accent-yellow")}
            placeholder={`e.g. PLANT.${node.element_code}.${calcName}`}
            defaultValue={String(overrideRow?.sensor_name ?? "")}
            onBlur={(e) => onTagBlur(node.element_path, node.element_code, e.target.value)}
          />
          {hasMappedTag ? (
            <span className="text-xs text-accent-green shrink-0">✓</span>
          ) : (
            <span className="text-xs text-accent-yellow shrink-0">required</span>
          )}
        </div>
      )}
    </div>
  );
}

function CalcSection({ index, calcName, levels, nodes, overrideMap, busyKey, onToggle, onTagBlur }: {
  index: number;
  calcName: string;
  levels: string[];
  nodes: FlatNode[];
  overrideMap: Map<string, SensorMappingRow>;
  busyKey: string | null;
  onToggle: (calcName: string, ep: string, ec: string, enabled: boolean) => void;
  onTagBlur: (calcName: string, ep: string, ec: string, tag: string) => void;
}) {
  const overriddenCount = nodes.filter((n) => overrideMap.has(overrideKey(n.element_path, n.element_code, calcName))).length;
  const mappedCount = nodes.filter((n) => {
    const r = overrideMap.get(overrideKey(n.element_path, n.element_code, calcName));
    return !!(r?.sensor_name);
  }).length;

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-3 px-4 py-2 bg-background">
        <span className="text-xs text-text-secondary font-mono w-5 shrink-0 text-right">{index}</span>
        <p className="flex-1 text-sm font-mono text-text-primary truncate">{calcName}</p>
        {levels.length > 0 && (
          <span className="text-xs text-text-secondary bg-surface border border-border px-1.5 py-0.5 rounded shrink-0">{levels[0]}</span>
        )}
        {overriddenCount > 0 && (
          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0", mappedCount === overriddenCount ? "bg-surface text-accent-green" : "bg-surface text-accent-yellow")}>
            {mappedCount === overriddenCount ? `${overriddenCount} overridden` : `${mappedCount}/${overriddenCount} mapped`}
          </span>
        )}
      </div>
      {nodes.length === 0 ? (
        <p className="px-12 py-2 text-xs text-text-secondary italic">No instances found for level: {levels.join(", ") || "unknown"}</p>
      ) : (
        nodes.map((node) => {
          const key = overrideKey(node.element_path, node.element_code, calcName);
          return (
            <InstanceRow
              key={`${node.element_path}|${node.element_code}`}
              calcName={calcName}
              node={node}
              overrideRow={overrideMap.get(key)}
              busy={busyKey === key}
              onToggle={(ep, ec, enabled) => onToggle(calcName, ep, ec, enabled)}
              onTagBlur={(ep, ec, tag) => onTagBlur(calcName, ep, ec, tag)}
            />
          );
        })
      )}
    </div>
  );
}

function PackageCard({ pkg, calcAttrMap, flatNodes, overrideMap, busyKey, onToggle, onTagBlur }: {
  pkg: KpiPackage;
  calcAttrMap: Map<string, CalcAttrDef>;
  flatNodes: FlatNode[];
  overrideMap: Map<string, SensorMappingRow>;
  busyKey: string | null;
  onToggle: (calcName: string, ep: string, ec: string, enabled: boolean) => void;
  onTagBlur: (calcName: string, ep: string, ec: string, tag: string) => void;
}) {
  const totalInstances = pkg.calcs.reduce((sum, c) => {
    const def = calcAttrMap.get(c);
    return sum + instancesForCalc(def?.levels ?? [], flatNodes).length;
  }, 0);
  const overriddenInstances = pkg.calcs.reduce((sum, c) => {
    const def = calcAttrMap.get(c);
    const nodes = instancesForCalc(def?.levels ?? [], flatNodes);
    return sum + nodes.filter((n) => overrideMap.has(overrideKey(n.element_path, n.element_code, c))).length;
  }, 0);
  const mappedInstances = pkg.calcs.reduce((sum, c) => {
    const def = calcAttrMap.get(c);
    const nodes = instancesForCalc(def?.levels ?? [], flatNodes);
    return sum + nodes.filter((n) => {
      const r = overrideMap.get(overrideKey(n.element_path, n.element_code, c));
      return !!(r?.sensor_name);
    }).length;
  }, 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
      <div className="px-4 py-3 bg-background border-b border-border flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary leading-tight">{pkg.name}</h3>
          {pkg.description && <p className="text-xs text-text-secondary mt-0.5 leading-snug">{pkg.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
            {pkg.calcs.length} calcs · {totalInstances} instances
          </span>
          {overriddenInstances > 0 && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", mappedInstances === overriddenInstances ? "bg-surface text-accent-green" : "bg-surface text-accent-yellow")}>
              {mappedInstances === overriddenInstances ? `${overriddenInstances} overridden` : `${mappedInstances}/${overriddenInstances} mapped`}
            </span>
          )}
        </div>
      </div>
      {pkg.calcs.map((calcName, idx) => {
        const def = calcAttrMap.get(calcName);
        const nodes = instancesForCalc(def?.levels ?? [], flatNodes);
        return (
          <CalcSection
            key={calcName}
            index={idx + 1}
            calcName={calcName}
            levels={def?.levels ?? []}
            nodes={nodes}
            overrideMap={overrideMap}
            busyKey={busyKey}
            onToggle={onToggle}
            onTagBlur={onTagBlur}
          />
        );
      })}
    </div>
  );
}

export default function KPIMappingTab() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const hierarchy = useAtomValue(hierarchyAtom);
  const sensors = useAtomValue(sensorsAtom);
  const kpi = useAtomValue(kpiAtom);
  const blueprint = useAtomValue(blueprintAtom);
  const loadSensorMapping = useSetAtom(loadSensorMappingAtom);
  const updateSensorMapping = useSetAtom(updateSensorMappingAtom);
  const updateCalcOverrides = useSetAtom(updateCalcOverridesAtom);
  const ensureCalcBlueprint = useSetAtom(ensureCalcBlueprintAtom);

  // Lazily fetch the calc blueprint; local flag distinguishes "loading" from "unavailable".
  const [calcBpLoading, setCalcBpLoading] = useState(!kpi.calcBlueprintData);

  useEffect(() => {
    if (hierarchy.root && sensors.mappingRows.length === 0) {
      loadSensorMapping().catch(() => {});
    }
  }, [hierarchy.root]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (kpi.calcBlueprintData) { setCalcBpLoading(false); return; }
    ensureCalcBlueprint().finally(() => setCalcBpLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const packages = useMemo(() => extractPackages(kpi.calcBlueprintData), [kpi.calcBlueprintData]);
  const calcAttrMap = useMemo(() => extractCalcAttrMap(kpi.calcBlueprintData), [kpi.calcBlueprintData]);
  const overrideMap = useMemo(() => buildOverrideMap(sensors.mappingRows), [sensors.mappingRows]);
  const systemName = blueprint.summary?.systemName || "";

  const handleToggle = useCallback(
    async (calcName: string, elementPath: string, elementCode: string, enabled: boolean) => {
      const key = overrideKey(elementPath, elementCode, calcName);
      setBusyKey(key);
      try {
        await updateCalcOverrides([{ elementPath, elementCode, outputAttrName: calcName, enabled }]);
      } finally {
        setBusyKey(null);
      }
    },
    [updateCalcOverrides]
  );

  const handleTagBlur = useCallback(
    (calcName: string, elementPath: string, elementCode: string, piTag: string) => {
      const newRows = sensors.mappingRows.map((r) =>
        r._is_calc_override &&
        String(r.attribute ?? "").trim() === calcName &&
        String(r.element_path ?? "") === elementPath &&
        String(r.element_code ?? "") === elementCode
          ? { ...r, sensor_name: piTag }
          : r
      );
      updateSensorMapping(newRows);
    },
    [sensors.mappingRows, updateSensorMapping]
  );

  const handleResetAll = useCallback(async () => {
    const toDisable = [...overrideMap.values()].map((r) => ({
      elementPath: String(r.element_path ?? ""),
      elementCode: String(r.element_code ?? ""),
      outputAttrName: String(r.attribute ?? "").trim(),
      enabled: false,
    }));
    setResetting(true);
    try {
      await updateCalcOverrides(toDisable);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }, [overrideMap, updateCalcOverrides]);

  if (!hierarchy.root) {
    return <div className="py-16 text-center text-text-secondary">Build the hierarchy first (System Config tab) to configure KPI overrides.</div>;
  }

  if (calcBpLoading && !kpi.calcBlueprintData) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-text-secondary">
        <span className="inline-block w-6 h-6 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading calculation blueprint…</p>
      </div>
    );
  }

  if (packages.length === 0) {
    return <div className="py-16 text-center text-text-secondary text-sm">Calculation blueprint unavailable. Ensure <code>calc_blueprint_{SYSTEM_NAME}.json</code> exists on the backend.</div>;
  }

  const totalOverridden = [...overrideMap.values()].length;
  const totalMapped = [...overrideMap.values()].filter((r) => r.sensor_name).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          {systemName && <p className="text-xs text-text-secondary mb-0.5">System: <strong className="text-text-primary">{formatSystemName(systemName)}</strong></p>}
          <p className="text-xs text-text-secondary max-w-lg">Enable PI override per element instance to read a KPI output directly from the historian instead of computing it from formula inputs.</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {totalOverridden > 0 && (
            <p className="text-xs text-text-secondary">
              <span className={totalMapped === totalOverridden ? "text-accent-green font-medium" : "text-accent-yellow font-medium"}>
                {totalMapped}/{totalOverridden}
              </span>{" "}overrides mapped
            </p>
          )}
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-accent-red">Remove all {totalOverridden} PI mapping{totalOverridden !== 1 ? "s" : ""}? This cannot be undone.</span>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-xs px-2 py-0.5 rounded border border-border text-text-secondary hover:bg-surface-hover transition-colors shrink-0"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                disabled={resetting}
                className="text-xs px-2 py-0.5 rounded border border-accent-red text-accent-red hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {resetting ? "Resetting…" : "Confirm"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={totalOverridden === 0}
              className="text-xs px-2.5 py-1 rounded border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset all PI mappings
            </button>
          )}
        </div>
      </div>

      {packages.map((pkg) => (
        <PackageCard
          key={pkg.name}
          pkg={pkg}
          calcAttrMap={calcAttrMap}
          flatNodes={hierarchy.flatNodes}
          overrideMap={overrideMap}
          busyKey={busyKey}
          onToggle={handleToggle}
          onTagBlur={handleTagBlur}
        />
      ))}
    </div>
  );
}
