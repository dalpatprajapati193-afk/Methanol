import prisma from "@/shared/libs/Prisma";
import ResourcesTable from "./components/ResourcesTable";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canCreate: await checkAccess(userId, "/admin", "canCreate"),
    canUpdate: await checkAccess(userId, "/admin", "canUpdate"),
    canDelete: await checkAccess(userId, "/admin", "canDelete"),
  };

  const resources = await prisma.resource.findMany({
    orderBy: [{ resourceArea: "asc" }, { title: "asc" }],
  });

  return (
    <div className="h-full">
      <PermissionProvider permissions={permissions}>
        <ResourcesTable initialResources={resources} />
      </PermissionProvider>
    </div>
  );
}
