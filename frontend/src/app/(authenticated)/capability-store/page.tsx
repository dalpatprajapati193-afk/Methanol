import prisma from "@/shared/libs/Prisma";
import { CapabilityTable } from "./components/Index";
import type { CapabilityRow } from "./components/CapabilityTable";
import PageGuard from "@/shared/components/PageGuard";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";

export default async function CapabilityStorePage() {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canCreate: await checkAccess(userId, "/capability-store", "canCreate"),
    canUpdate: await checkAccess(userId, "/capability-store", "canUpdate"),
    canDelete: await checkAccess(userId, "/capability-store", "canDelete"),
  };

  const [rawCapabilities, moduleTypes, plantTypes, systemTypes] =
    await Promise.all([
      prisma.capability.findMany({
        include: {
          moduleTypeRel: true,
          plantTypeRel: true,
          systemTypeRel: true,
        },
        orderBy: { capabilityId: "asc" },
      }),
      prisma.moduleType.findMany({ orderBy: { moduleTypeName: "asc" } }),
      prisma.plantType.findMany({ orderBy: { plantTypeName: "asc" } }),
      prisma.systemType.findMany({ orderBy: { systemTypeName: "asc" } }),
    ]);

  // Flatten nested relations into a shape TanStack Table can work with directly
  const capabilities: CapabilityRow[] = rawCapabilities.map((c) => ({
    capabilityId: c.capabilityId,
    moduleType: c.moduleType,
    plantType: c.plantType,
    systemType: c.systemType,
    moduleTypeName: c.moduleTypeRel.moduleTypeName,
    plantTypeName: c.plantTypeRel.plantTypeName,
    systemTypeName: c.systemTypeRel.systemTypeName,
    folderMapping: c.folderMapping,
    isActive: c.isActive,
  }));

  return (
    <PageGuard resourceId="/capability-store">
      <PermissionProvider permissions={permissions}>
        <CapabilityTable
          initialCapabilities={capabilities}
          moduleTypes={moduleTypes.map((m) => ({
            id: m.moduleTypeId,
            name: m.moduleTypeName,
          }))}
          plantTypes={plantTypes.map((p) => ({
            id: p.plantTypeId,
            name: p.plantTypeName,
          }))}
          systemTypes={systemTypes.map((s) => ({
            id: s.systemTypeId,
            name: s.systemTypeName,
          }))}
        />
      </PermissionProvider>
    </PageGuard>
  );
}