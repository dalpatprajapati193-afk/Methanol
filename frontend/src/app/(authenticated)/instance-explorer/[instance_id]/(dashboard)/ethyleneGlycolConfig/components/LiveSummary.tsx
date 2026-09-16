import type { EgConfigData } from "../store/Types";

type Row = { label: string; value: (c: EgConfigData) => unknown };

// Key field rows per leaf step id, read from configData.
const SUMMARY_FIELDS: Record<string, Row[]> = {
  general: [
    { label: "Config Name", value: (c) => c.configName },
    { label: "Capacity", value: (c) => c.plantCapacity },
    { label: "Licensor", value: (c) => c.techLicensor },
    { label: "Comm. Year", value: (c) => c.commissioningYear },
  ],
  steam: [
    { label: "# Headers", value: (c) => c.numSteamHeaders },
    { label: "Configured", value: (c) => c.steamHeaders?.length ?? 0 },
  ],
  "eq.select": [
    { label: "Has GFS", value: (c) => c.eq_hasGFS },
    { label: "GFS Arrangement", value: (c) => c.eq_gfsArrangement },
  ],
  kpi: [
    { label: "KPIs Configured", value: (c) => Object.keys(c.output_kpis ?? {}).length },
    { label: "Soft Sensors", value: (c) => Object.keys(c.soft_sensor_mappings ?? {}).length },
  ],
  inputKpi: [{ label: "Mapped Outputs", value: (c) => Object.keys(c.output_kpis ?? {}).length }],
  inputAdditional: [
    { label: "Additional Inputs", value: (c) => Object.keys(c.additional_inputs ?? {}).length },
  ],
  forecast: [
    { label: "Model", value: (c) => c.forecast_config?.model_name },
    { label: "Days", value: (c) => c.forecast_config?.forecast_days },
  ],
  export: [
    { label: "KPIs", value: (c) => Object.keys(c.output_kpis ?? {}).length },
    { label: "Additional", value: (c) => Object.keys(c.additional_inputs ?? {}).length },
    { label: "Soft Sensors", value: (c) => Object.keys(c.soft_sensor_mappings ?? {}).length },
  ],
};

// Equipment detail leaves (eq.* except eq.select) share one summary.
const EQUIPMENT_DETAIL_ROWS: Row[] = [
  { label: "Column Type", value: (c) => c.sc_columnType },
  { label: "# Exchangers", value: (c) => c.fpe_numExchangers },
  { label: "Reactor Type", value: (c) => c.gr_reactorType },
  { label: "# Effects", value: (c) => c.ev_numEffects },
];

function rowsFor(leafId: string): Row[] {
  if (SUMMARY_FIELDS[leafId]) return SUMMARY_FIELDS[leafId];
  if (leafId.startsWith("eq.") && leafId !== "eq.select") return EQUIPMENT_DETAIL_ROWS;
  return [];
}

function format(value: unknown): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function LiveSummary({
  config,
  leafId,
  heading,
}: {
  config: EgConfigData;
  leafId: string;
  heading: string;
}) {
  const rows = rowsFor(leafId);

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
        {heading} Summary
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-text-secondary">{row.label}</span>
            <span className="text-text-primary font-medium text-right truncate">
              {format(row.value(config))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
