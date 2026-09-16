"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  kpiAtom,
  hierarchyAtom,
  sensorsAtom,
  mandatoryKpiPackageStatusAtom,
  calcStatusAtom,
  loadKpiPackagesAtom,
  loadCalcOptionalityAtom,
  loadCalcRequirementsAtom,
  loadSensorMappingAtom,
  updateCalcOverridesAtom,
  updateSensorMappingAtom,
} from "../../store/Index";
import PIAttributeRow from "../shared/PIAttributeRow";
import type { SensorMappingRow, FlatNode, HierarchyNode, CalcAlternativeGroup } from "../../types/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));
const fmtName = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

type Status = "ready" | "partial" | "insufficient" | "no_data";

interface AttrStatus {
  attribute: string;
  mapped: boolean;
  via: "sensor" | "constant" | "formula" | "calc_override" | "unmapped";
  optGroup?: string;
  optSatisfied?: boolean;
  isAltGroup?: boolean;
  altOptionIdx?: number;
  altOptionLabel?: string;
  altOptionSatisfied?: boolean;
  row?: SensorMappingRow;
}

interface LevelGroup {
  level: string;
  elementCode: string;
  elementName: string;
  elementPath: string;
  attrs: AttrStatus[];
  status: Status;
  isOptional: boolean;
  isAbsent?: boolean;
}

function isMapped(r: SensorMappingRow): boolean {
  return !!(r.sensor_name || r.constant_value || r.formula || r._is_calc_override);
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

// Global per-calc override map (keyed by calc name) — used for sidebar status dot
function buildOverrideMap(rows: SensorMappingRow[]): Map<string, SensorMappingRow> {
  const map = new Map<string, SensorMappingRow>();
  for (const r of rows) {
    if (!r._is_calc_override) continue;
    const attr = String(r.attribute ?? "").trim();
    if (attr) map.set(attr, r);
  }
  return map;
}

// Per-instance override map keyed by element_path|element_code|calcName
function buildInstanceOverrideMap(rows: SensorMappingRow[]): Map<string, SensorMappingRow> {
  const map = new Map<string, SensorMappingRow>();
  for (const r of rows ?? []) {
    if (!r._is_calc_override) continue;
    const key = `${String(r.element_path ?? "")}|${String(r.element_code ?? "")}|${String(r.attribute ?? "")}`;
    map.set(key, r);
  }
  return map;
}

function instanceOverrideKey(ep: string, ec: string, calcName: string) {
  return `${ep}|${ec}|${calcName}`;
}


function isOverrideMapped(row: SensorMappingRow | undefined): boolean {
  if (!row) return false;
  return !!(row.sensor_name || row.constant_value || row.formula);
}

function buildCodeMap(flatNodes: FlatNode[]): Map<string, FlatNode> {
  const map = new Map<string, FlatNode>();
  for (const fn of flatNodes) { if (fn.id) map.set(fn.id, fn); }
  return map;
}

// Look up the hierarchy level(s) where a calc's output is defined in the calc blueprint.
// Each blueprint attribute row has an attribute_name (or outputs[].attribute_name) and
// a hierarchy_level (string | string[]) specifying the element type(s) the calc runs on.
function getCalcOutputLevels(calcName: string, data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  const attrs = data.attributes as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(attrs)) return [];

  const calcLower = calcName.toLowerCase();
  const normalise = (level: unknown): string[] => {
    if (!level) return [];
    if (Array.isArray(level)) return (level as unknown[]).map(String).filter(Boolean);
    return [String(level)].filter(Boolean);
  };

  for (const attr of attrs) {
    const attrName = String(attr.attribute_name ?? "").trim().toLowerCase();
    const levels = normalise(attr.hierarchy_level);
    if (attrName === calcLower) return levels;

    const outputs = attr.outputs as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(outputs)) {
      for (const out of outputs) {
        if (String(out.attribute_name ?? "").trim().toLowerCase() === calcLower) return levels;
      }
    }
  }
  return [];
}

type SensorPath = { attr: string; level: string | null; parent: string | null; parent_path?: string; element_path?: string; path: string };

// Normalise an element path for comparison: replace > with /, collapse slashes,
// strip trailing slash, lowercase. Handles both sensor-mapping format ("A>B>C>")
// and hierarchy-builder format ("A/B/C/").
function normEP(p: string): string {
  return p.replace(/>/g, "/").replace(/\/+/g, "/").replace(/\/$/, "").toLowerCase();
}

function sensorPathMatchesInstance(s: SensorPath, instanceLevel: string, instanceLevelPath: string, instanceFullPath: string): boolean {
  // Exact element-path match when the backend resolved to a specific instance
  if (s.element_path) {
    const fn = normEP(instanceFullPath);
    const sp = normEP(s.element_path);
    // Allow suffix match: sensor mapping may omit the System-level prefix present in the hierarchy path
    return fn === sp || fn.endsWith("/" + sp);
  }
  // Fallback: level-type + parent_path matching (formula-text mode / no instance data)
  const levelMatch = !s.level || (s.level ?? "").toLowerCase() === instanceLevel.toLowerCase();
  if (!levelMatch) return false;
  if (s.parent_path) {
    const lp = instanceLevelPath.toLowerCase();
    const pp = s.parent_path.toLowerCase();
    return lp.endsWith(pp);
  }
  const sParent = (s.parent ?? "").toLowerCase();
  return !s.parent || instanceLevelPath.toLowerCase().includes(sParent);
}

// Parse a sensor-group member into { attr, scope }. Members use the same short-form
// convention as sensor_overrides paths: "fuels.composition_ch4" scopes the attr to
// Fuels instances; "convection_coil_mix_feed.inlet.temperature" scopes to Inlet under
// Convection Coil Mix Feed (multi-segment scope, matched as a suffix of the instance's
// level-type path). A bare attr (no dot) is unscoped and matches any instance — the
// format auto-detected numpy.where groups produce.
function parseGroupMember(s: string): { attr: string; scope: string | null } {
  const i = s.lastIndexOf(".");
  return i === -1
    ? { attr: s, scope: null }
    : { attr: s.slice(i + 1), scope: s.slice(0, i).split(".").join("/") };
}

function collectNodesAtLevels(root: HierarchyNode | null, codeMap: Map<string, FlatNode>, levelSet: Set<string>): FlatNode[] {
  if (!root) return [];
  const result: FlatNode[] = [];
  const levelSetLower = new Set(Array.from(levelSet).map((l) => l.toLowerCase()));
  function walk(node: HierarchyNode, parentLevels: string[]) {
    if (levelSetLower.has((node.level ?? "").toLowerCase())) {
      const fn = codeMap.get(node.id);
      const derivedLevelPath = node.level === "System" ? "" : `${parentLevels.join("/")}/`;
      if (fn) result.push({ ...fn, level_path: fn.level_path || derivedLevelPath });
    }
    for (const child of node.children ?? []) walk(child, [...parentLevels, node.level ?? ""]);
  }
  walk(root, []);
  return result;
}

