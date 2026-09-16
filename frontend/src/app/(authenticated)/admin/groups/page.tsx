import prisma from "@/shared/libs/Prisma";
import GroupsTable from "./components/GroupsTable";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canCreate: await checkAccess(userId, "/admin", "canCreate"),
    canUpdate: await checkAccess(userId, "/admin", "canUpdate"),
    canDelete: await checkAccess(userId, "/admin", "canDelete"),
  };

  const groups = await prisma.securityGroup.findMany({
    orderBy: { groupName: 'asc' }
  });

  return (
    <div className="h-full">
      <PermissionProvider permissions={permissions}>
        <GroupsTable initialGroups={groups} />
      </PermissionProvider>
    </div>
  );
}
