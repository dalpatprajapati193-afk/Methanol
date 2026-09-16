import prisma from "@/shared/libs/Prisma";
import HierarchySidebar from "./components/HierarchySidebar";
import PageGuard from "@/shared/components/PageGuard";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";
import fs from "fs";
import path from "path";
import InstanceInfo from "./components/instanceInfo/InstanceInfo";
import { JotaiProvider } from "@/shared/libs/JotaiProvider";

export const dynamic = "force-dynamic";

export default async function InstanceExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canUpdate: await checkAccess(userId, "/instance-explorer", "canUpdate"),
    canDelete: await checkAccess(userId, "/instance-explorer", "canDelete"),
  };

  let instances: any[] = [];
  let capabilities: any[] = [];
  let hierarchyTypes: any[] = [];
  let hierarchyMasters: any[] = [];

  try {
    instances = await prisma.instance.findMany({
      include: {
        capability: {
          include: {
            moduleTypeRel: true,
            plantTypeRel: true,
            systemTypeRel: true,
          },
        },
      },
      orderBy: { instanceName: "asc" },
    });

    capabilities = await prisma.capability.findMany({
      include: {
        moduleTypeRel: true,
        plantTypeRel: true,
        systemTypeRel: true,
      },
      orderBy: { capabilityId: "asc" },
    });

    hierarchyTypes = await prisma.hierarchyType.findMany({
      where: { hierarchyTypeName: { not: "global" }, isActive: true },
      orderBy: { sort_id: "asc" },
    });

    hierarchyMasters = await prisma.hierarchyMaster.findMany({
      where: { isActive: true },
    });
  } catch (err) {
    console.warn("[InstanceExplorerLayout Warning]: Database connection fetch failed, using fallbacks:", err);
  }

  // Convert dates and relation types to standard objects to pass to client component securely
  const safeInstances = instances.map((ins) => ({
    ...ins,
    createdAt: ins.createdAt ? (ins.createdAt instanceof Date ? ins.createdAt.toISOString() : String(ins.createdAt)) : new Date().toISOString(),
    hierarchyMasterId: ins.hierarchyMasterId?.toString() || null,
  }));

  const safeCapabilities = capabilities.map((cap) => ({
    ...cap,
    createdAt: cap.createdAt ? (cap.createdAt instanceof Date ? cap.createdAt.toISOString() : String(cap.createdAt)) : new Date().toISOString(),
  }));

  const safeHierarchyTypes = hierarchyTypes.map(t => ({
    ...t,
    hierarchyTypeId: t.hierarchyTypeId ? t.hierarchyTypeId.toString() : "",
    parentHierarchyTypeId: t.parentHierarchyTypeId?.toString() || null,
    createdAt: t.createdAt ? (t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt)) : new Date().toISOString(),
    updatedAt: t.updatedAt ? (t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt)) : new Date().toISOString(),
  }));

  const safeHierarchyMasters = hierarchyMasters.map(m => ({
    ...m,
    hierarchyMasterId: m.hierarchyMasterId ? m.hierarchyMasterId.toString() : "",
    hierarchyTypeId: m.hierarchyTypeId ? m.hierarchyTypeId.toString() : "",
    parentHierarchyId: m.parentHierarchyId?.toString() || null,
    createdAt: m.createdAt ? (m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt)) : new Date().toISOString(),
    updatedAt: m.updatedAt ? (m.updatedAt instanceof Date ? m.updatedAt.toISOString() : String(m.updatedAt)) : new Date().toISOString(),
  }));

  const dashboardsPath = path.join(process.cwd(), "src/app/(authenticated)/instance-explorer/[instance_id]");
  let dashboardFolders: string[] = [];
  try {
    dashboardFolders = fs.readdirSync(dashboardsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("[") && !dirent.name.startsWith("("))
      .map((dirent) => dirent.name);
  } catch (err) {
    console.error("Failed to read dashboard directories", err);
  }

  return (
    <PageGuard resourceId="/instance-explorer">
      <PermissionProvider permissions={permissions}>
        <JotaiProvider>
          <div className="flex h-full w-full gap-6">
            {/* Left Sidebar (Hierarchy) */}
            <HierarchySidebar
              instances={safeInstances}
              capabilities={safeCapabilities}
              dashboardFolders={dashboardFolders}
              hierarchyTypes={safeHierarchyTypes}
              hierarchyMasters={safeHierarchyMasters}
            />

            {/* 70% Right Details (Overview / Dynamic routes) */}
            <section className="flex-1 h-full  bg-background">
              <div className="w-full h-[5%] flex items-center justify-start">
                <InstanceInfo />
              </div>
              <div className="h-[95%] overflow-y-auto">
                {children}
              </div>
            </section>
          </div>
        </JotaiProvider>
      </PermissionProvider>
    </PageGuard>
  );
}
