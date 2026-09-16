"use server";

// Server actions for the Input Sheet tile. These replace the original single-app
// repo's Next.js API routes (/api/input-sheet[/confirm|/revert|/download|/upload]),
// which a capability_dev cannot own under src/app/api. The heavy Excel work stays
// server-side in the colocated helper (inputSheetIo) — the pipeline reads the same
// on-disk .xlsx it always did (paths.py → outputs/user_input), so nothing on the
// Python side changes.
//
// ── Platform contract (docs 02/04/05/07) ──────────────────────────────────────
// The on-disk artifacts remain the working engine AND the pipeline's fixed-path
// input (kept byte-for-byte for a lossless Revert). On top of that, the Input
// Sheet is now persisted per-instance in the database, exactly like the Hub and
// Package/KPI sections in actions.ts:
//   - instance_configuration_drafts.draft_data.inputSheet  — intermediate edits
//     ({ edits: [...] }) so unsaved work survives a refresh (doc 04).
//   - instance_configurations.ui_config_data.inputSheet    — the confirmed sheet
//     payload (finalized JSON, doc 05/07).
// Both are surgical: read the row → set only the `inputSheet` key → write back,
// so a write here never drops the `hub` / `pkgKpi` sections written elsewhere.
// The DB is scoped to `instance_id` (the tenancy key, doc 02); the shared on-disk
// dir is unchanged (the pipeline is single-tenant — see the scope decision docs).
import { z } from "zod";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "@/shared/libs/Prisma";
import {
  readInputPayload, writeEdits, readWorkbookBuffer, saveUploadedWorkbook,
  writeConfirmedSnapshot, readConfirmedPayload, revertToConfirmed,
  currentDir, DOWNLOAD_FILENAME,
  type InputSheetPayload, type Edit,
} from "./inputSheetIo";

// instance_id is a user-editable, URL-sourced value — validate before any DB call
// (doc 02). A null instanceId means no valid instance is in context; DB writes are
// skipped and the action degrades to the disk-only behavior (no functionality loss).
const InstanceIdSchema = z.number().int().positive();
function validInstance(instanceId: number | null): number | null {
  if (instanceId == null) return null;
  return InstanceIdSchema.parse(instanceId);
}

const EditSchema = z.object({
  sheet: z.string(),
  row: z.number().int(),
  col: z.number().int(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// The `inputSheet` slice of the combined draft JSON — the pending edit overlay on
// top of the pipeline-generated sheet (compact; the full sheet lives on disk + in
// the confirmed snapshot).
interface InputSheetDraftSection { edits: Edit[] }

// The on-disk UI_Export.xlsx (written by the Hub / Package-KPI Confirm) — used only
// as the seed for pipeline_config_data when an instance_configurations row does not
// exist yet (the column is non-null bytes). Per-instance (mirrors actions.ts).
function uiExportPath(instanceId: number): string {
  return path.join(currentDir(instanceId), "UI_Export.xlsx");
}

// ── DB helpers (surgical per-section upsert; mirror actions.ts) ────────────────

async function upsertDraftInputSheet(instanceId: number, section: InputSheetDraftSection): Promise<void> {
  const existing = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: instanceId } });
  const current = (existing?.draft_data as Record<string, unknown> | null) || {};
  const merged = { ...current, inputSheet: section } as unknown as Prisma.InputJsonValue;
  if (existing) {
    await prisma.instance_configuration_drafts.update({
      where: { instance_configuration_draft_id: existing.instance_configuration_draft_id },
      data: { draft_data: merged },
    });
  } else {
    await prisma.instance_configuration_drafts.create({ data: { instance_id: instanceId, draft_data: merged } });
  }
}

async function readDraftInputSheet(instanceId: number): Promise<InputSheetDraftSection | null> {
  const draft = await prisma.instance_configuration_drafts.findFirst({ where: { instance_id: instanceId } });
  const section = (draft?.draft_data as Record<string, unknown> | null)?.inputSheet;
  return (section as InputSheetDraftSection | undefined) ?? null;
}

async function upsertConfigInputSheet(instanceId: number, payload: InputSheetPayload): Promise<void> {
  const existing = await prisma.instanceConfiguration.findFirst({ where: { instanceId } });
  const current = (existing?.ui_config_data as Record<string, unknown> | null) || {};
  const merged = { ...current, inputSheet: payload } as unknown as Prisma.InputJsonValue;
  if (existing) {
    // Update ui_config_data ONLY — leave pipeline_config_data (the Hub/KPI UI_Export.xlsx).
    await prisma.instanceConfiguration.update({
      where: { instance_configurations_id: existing.instance_configurations_id },
      data: { ui_config_data: merged },
    });
  } else {
    // pipeline_config_data is non-null bytes: seed it from the on-disk UI_Export.xlsx.
    // In the normal flow the row already exists (KPI/Package Confirm creates it, and
    // green gates this tile), so this branch is a safety net.
    const uiExport = uiExportPath(instanceId);
    if (!fs.existsSync(uiExport)) {
      throw new Error("Cannot record the input sheet yet — confirm the Hub and Package/KPI selection first (UI_Export.xlsx not found).");
    }
    const bytes = await fs.promises.readFile(uiExport);
    await prisma.instanceConfiguration.create({
      data: { instanceId, pipeline_config_data: new Uint8Array(bytes), ui_config_data: merged },
    });
  }
}

