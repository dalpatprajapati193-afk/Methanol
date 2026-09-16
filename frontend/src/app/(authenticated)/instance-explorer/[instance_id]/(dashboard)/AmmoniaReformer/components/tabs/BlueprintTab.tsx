"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  blueprintAtom,
  instanceIdAtom,
  savedBlueprintsAtom,
  uploadBlueprintAtom,
  createBlueprintAtom,
  updateAttributesAtom,
  updateUomAtom,
  updateConstraintsAtom,
  updateQuestionsAtom,
  refreshSavedBlueprintsAtom,
  saveCurrentBlueprintAtom,
  loadSavedBlueprintAtom,
} from "../../store/Index";
import { getFileSystemsAction } from "../../actions/Index";
import DataTable from "../shared/DataTable";
import FileUpload from "../shared/FileUpload";
import ValidationAlert from "../shared/ValidationAlert";
import type { AttributeRow, UomRow, ConstraintRow, QuestionRow } from "../../types/Index";
import { formatSystemName } from "../../Constants";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type SubTab = "attributes" | "uom" | "constraints" | "questions";

// ── Tree builder ───────────────────────────────────────────────────────────────

interface ScopeNode {
  path: string;
  label: string;
  elementType: string;
  attributes: { idx: number; row: AttributeRow }[];
  children: ScopeNode[];
}

function normPath(raw: string): string {
  return raw.split(">").map((s) => s.trim()).filter(Boolean).join(" > ");
}

function buildScopeTree(rows: AttributeRow[]): ScopeNode[] {
  const nodeMap = new Map<string, ScopeNode>();

  const touch = (npath: string): ScopeNode => {
    if (!nodeMap.has(npath)) {
      const segs = npath.split(" > ");
      nodeMap.set(npath, {
        path: npath,
        label: segs[segs.length - 1],
        elementType: "",
        attributes: [],
        children: [],
      });
    }
    return nodeMap.get(npath)!;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = String(row["Element Path"] ?? "").trim();
    if (!raw) continue;

    const segs = raw.split(">").map((s) => s.trim()).filter(Boolean);
    if (segs.length === 0) continue;

    for (let j = 1; j <= segs.length; j++) {
      touch(segs.slice(0, j).join(" > "));
    }

    const leaf = nodeMap.get(segs.join(" > "))!;
    if (!leaf.elementType && row["Element Type"]) {
      leaf.elementType = String(row["Element Type"]).trim();
    }
    const attrName = String(row["Attribute Name"] ?? "").trim();
    const attrType = String(row["Attribute Type"] ?? "").trim();
    const uom = String(row["UOM"] ?? "").trim();
    if (attrName || attrType || uom) {
      leaf.attributes.push({ idx: i, row });
    }
  }

  const isChild = new Set<ScopeNode>();
  for (const [path, node] of nodeMap) {
    const segs = path.split(" > ");
    if (segs.length < 2) continue;
    const parentPath = segs.slice(0, -1).join(" > ");
    const parent = nodeMap.get(parentPath);
    if (parent && !parent.children.includes(node)) {
      parent.children.push(node);
      isChild.add(node);
    }
  }

  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
  }

  return Array.from(nodeMap.values())
    .filter((n) => !isChild.has(n))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Attribute type badge ───────────────────────────────────────────────────────

function AttrTypeBadge({ type }: { type: string }) {
  if (type === "Sensor Tag") return (
    <span className="px-1.5 py-0.5 bg-surface text-accent-blue text-xs rounded font-medium border border-accent-blue">Sensor</span>
  );
  if (type === "Constant") return (
    <span className="px-1.5 py-0.5 bg-surface text-accent-yellow text-xs rounded font-medium border border-accent-yellow">Const</span>
  );
  return null;
}

// ── Inline attribute row ───────────────────────────────────────────────────────

