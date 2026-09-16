"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SensorMappingRow, UomOption } from "../../types/Index";
import { blueprintAtom, uomCatalogAtom } from "../../store/Index";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));
const fmtName = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export type MappingType = "sensor" | "constant" | "formula";

export const TYPE_OPTIONS: { key: MappingType; label: string }[] = [
  { key: "sensor", label: "Sensor" },
  { key: "constant", label: "Constant" },
  { key: "formula", label: "Formula" },
];

export function rowMappingType(row: SensorMappingRow): MappingType {
  if (String(row.formula ?? "").trim()) return "formula";
  if (String(row.constant_value ?? "").trim()) return "constant";
  return "sensor";
}

/** Default type for an unmapped row — seeded from the blueprint's Attribute Type
 *  (carried on the row as `_value_type`). Keeps the dropdown pre-selected while
 *  the row stays "unmapped" until the user enters a value. */
export function seededMappingType(row: SensorMappingRow): MappingType {
  const vt = String(row._value_type ?? "").trim().toLowerCase();
  if (vt === "constant") return "constant";
  if (vt === "formula") return "formula";
  return "sensor";
}

/** Type the dropdown should show: the user's choice if a value is present,
 *  otherwise the blueprint-seeded default. */
function initialMappingType(row: SensorMappingRow): MappingType {
  return isMapped(row) ? rowMappingType(row) : seededMappingType(row);
}

function isMapped(r: SensorMappingRow) {
  return !!(r.sensor_name || r.constant_value || r.formula);
}

function isRequiredAttribute(r: SensorMappingRow): boolean {
  const raw = r.required ?? r.is_required ?? r._required;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}

/* ── border colour per input type ───────────────────────────────────────── */
const inputBorder: Record<MappingType, string> = {
  sensor:   "border-accent-blue   focus:ring-accent-blue/15",
  constant: "border-accent-yellow focus:ring-accent-yellow/15",
  formula:  "border-accent-orange focus:ring-accent-orange/15",
};

/* ── via badge styles ────────────────────────────────────────────────────── */
const viaBadge: Record<string, string> = {
  sensor:   "text-accent-blue   border-blue-200   bg-blue-50",
  constant: "text-accent-yellow border-yellow-200 bg-yellow-50",
  formula:  "text-accent-orange border-orange-200 bg-orange-50",
};

/** UOM dropdown — applicable units are the active units in the attribute's category,
 *  sourced from the DB catalog (configurations.unit_of_measurement) and passed in as
 *  `options` (derived in the parent from `blueprintAtom.uom` + `uomCatalogAtom`). When
 *  the attribute has no category (or an empty one) the control is disabled/empty.
 *
 *  Mirrors the attribute-type field: read-only display for a mapped row until
 *  the user clicks the edit pencil. While `editable` (editing or unmapped) it
 *  renders a live `<select>` bound to the parent's draft; the value commits with
 *  the ✓ button alongside the mapping value. */
