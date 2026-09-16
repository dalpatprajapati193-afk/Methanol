"use client";

import type { PiPullConfig } from "../store/Types";

/** Start / End / Interval inputs. Interval defaults to "1h" in the action if blank. */
export function TimeRangeControls({
  config,
  onChange,
}: {
  config: PiPullConfig;
  onChange: (patch: Partial<PiPullConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Start Time
        <input
          type="datetime-local"
          value={config.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
          className="rounded border border-border bg-background px-2 py-1 text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        End Time
        <input
          type="datetime-local"
          value={config.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
          className="rounded border border-border bg-background px-2 py-1 text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Interval
        <input
          value={config.interval}
          onChange={(e) => onChange({ interval: e.target.value })}
          placeholder="1h"
          className="rounded border border-border bg-background px-2 py-1 text-text-primary"
        />
      </label>
    </div>
  );
}
