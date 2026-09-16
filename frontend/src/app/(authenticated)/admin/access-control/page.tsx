import prisma from "@/shared/libs/Prisma";
import ACETable from "./components/ACETable";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";

export const dynamic = "force-dynamic";

export default async function AccessControlPage() {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canCreate: await checkAccess(userId, "/admin", "canCreate"),
    canUpdate: await checkAccess(userId, "/admin", "canUpdate"),
    canDelete: await checkAccess(userId, "/admin", "canDelete"),
  };

  const [groups, resources, mappings] = await Promise.all([
    prisma.securityGroup.findMany({
      where: { isActive: true },
      orderBy: { groupName: "asc" },
    }),
    prisma.resource.findMany({
      where: { isActive: true },
      orderBy: [{ resourceArea: "asc" }, { title: "asc" }],
    }),
    prisma.securityGroupResourceMapping.findMany({
      include: {
        group: true,
        resource: true,
        ace: true,
      },
      orderBy: { group: { groupName: "asc" } },
    }),
  ]);

  // Flatten to ACERow format for the table
  const aceRows = mappings
    .filter((m) => m.ace !== null)
    .map((m) => ({
      mappingId: m.id,
      aceId: m.ace!.aceId,
      groupId: m.groupId,
      groupName: m.group.groupName,
      resourceId: m.resourceId,
      resourceTitle: m.resource.title,
      resourceType: m.resource.resourceType,
      resourceArea: m.resource.resourceArea,
      resourceUrl: m.resource.url,
      canCreate: m.ace!.canCreate,
      canRead: m.ace!.canRead,
      canUpdate: m.ace!.canUpdate,
      canDelete: m.ace!.canDelete,
      isAllowed: m.ace!.isAllowed,
    }));

  return (
    <div className="h-full">
      <PermissionProvider permissions={permissions}>
        <ACETable
          initialRows={aceRows}
          groups={groups.map((g) => ({ id: g.groupId, name: g.groupName }))}
          resources={resources.map((r) => ({
            id: r.resourceId,
            title: r.title,
            resourceType: r.resourceType,
            resourceArea: r.resourceArea,
            url: r.url,
          }))}
        />
      </PermissionProvider>
    </div>
  );
}