function collectAvailableLevels(root: HierarchyNode | null): Set<string> {
  const levels = new Set<string>();
  if (!root) return levels;
  function walk(node: HierarchyNode) {
    const level = String(node.level ?? "").trim();
    if (level) levels.add(level.toLowerCase());
    for (const child of node.children ?? []) walk(child);
  }
  walk(root);
  return levels;
}

function computeLevelGroups(
  calcName: string, requiredLevels: string[], optionalLevels: string[],
  requiredSensorPaths: SensorPath[], optionalSensorPaths: SensorPath[],
  root: HierarchyNode | null, codeMap: Map<string, FlatNode>, rowsByCode: Map<string, SensorMappingRow[]>,
  optionality: CalcAlternativeGroup[],
  alwaysIncludeLevels?: Set<string>,
  autoAlternatives?: { label: string; options: { label: string; sensors: string[]; mode?: "any" | "all" }[] }[],
): LevelGroup[] {
  const levelSet = new Set([...requiredLevels, ...optionalLevels]);
  const optionalSet = new Set(optionalLevels);
  // Ensure output levels are always included even if they hold no direct sensor rows
  if (alwaysIncludeLevels) {
    for (const l of alwaysIncludeLevels) levelSet.add(l.toLowerCase());
  }
  const instances = collectNodesAtLevels(root, codeMap, levelSet);
  if (instances.length === 0) return [];
  const hasExplicitPaths = requiredSensorPaths.length > 0 || optionalSensorPaths.length > 0;
  const relGroups = [
    ...optionality.filter((g) => g.affected_calcs.includes(calcName)),
    ...(autoAlternatives ?? []).map((ag) => ({
      label: ag.label,
      affected_calcs: [calcName],
      levels: [] as string[],
      options: ag.options,
    })),
  ];
  // Pre-parse member scoping once — members are instance-independent; only
  // relevance (which instance a member applies to) is evaluated per instance.
  const parseOption = (opt: { label: string; sensors: string[]; mode?: "any" | "all" }) => ({
    label: opt.label,
    mode: opt.mode,
    members: opt.sensors.map(parseGroupMember),
  });
  const parsedGroups = relGroups.map((g) => ({ label: g.label, options: g.options.map(parseOption) }));

  // ── Calc-global satisfaction for CROSS-LEVEL groups ──────────────────────
  // A group whose members are scoped to >1 distinct level (e.g. thermal_efficiency
  // "Combustion air basis": combustion_air.temperature OR gas_turbine.exhaust.temperature)
  // is a system-wide choice: satisfaction must be evaluated across ALL instances, not
  // per-instance (each instance only sees one option's level and would otherwise demand
  // it). Single-level groups (and bare-only groups) stay per-instance below.
  const instMeta = instances.map((fn) => {
    const code = fn.element_code ?? "";
    const instancePath = fn.element_path ?? "";
    const instanceLevelPath = fn.level_path ?? "";
    const allRows = rowsByCode.get(`${instancePath}|${code}`) ?? [];
    const instKeyPath = (instanceLevelPath + (fn.level ?? "")).toLowerCase().replace(/ /g, "_");
    return { instKeyPath, allRows };
  });
  const memberRelevantTo = (m: { scope: string | null }, kp: string) =>
    m.scope === null || kp === m.scope || kp.endsWith("/" + m.scope);
  const memberMappedGlobally = (m: { attr: string; scope: string | null }) =>
    instMeta.some((im) => memberRelevantTo(m, im.instKeyPath) && im.allRows.some((r) => r.attribute === m.attr && isMapped(r)));
  // groupLabel → { satisfied, optSat } for cross-level groups only
  const globalVerdict = new Map<string, { satisfied: boolean; optSat: Map<number, boolean> }>();
  for (const g of parsedGroups) {
    const scopes = new Set(g.options.flatMap((o) => o.members).map((m) => m.scope).filter((s): s is string => s !== null));
    if (scopes.size < 2) continue; // single-level / bare-only → per-instance
    const optSat = new Map<number, boolean>();
    g.options.forEach((opt, idx) => {
      const sat = opt.mode === "any" ? opt.members.some(memberMappedGlobally) : opt.members.every(memberMappedGlobally);
      optSat.set(idx, sat);
    });
    globalVerdict.set(g.label, { satisfied: [...optSat.values()].some(Boolean), optSat });
  }

  return instances.map((fn) => {
    const code = fn.element_code ?? "";
    const instancePath = fn.element_path ?? "";
    const instanceLevelPath = fn.level_path ?? "";
    const instanceFullPath = instancePath + code;
    const allRows = rowsByCode.get(`${instancePath}|${code}`) ?? [];
    const instanceLevel = fn.level ?? "";
    let rows = allRows;
    let relevantAttrs: Set<string> | null = null;
    if (hasExplicitPaths) {
      const allPaths = [...requiredSensorPaths, ...optionalSensorPaths];
      relevantAttrs = new Set(allPaths.filter((s) => sensorPathMatchesInstance(s, instanceLevel, instanceLevelPath, instanceFullPath)).map((s) => s.attr));
      rows = allRows.filter((r) => relevantAttrs!.has(r.attribute ?? ""));
    }
    // Synthesise unmapped placeholder rows for expected attrs absent from the sensor mapping,
    // so the instance still renders with "✗" tags instead of being silently dropped.
    if (relevantAttrs && relevantAttrs.size > 0) {
      const mappedAttrNames = new Set(rows.map((r) => r.attribute ?? ""));
      for (const attr of relevantAttrs) {
        if (!mappedAttrNames.has(attr)) {
          rows = [...rows, { element_path: instancePath, element_code: code, level: instanceLevel, attribute: attr } as SensorMappingRow];
        }
      }
    }
    // Always include instances at the calc's output level even with no direct sensor rows
    if (rows.length === 0 && !alwaysIncludeLevels?.has(instanceLevel.toLowerCase())) return null;

    const reqAttrSet = new Set(requiredSensorPaths.filter((s) => sensorPathMatchesInstance(s, instanceLevel, instanceLevelPath, instanceFullPath)).map((s) => s.attr));
    const optAttrSet = new Set(optionalSensorPaths.filter((s) => sensorPathMatchesInstance(s, instanceLevel, instanceLevelPath, instanceFullPath)).map((s) => s.attr));
    // Member relevance: a member's scope must suffix-match this instance's level-type
    // path (mirrors sensorPathMatchesInstance parent_path semantics). Unscoped members
    // (bare attrs, e.g. from auto-detected groups) are relevant to every instance.
    const instKeyPath = (instanceLevelPath + instanceLevel).toLowerCase().replace(/ /g, "_");
    const memberRelevant = (m: { attr: string; scope: string | null }) =>
      m.scope === null || instKeyPath === m.scope || instKeyPath.endsWith("/" + m.scope);
    const attrToAltInfo = new Map<string, { groupLabel: string; optionIdx: number; optionLabel: string }>();
    for (const g of parsedGroups) {
      g.options.forEach((opt, idx) => {
        for (const m of opt.members) {
          if (memberRelevant(m)) attrToAltInfo.set(m.attr, { groupLabel: g.label, optionIdx: idx, optionLabel: opt.label });
        }
      });
    }
    const altGroupSatisfied = new Map<string, boolean>();
    const altOptionSatisfied = new Map<string, Map<number, boolean>>();
    // Option state on this instance — null = not applicable (no member scoped here;
    // must NOT count as satisfied, [].every() would be trivially true).
    // mode "any" (atleast_one/any_of groups): ≥1 relevant sensor mapped satisfies it.
    // mode "all" (default, either-or options): every relevant sensor must be mapped.
    const optionState = (opt: { members: { attr: string; scope: string | null }[]; mode?: "any" | "all" }): boolean | null => {
      const rel = opt.members.filter(memberRelevant);
      if (rel.length === 0) return null;
      const attrMapped = (m: { attr: string }) => allRows.some((r) => r.attribute === m.attr && isMapped(r));
      return opt.mode === "any" ? rel.some(attrMapped) : rel.every(attrMapped);
    };
    for (const g of parsedGroups) {
      const gv = globalVerdict.get(g.label);
      if (gv) {
        // Cross-level group: use the calc-global verdict so satisfying ONE option
        // (on whichever instance holds it) marks this group satisfied on EVERY
        // instance — the option-A instance no longer blocks when option B is chosen.
        altOptionSatisfied.set(g.label, gv.optSat);
        altGroupSatisfied.set(g.label, gv.satisfied);
        continue;
      }
      const states = g.options.map(optionState);
      const optMap = new Map<number, boolean>();
      states.forEach((st, idx) => optMap.set(idx, st ?? false));
      altOptionSatisfied.set(g.label, optMap);
      // Group satisfied when ≥1 APPLICABLE option is satisfied. A group with no
      // applicable options on this instance marks no attrs and gates nothing here.
      altGroupSatisfied.set(g.label, states.some((st) => st === true));
    }
    const attrs: AttrStatus[] = rows.map((r) => {
      const attr = r.attribute ?? "";
      const altInfo = attrToAltInfo.get(attr);
      const isInReq = reqAttrSet.has(attr);
      const isExplicitOpt = hasExplicitPaths && optAttrSet.has(attr) && !isInReq;
      let via: AttrStatus["via"] = "unmapped";
      if (r.sensor_name) via = "sensor";
      else if (r.constant_value) via = "constant";
      else if (r.formula) via = "formula";
      else if (r._is_calc_override) via = "calc_override";
      if (altInfo) {
        return {
          attribute: attr, mapped: isMapped(r), via,
          optGroup: altInfo.groupLabel,
          optSatisfied: altGroupSatisfied.get(altInfo.groupLabel) ?? false,
          isAltGroup: true,
          altOptionIdx: altInfo.optionIdx,
          altOptionLabel: altInfo.optionLabel,
          altOptionSatisfied: altOptionSatisfied.get(altInfo.groupLabel)?.get(altInfo.optionIdx) ?? false,
          row: r,
        };
      }
      const grp = isExplicitOpt ? "optional" : undefined;
      return { attribute: attr, mapped: isMapped(r), via, optGroup: grp, optSatisfied: isExplicitOpt, row: r };
    });

    const reqHere = attrs.filter((a) => reqAttrSet.has(a.attribute));
    const required = reqHere.filter((a) => !a.optSatisfied);
    const mappedReq = required.filter((a) => a.mapped).length;
    let status: Status;
    // "no_data" applies ONLY when this instance has no required sensors at all.
    // When it HAS required sensors that are all satisfied — whether directly mapped
    // or covered by a satisfied alt-group — it is READY. Previously an instance whose
    // required attrs were all group-satisfied got required=[] → "no_data" → filtered
    // out of calcStatus, so a calc whose ENTIRE required set is group-covered (e.g.
    // steam_to_carbon: NG-analyzer comps + Flowrate-basis volumetric_flowrate_ntp)
    // never reached "ready".
    if (reqHere.length === 0) status = "no_data";
    else if (required.length === 0 || mappedReq === required.length) status = "ready";
    else if (mappedReq > 0) status = "partial";
    else status = "insufficient";

    return { level: instanceLevel, elementCode: code, elementName: fn.element_name ?? fn.element_code ?? "", elementPath: instancePath, attrs, status, isOptional: optionalSet.has(instanceLevel) } satisfies LevelGroup;
  }).filter((g): g is LevelGroup => g !== null);
}

