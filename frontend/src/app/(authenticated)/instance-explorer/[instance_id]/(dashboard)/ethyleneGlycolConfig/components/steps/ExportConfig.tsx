"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState, useEffect } from "react";
import { configIdAtom, configDataAtom, kpiListAtom, lbmOverridesAtom } from "../../store/WizardAtoms";
import { viewConfig, getOutputKpiList } from "../../actions/Actions";
import type { OutputKpiMapping, SoftSensorMapping } from "../../store/Types";

type SheetRow = Record<string, string | number | boolean | null>;
type SheetData = { headers: string[]; rows: SheetRow[] };
type ViewConfigResult = Record<string, SheetData>;

const LBM_TABS = ["LBM_Iterations", "LBM_Contributors", "ODS_Rules", "Clean_Data_Ranges"] as const;
type LbmTab = typeof LBM_TABS[number];

type KpiTab = "steam" | "equipment" | "plant";
function getKpiTab(section: string): KpiTab {
  if (section === "Steam System") return "steam";
  if (section === "Overall Plant") return "plant";
  return "equipment";
}
function kpiIsConfigured(m: OutputKpiMapping | undefined): boolean {
  if (!m) return false;
  return ["pi_tag_direct", "has_pi_tag", "no_pi_tag", "soft_sensor", "formula_mapped"].includes(
    m.input_type
  );
}

