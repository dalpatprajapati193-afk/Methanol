"use client";

import type { SensorMapping } from "../store/Types";

/** Editable display-name → PI-tag rows (display names are predefined, tags entered by user). */
export function TagMappingTable({
  mappings,
  onChange,
}: {
  mappings: SensorMapping[];
  onChange: (next: SensorMapping[]) => void;
}) {
  const setTag = (i: number, piTag: string) => {
    const next = mappings.map((m, idx) => (idx === i ? { ...m, piTag } : m));
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="px-4 py-2 font-medium">Sensor</th>
            <th className="px-4 py-2 font-medium">PI Tag</th>
            <th className="px-4 py-2 font-medium">Unit</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m, i) => (
            <tr key={m.displayName} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-text-primary">{m.displayName}</td>
              <td className="px-4 py-2">
                <input
                  value={m.piTag}
                  onChange={(e) => setTag(i, e.target.value)}
                  placeholder="e.g. PLANT.RX.TEMP.PV"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-text-primary"
                />
              </td>
              <td className="px-4 py-2 text-text-secondary">{m.unit ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