function AltOptionRow({ label, attrs, optionSatisfied, groupSatisfied, onRowChange }: {
  label: string; attrs: AttrStatus[]; optionSatisfied: boolean; groupSatisfied: boolean;
  onRowChange?: (row: SensorMappingRow) => void;
}) {
  const [open, setOpen] = useState(optionSatisfied || (!groupSatisfied));
  const faded = groupSatisfied && !optionSatisfied;
  const mappedCount = attrs.filter((a) => a.mapped).length;
  return (
    <div className={cn("border-t border-border", faded && "opacity-40")}>
      <button className="w-full flex items-center gap-2 px-3 py-1.5 bg-surface hover:bg-surface-hover text-xs text-left" onClick={() => setOpen((o) => !o)}>
        <span className="w-3 text-text-secondary shrink-0">{open ? "▾" : "▸"}</span>
        <span className="flex-1 text-text-secondary">{label}</span>
        {optionSatisfied
          ? <span className="text-xs border border-accent-green text-accent-green px-1.5 py-0.5 rounded shrink-0">✓ Ready</span>
          : groupSatisfied
            ? <span className="text-xs border border-border text-text-secondary px-1.5 py-0.5 rounded shrink-0">alt ✓</span>
            : <span className="text-xs text-text-secondary shrink-0">{mappedCount}/{attrs.length}</span>
        }
      </button>
      {open && <div className="divide-y divide-border">{attrs.map((a) => <AttrRow key={a.attribute} a={a} onRowChange={onRowChange} />)}</div>}
    </div>
  );
}

function AltGroupSection({ label, options, onRowChange }: {
  label: string;
  options: { label: string; attrs: AttrStatus[]; optionSatisfied: boolean }[];
  onRowChange?: (row: SensorMappingRow) => void;
}) {
  const groupSatisfied = options.some((o) => o.optionSatisfied);
  return (
    <div className="mx-2 my-1.5 rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-1 bg-background text-xs font-medium text-text-secondary border-b border-border">{label}</div>
      {options.map((opt, i) => (
        <AltOptionRow key={i} label={opt.label} attrs={opt.attrs} optionSatisfied={opt.optionSatisfied} groupSatisfied={groupSatisfied} onRowChange={onRowChange} />
      ))}
    </div>
  );
}

