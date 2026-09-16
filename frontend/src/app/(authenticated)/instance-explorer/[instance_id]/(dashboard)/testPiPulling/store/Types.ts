// ─── Test PI Pulling — shared types (mirror the FastAPI contract camelCase) ───

/** A predefined sensor (from sensors.json). User supplies the PI tag for each. */
export interface SensorDef {
  displayName: string;
  defaultUnit?: string;
}

/** One display-name → PI-tag row entered by the user. */
export interface SensorMapping {
  displayName: string;
  piTag: string;
  unit?: string;
}

/** The full capability config (what gets drafted / submitted). */
export interface PiPullConfig {
  mappings: SensorMapping[];
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
  interval: string;  // duration string, default "1h"
}

/** Computed statistics for one sensor (response from /generate-stats). */
export interface SensorStats {
  displayName: string;
  piTag: string;
  unit: string | null;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
  q3: number | null; // third quartile (p75)
  error: string | null;
}

export interface StatsResponse {
  results: SensorStats[];
  warnings: string[];
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
