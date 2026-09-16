"use server";

// ── src ↔ services bridge (Doc 00/01 BFF contract) ────────────────────────────
// The browser never calls FastAPI directly. These server actions are the only
// bridge: UI → server action → FastAPI (services/app/routers/PeOlfFur/router.py)
// → the Package_Processor pipeline scripts (kpi_bridge / pp_bridge / run_bridge).
//
// The original single-app repo reached the pipeline through Next.js API routes
// (/api/kpi, /api/packages, /api/packages/confirm, /api/run-packages) that
// spawned Python directly. On this platform a capability_dev cannot own routes
// under src/app/api, and the contract routes heavy/data work through FastAPI —
// so the same four operations now live at /api/pe-olf-fur/* and are reached via
// these actions instead.
import { z } from "zod";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";

// instance_id is user-editable, URL-sourced — validate before it reaches FastAPI
// / the pipeline (doc 02). A null instanceId means no instance is in context
// (single-tenant local fallback); it passes through unvalidated to the shared dir.
const InstanceIdSchema = z.number().int().positive();
function validInstance(instanceId: number | null): number | null {
  if (instanceId == null) return null;
  return InstanceIdSchema.parse(instanceId);
}

// Non-streaming JSON calls go through the shared client (adds Content-Type,
// timeout, error normalization). Streaming calls use a raw fetch to FASTAPI_URL
// because the response is a live text stream, not JSON, and can run for minutes
// (no request timeout) — the client reads it exactly as it read the old route.

export interface ParentPackage {
  parent: string;
  package_name: string;
  ignore: boolean;
  selected: boolean;
}

export interface Kpi {
  unique_display_name: string;
  attribute_name: string;
  package: string;
  parent: string;
}

export type KpiSource = "none" | "sensor" | "calculate";

// instance_id scopes the pipeline to this instance's private data dirs (the
// bridges seed + read/write _instances/<id>/...). Null → the shared default.
function withInstance(endpoint: string, instanceId: number | null): string {
  return instanceId != null ? `${endpoint}?instance_id=${instanceId}` : endpoint;
}

/** List parent packages (pp_bridge.py list) for an instance. */
export async function listParentPackages(instanceId: number | null): Promise<ParentPackage[]> {
  const id = validInstance(instanceId);
  const { parents } = await fetchFastAPI<{ parents: ParentPackage[] }>(
    withInstance("/pe-olf-fur/packages", id),
  );
  return parents ?? [];
}

/** List KPIs (kpi_bridge.py list) for an instance. */
export async function listKpis(instanceId: number | null): Promise<Kpi[]> {
  const id = validInstance(instanceId);
  const { kpis } = await fetchFastAPI<{ kpis: Kpi[] }>(
    withInstance("/pe-olf-fur/kpi", id),
  );
  return kpis ?? [];
}

// Resolve the FastAPI base URL for the streaming calls (fetchFastAPI is JSON-only).
function fastapiBase(): string {
  const base = process.env.FASTAPI_URL;
  if (!base) throw new Error("FASTAPI_URL environment variable is missing.");
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

// A streaming POST → returns the raw response stream. The body still carries the
// trailing `__DONE__<exitCode>` sentinel the client parses, so the confirm /
// build progress modals work unchanged. A ReadableStream is returned across the
// server-action boundary (React Flight streams it) so the client keeps its
// incremental getReader() loop rather than buffering the whole log.
async function streamPost(endpoint: string, payload: unknown): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${fastapiBase()}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `FastAPI ${res.status} for ${endpoint}`);
  }
  if (!res.body) throw new Error("No response stream from FastAPI.");
  return res.body;
}

/**
 * Confirm the Package/KPI selection (pp_bridge.py confirm): sets run_status +
 * dependency chain, writes User_Package_Response.json, then runs Current_Packages
 * → Current_Attribute → Create_Input_Sheet, streaming its stdout live.
 */
export async function confirmPackagesStream(
  instanceId: number | null,
  selected: string[],
  kpiStates: Record<string, KpiSource>,
): Promise<ReadableStream<Uint8Array>> {
  const id = validInstance(instanceId);
  return streamPost("/pe-olf-fur/packages/confirm", { selected, kpiStates, instanceId: id });
}

/**
 * Build instance_configs.xlsx (run_bridge.py run → Build_Instance_Configs.py),
 * streaming its stdout live. Payload is accepted for parity with the old Run
 * dialog but is ignored by the bridge (there is no PI-timestamp selection now).
 */
export async function runPackagesStream(
  instanceId: number | null,
  payload: { start_time?: string; end_time?: string; interval?: string } = {},
): Promise<ReadableStream<Uint8Array>> {
  const id = validInstance(instanceId);
  return streamPost("/pe-olf-fur/run-packages", { ...payload, instanceId: id });
}