export default function ExportConfig() {
  const [configId] = useAtom(configIdAtom);
  const [configData] = useAtom(configDataAtom);
  const kpiList = useAtomValue(kpiListAtom);
  const setKpiList = useSetAtom(kpiListAtom);
  const setLbmOverrides = useSetAtom(lbmOverridesAtom);
  const [lbmLoading, setLbmLoading] = useState(false);

  useEffect(() => {
    if (kpiList.length > 0) return;
    getOutputKpiList(configData).then(setKpiList).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [error, setError] = useState<string | null>(null);

  // LBM override editor state (local for rendering; synced to atom for WizardShell submit)
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideData, setOverrideData] = useState<ViewConfigResult | null>(null);
  const [activeTab, setActiveTab] = useState<LbmTab>("LBM_Iterations");

  function syncAndSet(data: ViewConfigResult) {
    setOverrideData(data);
    setLbmOverrides(data);
  }

  async function openOverrideEditor() {
    if (!configId) return;
    setOverrideOpen(true);
    if (overrideData) return; // already loaded
    setOverrideLoading(true);
    setError(null);
    try {
      const result = await viewConfig(configData);
      syncAndSet(result as ViewConfigResult);
    } catch {
      setError("Failed to load LBM sheet data.");
    } finally {
      setOverrideLoading(false);
    }
  }

  function updateRow(tab: LbmTab, rowIndex: number, col: string, value: string) {
    if (!overrideData) return;
    const sheet = overrideData[tab];
    const newRows = sheet.rows.map((row, i) =>
      i === rowIndex ? { ...row, [col]: value } : row
    );
    syncAndSet({ ...overrideData, [tab]: { ...sheet, rows: newRows } });
  }

  function addRow(tab: LbmTab) {
    if (!overrideData) return;
    const sheet = overrideData[tab];
    const blank: SheetRow = Object.fromEntries(sheet.headers.map((h) => [h, ""]));
    syncAndSet({ ...overrideData, [tab]: { ...sheet, rows: [...sheet.rows, blank] } });
  }

  function deleteRow(tab: LbmTab, rowIndex: number) {
    if (!overrideData) return;
    const sheet = overrideData[tab];
    syncAndSet({
      ...overrideData,
      [tab]: { ...sheet, rows: sheet.rows.filter((_, i) => i !== rowIndex) },
    });
  }

  async function downloadLbm() {
    if (!configId) return;
    setLbmLoading(true);
    setError(null);
    try {
      const sheetOverrides: Record<string, SheetRow[]> = {};
      if (overrideData) {
        for (const tab of LBM_TABS) {
          sheetOverrides[tab] = overrideData[tab]?.rows ?? [];
        }
      }
      const res = await fetch(`/api/ethyleneGlycolConfig/${configId}/export-lbm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_overrides: sheetOverrides }),
      });
      if (!res.ok) throw new Error(`LBM export failed: ${res.status}`);
      await triggerDownload(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LBM export failed.");
    } finally {
      setLbmLoading(false);
    }
  }

  async function triggerDownload(res: Response) {
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? "export.xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const softSensorKpis = kpiList.filter((k) => k.kpi_type === "soft_sensor");
  const ssTotal = softSensorKpis.length;
  const ssConfigured = softSensorKpis.filter((k) => {
    const m = configData.soft_sensor_mappings[k.id] as SoftSensorMapping | undefined;
    if (!m) return false;
    return (m.has_pi_tag && !!m.tags?.[0]?.tag) ||
      (!m.has_pi_tag && (!!m.model_info || Object.keys(m.x_variables ?? {}).length > 0));
  }).length;
  const forecastConfigured = !!configData.forecast_config?.model_filename;

  const tabSummary = (["steam", "equipment", "plant"] as const).map((tab) => {
    const tabKpis = kpiList.filter((k) => k.kpi_type !== "soft_sensor" && getKpiTab(k.section) === tab);
    const done = tabKpis.filter((k) => kpiIsConfigured(configData.output_kpis[k.id])).length;
    return { tab, total: tabKpis.length, done };
  });
  const totalAll = tabSummary.reduce((a, s) => a + s.total, 0);
  const totalDone = tabSummary.reduce((a, s) => a + s.done, 0);
  const pct = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;
  const TAB_LABEL: Record<KpiTab, string> = {
    steam: "Steam System KPIs",
    equipment: "Equipment KPIs",
    plant: "Plant KPIs",
  };

  return (
    <div className="flex flex-col gap-6 max-w-full">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-text-primary">Review &amp; Submit</h2>
        <p className="text-sm text-text-secondary mt-1">
          Review your configuration summary, inspect LBM config sheets if needed, then submit.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="max-w-2xl rounded-lg border border-border bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-green text-white text-sm">
            ✓
          </span>
          <p className="text-base font-semibold text-text-primary">Configuration Summary</p>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-sm">
          <span className="text-text-secondary">Plant Name</span>
          <span className="text-text-primary font-medium">{configData.configName || "—"}</span>
          <span className="text-text-secondary">Design Capacity</span>
          <span className="text-text-primary font-medium">{configData.plantCapacity || "—"}</span>
          <span className="text-text-secondary">Technology Licensor</span>
          <span className="text-text-primary font-medium">{configData.techLicensor || "—"}</span>
          {ssTotal > 0 && (
            <>
              <span className="text-text-secondary">Soft Sensors</span>
              <span className="text-text-primary font-medium">{ssConfigured} / {ssTotal} configured</span>
            </>
          )}
          <span className="text-text-secondary">Forecast Model (S44)</span>
          <span className="text-text-primary font-medium">
            {forecastConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        {totalAll > 0 && (
          <div className="border-t border-border pt-3 grid grid-cols-2 gap-y-1.5 gap-x-6 text-sm">
            {tabSummary.map((s) => (
              <div key={s.tab} className="contents">
                <span className="text-text-secondary">{TAB_LABEL[s.tab]}</span>
                <span className="text-text-primary">{s.done} / {s.total} mapped</span>
              </div>
            ))}
            <span className="font-semibold text-accent-green">Total KPIs Configured</span>
            <span className="font-semibold text-accent-green">
              {totalDone} / {totalAll} ({pct}%)
            </span>
          </div>
        )}
        {totalAll === 0 && (
          <p className="text-xs text-text-secondary italic border-t border-border pt-3">
            Loading KPI summary…
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-accent-red-light border border-accent-red rounded-lg text-sm text-accent-red">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* LBM Config Sheets with override editor */}
        <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">LBM Config Sheets</p>
            <p className="text-xs text-text-secondary mt-1">
              Inspect and optionally edit the Live Benchmarking Model config sheets before submitting.
            </p>
          </div>

          {/* Override editor toggle */}
          <button
            onClick={overrideOpen ? () => setOverrideOpen(false) : openOverrideEditor}
            disabled={!configId}
            className="btn-secondary text-sm self-start"
          >
            {overrideOpen ? "▲ Hide Sheet Overrides" : "▼ Edit Sheet Overrides"}
          </button>

          {/* Override editor panel */}
          {overrideOpen && (
            <div className="border border-border rounded-lg overflow-auto">
              {overrideLoading ? (
                <p className="p-4 text-sm text-text-secondary">Loading sheet data…</p>
              ) : overrideData ? (
                <>
                  {/* Tab bar */}
                  <div className="flex border-b border-border bg-background overflow-x-auto">
                    {LBM_TABS.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                          activeTab === tab
                            ? "border-b-2 border-accent-blue text-accent-blue"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {tab.replace(/_/g, " ")}
                        <span className="ml-1 text-text-secondary">
                          ({overrideData[tab]?.rows.length ?? 0})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Sheet table */}
                  <SheetEditor
                    data={overrideData[activeTab] ?? { headers: [], rows: [] }}
                    onUpdateRow={(ri, col, val) => updateRow(activeTab, ri, col, val)}
                    onAddRow={() => addRow(activeTab)}
                    onDeleteRow={(ri) => deleteRow(activeTab, ri)}
                  />
                </>
              ) : (
                <p className="p-4 text-sm text-text-secondary italic">No data loaded.</p>
              )}
            </div>
          )}

          <button
            onClick={downloadLbm}
            disabled={lbmLoading || !configId}
            className="btn-primary text-sm self-start"
          >
            {lbmLoading ? "Downloading…" : "Download LBM Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sheet editor ──────────────────────────────────────────────────────────────

function SheetEditor({
  data,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
}: {
  data: SheetData;
  onUpdateRow: (rowIndex: number, col: string, value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowIndex: number) => void;
}) {
  const [editMode, setEditMode] = useState(false);

  if (data.headers.length === 0) {
    return <p className="p-4 text-sm text-text-secondary italic">No data for this sheet.</p>;
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <span className="text-xs text-text-secondary">{data.rows.length} rows · {data.headers.length} columns</span>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={editMode ? "btn-primary text-xs" : "btn-secondary text-xs"}
        >
          {editMode ? "✓ Done Editing" : "✎ Edit Values"}
        </button>
      </div>

      {/* Table — only horizontal scroll when needed; page handles vertical */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="bg-surface-hover">
              {data.headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2.5 text-text-secondary font-semibold border-b border-border whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              {editMode && <th className="border-b border-border w-8" />}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                {data.headers.map((h) => {
                  const val = String(row[h] ?? "");
                  return (
                    <td
                      key={h}
                      className="px-3 py-2 align-top"
                      style={{ maxWidth: "280px", minWidth: "100px" }}
                    >
                      {editMode ? (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => onUpdateRow(ri, h, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-text-primary focus:border-accent-blue outline-none"
                        />
                      ) : (
                        <span
                          className="text-text-primary leading-relaxed"
                          style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                        >
                          {val || <span className="text-text-secondary italic">—</span>}
                        </span>
                      )}
                    </td>
                  );
                })}
                {editMode && (
                  <td className="px-2 py-2 text-center align-top">
                    <button
                      onClick={() => onDeleteRow(ri)}
                      className="text-accent-red hover:opacity-70 text-xs"
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editMode && (
        <div className="p-3 border-t border-border">
          <button onClick={onAddRow} className="btn-secondary text-xs">
            + Add Row
          </button>
        </div>
      )}
    </div>
  );
}