function UomSelect({
  options,
  value,
  editable,
  onChange,
}: {
  options: UomOption[];
  value: string;
  editable: boolean;
  onChange: (uom: string) => void;
}) {
  const opts = options;
  const current = String(value ?? "");
  // Strict: a value is only "selected" if it's one of the applicable options.
  const valid = opts.some((o) => o.symbol === current);

  // Read-only display — matches the mapped attribute-type value: static text,
  // no editable control until the row is put into edit mode.
  if (!editable) {
    return (
      <span
        className={cn(
          "shrink-0 w-[92px] h-[27px] flex items-center px-1.5 text-xs rounded-[6px] border border-border bg-surface truncate",
          valid ? "text-text-primary" : "text-text-tertiary"
        )}
        title={valid ? "Unit of measure" : "No unit set"}
      >
        {valid ? current : "—"}
      </span>
    );
  }

  const disabled = opts.length === 0;
  return (
    <select
      className={cn(
        "shrink-0 w-[92px] h-[27px] border border-border rounded-[6px] px-1.5 text-xs bg-surface focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10",
        disabled ? "text-text-tertiary cursor-not-allowed opacity-70" : "text-text-secondary"
      )}
      title={
        disabled
          ? "No UOM category set for this attribute in the blueprint UOM Reference sheet"
          : "Unit of measure"
      }
      disabled={disabled}
      value={valid ? current : ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {disabled ? "— UOM —" : "UOM…"}
      </option>
      {opts.map((o) => (
        <option key={o.uomId} value={o.symbol} title={o.name || undefined}>
          {o.symbol}
        </option>
      ))}
    </select>
  );
}

export default function PIAttributeRow({
  row,
  onChange,
  trailing,
}: {
  row: SensorMappingRow;
  onChange: (r: SensorMappingRow) => void;
  trailing?: React.ReactNode;
}) {
  const [sipOpen, setSipOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mappingType, setMappingType] = useState<MappingType | "">(
    initialMappingType(row)
  );
  const [sensorDraft, setSensorDraft] = useState(String(row.sensor_name ?? ""));
  const [constantDraft, setConstantDraft] = useState(String(row.constant_value ?? ""));
  const [formulaDraft, setFormulaDraft] = useState(String(row.formula ?? ""));
  const [uomDraft, setUomDraft] = useState(String(row.sensor_uom ?? ""));

  const blueprint = useAtomValue(blueprintAtom);
  const uomCatalog = useAtomValue(uomCatalogAtom);
  // Applicable units = the active catalog entries for this attribute's category, where the
  // category is the attribute's row in the blueprint's 2-col UOM Reference sheet (exact,
  // case-sensitive, trimmed match — the same rule the sheet has always used). No category
  // ⇒ no options ⇒ disabled dropdown.
  const uomOptions = useMemo<UomOption[]>(() => {
    const attr = String(row.attribute ?? "").trim();
    if (!attr) return [];
    const match = blueprint.uom.find((u) => String(u.Attribute ?? "").trim() === attr);
    const category = String(match?.Category ?? "").trim();
    return category ? uomCatalog[category] ?? [] : [];
  }, [blueprint.uom, uomCatalog, row.attribute]);

  const mapped = isMapped(row);
  const required = isRequiredAttribute(row);
  const currentType = rowMappingType(row);
  const rowIdentity = `${String(row.element_path ?? "")}|${String(row.element_code ?? "")}|${String(row.attribute ?? "")}`;

  useEffect(() => {
    if (!editing) {
      setMappingType(initialMappingType(row));
      setSensorDraft(String(row.sensor_name ?? ""));
      setConstantDraft(String(row.constant_value ?? ""));
      setFormulaDraft(String(row.formula ?? ""));
      setUomDraft(String(row.sensor_uom ?? ""));
    }
  }, [row.sensor_name, row.constant_value, row.formula, row.sensor_uom, row._value_type, editing]);

  const commit = () => {
    if (!mappingType) return;
    onChange({
      ...row,
      sensor_name: mappingType === "sensor" ? sensorDraft : "",
      constant_value: mappingType === "constant" ? constantDraft : "",
      formula: mappingType === "formula" ? formulaDraft : "",
      sensor_uom: uomDraft,
      uom_id: uomOptions.find((o) => o.symbol === uomDraft)?.uomId ?? null,
      _value_type:
        mappingType === "constant" ? "constant" :
        mappingType === "formula"  ? "formula"  : "sensor_tag",
    });
    setEditing(false);
  };

  const cancel = () => {
    setMappingType(isMapped(row) ? rowMappingType(row) : "");
    setSensorDraft(String(row.sensor_name ?? ""));
    setConstantDraft(String(row.constant_value ?? ""));
    setFormulaDraft(String(row.formula ?? ""));
    setUomDraft(String(row.sensor_uom ?? ""));
    setEditing(false);
  };

  const displayValue =
    currentType === "sensor"   ? String(row.sensor_name ?? "")    :
    currentType === "constant" ? String(row.constant_value ?? "") :
                                 String(row.formula ?? "");

  const showSip = sipOpen && (!mapped || currentType === "sensor");

  return (
    <div className={cn("border-t border-border/60", showSip ? "bg-surface" : "")}>

      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 hover:bg-surface transition-colors">

        {/* Status dot */}
        <span
          className={cn(
            "w-[6px] h-[6px] rounded-full shrink-0",
            mapped ? "bg-accent-green" : required ? "bg-accent-red" : "bg-border"
          )}
        />

        {/* Attribute name */}
        <span className="text-sm font-medium text-text-primary flex-1 min-w-0 truncate">
          {fmtName(String(row.attribute ?? ""))}
        </span>

        {/* Calc override badge */}
        {row._is_calc_override && (
          <span className="text-[10.5px] bg-orange-50 text-accent-orange px-1.5 py-0.5 rounded border border-orange-200 shrink-0 font-medium">
            Calc
          </span>
        )}

        {/* Mapped display / edit controls */}
        {!editing && mapped ? (
          <div className="flex items-center gap-1.5 w-[28rem] shrink-0">
            <span
              className={cn(
                "text-[10.5px] px-1.5 py-0.5 rounded border shrink-0 font-medium",
                viaBadge[currentType] ?? "bg-surface text-text-secondary border-border"
              )}
            >
              {currentType}
            </span>
            <span
              className="flex-1 min-w-0 truncate border rounded-[6px] px-2 py-[3px] text-xs font-mono bg-surface border-border text-text-primary"
              title={displayValue}
            >
              {displayValue}
            </span>
            <UomSelect
              options={uomOptions}
              value={String(row.sensor_uom ?? "")}
              editable={false}
              onChange={setUomDraft}
            />
            <button
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-accent-blue hover:bg-blue-50 transition-colors"
              title="Edit mapping"
              onClick={() => setEditing(true)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L3.5 10.5l-3 .5.5-3L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 w-[28rem] shrink-0">
            <select
              className="shrink-0 w-[82px] h-[27px] border border-border rounded-[6px] px-1.5 text-xs bg-surface focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10 text-text-secondary"
              value={mappingType}
              onChange={(e) => setMappingType(e.target.value as MappingType | "")}
            >
              <option value="" disabled>Type…</option>
              {TYPE_OPTIONS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {mappingType === "sensor" && (
              <input
                autoFocus={editing}
                className={cn(
                  "flex-1 min-w-0 h-[27px] border rounded-[6px] px-2 text-xs font-mono focus:outline-none focus:ring-2 bg-surface",
                  inputBorder.sensor
                )}
                placeholder="PI Tag / Sensor Name"
                value={sensorDraft}
                onChange={(e) => setSensorDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              />
            )}
            {mappingType === "constant" && (
              <input
                autoFocus
                className={cn(
                  "flex-1 min-w-0 h-[27px] border rounded-[6px] px-2 text-xs font-mono focus:outline-none focus:ring-2 bg-surface",
                  inputBorder.constant
                )}
                placeholder="Constant value"
                value={constantDraft}
                onChange={(e) => setConstantDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              />
            )}
            {mappingType === "formula" && (
              <input
                autoFocus
                className={cn(
                  "flex-1 min-w-0 h-[27px] border rounded-[6px] px-2 text-xs font-mono focus:outline-none focus:ring-2 bg-surface",
                  inputBorder.formula
                )}
                placeholder="e.g. flow_in / flow_out * 100"
                value={formulaDraft}
                onChange={(e) => setFormulaDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              />
            )}

            {/* UOM — editable here; commits with the mapping value on ✓ */}
            <UomSelect
              options={uomOptions}
              value={uomDraft}
              editable={true}
              onChange={setUomDraft}
            />

            {/* Confirm */}
            <button
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-text-secondary hover:text-accent-green hover:bg-green-50 transition-colors font-semibold"
              title="Confirm"
              onClick={commit}
            >
              ✓
            </button>
            {/* Cancel */}
            <button
              className={cn(
                "shrink-0 w-6 h-6 flex items-center justify-center rounded text-text-secondary hover:text-accent-red hover:bg-red-50 transition-colors",
                !editing && "invisible"
              )}
              title="Cancel"
              onClick={cancel}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1 1l7 7M8 1l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* Mapped label */}
        <span
          className={cn(
            "text-xs w-14 text-right shrink-0 font-medium",
            mapped ? "text-accent-green" : "text-text-tertiary"
          )}
        >
          {mapped ? "✓ mapped" : "—"}
        </span>

        {/* SIP toggle */}
        {(!mapped || currentType === "sensor") ? (
          <button
            className="text-[11px] text-text-secondary hover:text-text-primary shrink-0 w-10 text-right transition-colors"
            onClick={() => setSipOpen((s) => !s)}
          >
            {sipOpen ? "▴ SIP" : "▾ SIP"}
          </button>
        ) : (
          <span className="w-10 shrink-0" />
        )}

        {/* Optional trailing slot (e.g. dependent-KPIs chip) */}
        {trailing}
      </div>

      {/* ── SIP sub-panel ─────────────────────────────────────────────────── */}
      {showSip && (
        <div className="px-4 pb-3 pt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "SIP Min",     key: "sip_min",             val: String(row.sip_min ?? ""),              type: "number" },
            { label: "SIP Max",     key: "sip_max",             val: String(row.sip_max ?? ""),              type: "number" },
            { label: "SIP Default", key: "sip_default_value",   val: String(row.sip_default_value ?? ""),   type: "number" },
            { label: "SIP Policy",  key: "sip_policy",          val: String(row.sip_policy ?? "0"),         type: "number" },
          ].map(({ label, key, val, type }) => (
            <div key={key}>
              <label className="block text-[10.5px] font-medium text-text-secondary mb-0.5">{label}</label>
              <input
                key={`${rowIdentity}|${key}|${val}`}
                type={type}
                className="w-full h-[27px] border border-border rounded-[6px] px-2 text-xs focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10 bg-surface"
                defaultValue={val}
                onBlur={(e) =>
                  onChange({
                    ...row,
                    [key]: key === "sip_policy" ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
