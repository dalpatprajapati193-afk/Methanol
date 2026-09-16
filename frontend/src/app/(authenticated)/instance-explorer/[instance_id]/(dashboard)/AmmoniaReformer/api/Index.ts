// Typed API contract — the single source of truth for request/response shapes,
// derived from the FastAPI OpenAPI schema. DO NOT hand-edit `generated/Schema.ts`.
//
// Regenerate after backend schema changes (backend must be running):
//   cd services/app && PYTHONPATH=. <venv>/python -c \
//     "import main,json;open('/tmp/openapi.json','w').write(json.dumps(main.app.openapi()))"
//   npx openapi-typescript /tmp/openapi.json -o src/app/ammoniaReformerConfig/api/generated/Schema.ts
//
// This replaces the hand-synced shapes in ../types/Types.ts feature-by-feature
// (Phase 3).
import type { paths, components } from "./generated/Schema";

export type { paths, components };
export type Schemas = components["schemas"];

// Generic helpers to pull a body / 200-response type straight from a path+method.
export type JsonBody<Op> = Op extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
export type Ok<Op> = Op extends { responses: { 200: { content: { "application/json": infer R } } } } ? R : never;

// Stable backend-owned shapes adopted by the frontend (single source of truth).
export type CoverageStats = Schemas["CoverageStats"];
export type OkResponse = Schemas["OkResponse"];
export type BuildFramesResponse = Schemas["BuildFramesResponse"];
export type ValidateResponse = Schemas["ValidateResponse"];
export type SavedBlueprintsResponse = Schemas["SavedBlueprintsResponse"];
export type FileSystemsResponse = Schemas["FileSystemsResponse"];
export type SaveAsResponse = Schemas["SaveAsResponse"];
export type CalcBlueprintsResponse = Schemas["CalcBlueprintsResponse"];
export type UploadCalcBlueprintResponse = Schemas["UploadCalcBlueprintResponse"];

// Topology (v3) — process-connectivity contract (typed from the start; see TOPOLOGY.md).
export type TopologyStateResponse = Schemas["TopologyStateResponse"];
export type TopologyChain = Schemas["TopologyChain"];
export type TopologyLink = Schemas["TopologyLink"];
export type TopologyNode = Schemas["TopologyNode"];
export type TopologyEndpoint = Schemas["TopologyEndpoint"];
export type StreamSensorsResponse = Schemas["StreamSensorsResponse"];
export type StreamSensorEntry = Schemas["StreamSensorEntry"];
export type StreamServesPort = Schemas["StreamServesPort"];
export type CalcResolutionResponse = Schemas["CalcResolutionResponse"];
export type CalcResolutionSummary = Schemas["CalcResolutionSummary"];

// Backend envelopes whose dynamic rows the frontend types more richly than the
// contract's `dict[str, Any]` — exposed for composition (see types/Types.ts).
export type ApiBlueprintResponse = Schemas["BlueprintResponse"];
export type ModelsStatusResponse = Schemas["ModelsStatusResponse"];
export type CalcRequirementsResponse = Schemas["CalcRequirementsResponse"];
export type KpiPackagesResponse = Schemas["KpiPackagesResponse"];