function renderGroupAttrs(attrs: AttrStatus[], onRowChange?: (row: SensorMappingRow) => void): React.ReactNode {
  const result: React.ReactNode[] = [];
  const seenGroups = new Set<string>();
  for (const a of attrs) {
    if (!a.isAltGroup) {
      result.push(<AttrRow key={a.attribute} a={a} onRowChange={onRowChange} />);
    } else if (!seenGroups.has(a.optGroup!)) {
      seenGroups.add(a.optGroup!);
      const groupAttrs = attrs.filter((x) => x.isAltGroup && x.optGroup === a.optGroup);
      const optionMap = new Map<number, AttrStatus[]>();
      for (const ga of groupAttrs) {
        if (!optionMap.has(ga.altOptionIdx!)) optionMap.set(ga.altOptionIdx!, []);
        optionMap.get(ga.altOptionIdx!)!.push(ga);
      }
      const options = Array.from(optionMap.entries())
        .sort(([ia], [ib]) => ia - ib)
        .map(([idx, optAttrs]) => ({
          label: optAttrs[0].altOptionLabel ?? `Path ${idx + 1}`,
          attrs: optAttrs,
          optionSatisfied: optAttrs[0].altOptionSatisfied ?? false,
        }));
      result.push(<AltGroupSection key={`altgrp-${a.optGroup}`} label={a.optGroup!} options={options} onRowChange={onRowChange} />);
    }
  }
  return <>{result}</>;
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
    no_data: { cls: "bg-background text-text-secondary border-border", label: "No template" },
  };
  const { cls, label } = cfg[status];
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cls)}><StatusDot status={status} />{label}</span>;
}

function AttrRow({ a, onRowChange }: { a: AttrStatus; onRowChange?: (row: SensorMappingRow) => void }) {
  if (onRowChange && a.row && !a.row._is_calc_override) {
    const isOptional = !a.isAltGroup && (a.optSatisfied ?? false);
    return <PIAttributeRow row={{ ...a.row, _required: !isOptional }} onChange={onRowChange} />;
  }
  const isOptional = !a.isAltGroup && (a.optSatisfied ?? false);
  const dotStatus = a.mapped ? "ready" : isOptional ? "no_data" : "insufficient";
  const viaBadge: Record<string, string> = {
    sensor: "bg-surface text-accent-blue border-accent-blue",
    constant: "bg-surface text-accent-yellow border-accent-yellow",
    formula: "bg-surface text-accent-orange border-accent-orange",
    calc_override: "bg-surface text-accent-orange border-accent-orange",
  };
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
      <StatusDot status={dotStatus} />
      <span className={cn("flex-1 font-mono truncate", a.mapped ? "text-text-primary" : "text-text-secondary")}>{a.attribute}</span>
      {a.mapped && a.via !== "unmapped" && <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", viaBadge[a.via] ?? "")}>{a.via === "calc_override" ? "override" : a.via}</span>}
      {a.optGroup && !a.isAltGroup && <span className="text-xs px-1.5 py-0.5 rounded border shrink-0 border-border text-text-secondary">{a.optGroup}</span>}
      <span className={cn("w-14 text-right shrink-0 font-medium", a.mapped ? "text-accent-green" : isOptional ? "text-text-secondary" : "text-accent-red")}>{a.mapped ? "✓" : isOptional ? "—" : "✗"}</span>
    </div>
  );
}

function LevelCard({ group, onRowChange }: { group: LevelGroup; onRowChange?: (row: SensorMappingRow) => void }) {
  const [open, setOpen] = useState(true);
  const crumbs = [...(group.elementPath ? group.elementPath.split("/").map((s) => s.trim()).filter(Boolean) : []), group.elementName];
  const required = group.attrs.filter((a) => !a.optSatisfied);
  const mappedReq = required.filter((a) => a.mapped).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-background border-b border-border">
        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="text-xs text-text-secondary w-3 shrink-0">{open ? "▾" : "▸"}</span>
          <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
            {crumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-text-secondary text-xs">›</span>}
                <span className={cn("text-xs", i === crumbs.length - 1 ? "font-semibold text-text-primary" : "text-text-secondary")}>{seg}</span>
              </span>
            ))}
          </div>
          <span className="text-xs text-text-secondary border border-border bg-surface px-1.5 py-0.5 rounded shrink-0">{group.level}</span>
          {group.isAbsent ? (
            group.isOptional ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border text-text-secondary border-border bg-surface shrink-0">optional · not in config</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border text-accent-red border-accent-red bg-surface shrink-0">element absent</span>
            )
          ) : group.isOptional ? (
            <span className="text-xs text-text-secondary bg-background px-1.5 py-0.5 rounded shrink-0">optional</span>
          ) : (
            <StatusBadge status={group.status} />
          )}
          {required.length > 0 && <span className="text-xs text-text-secondary shrink-0 w-10 text-right">{mappedReq}/{required.length}</span>}
        </button>
      </div>
      {open && (
        <div className="divide-y divide-border py-1">
          {group.attrs.length === 0
            ? <p className="px-4 py-2 text-xs text-text-secondary italic">No sensor attributes at this level.</p>
            : renderGroupAttrs(group.attrs, group.isAbsent ? undefined : onRowChange)
          }
        </div>
      )}
    </div>
  );
}

interface InstanceBoxProps {
  group: LevelGroup;
  calcName: string;
  overrideRow: SensorMappingRow | undefined;
  isBusy: boolean;
  onToggle: (enabled: boolean) => void;
  onRowChange: (row: SensorMappingRow) => void;
  children?: React.ReactNode;
}

