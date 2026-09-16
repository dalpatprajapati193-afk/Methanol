import prisma from "@/shared/libs/Prisma";
import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import Shell from "./Shell";
import type { DraftConfigPayload, UomCatalog } from "./types/Index";

export const metadata = { title: "Ammonia Reformer Config — Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

/**
 * Resolve the instance's Plant name from the `hierarchy_master` tree. The platform models
 * the chain as Region (L0) → Affiliate (L1) → Plant (L2) → System (L3); the Plant is the
 * level-2 node — the same definition the instance-explorer sidebar uses. Walks up the
 * parent chain from the instance's bound node and returns that node's display name, falling
 * back to the instance label when the chain is shorter than a Plant level.
 */
async function resolvePlantName(hierarchyMasterId: bigint | null, fallback: string): Promise<string> {
  const path: string[] = [];
  let currentId: bigint | null = hierarchyMasterId;
  for (let guard = 0; currentId != null && guard < 20; guard++) {
    const node = await prisma.hierarchyMaster.findUnique({
      where: { hierarchyMasterId: currentId },
      select: { hierarchyDisplayName: true, parentHierarchyId: true },
    });
    if (!node) break;
    path.unshift(node.hierarchyDisplayName);
    currentId = node.parentHierarchyId;
  }
  return path[2] ?? fallback;
}

/**
 * Active unit catalog for attribute UOM mapping, grouped by category. Read directly via
 * Prisma in this Server Component (per the "fetch in the RSC, reuse the shared client"
 * convention) from configurations.unit_of_measurement — the single source of truth. An
 * attribute's selectable units are the entries under its blueprint-declared category.
 * Decimal conversion factors are narrowed to number at the RSC→client boundary.
 */
async function loadUomCatalog(): Promise<UomCatalog> {
  const rows = await prisma.unit_of_measurement.findMany({
    where: { is_active: true },
    select: {
      uom_id: true, uom_symbol: true, uom_name: true, category: true,
      ref_uom_id: true, ref_factor: true, ref_offset: true,
    },
    orderBy: [{ category: "asc" }, { uom_id: "asc" }],
  });
  const catalog: UomCatalog = {};
  for (const u of rows) {
    (catalog[u.category] ??= []).push({
      uomId: u.uom_id,
      symbol: u.uom_symbol,
      name: u.uom_name,
      category: u.category,
      refUomId: u.ref_uom_id,
      refFactor: Number(u.ref_factor),
      refOffset: Number(u.ref_offset),
    });
  }
  return catalog;
}

/** A config payload is usable for hydration only if it carries a hierarchy. */
function normalizeConfig(raw: unknown): DraftConfigPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  // Draft shape: { version, systemConfig: { hierarchy, ... }, sensorMapping }.
  if (obj.systemConfig && typeof obj.systemConfig === "object") {
    return obj as unknown as DraftConfigPayload;
  }
  // Snapshot shape (ui_config_data): a raw system-config with a top-level hierarchy.
  if (Array.isArray(obj.hierarchy)) {
    return { version: 1, systemConfig: obj };
  }
  return null;
}

export default async function AmmoniaReformerPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  // Resume precedence (per docs 04/05): live draft → last submitted snapshot → defaults.
  // Read directly via Prisma in this Server Component — no server action for fetching.
  const [instance, draft, uomCatalog] = await Promise.all([
    prisma.instance.findUnique({
      where: { instanceId },
      select: { instanceName: true, hierarchyMasterId: true },
    }),
    prisma.instance_configuration_drafts.findFirst({
      where: { instance_id: instanceId },
      select: { draft_data: true },
    }),
    loadUomCatalog(),
  ]);

  let initialConfig: DraftConfigPayload | null = null;
  let configSource: "draft" | "snapshot" | "default" = "default";
  if (draft?.draft_data) {
    initialConfig = normalizeConfig(draft.draft_data);
    if (initialConfig) configSource = "draft";
  }
  if (!initialConfig) {
    const snap = await prisma.instanceConfiguration.findFirst({
      where: { instanceId },
      select: { ui_config_data: true },
    });
    if (snap?.ui_config_data) {
      initialConfig = normalizeConfig(snap.ui_config_data);
      if (initialConfig) configSource = "snapshot";
    }
  }

  // Plant name comes from the instance's hierarchy (its Plant-level ancestor), not the
  // build-session value. Falls back to the instance label if the chain has no Plant level.
  const instanceName = instance?.instanceName ?? "Ammonia";
  const plantName = await resolvePlantName(instance?.hierarchyMasterId ?? null, instanceName);

  return (
    <JotaiProvider>
      <Shell
        instanceId={instanceId}
        plantName={plantName}
        initialConfig={initialConfig}
        configSource={configSource}
        uomCatalog={uomCatalog}
      />
    </JotaiProvider>
  );
}
