import { ReactNode } from "react";
import { checkAccess, AccessRight } from "@/shared/libs/AccessControl";
import { auth } from "@/auth";

interface ProtectedComponentProps {
  resourceId: string;
  resourceType: string;
  requiredRight?: AccessRight;
  children: ReactNode;
  fallback?: ReactNode;
}

export default async function ProtectedComponent({
  resourceId,
  resourceType,
  requiredRight = "canRead",
  children,
  fallback = null,
}: ProtectedComponentProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return <>{fallback}</>;
  }

  const userId = parseInt(session.user.id, 10);
  if (isNaN(userId)) {
    return <>{fallback}</>;
  }

  const hasAccess = await checkAccess(userId, resourceId, requiredRight);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
