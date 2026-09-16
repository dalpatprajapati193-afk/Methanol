"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { wizardStateAtom } from "../../config/ConfigAtoms";
import { toKey, UOM_OPTIONS } from "../../config/ConfigCatalog";
import { generateSubAssets } from "../../config/SubAssets";
import { generateKpiDraft, getKpiDraft, type KpiDraftPiRow } from "../../actions/Actions";
import type { SensorRow } from "../../config/ConfigTypes";

const COMMON_KEY = "__common__";
const COMMON_SUBASSET_CODE = "Common_Parameters";
const SENSOR_SHEET_HEADER = ["#", "Parameter", "Sensor Tag(s)", "User UoM", "Parameter Type"];

// OEM Limits and Trip Limit moved to the post-onboarding "Domain Limits" step
// (StepDomainLimits.tsx) — filled in after a successful Run Onboarding,
// scoped to only the tags confirmed relevant for this instance, instead of
// the full static template list asked for here before onboarding even runs.

interface StepSensorsProps {
  instanceId: number;
}

export function StepSensors({ instanceId }: StepSensorsProps) {
  const [state, setState] = useAtom(wizardStateAtom);
  const items = generateSubAssets(state.mc);
  const [activeTab, setActiveTab] = useState<string>(COMMON_KEY);

  // Draft rows (generated from Master_KPI_Calc_File.xlsx once Machine Config
  // validates — see ConfigWizard.tsx's goNext()) replace the old static
  // SensorTemplates.ts arrays as the source of "what parameters need mapping
  // for this sub-asset". Grouped by mainSubasset (the physical owning asset),
  // not the raw cross-reference Sub_Asset label.
  const [draftBySubAsset, setDraftBySubAsset] = useState<Record<string, KpiDraftPiRow[]>>({});
  const [draftStatus, setDraftStatus] = useState<"loading" | "done" | "error">("loading");
  const [draftError, setDraftError] = useState<string | null>(null);

  const subAssetCode = (id: string) => {
    if (id === COMMON_KEY) return COMMON_SUBASSET_CODE;
    const item = items.find((i) => i.id === id);
    return item ? toKey(item.label) : id;
  };

  useEffect(() => {
    if (Number.isNaN(instanceId)) return;
    let cancelled = false;

    // Always regenerate on mount rather than reusing whatever's already
    // persisted — build_kpi_draft_tables() is a pure function of Machine
    // Config + Master_KPI_Calc_File.xlsx, and the master file is still being
    // actively edited (show-only-when conditions, tag lists, etc.), so a
    // previously-generated draft can silently go stale. This also covers the
    // resumed-session case (an instance already past step 2 before this
    // draft mechanism existed never triggers ConfigWizard.tsx's goNext()
    // generation, so the draft would otherwise never get created at all).
    const loadDraft = (): Promise<KpiDraftPiRow[]> =>
      generateKpiDraft(instanceId, state).then(() => getKpiDraft(instanceId));

    loadDraft()
      .then((rows) => {
        if (cancelled) return;
        const grouped: Record<string, KpiDraftPiRow[]> = {};
        rows.forEach((r) => {
          (grouped[r.mainSubasset] ??= []).push(r);
        });
        setDraftBySubAsset(grouped);
        setDraftStatus("done");

        // Eagerly seed state.sensors/commonSensors for EVERY sub-asset (not
        // just whichever tab the user happens to open) — buildConfigWorkbookBytes's
        // ensureSensorRows() runs synchronously at Run Onboarding time and
        // can't await this fetch, so a sub-asset the user never visits here
        // must already have its draft-default rows in state, or it would
        // silently fall back to the old static SensorTemplates.ts list.
        const reconcile = (existing: SensorRow[] | undefined, draftRows: KpiDraftPiRow[]): SensorRow[] => {
          if (!draftRows.length) return existing || [];
          const byId = new Map((existing || []).map((r) => [r.templateId, r]));
          return draftRows.map((t) => {
            const found = byId.get(t.piTag);
            if (!found) {
              return {
                templateId: t.piTag,
                defaultName: t.piTag.replace(/_/g, " "),
                defaultUom: t.uom,
                name: "",
                uom: t.uom,
                paramType: "PI" as const,
              };
            }
            // defaultUom always reflects the current master file, not a
            // frozen snapshot from whenever this row was first cached — and
            // User UoM refreshes along with it as long as the user never
            // actually changed it away from the default (otherwise their
            // own choice is preserved).
            const userChangedUom = found.uom !== found.defaultUom;
            return { ...found, defaultUom: t.uom, uom: userChangedUom ? found.uom : t.uom };
          });
        };

        const nextSensors = { ...state.sensors };
        items.forEach((item) => {
          nextSensors[item.id] = reconcile(state.sensors[item.id], grouped[toKey(item.label)] || []);
        });
        setState({
          ...state,
          sensors: nextSensors,
          commonSensors: reconcile(state.commonSensors, grouped[COMMON_SUBASSET_CODE] || []),
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setDraftError(e instanceof Error ? e.message : "Failed to load generated sensor list");
          setDraftStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const rowsFor = (key: string): SensorRow[] => {
    const existing = (key === COMMON_KEY ? state.commonSensors : state.sensors[key]) || [];
    const draftRows = draftBySubAsset[subAssetCode(key)] || [];
    if (!draftRows.length) return existing;
    // Reconcile by templateId (== the draft's PI_Tag) rather than an
    // all-or-nothing cache — if the draft regenerates with a different row
    // set (e.g. Machine Config's stage/turbine/SC count changed), newly
    // added parameters must still show up instead of being hidden behind a
    // stale cached array, while already-entered values for still-present
    // rows are preserved.
    const byId = new Map(existing.map((r) => [r.templateId, r]));
    return draftRows.map((t) => {
      const found = byId.get(t.piTag);
      if (!found) {
        return {
          templateId: t.piTag,
          defaultName: t.piTag.replace(/_/g, " "),
          defaultUom: t.uom,
          name: "",
          uom: t.uom,
          paramType: "PI" as const,
        };
      }
      // Same reasoning as the mount-time reconcile() above: defaultUom
      // always tracks the current master file; User UoM refreshes with it
      // unless the user actually changed it away from the default.
      const userChangedUom = found.uom !== found.defaultUom;
      return { ...found, defaultUom: t.uom, uom: userChangedUom ? found.uom : t.uom };
    });
  };

  const setRow = (key: string, idx: number, patch: Partial<SensorRow>) => {
    const rows = rowsFor(key).map((r, i) => (i === idx ? { ...r, ...patch } : r));
    if (key === COMMON_KEY) {
      setState({ ...state, commonSensors: rows });
    } else {
      setState({ ...state, sensors: { ...state.sensors, [key]: rows } });
    }
  };

  const activeLabel = activeTab === COMMON_KEY ? "Common Parameters" : items.find((i) => i.id === activeTab)?.label;
  const activeRows = rowsFor(activeTab);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSensorMapping = (key: string) => {
    const rows = rowsFor(key);
    const label = key === COMMON_KEY ? "Common Parameters" : items.find((i) => i.id === key)?.label || key;
    const aoa = [
      SENSOR_SHEET_HEADER,
      ...rows.map((r, i) => [i + 1, r.defaultName, r.name, r.uom, r.paramType]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sensor Mapping");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/[^a-z0-9]+/gi, "_")}_sensor_mapping.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadSensorMapping = async (key: string, file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as (string | number)[][];
    const [header, ...data] = rows;
    if (!header) return;
    const colIndex = (label: string) =>
      header.findIndex((h) => String(h).trim().toLowerCase() === label.toLowerCase());
    const paramIdx = colIndex("Parameter");
    const tagIdx = colIndex("Sensor Tag(s)");
    const uomIdx = colIndex("User UoM");
    const typeIdx = colIndex("Parameter Type");
    if (paramIdx === -1) {
      window.alert('Uploaded file is missing a "Parameter" column — expected the same layout as the downloaded template.');
      return;
    }
    const byParam = new Map<string, { tag: string; uom: string; paramType: string }>();
    data.forEach((r) => {
      const param = String(r[paramIdx] ?? "").trim();
      if (!param) return;
      byParam.set(param.toLowerCase(), {
        tag: tagIdx !== -1 ? String(r[tagIdx] ?? "").trim() : "",
        uom: uomIdx !== -1 ? String(r[uomIdx] ?? "").trim() : "",
        paramType: typeIdx !== -1 ? String(r[typeIdx] ?? "").trim() : "",
      });
    });
    const merged = rowsFor(key).map((row) => {
      const match = byParam.get(row.defaultName.trim().toLowerCase());
      if (!match) return row;
      return {
        ...row,
        name: match.tag || row.name,
        uom: match.uom || row.uom,
        paramType: (match.paramType === "Constant" ? "Constant" : match.paramType === "PI" ? "PI" : row.paramType) as
          | "PI"
          | "Constant",
      };
    });
    if (key === COMMON_KEY) {
      setState({ ...state, commonSensors: merged });
    } else {
      setState({ ...state, sensors: { ...state.sensors, [key]: merged } });
    }
  };

  if (draftStatus === "loading") {
    return <div className="text-sm text-text-secondary">Loading generated sensor list…</div>;
  }

  if (draftStatus === "error") {
    return (
      <div className="rounded-md border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
        Couldn&apos;t load the generated sensor list ({draftError}). Go back to Machine Config and forward again to
        regenerate it.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab(COMMON_KEY)}
          className={
            "px-3 py-2 text-xs font-medium uppercase tracking-wide " +
            (activeTab === COMMON_KEY ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
          }
        >
          Common Parameters
        </button>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={
              "px-3 py-2 text-xs font-medium uppercase tracking-wide " +
              (activeTab === item.id ? "border-b-2 border-accent-blue text-accent-blue" : "text-text-secondary")
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => downloadSensorMapping(activeTab)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
          >
            Download Excel
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
          >
            Upload Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadSensorMapping(activeTab, file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="p-2 text-left text-xs uppercase text-text-secondary">#</th>
                <th className="p-2 text-left text-xs uppercase text-text-secondary">Parameter</th>
                <th className="p-2 text-left text-xs uppercase text-text-secondary">Sensor Tag(s)</th>
                <th className="p-2 text-left text-xs uppercase text-text-secondary">User UoM</th>
                <th className="p-2 text-left text-xs uppercase text-text-secondary">Default UoM</th>
                <th className="p-2 text-left text-xs uppercase text-text-secondary">Parameter Type</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, idx) => (
                <tr key={row.templateId} className="border-t border-border">
                  <td className="p-2 text-text-secondary">{idx + 1}</td>
                  <td className="p-2 text-text-primary">{row.defaultName}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => setRow(activeTab, idx, { name: e.target.value })}
                      placeholder="e.g. PT-101, PT-102"
                      className="w-full min-w-48 rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.uom}
                      onChange={(e) => setRow(activeTab, idx, { uom: e.target.value })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                    >
                      {!UOM_OPTIONS.includes(row.uom) && row.uom && <option value={row.uom}>{row.uom}</option>}
                      {UOM_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-text-secondary">{row.defaultUom}</td>
                  <td className="p-2">
                    <select
                      value={row.paramType}
                      onChange={(e) => setRow(activeTab, idx, { paramType: e.target.value as "PI" | "Constant" })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                    >
                      <option value="PI">PI</option>
                      <option value="Constant">Constant</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {activeLabel}: {activeRows.length} sensors
      </p>
    </div>
  );
}
