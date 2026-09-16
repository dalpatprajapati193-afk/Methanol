"use client";

import type { SensorStats } from "../store/Types";

const fmt = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(3));

const COLS: { key: keyof SensorStats; label: string }[] = [
  { key: "count", label: "Count" },
  { key: "min", label: "Min" },
  { key: "max", label: "Max" },
  { key: "avg", label: "Avg" },
  { key: "median", label: "Median" },
  { key: "q3", label: "Q3" },
];

/** Tabular per-sensor statistics. */
export function StatsResultTable({ results }: { results: SensorStats[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-text-secondary">No statistics yet. Click Generate Statistics.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="px-4 py-2 font-medium">Sensor</th>
            <th className="px-4 py-2 font-medium">Unit</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-4 py-2 text-right font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.piTag} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-text-primary">{r.displayName}</td>
              <td className="px-4 py-2 text-text-secondary">{r.unit ?? "—"}</td>
              {r.error ? (
                <td colSpan={COLS.length} className="px-4 py-2 text-accent-red">{r.error}</td>
              ) : (
                COLS.map((c) => (
                  <td key={c.key} className="px-4 py-2 text-right text-text-primary">
                    {fmt(r[c.key] as number | null)}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
