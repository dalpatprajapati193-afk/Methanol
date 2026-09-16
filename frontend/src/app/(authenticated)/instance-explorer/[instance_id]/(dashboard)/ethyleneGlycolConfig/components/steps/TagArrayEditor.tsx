"use client";

import { useState } from "react";
import type { TagEntry } from "../../store/Types";

export const UOM_GROUPS: string[][] = [
  ["°C", "°F", "K"],
  ["barg", "bara", "psia", "psig", "kPa", "MPa"],
  ["T/hr", "kg/hr", "lb/hr", "t/hr"],
  ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"],
  ["kJ/kg", "kcal/kg", "BTU/lb"],
  ["Nm³/hr", "m³/hr", "SCFM"],
  ["%"],
  ["—", "dimensionless", ""],
];

// Ordered keyword list — first match wins. More specific terms must come before generic ones
// (e.g. "enthalpy" before "heat", "volumetric" before "flow").
const KEYWORD_UOM_MAP: [string, string[]][] = [
  ["temperature",  ["°C", "°F", "K"]],
  [" temp",        ["°C", "°F", "K"]],
  ["pressure",     ["barg", "bara", "psia", "psig", "kPa", "MPa"]],
  [" press",       ["barg", "bara", "psia", "psig", "kPa", "MPa"]],
  ["enthalpy",     ["kJ/kg", "kcal/kg", "BTU/lb"]],
  ["specific heat",["kJ/kg", "kcal/kg", "BTU/lb"]],
  ["latent heat",  ["kJ/kg", "kcal/kg", "BTU/lb"]],
  ["volumetric",   ["Nm³/hr", "m³/hr", "SCFM"]],
  ["gas flow",     ["Nm³/hr", "m³/hr", "SCFM"]],
  ["vapour flow",  ["Nm³/hr", "m³/hr", "SCFM"]],
  ["vapor flow",   ["Nm³/hr", "m³/hr", "SCFM"]],
  ["power",        ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["duty",         ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["heat duty",    ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["energy",       ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["consumption",  ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["demand",       ["MW", "kW", "GJ/hr", "Gcal/hr", "MMBtu/hr"]],
  ["flow",         ["T/hr", "kg/hr", "lb/hr", "t/hr"]],
  ["efficiency",   ["%"]],
  ["fraction",     ["%"]],
  ["purity",       ["%"]],
  ["quality",      ["%"]],
  ["ratio",        ["%"]],
];

function inferUomGroupFromName(name: string): string[] {
  const lower = name.toLowerCase();
  for (const [keyword, group] of KEYWORD_UOM_MAP) {
    if (lower.includes(keyword)) return group;
  }
  const all = UOM_GROUPS.flat().filter((u) => u !== "" && u !== "—");
  return [...new Set(all)];
}

export function getCompatibleUoms(uom: string, nameHint?: string): string[] {
  if (!uom || uom === "—") {
    return nameHint ? inferUomGroupFromName(nameHint) : [...new Set(UOM_GROUPS.flat().filter((u) => u !== "" && u !== "—"))];
  }
  const group = UOM_GROUPS.find((g) => g.includes(uom));
  return group ?? [uom, ""];
}

type UomEntry = { symbol: string; category: string };

const KEYWORD_CATEGORY_MAP: [string, string][] = [
  ["temperature", "Temperature"], [" temp", "Temperature"],
  ["pressure",    "Pressure"],    [" press", "Pressure"],
  ["enthalpy",    "Specific Energy"], ["specific heat", "Specific Energy"], ["latent heat", "Specific Energy"],
  ["volumetric",  "Volumetric Flow Rate"], ["gas flow", "Volumetric Flow Rate"], ["vapour flow", "Volumetric Flow Rate"], ["vapor flow", "Volumetric Flow Rate"],
  ["power",       "Power"], ["duty", "Power"], ["heat duty", "Power"], ["energy", "Power"], ["consumption", "Power"], ["demand", "Power"],
  ["flow",        "Mass Flow Rate"],
  ["efficiency",  "Dimensionless"], ["fraction", "Dimensionless"], ["purity", "Dimensionless"], ["quality", "Dimensionless"], ["ratio", "Dimensionless"],
];

function getFilteredUoms(uomList: UomEntry[], uomHint: string, nameHint?: string): UomEntry[] {
  if (uomHint) {
    const match = uomList.find((u) => u.symbol === uomHint);
    if (match) return uomList.filter((u) => u.category === match.category);
  }
  if (nameHint) {
    const lower = nameHint.toLowerCase();
    for (const [kw, cat] of KEYWORD_CATEGORY_MAP) {
      if (lower.includes(kw)) {
        const filtered = uomList.filter((u) => u.category === cat);
        if (filtered.length) return filtered;
      }
    }
  }
  return uomList;
}

export const OPERATION_OPTIONS = ["Sum", "Average", "Max", "Min", "Custom Formula"] as const;
export type Operation = typeof OPERATION_OPTIONS[number];

const OP_TO_BACKEND: Record<Operation, string> = {
  "Sum": "sum", "Average": "avg", "Max": "max", "Min": "min", "Custom Formula": "custom",
};
const OP_FROM_BACKEND: Record<string, Operation> = {
  "sum": "Sum", "avg": "Average", "max": "Max", "min": "Min", "custom": "Custom Formula",
};

export const BLANK_TAG: TagEntry = { tag: "", uom: "", value_type: "real" };

export default function TagArrayEditor({
  label,
  tags,
  uomHint,
  nameHint,
  uomList,
  operation,
  onOperationChange,
  onChange,
}: {
  label: string;
  tags: TagEntry[];
  uomHint: string;
  nameHint?: string;
  uomList?: UomEntry[];
  operation?: string;
  onOperationChange?: (op: string) => void;
  onChange: (tags: TagEntry[]) => void;
}) {
  const [showLimits, setShowLimits] = useState(false);
  const compatibleUoms = getCompatibleUoms(uomHint, nameHint);
  const filteredBank = uomList?.length ? getFilteredUoms(uomList, uomHint, nameHint) : null;

  function addTag() {
    onChange([...tags, { ...BLANK_TAG, uom: uomHint }]);
  }

  function removeTag(i: number) {
    onChange(tags.filter((_, idx) => idx !== i));
  }

  function updateTag(i: number, field: keyof TagEntry, value: string) {
    onChange(tags.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-secondary uppercase">{label}</label>
        <button
          onClick={() => setShowLimits((v) => !v)}
          className="text-xs text-accent-blue hover:opacity-70"
        >
          {showLimits ? "Hide limits" : "Show limits"}
        </button>
      </div>

      {tags.length === 0 && (
        <p className="text-xs text-text-secondary italic">No tags added yet.</p>
      )}

      {tags.length > 1 && (
        <OperationSelector
          operation={operation}
          onOperationChange={onOperationChange}
          tags={tags}
          onChange={onChange}
        />
      )}

      {tags.map((t, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-lg">
          <div className="flex gap-2 items-start">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-text-secondary">Tag {i + 1}</label>
              <input
                type="text"
                className="input-base text-sm"
                placeholder="PLANT.AREA.TAG"
                value={t.tag}
                onChange={(e) => updateTag(i, "tag", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="text-xs text-text-secondary">UOM</label>
              <select className="input-base text-sm" value={t.uom} onChange={(e) => updateTag(i, "uom", e.target.value)}>
                <option value="">— Select —</option>
                {filteredBank
                  ? Object.entries(
                      filteredBank.reduce<Record<string, string[]>>((acc, u) => {
                        (acc[u.category] ??= []).push(u.symbol);
                        return acc;
                      }, {})
                    ).map(([cat, syms]) => (
                      <optgroup key={cat} label={cat}>
                        {syms.map((s) => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                    ))
                  : compatibleUoms.map((u) => <option key={u} value={u}>{u || "—"}</option>)
                }
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary">Value Type</label>
              <div className="flex gap-2 pt-1">
                {(["real", "polynomial"] as const).map((vt) => (
                  <label key={vt} className="flex items-center gap-1 text-xs cursor-pointer capitalize">
                    <input type="radio" className="accent-accent-blue" checked={t.value_type === vt} onChange={() => updateTag(i, "value_type", vt)} />
                    {vt}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => removeTag(i)} className="text-accent-red text-xs mt-5 hover:opacity-70">✕</button>
          </div>

          {showLimits && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
              {(["min", "max", "default"] as const).map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary capitalize">{field}</label>
                  <input
                    type="text"
                    className="input-base text-xs"
                    value={t[field] ?? ""}
                    onChange={(e) => updateTag(i, field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button onClick={addTag} className="btn-secondary text-xs self-start">
        + Add Tag
      </button>
    </div>
  );
}

function OperationSelector({
  operation,
  onOperationChange,
  tags: _tags,
  onChange: _onChange,
}: {
  operation?: string;
  onOperationChange?: (op: string) => void;
  tags: TagEntry[];
  onChange: (tags: TagEntry[]) => void;
}) {
  const displayOp: Operation = OP_FROM_BACKEND[operation ?? "sum"] ?? "Sum";
  const [customFormula, setCustomFormula] = useState("");

  function handleOpChange(label: Operation) {
    onOperationChange?.(OP_TO_BACKEND[label]);
  }

  return (
    <div className="flex gap-3 items-center flex-wrap p-2 bg-accent-blue-light rounded">
      <label className="text-xs font-semibold text-text-secondary">Multi-tag Operation:</label>
      <select
        className="input-base text-xs max-w-[160px]"
        value={displayOp}
        onChange={(e) => handleOpChange(e.target.value as Operation)}
      >
        {OPERATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {displayOp === "Custom Formula" && (
        <input
          type="text"
          className="input-base text-xs flex-1"
          placeholder="e.g. (T1 + T2) / 2"
          value={customFormula}
          onChange={(e) => setCustomFormula(e.target.value)}
        />
      )}
    </div>
  );
}
