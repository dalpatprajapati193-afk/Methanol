import { ReactNode } from "react";
import { checkAccess, AccessRight } from "@/shared/libs/AccessControl";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface PageGuardProps {
  resourceId: string;       // The URL/resource to gate (e.g. "/admin")
  requiredRight?: AccessRight;
  children: ReactNode;
}

export default async function PageGuard({
  resourceId,
  requiredRight = "canRead",
  children,
}: PageGuardProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const userId = parseInt(session.user.id, 10);
  if (isNaN(userId)) {
    redirect("/api/auth/signin");
  }

  const hasAccess = await checkAccess(userId, resourceId, requiredRight);

  if (!hasAccess) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-background">
        <h1 className="text-4xl font-bold text-accent-red mb-4">403 - Forbidden</h1>
        <p className="text-lg text-text-secondary">
          You do not have permission to access this resource.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
