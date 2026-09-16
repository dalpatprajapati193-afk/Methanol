import prisma from "@/shared/libs/Prisma";
import MappingsTable from "./components/MappingsTable";
import { auth } from "@/auth";
import { checkAccess } from "@/shared/libs/AccessControl";
import { PermissionProvider } from "@/shared/providers/PermissionProvider";

export const dynamic = "force-dynamic";

export default async function MappingsPage() {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);

  const permissions = {
    canCreate: await checkAccess(userId, "/admin", "canCreate"),
    canUpdate: await checkAccess(userId, "/admin", "canUpdate"),
    canDelete: await checkAccess(userId, "/admin", "canDelete"),
  };

  const [dbMappings, users, groups] = await Promise.all([
    prisma.userGroupMapping.findMany({
      include: {
        user: true,
        group: true,
      },
      orderBy: {
        user: { userName: 'asc' }
      }
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { userName: 'asc' }
    }),
    prisma.securityGroup.findMany({
      where: { isActive: true },
      orderBy: { groupName: 'asc' }
    }),
  ]);

  const initialMappings = dbMappings.map(m => ({
    userId: m.userId,
    groupId: m.groupId,
    userName: m.user.userName,
    userEmail: m.user.userEmail,
    groupName: m.group.groupName,
  }));

  const userLookups = users.map(u => ({ id: u.userId, name: `${u.userName} | ${u.userEmail}` }));
  const groupLookups = groups.map(g => ({ id: g.groupId, name: g.groupName }));

  return (
    <div className="h-full">
      <PermissionProvider permissions={permissions}>
        <MappingsTable 
          initialMappings={initialMappings} 
          users={userLookups} 
          groups={groupLookups} 
        />
      </PermissionProvider>
    </div>
  );
}