function AttrRow({
  attr,
  onSave,
  onDelete,
}: {
  attr: { idx: number; row: AttributeRow };
  onSave: (idx: number, updated: Partial<AttributeRow>) => void;
  onDelete: (idx: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(String(attr.row["Attribute Name"] ?? ""));
  const [type, setType] = useState(String(attr.row["Attribute Type"] ?? ""));
  const [uom, setUom] = useState(String(attr.row["UOM"] ?? ""));

  const save = () => {
    onSave(attr.idx, { "Attribute Name": name, "Attribute Type": type as AttributeRow["Attribute Type"], "UOM": uom });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-surface-hover rounded">
        <input
          autoFocus
          className="flex-1 border border-accent-blue rounded px-1.5 py-1 text-xs bg-surface"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Attribute name"
        />
        <select
          className="border border-accent-blue rounded px-1.5 py-1 text-xs bg-surface"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">—</option>
          <option value="Sensor Tag">Sensor Tag</option>
          <option value="Constant">Constant</option>
        </select>
        <input
          className="w-16 border border-accent-blue rounded px-1.5 py-1 text-xs bg-surface"
          value={uom}
          onChange={(e) => setUom(e.target.value)}
          placeholder="UOM"
        />
        <button onClick={save} className="text-xs text-accent-blue font-medium hover:text-accent-blue">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-1 px-2 hover:bg-surface-hover rounded cursor-pointer group"
      onClick={() => setEditing(true)}
    >
      <span className="flex-1 text-xs text-text-primary truncate">{attr.row["Attribute Name"] || <em className="text-text-secondary">unnamed</em>}</span>
      <AttrTypeBadge type={String(attr.row["Attribute Type"] ?? "")} />
      {attr.row["UOM"] && (
        <span className="text-xs text-text-secondary shrink-0">{String(attr.row["UOM"])}</span>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-accent-red text-xs px-1"
        onClick={(e) => { e.stopPropagation(); onDelete(attr.idx); }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Add attribute inline form ──────────────────────────────────────────────────

function AddAttrForm({ onAdd, onCancel }: {
  onAdd: (name: string, type: string, uom: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [uom, setUom] = useState("");
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 bg-surface rounded border border-accent-green">
      <input
        autoFocus
        className="flex-1 border border-accent-green rounded px-1.5 py-1 text-xs bg-surface"
        placeholder="Attribute name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(name, type, uom); if (e.key === "Escape") onCancel(); }}
      />
      <select
        className="border border-accent-green rounded px-1.5 py-1 text-xs bg-surface"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">—</option>
        <option value="Sensor Tag">Sensor Tag</option>
        <option value="Constant">Constant</option>
      </select>
      <input
        className="w-16 border border-accent-green rounded px-1.5 py-1 text-xs bg-surface"
        placeholder="UOM"
        value={uom}
        onChange={(e) => setUom(e.target.value)}
      />
      <button
        onClick={() => onAdd(name, type, uom)}
        className="text-xs text-accent-green font-medium hover:text-accent-green"
      >
        Add
      </button>
      <button onClick={onCancel} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
    </div>
  );
}

// ── Silent Toggle ──────────────────────────────────────────────────────────────

function SilentToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus:outline-none",
        value ? "bg-accent-yellow" : "bg-surface-hover"
      )}
      title={value ? "Silent: on (auto-created)" : "Silent: off"}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 mt-0.5 rounded-full bg-surface shadow transition-transform duration-150",
          value ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function MinRequiredCounter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-6 h-6 rounded border border-border text-text-secondary hover:bg-surface-hover text-xs flex items-center justify-center"
      >
        −
      </button>
      <span className="w-5 text-center text-xs font-semibold text-text-primary">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-6 h-6 rounded border border-border text-text-secondary hover:bg-surface-hover text-xs flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

// ── Constraints Panel ─────────────────────────────────────────────────────────

function ConstraintsPanel({
  rows,
  onChange,
  onAdd,
  onDelete,
}: {
  rows: ConstraintRow[];
  onChange: (idx: number, updated: Partial<ConstraintRow>) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
      <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-2 items-center px-3 py-1.5 bg-background border border-border rounded text-xs font-semibold text-text-secondary sticky top-0 z-10">
        <span>Parent Level / Path</span>
        <span>Child Level</span>
        <span className="text-center w-24">Min Required</span>
        <span className="text-center w-16">Silent</span>
        <span className="text-center w-20">Suffix</span>
        <span>Notes</span>
        <span />
      </div>

      {rows.length === 0 && (
        <div className="py-8 text-center text-text-secondary text-sm">
          No constraints defined.
        </div>
      )}

      {rows.map((row, idx) => {
        const parentPath = String(row["Parent Element Path"] ?? "").trim();
        const parentLevel = String(row["Parent Level"] ?? "").trim();
        const childLevel = String(row["Child Level"] ?? "").trim();
        const minReq = Number(row["Min Required"] ?? 0);
        const silent = Number(row["Silent"] ?? 0) === 1;
        const suffix = String(row["Suffix Style"] ?? "alpha");
        const notes = String(row["Notes"] ?? "");
        const parentLabel = parentPath || parentLevel || "—";
        const isPathSpecific = !!parentPath;

        return (
          <div
            key={idx}
            className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-2 items-center px-3 py-2 border border-border rounded bg-surface hover:bg-surface-hover"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate" title={parentLabel}>
                {parentLabel}
              </p>
              {isPathSpecific && parentLevel && (
                <p className="text-xs text-text-secondary truncate">{parentLevel}</p>
              )}
              {isPathSpecific && (
                <span className="text-xs text-accent-blue font-medium">path-specific</span>
              )}
            </div>

            <input
              className="border border-transparent hover:border-border focus:border-accent-blue rounded px-1.5 py-1 text-xs text-text-primary bg-transparent focus:bg-surface w-full"
              value={childLevel}
              onChange={(e) => onChange(idx, { "Child Level": e.target.value })}
              placeholder="Child level"
            />

            <div className="w-24 flex justify-center">
              <MinRequiredCounter
                value={minReq}
                onChange={(v) => onChange(idx, { "Min Required": v })}
              />
            </div>

            <div className="w-16 flex justify-center">
              <SilentToggle
                value={silent}
                onChange={(v) => onChange(idx, { Silent: v ? 1 : 0 })}
              />
            </div>

            <div className="w-20">
              <select
                className="border border-border rounded px-1.5 py-1 text-xs text-text-secondary w-full bg-surface"
                value={suffix}
                onChange={(e) => onChange(idx, { "Suffix Style": e.target.value as "alpha" | "num" })}
              >
                <option value="alpha">A, B, C…</option>
                <option value="num">1, 2, 3…</option>
              </select>
            </div>

            <input
              className="border border-transparent hover:border-border focus:border-accent-blue rounded px-1.5 py-1 text-xs text-text-secondary bg-transparent focus:bg-surface w-full"
              value={notes}
              onChange={(e) => onChange(idx, { Notes: e.target.value })}
              placeholder="Notes"
            />

            <button
              onClick={() => onDelete(idx)}
              className="text-text-secondary hover:text-accent-red text-xs px-1"
            >
              ✕
            </button>
          </div>
        );
      })}

      <button
        onClick={onAdd}
        className="text-xs text-accent-blue hover:text-accent-blue font-medium px-1 pt-1"
      >
        + Add constraint
      </button>
    </div>
  );
}

// ── Scope Box ─────────────────────────────────────────────────────────────────

function ScopeBox({
  node,
  depth,
  allRows,
  onRowsChange,
  systemName,
  parentPath,
  parentElementType,
  constraints,
  onConstraintsChange,
}: {
  node: ScopeNode;
  depth: number;
  allRows: AttributeRow[];
  onRowsChange: (rows: AttributeRow[]) => void;
  systemName?: string;
  parentPath?: string;
  parentElementType?: string;
  constraints: ConstraintRow[];
  onConstraintsChange: (rows: ConstraintRow[]) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editOpen, setEditOpen] = useState(false);
  const [addingAttr, setAddingAttr] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childType, setChildType] = useState("");
  const [editName, setEditName] = useState("");
  const [editElementType, setEditElementType] = useState("");

  const totalAttrs = node.attributes.length;
  const totalDescendants = (function count(n: ScopeNode): number {
    return n.children.reduce((s, c) => s + count(c), n.children.length);
  })(node);

  const nodeType = node.elementType || node.label;
  const constraintIdx = depth > 0
    ? constraints.findIndex((c) => {
        const cChild = String(c["Child Level"] ?? "").trim();
        const cPath = String(c["Parent Element Path"] ?? "").trim();
        const cLevel = String(c["Parent Level"] ?? "").trim();
        if (cChild !== nodeType) return false;
        if (parentPath && cPath === parentPath) return true;
        if (parentElementType && cLevel === parentElementType) return true;
        return false;
      })
    : -1;

  const constraint = constraintIdx >= 0 ? constraints[constraintIdx] : null;
  const minReq = Math.max(0, Number(constraint?.["Min Required"] ?? 0));
  const silent = Number(constraint?.["Silent"] ?? 0) === 1;
  const suffix = String(constraint?.["Suffix Style"] ?? "alpha");

  const updateConstraint = (updates: Partial<ConstraintRow>) => {
    if (constraintIdx >= 0) {
      const rows = [...constraints];
      rows[constraintIdx] = { ...rows[constraintIdx], ...updates };
      onConstraintsChange(rows);
    } else {
      onConstraintsChange([...constraints, {
        "Parent Element Path": parentPath ?? "",
        "Parent Level": parentElementType ?? "",
        "Child Level": nodeType,
        "Min Required": 0,
        "Silent": 0,
        "Suffix Style": "alpha",
        "Notes": "",
        ...updates,
      } as ConstraintRow]);
    }
  };

  const openEdit = () => {
    setEditName(node.label);
    setEditElementType(node.elementType || node.label);
    setExpanded(true);
    setEditOpen(true);
  };

  const handleRename = () => {
    const newLabel = editName.trim();
    const newType = editElementType.trim() || newLabel;
    if (!newLabel) return;

    const oldPath = node.path;
    const segs = oldPath.split(" > ");
    segs[segs.length - 1] = newLabel;
    const newPath = segs.join(" > ");

    const updatedRows = allRows.map((r) => {
      const ep = String(r["Element Path"] ?? "").trim();
      let newEp = ep;
      if (ep === oldPath) newEp = newPath;
      else if (ep.startsWith(oldPath + " > ")) newEp = newPath + ep.slice(oldPath.length);

      const et = String(r["Element Type"] ?? "").trim();
      const pet = String(r["Parent El. Type"] ?? "").trim();

      return {
        ...r,
        "Element Path": newEp,
        "Element Type": et === (node.elementType || node.label) && ep === oldPath ? newType : r["Element Type"],
        "Parent El. Type": pet === (node.elementType || node.label) ? newType : r["Parent El. Type"],
      };
    });

    const updatedCons = constraints.map((c) => {
      const pep = String(c["Parent Element Path"] ?? "").trim();
      const pl = String(c["Parent Level"] ?? "").trim();
      const cl = String(c["Child Level"] ?? "").trim();
      return {
        ...c,
        "Parent Element Path": pep === oldPath ? newPath
          : pep.startsWith(oldPath + " > ") ? newPath + pep.slice(oldPath.length)
          : pep,
        "Parent Level": pl === nodeType ? newType : pl,
        "Child Level": cl === nodeType ? newType : cl,
      };
    });

    onRowsChange(updatedRows);
    onConstraintsChange(updatedCons);
    setEditOpen(false);
  };

  const handleAttrSave = (idx: number, updated: Partial<AttributeRow>) =>
    onRowsChange(allRows.map((r, i) => (i === idx ? { ...r, ...updated } : r)));

  const handleAttrDelete = (idx: number) =>
    onRowsChange(allRows.filter((_, i) => i !== idx));

  const handleAttrAdd = (name: string, type: string, uom: string) => {
    if (!name.trim()) return;
    const meta = allRows.find((r) => String(r["Element Path"] ?? "").trim() === node.path) ?? {};
    onRowsChange([...allRows, {
      "Plant Name": meta["Plant Name"] ?? "",
      "System Name": meta["System Name"] ?? "",
      "Element Type": node.elementType || meta["Element Type"] || "",
      "Parent El. Type": meta["Parent El. Type"] ?? "",
      "Attribute Name": name.trim(),
      "Attribute Type": type as AttributeRow["Attribute Type"],
      "UOM": uom,
      "Element Path": node.path,
    }]);
    setAddingAttr(false);
  };

  const handleChildAdd = () => {
    if (!childName.trim()) return;
    const meta = allRows.find((r) => String(r["Element Path"] ?? "").trim() === node.path) ?? {};
    onRowsChange([...allRows, {
      "Plant Name": meta["Plant Name"] ?? "",
      "System Name": meta["System Name"] ?? "",
      "Element Type": childType.trim() || childName.trim(),
      "Parent El. Type": node.elementType || node.label,
      "Attribute Name": "", "Attribute Type": "", "UOM": "",
      "Element Path": `${node.path} > ${childName.trim()}`,
    }]);
    setChildName(""); setChildType(""); setAddingChild(false);
  };

  const handleScopeDelete = () => {
    if (!confirm(`Delete scope "${node.label}" and all its attributes/children?`)) return;
    onRowsChange(allRows.filter((r) => {
      const ep = String(r["Element Path"] ?? "").trim();
      return ep !== node.path && !ep.startsWith(node.path + " > ");
    }));
  };

  const borders = ["border-accent-blue", "border-accent-green", "border-accent-yellow", "border-accent-orange", "border-border"];
  const headers = ["bg-surface-hover", "bg-surface-hover", "bg-surface-hover", "bg-surface-hover", "bg-background"];
  const bc = borders[depth % borders.length];
  const hc = headers[depth % headers.length];

  return (
    <div className={cn("border rounded-lg overflow-hidden", bc)}>
      <div
        className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer select-none", hc)}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-text-secondary text-xs w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
        <span className="text-sm font-semibold text-text-primary">
          {node.elementType === "System" && node.label === "System" && systemName ? formatSystemName(systemName) : node.label}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {totalAttrs > 0 && (
            <span className="text-xs text-text-secondary">{totalAttrs} attr{totalAttrs !== 1 ? "s" : ""}</span>
          )}
          {totalDescendants > 0 && (
            <span className="text-xs text-text-secondary">{totalDescendants} child{totalDescendants !== 1 ? "ren" : ""}</span>
          )}

          <button
            className={cn(
              "text-xs px-2 py-0.5 rounded border transition-colors",
              editOpen
                ? "border-accent-blue bg-surface-hover text-accent-blue"
                : "border-border text-text-secondary hover:bg-surface hover:text-text-primary"
            )}
            title="Edit level settings"
            onClick={(e) => { e.stopPropagation(); editOpen ? setEditOpen(false) : openEdit(); }}
          >
            ✎ Edit
          </button>

          <button
            className="text-xs text-accent-blue hover:text-accent-blue px-1"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setAddingAttr(true); }}
          >+ Attr</button>
          <button
            className="text-xs text-accent-green hover:text-accent-green px-1"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setAddingChild(true); }}
          >+ Child</button>
          <button
            className="text-xs text-text-secondary hover:text-accent-red px-1"
            onClick={(e) => { e.stopPropagation(); handleScopeDelete(); }}
          >✕</button>

          {node.elementType && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-surface text-text-secondary border border-border">
              {node.elementType}
            </span>
          )}
        </div>
      </div>

      {editOpen && (
        <div
          className="px-4 py-3 bg-surface border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Level name</label>
              <input
                autoFocus
                className="w-full border border-border rounded px-2 py-1.5 text-sm focus:border-accent-blue focus:outline-none bg-surface"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditOpen(false); }}
                placeholder="Level name"
              />
              <p className="text-xs text-text-secondary mt-0.5">Updates all path references in the blueprint.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Element type</label>
              <input
                className="w-full border border-border rounded px-2 py-1.5 text-sm focus:border-accent-blue focus:outline-none bg-surface"
                value={editElementType}
                onChange={(e) => setEditElementType(e.target.value)}
                placeholder="Element type (defaults to name)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Min required instances
              </label>
              <div className="flex items-center gap-1">
                <button
                  className="w-7 h-7 rounded border border-border text-text-secondary hover:bg-surface-hover text-sm flex items-center justify-center"
                  onClick={() => updateConstraint({ "Min Required": Math.max(0, minReq - 1) })}
                >−</button>
                <input
                  type="number"
                  min={0}
                  className="w-12 h-7 border border-border rounded text-center text-sm font-semibold text-text-primary focus:border-accent-blue focus:outline-none bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={minReq}
                  onChange={(e) => updateConstraint({ "Min Required": Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
                <button
                  className="w-7 h-7 rounded border border-border text-text-secondary hover:bg-surface-hover text-sm flex items-center justify-center"
                  onClick={() => updateConstraint({ "Min Required": minReq + 1 })}
                >+</button>
                <span className="text-xs text-text-secondary ml-1">
                  {minReq === 0 ? "optional" : `${minReq} required`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Count / naming type</label>
                <div className="flex gap-3">
                  {(["alpha", "num"] as const).map((val) => (
                    <label key={val} className="flex items-center gap-1.5 cursor-pointer text-sm text-text-primary">
                      <input
                        type="radio"
                        name={`suffix-${node.path}`}
                        checked={suffix === val}
                        onChange={() => updateConstraint({ "Suffix Style": val })}
                        className="accent-accent-blue"
                      />
                      {val === "alpha" ? "A, B, C…" : "1, 2, 3…"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-text-secondary">Silent</label>
                <SilentToggle
                  value={silent}
                  onChange={(v) => updateConstraint({ Silent: v ? 1 : 0 })}
                />
                <span className="text-xs text-text-secondary">
                  {silent ? "Auto-created (no wizard prompt)" : "User configures count"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-3 pt-2 border-t border-border">
            <button
              className="px-3 py-1.5 bg-accent-blue text-surface text-xs font-medium rounded hover:bg-accent-blue"
              onClick={handleRename}
            >
              Save changes
            </button>
            <button
              className="px-3 py-1.5 border border-border text-xs text-text-secondary rounded hover:bg-surface-hover"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-3 py-2 space-y-1 bg-surface">
          {node.attributes.map((attr) => (
            <AttrRow key={attr.idx} attr={attr} onSave={handleAttrSave} onDelete={handleAttrDelete} />
          ))}

          {addingAttr && (
            <AddAttrForm onAdd={handleAttrAdd} onCancel={() => setAddingAttr(false)} />
          )}

          {node.attributes.length === 0 && !addingAttr && node.children.length === 0 && !addingChild && (
            <p className="text-xs text-text-secondary italic py-1 px-2">No attributes — click + Attr to add one.</p>
          )}

          {node.children.length > 0 && (
            <div className="space-y-2 pt-1">
              {node.children.map((child) => (
                <ScopeBox
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  allRows={allRows}
                  onRowsChange={onRowsChange}
                  systemName={systemName}
                  parentPath={node.path}
                  parentElementType={node.elementType || node.label}
                  constraints={constraints}
                  onConstraintsChange={onConstraintsChange}
                />
              ))}
            </div>
          )}

          {addingChild && (
            <div className="flex items-center gap-2 py-1.5 px-2 bg-background rounded border border-border mt-1">
              <input
                autoFocus
                className="flex-1 border border-border rounded px-1.5 py-1 text-xs bg-surface"
                placeholder="Child scope label"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleChildAdd(); if (e.key === "Escape") setAddingChild(false); }}
              />
              <input
                className="w-32 border border-border rounded px-1.5 py-1 text-xs bg-surface"
                placeholder="Element Type (opt.)"
                value={childType}
                onChange={(e) => setChildType(e.target.value)}
              />
              <button onClick={handleChildAdd} className="text-xs text-accent-blue font-medium hover:text-accent-blue">Add</button>
              <button onClick={() => setAddingChild(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add root scope form ────────────────────────────────────────────────────────

function AddRootScopeForm({
  onAdd,
  onCancel,
  plantName: _plantName,
  systemName: _systemName,
}: {
  onAdd: (label: string, elementType: string) => void;
  onCancel: () => void;
  plantName: string;
  systemName: string;
}) {
  const [label, setLabel] = useState("");
  const [elementType, setElementType] = useState("");
  return (
    <div className="border border-dashed border-border rounded-lg px-3 py-2 flex items-center gap-2 bg-background">
      <input
        autoFocus
        className="flex-1 border border-border rounded px-2 py-1 text-sm bg-surface"
        placeholder="Top-level scope label (e.g. Primary Reformer)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(label, elementType); if (e.key === "Escape") onCancel(); }}
      />
      <input
        className="w-36 border border-border rounded px-2 py-1 text-sm bg-surface"
        placeholder="Element Type (opt.)"
        value={elementType}
        onChange={(e) => setElementType(e.target.value)}
      />
      <button onClick={() => onAdd(label, elementType)} className="px-3 py-1 text-sm bg-accent-blue text-surface rounded hover:bg-accent-blue">Add</button>
      <button onClick={onCancel} className="text-sm text-text-secondary hover:text-text-primary">Cancel</button>
    </div>
  );
}

// ── Main BlueprintTab ──────────────────────────────────────────────────────────

export default function BlueprintTab() {
  const [subTab, setSubTab] = useState<SubTab>("attributes");
  const [loading, setLoading] = useState(false);
  const [addingRoot, setAddingRoot] = useState(false);
  const [addingSystem, setAddingSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [fileSystems, setFileSystems] = useState<{ pathSegment: string; systemName: string }[]>([]);
  const [loadingFileSystems, setLoadingFileSystems] = useState(false);

  const blueprint = useAtomValue(blueprintAtom);
  const instanceId = useAtomValue(instanceIdAtom);
  const savedBlueprints = useAtomValue(savedBlueprintsAtom);
  const uploadBlueprint = useSetAtom(uploadBlueprintAtom);
  const createBlueprint = useSetAtom(createBlueprintAtom);
  const updateAttributes = useSetAtom(updateAttributesAtom);
  const updateUom = useSetAtom(updateUomAtom);
  const updateConstraints = useSetAtom(updateConstraintsAtom);
  const updateQuestions = useSetAtom(updateQuestionsAtom);
  const refreshSavedBlueprints = useSetAtom(refreshSavedBlueprintsAtom);
  const saveCurrentBlueprint = useSetAtom(saveCurrentBlueprintAtom);
  const loadSavedBlueprint = useSetAtom(loadSavedBlueprintAtom);

  useEffect(() => {
    refreshSavedBlueprints();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSaved || !instanceId) { setFileSystems([]); return; }
    setLoadingFileSystems(true);
    getFileSystemsAction(instanceId, selectedSaved)
      .then((res) => setFileSystems(res.systems))
      .catch(() => setFileSystems([]))
      .finally(() => setLoadingFileSystems(false));
  }, [selectedSaved, instanceId]);

  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  }, []);

  const tree = buildScopeTree(blueprint.attributes);
  const plantName = String(blueprint.attributes[0]?.["Plant Name"] ?? "");
  const systemName = String(blueprint.attributes[0]?.["System Name"] ?? "System");

  const handleRowsChange = useCallback(
    (rows: AttributeRow[]) => { wrap(() => updateAttributes(rows)); },
    [wrap, updateAttributes]
  );

  const handleAddRoot = (label: string, elementType: string) => {
    if (!label.trim()) return;
    const rootPath = `${systemName} > ${label.trim()}`;
    const newRow: AttributeRow = {
      "Plant Name": plantName,
      "System Name": systemName,
      "Element Type": elementType.trim() || label.trim(),
      "Parent El. Type": "System",
      "Attribute Name": "",
      "Attribute Type": "",
      "UOM": "",
      "Element Path": rootPath,
    };
    handleRowsChange([...blueprint.attributes, newRow]);
    setAddingRoot(false);
  };

  const handleAddSystem = () => {
    const name = newSystemName.trim();
    if (!name) return;
    const newRow: AttributeRow = {
      "Plant Name": plantName,
      "System Name": name,
      "Element Type": "System",
      "Parent El. Type": "",
      "Attribute Name": "",
      "Attribute Type": "",
      "UOM": "",
      "Element Path": name,
    };
    handleRowsChange([...blueprint.attributes, newRow]);
    setNewSystemName("");
    setAddingSystem(false);
  };

  // Two-column attribute→category map. Exact, case-sensitive Attribute Name; Category is a
  // UOM category from configurations.unit_of_measurement — the selectable units are resolved
  // from that catalog by category. Mirrors UOM_COLUMNS in BlueprintSheets.py.
  const uomColumns = [
    { key: "Attribute", header: "Attribute", editable: true, width: "220px" },
    { key: "Category", header: "Category", editable: true },
  ];
  const questionsColumns = [
    { key: "Element Level", header: "Level", editable: true, width: "110px" },
    { key: "Question ID", header: "ID", editable: true, width: "110px" },
    { key: "Step", header: "Step", editable: true, type: "number" as const, width: "50px" },
    { key: "Question Text", header: "Question", editable: true },
    { key: "Type", header: "Type", editable: true, type: "select" as const, options: ["text", "count", "boolean", "select", "number"], width: "80px" },
    { key: "Options", header: "Options", editable: true, width: "130px" },
    { key: "Default", header: "Default", editable: true, width: "70px" },
    { key: "Required", header: "Req.", editable: true, type: "select" as const, options: ["0", "1"], width: "50px" },
    { key: "Show If", header: "Show If", editable: true, width: "130px" },
    { key: "Effect", header: "Effect", editable: true, width: "160px" },
    { key: "Help Text", header: "Help", editable: true, width: "140px" },
    { key: "Tile Order", header: "Order", editable: true, type: "number" as const, width: "60px" },
  ];

  const subTabs: { key: SubTab; label: string; count: number }[] = [
    { key: "attributes", label: "Attributes", count: blueprint.attributes.length },
    { key: "uom", label: "UOM Reference", count: blueprint.uom.length },
    { key: "constraints", label: "Constraints", count: blueprint.constraints.length },
    { key: "questions", label: "Wizard Questions", count: blueprint.questions.length },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-full">

      <div className="flex flex-wrap items-center gap-2">
        <FileUpload
          tooltip={"Load Blueprint\n.xlsx · .xls"}
          accept=".xlsx,.xls"
          onFile={(f) => wrap(() => uploadBlueprint(f))}
          disabled={loading}
        />
        <button
          className="px-3 py-1.5 text-sm border border-border rounded bg-surface hover:bg-surface-hover disabled:opacity-50"
          onClick={() => wrap(createBlueprint)}
          disabled={loading}
        >
          Create New
        </button>
        {blueprint.isLoaded && (
          <button
            className="px-3 py-1.5 text-sm border border-border rounded bg-surface hover:bg-surface-hover"
            onClick={async () => {
              const { downloadBlueprintAction } = await import("../../actions/Actions");
              const result = await downloadBlueprintAction(instanceId);
              const bytes = atob(result.base64);
              const arr = new Uint8Array(bytes.length);
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
              const blob = new Blob([arr]);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = result.filename; a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download .xlsx
          </button>
        )}
        {loading && <span className="text-xs text-text-secondary animate-pulse">Saving…</span>}
        {blueprint.summary && (
          <div className="ml-auto flex gap-3 text-xs text-text-secondary">
            <span><strong>{blueprint.summary.plantName}</strong></span>
            <span>{blueprint.summary.elementLevels.length} levels</span>
            <span>{blueprint.summary.sensorTagCount} sensors</span>
            <span>{blueprint.summary.constantCount} constants</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3 py-2.5 bg-background border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary shrink-0">Saved blueprints:</span>

          {savedBlueprints.length === 0 ? (
            <span className="text-xs text-text-secondary italic">None saved yet</span>
          ) : (
            <select
              className="flex-1 max-w-xs border border-border rounded px-2 py-1 text-sm bg-surface"
              value={selectedSaved}
              onChange={(e) => { setSelectedSaved(e.target.value); }}
            >
              <option value="">— select a file —</option>
              {savedBlueprints.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/^Blueprint_/, "").replace(/\.xlsx$/, "").replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          {blueprint.isLoaded && (
            <button
              className="px-3 py-1 text-sm bg-accent-blue text-surface rounded hover:bg-accent-blue disabled:opacity-50"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const saved = await saveCurrentBlueprint();
                  const names = (saved as { systemName: string }[]).map((s) => s.systemName).join(", ");
                  setSaveMsg(`Saved: ${names}`);
                  setTimeout(() => setSaveMsg(null), 4000);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Save to server
            </button>
          )}

          {saveMsg && (
            <span className="text-xs text-accent-green font-medium animate-pulse">{saveMsg}</span>
          )}

          <button
            className="ml-auto text-xs text-text-secondary hover:text-text-primary"
            title="Refresh list"
            onClick={() => refreshSavedBlueprints()}
          >↺</button>
        </div>

        {selectedSaved && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs text-text-secondary shrink-0">Load:</span>

            <button
              className="px-2.5 py-1 text-xs bg-surface border border-border rounded hover:bg-surface-hover disabled:opacity-40 font-medium"
              disabled={loading}
              onClick={() => wrap(async () => {
                await loadSavedBlueprint({ filename: selectedSaved });
                setSelectedSaved("");
              })}
            >
              All systems
            </button>

            {loadingFileSystems && (
              <span className="text-xs text-text-secondary italic">Loading systems…</span>
            )}
            {!loadingFileSystems && fileSystems.map((sys) => (
              <div key={sys.pathSegment} className="flex items-center gap-1">
                <button
                  className="px-2.5 py-1 text-xs bg-surface border border-accent-blue text-accent-blue rounded hover:bg-surface-hover disabled:opacity-40"
                  disabled={loading}
                  title={`Replace current blueprint with "${formatSystemName(sys.systemName)}"`}
                  onClick={() => wrap(async () => {
                    await loadSavedBlueprint({ filename: selectedSaved, opts: { system: sys.pathSegment } });
                    setSelectedSaved("");
                  })}
                >
                  {formatSystemName(sys.systemName)}
                </button>
                <button
                  className="px-2 py-1 text-xs bg-surface border border-accent-green text-accent-green rounded hover:bg-surface-hover disabled:opacity-40"
                  disabled={loading}
                  title={`Merge "${formatSystemName(sys.systemName)}" into current blueprint`}
                  onClick={() => wrap(async () => {
                    await loadSavedBlueprint({ filename: selectedSaved, opts: { system: sys.pathSegment, merge: true } });
                    setSelectedSaved("");
                  })}
                >
                  + merge
                </button>
              </div>
            ))}

            <button
              className="ml-auto text-xs text-text-secondary hover:text-text-primary"
              onClick={() => setSelectedSaved("")}
            >✕</button>
          </div>
        )}
      </div>

      <ValidationAlert errors={blueprint.errors} warnings={blueprint.warnings} />

      {!blueprint.isLoaded ? (
        <div className="py-16 text-center text-text-secondary">
          Load a blueprint file or create a new one to get started.
        </div>
      ) : (
        <>
          <div className="flex border-b border-border">
            {subTabs.map((st) => (
              <button
                key={st.key}
                onClick={() => setSubTab(st.key)}
                className={cn(
                  "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                  subTab === st.key
                    ? "border-accent-blue text-accent-blue"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                {st.label}
                <span className="ml-1 text-text-secondary">({st.count})</span>
              </button>
            ))}
          </div>

          {subTab === "attributes" && (
            <div className="space-y-2">
              {tree.length === 0 && !addingRoot && (
                <div className="py-8 text-center text-text-secondary text-sm">
                  No element scopes found.{" "}
                  <button
                    className="text-accent-blue hover:underline"
                    onClick={() => setAddingRoot(true)}
                  >
                    Add the first scope
                  </button>
                </div>
              )}

              {tree.map((node) => (
                <ScopeBox
                  key={node.path}
                  node={node}
                  depth={0}
                  allRows={blueprint.attributes}
                  onRowsChange={handleRowsChange}
                  systemName={blueprint.summary?.systemName}
                  constraints={blueprint.constraints}
                  onConstraintsChange={(rows) => wrap(() => updateConstraints(rows))}
                />
              ))}

              {addingRoot && (
                <AddRootScopeForm
                  onAdd={handleAddRoot}
                  onCancel={() => setAddingRoot(false)}
                  plantName={plantName}
                  systemName={systemName}
                />
              )}

              {addingSystem && (
                <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-accent-green rounded-lg bg-surface">
                  <span className="text-xs font-medium text-accent-green shrink-0">New system name:</span>
                  <input
                    autoFocus
                    className="flex-1 border border-accent-green rounded px-2 py-1 text-sm focus:border-accent-green focus:outline-none bg-surface"
                    placeholder="e.g. CO2 Absorber Section"
                    value={newSystemName}
                    onChange={(e) => setNewSystemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSystem();
                      if (e.key === "Escape") { setAddingSystem(false); setNewSystemName(""); }
                    }}
                  />
                  <button
                    className="px-3 py-1 text-sm bg-accent-green text-surface rounded hover:bg-accent-green disabled:opacity-50"
                    disabled={!newSystemName.trim()}
                    onClick={handleAddSystem}
                  >
                    Add system
                  </button>
                  <button
                    className="text-xs text-text-secondary hover:text-text-primary"
                    onClick={() => { setAddingSystem(false); setNewSystemName(""); }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {!addingRoot && !addingSystem && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    className="text-xs text-accent-blue hover:text-accent-blue font-medium"
                    onClick={() => setAddingRoot(true)}
                  >
                    + Add top-level scope
                  </button>
                  <span className="text-border text-xs">|</span>
                  <button
                    className="text-xs text-accent-green hover:text-accent-green font-medium"
                    onClick={() => setAddingSystem(true)}
                  >
                    + Add new system
                  </button>
                </div>
              )}
            </div>
          )}

          {subTab === "uom" && (
            <DataTable
              columns={uomColumns}
              data={blueprint.uom as Record<string, unknown>[]}
              onRowChange={(idx, key, value) => {
                const rows = [...blueprint.uom];
                rows[idx] = { ...rows[idx], [key]: value };
                updateUom(rows);
              }}
              onAddRow={() => updateUom([...blueprint.uom, {} as UomRow])}
              onDeleteRow={(idx) => updateUom(blueprint.uom.filter((_, i) => i !== idx))}
              stickyHeader
              maxHeight="calc(100vh - 280px)"
            />
          )}

          {subTab === "constraints" && (
            <ConstraintsPanel
              rows={blueprint.constraints}
              onChange={(idx, updated) => {
                const rows = [...blueprint.constraints];
                rows[idx] = { ...rows[idx], ...updated };
                wrap(() => updateConstraints(rows));
              }}
              onAdd={() => updateConstraints([...blueprint.constraints, {
                "Parent Element Path": "", "Parent Level": "", "Child Level": "",
                "Min Required": 0, Silent: 0, "Suffix Style": "alpha", Notes: "",
              } as ConstraintRow])}
              onDelete={(idx) => updateConstraints(blueprint.constraints.filter((_, i) => i !== idx))}
            />
          )}

          {subTab === "questions" && (
            <DataTable
              columns={questionsColumns}
              data={blueprint.questions as Record<string, unknown>[]}
              onRowChange={(idx, key, value) => {
                const rows = [...blueprint.questions];
                rows[idx] = { ...rows[idx], [key]: value };
                updateQuestions(rows);
              }}
              onAddRow={() => updateQuestions([...blueprint.questions, {} as QuestionRow])}
              onDeleteRow={(idx) => updateQuestions(blueprint.questions.filter((_, i) => i !== idx))}
              stickyHeader
              maxHeight="calc(100vh - 280px)"
            />
          )}
        </>
      )}
    </div>
  );
}