function InstanceBox({ group, calcName, overrideRow, isBusy, onToggle, onRowChange, children }: InstanceBoxProps) {
  const [open, setOpen] = useState(true);
  const crumbs = [...(group.elementPath ? group.elementPath.split("/").map((s) => s.trim()).filter(Boolean) : []), group.elementName];
  const isOn = !!overrideRow;
  const hasTag = !!(overrideRow?.sensor_name || overrideRow?.constant_value || overrideRow?.formula);
  const required = group.attrs.filter((a) => !a.optSatisfied);
  const mappedReq = required.filter((a) => a.mapped).length;

  return (
    <div className={cn("border rounded-xl overflow-hidden bg-surface shadow-sm", isOn && hasTag ? "border-accent-green" : isOn ? "border-accent-yellow" : "border-border")}>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-background border-b border-border">
        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="text-xs text-text-secondary w-3 shrink-0">{open ? "▾" : "▸"}</span>
          <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
            {crumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-text-secondary text-xs">›</span>}
                <span className={cn("text-xs", i === crumbs.length - 1 ? "font-semibold text-text-primary" : "text-text-secondary")}>{seg}</span>
              </span>
            ))}
          </div>
          <span className="text-xs text-text-secondary border border-border bg-surface px-1.5 py-0.5 rounded shrink-0">{group.level}</span>
          {isOn ? (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0", hasTag ? "text-accent-green border-accent-green" : "text-accent-yellow border-accent-yellow")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", hasTag ? "bg-accent-green" : "bg-accent-yellow")} />
              {hasTag ? "PI Override" : "Tag needed"}
            </span>
          ) : group.isOptional ? (
            <span className="text-xs text-text-secondary bg-background px-1.5 py-0.5 rounded shrink-0">optional</span>
          ) : group.status !== "no_data" ? (
            <StatusBadge status={group.status} />
          ) : null}
          {!isOn && required.length > 0 && <span className="text-xs text-text-secondary shrink-0 w-10 text-right">{mappedReq}/{required.length}</span>}
        </button>
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-border">
          <span className="text-xs text-text-secondary">PI sensor Override</span>
          {isBusy ? (
            <span className="text-xs text-text-secondary italic">…</span>
          ) : (
            <button
              className={cn("relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200", isOn ? "bg-accent-blue" : "bg-surface-hover")}
              onClick={() => onToggle(!isOn)}
              title={isOn ? `Disable PI override for ${calcName} on this instance` : `Enable PI override for ${calcName} on this instance`}
            >
              <span className={cn("pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200", isOn ? "translate-x-4" : "translate-x-0")} />
            </button>
          )}
        </div>
      </div>

      {isOn && overrideRow && (
        <PIAttributeRow row={overrideRow} onChange={onRowChange} />
      )}

      {open && !isOn && (
        <>
          {group.attrs.length > 0 && (
            <div className="divide-y divide-border py-1">
              {renderGroupAttrs(group.attrs, onRowChange)}
            </div>
          )}
          {group.attrs.length === 0 && !children && (
            <p className="px-4 py-2 text-xs text-text-secondary italic">
              Sensors for this calc come from child elements — use PI Override to bypass the formula directly.
            </p>
          )}
          {children && (
            <div className="px-3 py-3 flex flex-col gap-2 border-l-2 border-border ml-4 mr-3 mb-3 mt-1">
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function KPIPackagesTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const kpi = useAtomValue(kpiAtom);
  const hierarchy = useAtomValue(hierarchyAtom);
  const sensors = useAtomValue(sensorsAtom);
  const loadKpiPackages = useSetAtom(loadKpiPackagesAtom);
  const loadCalcOptionality = useSetAtom(loadCalcOptionalityAtom);
  const loadCalcRequirements = useSetAtom(loadCalcRequirementsAtom);
  const loadSensorMapping = useSetAtom(loadSensorMappingAtom);
  const updateCalcOverrides = useSetAtom(updateCalcOverridesAtom);
  const updateSensorMapping = useSetAtom(updateSensorMappingAtom);
  const setMandatoryKpiPackageStatus = useSetAtom(mandatoryKpiPackageStatusAtom);
  const setCalcStatus = useSetAtom(calcStatusAtom);
  const calcRequirementsLoading = kpi.calcRequirementsLoading;

  const [openPkgs, setOpenPkgs] = useState<Set<string>>(
    () => new Set(kpi.packages[0] ? [kpi.packages[0].name] : [])
  );
  useEffect(() => {
    if (kpi.packages.length > 0 && openPkgs.size === 0)
      setOpenPkgs(new Set([kpi.packages[0].name]));
  }, [kpi.packages]); // eslint-disable-line
  const togglePkg = (name: string) =>
    setOpenPkgs(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });

  const [reqLoadElapsed, setReqLoadElapsed] = useState(0);
  useEffect(() => {
    if (!calcRequirementsLoading) { setReqLoadElapsed(0); return; }
    setReqLoadElapsed(0);
    const iv = setInterval(() => setReqLoadElapsed((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [calcRequirementsLoading]);

  useEffect(() => {
    loadCalcOptionality().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hierarchy.root && sensors.mappingRows.length === 0) loadSensorMapping().catch(() => {});
  }, [hierarchy.root, sensors.mappingRows.length, loadSensorMapping]);

  // Packages load via loadKpiPackages (which first fetches the calc blueprint).
  // Track that fetch so the empty state shows a spinner instead of flashing
  // "No KPI packages found." while the dependency graph is still loading.
  const [packagesLoading, setPackagesLoading] = useState(true);
  useEffect(() => {
    setPackagesLoading(true);
    loadKpiPackages().catch(() => {}).finally(() => setPackagesLoading(false));
  }, [loadKpiPackages]);

  const mappingTemplateKey = useMemo(
    () => sensors.mappingRows.map((row) => `${row.element_path ?? ""}|${row.element_code ?? ""}|${row.attribute ?? ""}`).join("||"),
    [sensors.mappingRows]
  );

  useEffect(() => {
    if (!hierarchy.root) return;
    loadCalcRequirements().catch(() => {});
  }, [hierarchy.root, mappingTemplateKey, loadCalcRequirements]);

  const rowsByCode = useMemo(() => buildRowsByCode(sensors.mappingRows), [sensors.mappingRows]);
  const overrideMap = useMemo(() => buildOverrideMap(sensors.mappingRows), [sensors.mappingRows]);
  const codeMap = useMemo(() => buildCodeMap(hierarchy.flatNodes), [hierarchy.flatNodes]);
  const availableLevels = useMemo(() => collectAvailableLevels(hierarchy.root), [hierarchy.root]);
  const hasAnyRequirements = useMemo(() => Object.keys(kpi.calcRequirements).length > 0, [kpi.calcRequirements]);
  const allCalcs = useMemo(() => kpi.packages.flatMap((p) => p.calcs), [kpi.packages]);

  useEffect(() => {
    if (allCalcs.length === 0) { if (selected !== null) setSelected(null); return; }
    if (!selected || !allCalcs.includes(selected)) setSelected(allCalcs[0]);
  }, [allCalcs, selected]);

  const instanceOverrideMap = useMemo(() => buildInstanceOverrideMap(sensors.mappingRows), [sensors.mappingRows]);

  const handleToggle = async (elementPath: string, elementCode: string, calcName: string, enabled: boolean) => {
    const key = instanceOverrideKey(elementPath, elementCode, calcName);
    setBusyKey(key);
    try {
      await updateCalcOverrides([{ elementPath, elementCode, outputAttrName: calcName, enabled }]);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRowChange = (updatedRow: SensorMappingRow) => {
    const newRows = sensors.mappingRows.map((r) =>
      r.element_path === updatedRow.element_path &&
      r.element_code === updatedRow.element_code &&
      r.attribute === updatedRow.attribute &&
      !!r._is_calc_override === !!updatedRow._is_calc_override
        ? updatedRow : r
    );
    updateSensorMapping(newRows);
  };

  const activeCalc = selected ?? allCalcs[0] ?? null;

  // Must be declared before `groups` because groups uses it as alwaysIncludeLevels
  const outputLevelSet = useMemo(() => {
    if (!activeCalc) return new Set<string>();
    const blueprintLevels = getCalcOutputLevels(activeCalc, kpi.calcBlueprintData);
    if (blueprintLevels.length > 0) return new Set(blueprintLevels.map((l) => l.toLowerCase()));
    const req = kpi.calcRequirements[activeCalc];
    const reqLevels = [...(req?.required ?? []), ...(req?.optional ?? [])];
    return new Set(reqLevels.map((l) => l.toLowerCase()));
  }, [activeCalc, kpi.calcBlueprintData, kpi.calcRequirements]);

  const groups = useMemo(() => {
    if (!activeCalc) return [];
    // If every output level for this calc is absent from the hierarchy, suppress all sensor
    // groups. The empty-state branch will show "No applicable levels found" instead.
    if (outputLevelSet.size > 0 && Array.from(outputLevelSet).every((l) => !availableLevels.has(l))) return [];
    const req = kpi.calcRequirements[activeCalc] ?? { required: [], optional: [], required_sensor_paths: [], optional_sensor_paths: [] };
    return computeLevelGroups(activeCalc, req.required, req.optional, req.required_sensor_paths ?? [], req.optional_sensor_paths ?? [], hierarchy.root, codeMap, rowsByCode, kpi.calcOptionality, outputLevelSet, req.auto_sensor_alternatives);
  }, [activeCalc, kpi.calcRequirements, hierarchy.root, codeMap, rowsByCode, kpi.calcOptionality, outputLevelSet, availableLevels]);

  const pairedGroups = useMemo(() => {
    const outputGroups = groups.filter((g) => outputLevelSet.has(g.level.toLowerCase()));
    const sensorGroups = groups.filter((g) => !outputLevelSet.has(g.level.toLowerCase()));
    // element_path is the parent's path with trailing slash; element_code is the node's own name.
    // A child belongs to a parent when child.elementPath === parent.elementPath + parent.elementCode + "/"
    const paired = outputGroups.map((parent) => {
      const parentFullPath = parent.elementPath + parent.elementCode + "/";
      return {
        parent,
        children: sensorGroups.filter((child) => child.elementPath.startsWith(parentFullPath)),
      };
    });
    const claimed = new Set(paired.flatMap((p) => p.children.map((c) => c.elementPath + "|" + c.elementCode)));
    const orphans = sensorGroups.filter((g) => !claimed.has(g.elementPath + "|" + g.elementCode));
    return { paired, orphans };
  }, [groups, outputLevelSet]);

  const calcStatus = useMemo(() => {
    const map = new Map<string, Status>();
    for (const calcName of allCalcs) {
      const overrideRow = overrideMap.get(calcName);
      if (overrideRow) { map.set(calcName, isOverrideMapped(overrideRow) ? "ready" : "partial"); continue; }
      const req = kpi.calcRequirements[calcName] ?? { required: [], optional: [] };
      if (req.required.length === 0 && req.optional.length === 0) { map.set(calcName, "no_data"); continue; }
      const gs = computeLevelGroups(calcName, req.required, req.optional, (req as { required_sensor_paths?: SensorPath[] }).required_sensor_paths ?? [], (req as { optional_sensor_paths?: SensorPath[] }).optional_sensor_paths ?? [], hierarchy.root, codeMap, rowsByCode, kpi.calcOptionality, undefined, (req as { auto_sensor_alternatives?: { label: string; options: { label: string; sensors: string[] }[] }[] }).auto_sensor_alternatives);
      const nonEmpty = gs.filter((g) => g.status !== "no_data");
      // Check whether any required attrs belong to levels absent from the hierarchy.
      // missing_element_sensor_paths covers instance mode; req.required filtered against
      // availableLevels covers fallback mode (where those paths stay in required_sensor_paths).
      const hasAbsentRequired =
        ((req as { missing_element_sensor_paths?: unknown[] }).missing_element_sensor_paths?.length ?? 0) > 0 ||
        (req.required as string[] ?? []).some((l: string) => !availableLevels.has(l.toLowerCase()));
      let status: Status;
      if (nonEmpty.length === 0) status = hasAbsentRequired ? "insufficient" : "no_data";
      else if (nonEmpty.every((g) => g.status === "ready")) status = hasAbsentRequired ? "partial" : "ready";
      else if (nonEmpty.some((g) => g.status === "ready" || g.status === "partial")) status = "partial";
      else status = "insufficient";
      map.set(calcName, status);
    }
    return map;
  }, [allCalcs, kpi.calcRequirements, hierarchy.root, codeMap, rowsByCode, kpi.calcOptionality, overrideMap, availableLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  const mandatoryCalcsSet = useMemo(
    () => new Set(kpi.packages.flatMap((p) => p.mandatory_calcs ?? [])),
    [kpi.packages]
  );

  const activeReq = activeCalc ? (kpi.calcRequirements[activeCalc] ?? { required: [], optional: [], required_sensor_paths: [], optional_sensor_paths: [], unresolvable_sensor_paths: [] }) : { required: [], optional: [], required_sensor_paths: [], optional_sensor_paths: [], unresolvable_sensor_paths: [] };
  const missingLevels = useMemo(() => {
    const required = Array.from(new Set((activeReq.required ?? []).filter((level) => !availableLevels.has(level.toLowerCase()))));
    const optional = Array.from(new Set((activeReq.optional ?? []).filter((level) => !availableLevels.has(level.toLowerCase()))));
    // When the calc's own output level is absent from the hierarchy, _collect's outer loop
    // never fires so req_paths is empty and activeReq.required is []. Detect this by checking
    // outputLevelSet directly — any output level not in availableLevels is also "missing".
    const outputMissing = required.length === 0 && (activeReq.required ?? []).length === 0
      ? Array.from(outputLevelSet).filter((l) => !availableLevels.has(l))
      : [];
    return { required: [...required, ...outputMissing], optional };
  }, [activeReq, availableLevels, outputLevelSet]);
  const hasMissingLevels = missingLevels.required.length > 0 || missingLevels.optional.length > 0;

  const absentGroups = useMemo(() => {
    const byLevel = new Map<string, { attrs: Set<string>; isOptional: boolean }>();

    // Source 1: missing_element_sensor_paths — instance mode, level exists in config but has no elements
    for (const p of (activeReq.missing_element_sensor_paths ?? []) as { attr: string; level: string; path: string }[]) {
      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isOptional: false });
      byLevel.get(p.level)!.attrs.add(p.attr);
    }

    // Source 2: required/optional sensor paths whose level is absent from the hierarchy
    // Covers fallback mode (no sensor mapping) where missing_element_sensor_paths is always empty.
    for (const p of (activeReq.required_sensor_paths ?? []) as { attr: string; level: string }[]) {
      if (!missingLevels.required.some((l) => l === p.level)) continue;
      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isOptional: false });
      byLevel.get(p.level)!.attrs.add(p.attr);
    }
    for (const p of (activeReq.optional_sensor_paths ?? []) as { attr: string; level: string }[]) {
      if (!missingLevels.optional.some((l) => l === p.level)) continue;
      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isOptional: true });
      byLevel.get(p.level)!.attrs.add(p.attr);
    }

    // Source 3: optional_missing_sensor_paths — blueprint endpoints at levels absent
    // from the config, reached only via formula-optional paths. Informational only:
    // marked optional so they don't degrade calc status (see calcStatus, which keys
    // hasAbsentRequired on missing_element_sensor_paths, not this field).
    for (const p of (activeReq.optional_missing_sensor_paths ?? []) as { attr: string; level: string; path: string }[]) {
      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isOptional: true });
      byLevel.get(p.level)!.attrs.add(p.attr);
    }

    return Array.from(byLevel.entries()).map(([level, { attrs, isOptional }]): LevelGroup => ({
      level,
      elementCode: "",
      elementName: level,
      elementPath: "",
      attrs: Array.from(attrs).map((attribute) => ({
        attribute,
        mapped: false,
        via: "unmapped" as const,
      })),
      status: "insufficient",
      isOptional,
      isAbsent: true,
    }));
  }, [activeReq.missing_element_sensor_paths, activeReq.optional_missing_sensor_paths, activeReq.required_sensor_paths, activeReq.optional_sensor_paths, missingLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  const mandatoryReadyCount = useMemo(
    () => Array.from(mandatoryCalcsSet).filter((c) => calcStatus.get(c) === "ready").length,
    [mandatoryCalcsSet, calcStatus]
  );
  const mandatoryTotal = mandatoryCalcsSet.size;
  const mandatoryFulfilled = mandatoryTotal === 0 || mandatoryReadyCount === mandatoryTotal;

  useEffect(() => {
    setMandatoryKpiPackageStatus({
      fulfilled: mandatoryFulfilled,
      readyCount: mandatoryReadyCount,
      total: mandatoryTotal,
    });
  }, [mandatoryFulfilled, mandatoryReadyCount, mandatoryTotal, setMandatoryKpiPackageStatus]);

  // Publish the per-calc status so other views (Model Config attribute readiness) reflect
  // the same computed status shown here, rather than re-deriving it and diverging.
  useEffect(() => {
    setCalcStatus(Object.fromEntries(calcStatus));
  }, [calcStatus, setCalcStatus]);

  if (kpi.packages.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-text-secondary">
        {packagesLoading ? (
          <>
            <span className="inline-block w-6 h-6 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading KPI packages…</p>
          </>
        ) : (
          <p className="text-sm">No KPI packages found.</p>
        )}
      </div>
    );
  }

  const nonEmptyGroups = groups.filter((g) => g.status !== "no_data");
  const activeStatus: Status = nonEmptyGroups.length === 0 ? "no_data"
    : nonEmptyGroups.every((g) => g.status === "ready") ? "ready"
    : nonEmptyGroups.some((g) => g.status === "partial" || g.status === "ready") ? "partial"
    : "insufficient";

  return (
    <div className="flex flex-col gap-3 h-full">
      {mandatoryTotal > 0 && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium shrink-0",
          mandatoryFulfilled
            ? "border-accent-green text-accent-green bg-surface"
            : "border-accent-orange text-accent-orange bg-surface"
        )}>
          <span className="shrink-0">{mandatoryFulfilled ? "✓" : "⚠"}</span>
          <span className="flex-1">
            {mandatoryFulfilled
              ? `Mandatory KPI Fulfillment: All ${mandatoryTotal} mandatory calc${mandatoryTotal > 1 ? "s" : ""} fully mapped.`
              : `Mandatory KPI Fulfillment: ${mandatoryReadyCount} of ${mandatoryTotal} mandatory calc${mandatoryTotal > 1 ? "s" : ""} fully mapped — Map all mandatory KPI inputs to proceed.`
            }
          </span>
        </div>
      )}
    <div className="flex gap-4 flex-1 min-h-0">
      <div className="w-[300px] shrink-0 border border-border rounded-xl bg-surface overflow-y-auto max-h-[calc(100vh-220px)]">
        {kpi.packages.map((pkg) => (
          <div key={pkg.name}>
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-surface hover:bg-surface-hover sticky top-0 z-10 transition-colors"
              onClick={() => togglePkg(pkg.name)}
            >
              <span className="text-xs font-semibold text-text-primary truncate">{fmtName(pkg.name)}</span>
              <span className={cn("text-[9px] text-text-secondary shrink-0 transition-transform duration-150", openPkgs.has(pkg.name) ? "rotate-90" : "")}>&#9658;</span>
            </button>
            <div className={cn("grid transition-[grid-template-rows] duration-200 ease-in-out", openPkgs.has(pkg.name) ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                {pkg.calcs.map((calcName) => {
                  const st = calcStatus.get(calcName) ?? "no_data";
                  const isActive = calcName === activeCalc;
                  return (
                    <button
                      key={calcName}
                      className={cn("w-full flex items-center gap-2 pl-3 pr-3 py-2 text-left transition-colors duration-150 border-l-2", isActive ? "bg-surface-hover border-accent-blue" : "border-transparent hover:bg-background")}
                      onClick={() => {
                        const prevPkg = kpi.packages.find(p => p.calcs.includes(selected ?? ""))?.name;
                        if (prevPkg && prevPkg !== pkg.name)
                          setOpenPkgs(prev => { const s = new Set(prev); s.delete(prevPkg); s.add(pkg.name); return s; });
                        setSelected(calcName);
                      }}
                    >
                      <StatusDot status={st} />
                      <span className={cn("text-xs font-mono truncate flex-1 transition-colors duration-150", isActive ? "text-accent-blue font-semibold" : "text-text-primary")}>{fmtName(calcName)}</span>
                      {mandatoryCalcsSet.has(calcName) && st !== "ready" && (
                        <span className="text-[9px] text-accent-orange shrink-0" title="Mandatory KPI">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto max-h-[calc(100vh-220px)]">
        {calcRequirementsLoading && (
          <div className={cn("flex items-center gap-2 mb-3 px-3 py-2 rounded text-xs border", reqLoadElapsed >= 15 ? "bg-surface border-accent-yellow text-accent-yellow" : "bg-surface border-accent-blue text-accent-blue")}>
            <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>
              {reqLoadElapsed < 5 ? "Computing dependency graph…" : reqLoadElapsed < 15 ? `Resolving complex calc dependencies… (${reqLoadElapsed}s)` : `Still computing — complex calcs with many intermediate dependencies can take up to 30s. (${reqLoadElapsed}s)`}
            </span>
          </div>
        )}

        {!activeCalc ? (
          <div className="py-16 text-center text-text-secondary text-sm">Select a calc to review its sensor requirements.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-text-primary font-mono">{fmtName(activeCalc)}</h3>
              <StatusBadge status={activeStatus} />
              {(activeReq.required.length > 0 || activeReq.optional.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {activeReq.required.map((l) => (<span key={l} className="text-xs border border-border text-text-primary px-1.5 py-0.5 rounded">{l}</span>))}
                  {activeReq.optional.map((l) => (<span key={l} className="text-xs border border-dashed border-border text-text-secondary px-1.5 py-0.5 rounded">{l}</span>))}
                </div>
              )}
            </div>

            {groups.length === 0 ? (
              (() => {
                if (!hierarchy.root) return <div className="py-12 text-center text-text-secondary text-sm">Build the hierarchy in System Config first.</div>;
                if (calcRequirementsLoading || !hasAnyRequirements) return <div className="py-12 text-center text-text-secondary text-sm">Loading calc dependency requirements…</div>;
                if (activeReq.required.length === 0 && activeReq.optional.length === 0 && missingLevels.required.length === 0) return <div className="py-12 text-center text-text-secondary text-sm">No required levels found — calc blueprint may not have attributes for this calc.</div>;
                // When the calc's own output level is absent, suppress all cards and show the
                // plain "No applicable levels" message — don't show absentGroups here because
                // groups were suppressed to avoid showing cross-referenced sensor cards out of context.
                const allAbsent = missingLevels.required.length === activeReq.required.length && activeReq.required.length > 0;
                if (allAbsent || missingLevels.required.length > 0) {
                  // Build a display-only view of all required attrs grouped by level.
                  // required_sensor_paths has cross-referenced present-level entries; missingLevels
                  // covers the absent output level which the backend never generates paths for.
                  const allDisplayGroups: LevelGroup[] = (() => {
                    const byLevel = new Map<string, { attrs: Set<string>; isAbsent: boolean; isOptional: boolean }>();
                    for (const p of (activeReq.required_sensor_paths ?? []) as { attr: string; level: string }[]) {
                      const absent = !availableLevels.has(p.level.toLowerCase());
                      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isAbsent: absent, isOptional: false });
                      byLevel.get(p.level)!.attrs.add(p.attr);
                    }
                    for (const level of missingLevels.required) {
                      if (!byLevel.has(level)) byLevel.set(level, { attrs: new Set(), isAbsent: true, isOptional: false });
                      else byLevel.get(level)!.isAbsent = true;
                    }
                    for (const level of missingLevels.optional) {
                      if (!byLevel.has(level)) byLevel.set(level, { attrs: new Set(), isAbsent: true, isOptional: true });
                      else { byLevel.get(level)!.isAbsent = true; byLevel.get(level)!.isOptional = true; }
                    }
                    // Blueprint endpoints at absent levels reached only via formula-optional
                    // paths — informational, shown alongside the missing-required view.
                    for (const p of (activeReq.optional_missing_sensor_paths ?? []) as { attr: string; level: string }[]) {
                      if (!byLevel.has(p.level)) byLevel.set(p.level, { attrs: new Set(), isAbsent: true, isOptional: true });
                      byLevel.get(p.level)!.attrs.add(p.attr);
                    }
                    return Array.from(byLevel.entries()).map(([level, { attrs, isAbsent, isOptional }]): LevelGroup => ({
                      level, elementCode: "", elementName: level, elementPath: "",
                      attrs: Array.from(attrs).map((attribute) => ({ attribute, mapped: false, via: "unmapped" as const })),
                      status: "insufficient", isOptional, isAbsent,
                    }));
                  })();
                  return (
                    <div className="flex flex-col gap-4">
                      <div className="rounded-xl border border-accent-orange bg-surface px-5 py-6 text-sm">
                        <p className="font-medium text-accent-orange mb-1">No applicable elements found for this system</p>
                        <p className="text-text-secondary text-xs mb-3">This calc targets elements that are not present in the current system configuration.</p>
                        <div className="flex flex-wrap gap-1.5">
                          {missingLevels.required.map((level) => (<span key={`req-${level}`} className="rounded border border-accent-orange text-accent-orange bg-background px-2 py-0.5 text-xs">{level}</span>))}
                          {missingLevels.optional.map((level) => (<span key={`opt-${level}`} className="rounded border border-dashed border-accent-orange text-accent-orange bg-background px-2 py-0.5 text-xs">{level}</span>))}
                        </div>
                      </div>
                      {allDisplayGroups.length > 0 && (
                        <div className="flex flex-col gap-4 opacity-50 pointer-events-none">
                          {allDisplayGroups.map((g) => (
                            <LevelCard key={`display-${g.level}`} group={g} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                // Only reached when missingLevels is empty — level exists in config but has no
                // element instances (missing_element_sensor_paths, instance mode only).
                if (absentGroups.length > 0) return (
                  <div className="flex flex-col gap-4">
                    {absentGroups.map((g) => (
                      <LevelCard key={`absent-${g.level}`} group={g} />
                    ))}
                  </div>
                );
                return <div className="py-12 text-center text-text-secondary text-sm">No hierarchy instances found at the required levels.</div>;
              })()
            ) : (
              <>
                {hasMissingLevels && (
                  <div className="mb-4 rounded-xl border border-accent-yellow bg-surface px-4 py-3 text-xs text-accent-yellow">
                    <p className="font-medium">Some elements required by this calc are not present in the configured system.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {missingLevels.required.map((level) => (<span key={`req-${level}`} className="rounded border border-accent-yellow bg-surface px-2 py-0.5">Missing required: {level}</span>))}
                      {missingLevels.optional.map((level) => (<span key={`opt-${level}`} className="rounded border border-dashed border-accent-yellow bg-surface px-2 py-0.5">Missing optional: {level}</span>))}
                    </div>
                  </div>
                )}
                {(activeReq.unresolvable_sensor_paths?.length ?? 0) > 0 && (
                  <div className="mb-4 rounded-xl border border-accent-orange bg-surface px-4 py-3 text-xs">
                    <p className="font-medium text-accent-orange mb-1">Sensor references with unresolvable hierarchy levels</p>
                    <p className="text-text-secondary mb-2">These formula inputs reference hierarchy nodes not defined in the calc blueprint. Add the missing levels to the blueprint to enable full sensor mapping.</p>
                    <div className="flex flex-col gap-1">
                      {(activeReq.unresolvable_sensor_paths ?? []).map((path) => (
                        <div key={path} className="flex items-center gap-2">
                          <span className="font-mono text-text-primary bg-background px-2 py-0.5 rounded flex-1 min-w-0 truncate">{path}</span>
                          <span className="text-accent-orange shrink-0">— level not in system config</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div className="flex flex-col gap-4">
                {pairedGroups.paired.map(({ parent, children }) => (
                  <InstanceBox
                    key={`${parent.elementPath}-${parent.elementCode}`}
                    group={parent}
                    calcName={activeCalc}
                    overrideRow={instanceOverrideMap.get(instanceOverrideKey(parent.elementPath, parent.elementCode, activeCalc))}
                    isBusy={busyKey === instanceOverrideKey(parent.elementPath, parent.elementCode, activeCalc)}
                    onToggle={(enabled) => handleToggle(parent.elementPath, parent.elementCode, activeCalc, enabled)}
                    onRowChange={handleRowChange}
                  >
                    {children.length > 0 && children.map((child) => (
                      <LevelCard key={`${child.elementPath}-${child.elementCode}`} group={child} onRowChange={handleRowChange} />
                    ))}
                  </InstanceBox>
                ))}
                {pairedGroups.orphans.map((g) => (
                  <LevelCard key={`${g.elementPath}-${g.level}-${g.elementCode}`} group={g} onRowChange={handleRowChange} />
                ))}
                {absentGroups.map((g) => (
                  <LevelCard key={`absent-${g.level}`} group={g} />
                ))}
              </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