async function readConfigInputSheet(instanceId: number): Promise<InputSheetPayload | null> {
  const config = await prisma.instanceConfiguration.findFirst({ where: { instanceId } });
  const payload = (config?.ui_config_data as Record<string, unknown> | null)?.inputSheet;
  return (payload as InputSheetPayload | undefined) ?? null;
}

// ── Public server actions ──────────────────────────────────────────────────────

// Read the live input-sheet payload (helper JSON first; self-heals from xlsx). The
// on-disk sheet is the authoritative STRUCTURE (columns/rows/options come from the
// pipeline-generated workbook); pending edits are layered on top via the draft (see
// readInputDraftEdits) so they survive a refresh.
export async function readInputSheet(instanceId: number | null): Promise<InputSheetPayload> {
  return readInputPayload(validInstance(instanceId));
}

// The pending edit overlay recorded for this instance (doc 04) — replayed into the
// dirty map on mount so unsaved edits survive a refresh. Empty when none/invalid.
export async function readInputDraftEdits(instanceId: number | null): Promise<{ edits: Edit[] }> {
  const id = validInstance(instanceId);
  if (id == null) return { edits: [] };
  const section = await readDraftInputSheet(id);
  return { edits: section?.edits ?? [] };
}

// Autosave the pending edit overlay to the instance's draft row (DB only — no disk
// touch, so the version history isn't churned). Called debounced on edit + on tab
// hide. Passing an empty list clears the overlay.
export async function saveInputDraft(instanceId: number | null, edits: Edit[]): Promise<{ ok: true }> {
  const id = validInstance(instanceId);
  if (id == null) return { ok: true };
  const clean = z.array(EditSchema).parse(edits ?? []);
  await upsertDraftInputSheet(id, { edits: clean });
  return { ok: true };
}

// Apply dirty edits → version the xlsx + refresh the helper JSON (disk; unchanged).
export async function saveInputEdits(instanceId: number | null, edits: Edit[]): Promise<{ applied: number }> {
  if (!Array.isArray(edits) || edits.length === 0) return { applied: 0 };
  return writeEdits(validInstance(instanceId), edits);
}

// The confirmed-snapshot payload (or null when never confirmed) — seeds the Confirm
// baseline on mount (blue when null). Reads the per-instance DB record first, falling
// back to the on-disk confirmed snapshot (pre-DB instances / disk-only degrade).
export async function readInputBaseline(instanceId: number | null): Promise<{ payload: InputSheetPayload | null }> {
  const id = validInstance(instanceId);
  if (id != null) {
    const dbPayload = await readConfigInputSheet(id);
    if (dbPayload) return { payload: dbPayload };
  }
  return { payload: await readConfirmedPayload(id) };
}

// Record the current live workbook as the confirmed snapshot (Confirm/Upload).
// Disk snapshot (lossless) is kept; additionally persisted per-instance to
// instance_configurations (finalized JSON) and the draft overlay is cleared so a
// post-confirm refresh reads green (draft == confirmed), mirroring Hub/PkgKpi.
export async function confirmInputSnapshot(instanceId: number | null): Promise<{ payload: InputSheetPayload }> {
  const id = validInstance(instanceId);
  const payload = await writeConfirmedSnapshot(id);
  if (id != null) {
    await upsertConfigInputSheet(id, payload);
    await upsertDraftInputSheet(id, { edits: [] });
  }
  return { payload };
}

// Restore the live workbook from the confirmed snapshot (Revert, through JSON, disk
// lossless). Clears the DB draft overlay so draft == confirmed after a revert.
export async function revertInputSheet(instanceId: number | null): Promise<{ payload: InputSheetPayload }> {
  const id = validInstance(instanceId);
  const payload = await revertToConfirmed(id);
  if (id != null) await upsertDraftInputSheet(id, { edits: [] });
  return { payload };
}

// Download the live workbook — base64 bytes + suggested filename. (Bytes ride the
// server-action boundary as base64; the client rebuilds a Blob and triggers the
// download, matching the old attachment response.)
export async function downloadInputWorkbook(instanceId: number | null): Promise<{ base64: string; filename: string }> {
  const buf = await readWorkbookBuffer(validInstance(instanceId));
  return { base64: buf.toString("base64"), filename: DOWNLOAD_FILENAME };
}

// Replace the live workbook from an uploaded .xlsx (multipart FormData, field
// "file"). Validates structure against the current live workbook before writing.
// (The confirm + per-instance DB write happens via confirmInputSnapshot, which the
// page calls right after — an upload counts as a Confirm.)
export async function uploadInputWorkbook(instanceId: number | null, formData: FormData): Promise<{ ok: true }> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded.");
  const buffer = Buffer.from(await file.arrayBuffer());
  await saveUploadedWorkbook(validInstance(instanceId), buffer);
  return { ok: true };
}
